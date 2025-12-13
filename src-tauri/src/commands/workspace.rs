//! Workspace Commands
//!
//! Commands for directory listing and file search operations.

use ignore::gitignore::{Gitignore, GitignoreBuilder};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::async_runtime::spawn_blocking;
use tokio::sync::RwLock;

/// Cache for gitignore matchers to avoid rebuilding on every directory listing.
/// Keyed by workspace root path.
#[derive(Clone, Default)]
pub struct GitignoreCache {
    cache: Arc<RwLock<HashMap<String, Arc<Gitignore>>>>,
}

impl GitignoreCache {
    pub fn new() -> Self {
        Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Get a cached gitignore matcher for a workspace, or build and cache a new one.
    pub async fn get_or_build(&self, workspace_root: &str) -> Option<Arc<Gitignore>> {
        // Check cache first
        {
            let cache = self.cache.read().await;
            if let Some(gitignore) = cache.get(workspace_root) {
                return Some(Arc::clone(gitignore));
            }
        }

        // Build a new gitignore matcher
        let root = PathBuf::from(workspace_root);
        let mut builder = GitignoreBuilder::new(&root);

        // Add root .gitignore
        let _ = builder.add(root.join(".gitignore"));

        // Walk up to find parent .gitignore files (for mono-repo support)
        let mut current = root.clone();
        while let Some(parent) = current.parent() {
            if parent == current {
                break;
            }
            let parent_gitignore = parent.join(".gitignore");
            if parent_gitignore.exists() {
                let _ = builder.add(parent_gitignore);
            }
            current = parent.to_path_buf();
        }

        if let Ok(gitignore) = builder.build() {
            let gitignore = Arc::new(gitignore);
            let mut cache = self.cache.write().await;
            cache.insert(workspace_root.to_string(), Arc::clone(&gitignore));
            Some(gitignore)
        } else {
            None
        }
    }

    /// Clear cache for a specific workspace
    #[allow(dead_code)]
    pub async fn clear(&self, workspace_root: &str) {
        let mut cache = self.cache.write().await;
        cache.remove(workspace_root);
    }

    /// Clear entire cache
    #[allow(dead_code)]
    pub async fn clear_all(&self) {
        let mut cache = self.cache.write().await;
        cache.clear();
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchMatch {
    pub file_path: String,
    pub line_number: usize,
    pub line_content: String,
    pub match_start: usize,
    pub match_end: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub matches: Vec<SearchMatch>,
    pub total_files_searched: usize,
    pub total_matches: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    #[serde(rename = "isDirectory")]
    pub is_directory: bool,
    #[serde(rename = "isIgnored")]
    pub is_ignored: bool,
}

/// List the immediate children of a directory without blocking the UI thread.
/// Runs on a blocking thread pool and applies .gitignore rules (from the provided workspace root) when available.
/// Uses cached gitignore matchers for improved performance on repeated calls.
#[cfg_attr(
    feature = "profiling",
    tracing::instrument(skip(path, workspace_root, cache), fields(category = "workspace"))
)]
#[tauri::command]
pub async fn list_directory_entries(
    path: String,
    workspace_root: Option<String>,
    max_entries: Option<usize>,
    parent_is_ignored: Option<bool>,
    cache: tauri::State<'_, GitignoreCache>,
) -> Result<Vec<DirEntry>, String> {
    let max_entries = max_entries.unwrap_or(10_000);
    let path_buf = PathBuf::from(&path);
    let skip_gitignore = parent_is_ignored.unwrap_or(false);

    if !path_buf.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    // Resolve workspace root for gitignore matching; default to the requested path.
    let workspace_root_str = workspace_root
        .as_ref()
        .filter(|p| PathBuf::from(p).is_dir())
        .cloned()
        .unwrap_or_else(|| path.clone());

    // Get cached gitignore matcher (or build and cache a new one)
    let cached_gitignore = if skip_gitignore {
        None
    } else {
        cache.get_or_build(&workspace_root_str).await
    };

    let entries = spawn_blocking(move || -> Result<Vec<DirEntry>, String> {
        // Pre-allocate with a reasonable capacity to reduce allocations
        let mut collected: Vec<DirEntry> = Vec::with_capacity(256);

        for dir_entry in fs::read_dir(&path_buf).map_err(|e| format!("Failed to read dir: {e}"))? {
            if collected.len() >= max_entries {
                break;
            }

            let dir_entry = match dir_entry {
                Ok(entry) => entry,
                Err(_) => continue,
            };

            let file_type = match dir_entry.file_type() {
                Ok(ft) => ft,
                Err(_) => continue,
            };

            let child_path = dir_entry.path();
            let is_directory = file_type.is_dir();

            // If parent is ignored, all children are ignored (skip expensive checking)
            // Otherwise, evaluate gitignore status if matcher is available
            let is_ignored = if skip_gitignore {
                true
            } else {
                cached_gitignore
                    .as_ref()
                    .map(|g| {
                        g.matched_path_or_any_parents(&child_path, is_directory)
                            .is_ignore()
                    })
                    .unwrap_or(false)
            };

            // Optimize string conversions - avoid cloning when possible
            let name = dir_entry.file_name();
            let path_string = child_path.to_string_lossy();
            
            collected.push(DirEntry {
                name: name.to_string_lossy().into_owned(),
                path: if cfg!(windows) {
                    path_string.replace('\\', "/")
                } else {
                    path_string.into_owned()
                },
                is_directory,
                is_ignored,
            });
        }

        // Optimize sorting: directories first, then case-insensitive alphabetical
        // Use lexicographical_cmp for better performance than to_lowercase()
        collected.sort_unstable_by(|a, b| {
            match (a.is_directory, b.is_directory) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => {
                    // Case-insensitive comparison without allocating new strings
                    a.name.chars()
                        .flat_map(|c| c.to_lowercase())
                        .cmp(b.name.chars().flat_map(|c| c.to_lowercase()))
                }
            }
        });

        Ok(collected)
    })
    .await
    .map_err(|e| format!("Failed to join directory listing task: {e}"))??;

    Ok(entries)
}

#[cfg_attr(
    feature = "profiling",
    tracing::instrument(skip(query, root_path), fields(category = "search"))
)]
#[tauri::command]
pub fn search_files(
    query: String,
    root_path: String,
    max_results: Option<usize>,
) -> Result<SearchResult, String> {
    if query.is_empty() {
        return Ok(SearchResult {
            matches: Vec::new(),
            total_files_searched: 0,
            total_matches: 0,
        });
    }

    let root = PathBuf::from(&root_path);
    if !root.exists() || !root.is_dir() {
        return Err(format!(
            "Root path does not exist or is not a directory: {}",
            root_path
        ));
    }

    let max_results = max_results.unwrap_or(1000);
    let mut matches = Vec::new();
    let mut total_files_searched = 0;
    let query_lower = query.to_lowercase();

    // Build gitignore matcher
    let mut builder = ignore::WalkBuilder::new(&root);
    builder.hidden(false); // Don't skip hidden files by default
    builder.git_ignore(true); // Respect .gitignore
    builder.git_exclude(true); // Respect .git/info/exclude
    builder.require_git(false); // Work even without git repo

    // Walk directory respecting gitignore
    for result in builder.build() {
        if matches.len() >= max_results {
            break;
        }

        let entry = match result {
            Ok(entry) => entry,
            Err(_) => continue, // Skip entries we can't read
        };

        let path = entry.path();

        // Skip directories
        if path.is_dir() {
            continue;
        }

        // Skip binary files (basic check)
        if let Some(ext) = path.extension() {
            let ext_str = ext.to_string_lossy().to_lowercase();
            let binary_exts = [
                "png", "jpg", "jpeg", "gif", "ico", "svg", "woff", "woff2", "ttf", "eot", "pdf",
                "zip", "tar", "gz", "7z", "rar", "exe", "dll", "so", "dylib", "bin", "dat", "db",
                "sqlite",
            ];
            if binary_exts.contains(&ext_str.as_str()) {
                continue;
            }
        }

        total_files_searched += 1;

        // Read file and search for matches
        let file = match fs::File::open(path) {
            Ok(f) => f,
            Err(_) => continue, // Skip files we can't read
        };

        let reader = BufReader::new(file);
        let mut line_number = 0;

        for line_result in reader.lines() {
            line_number += 1;

            if matches.len() >= max_results {
                break;
            }

            let line = match line_result {
                Ok(l) => l,
                Err(_) => continue, // Skip lines we can't read
            };

            // Case-insensitive search
            if let Some(pos) = line.to_lowercase().find(&query_lower) {
                let match_end = pos + query.len().min(line.len() - pos);

                matches.push(SearchMatch {
                    file_path: path.to_string_lossy().replace('\\', "/"),
                    line_number,
                    line_content: line.clone(),
                    match_start: pos,
                    match_end,
                });
            }
        }
    }

    Ok(SearchResult {
        total_matches: matches.len(),
        total_files_searched,
        matches,
    })
}
