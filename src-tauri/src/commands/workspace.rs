//! Workspace Commands
//!
//! Commands for directory listing and file search operations.

use ignore::gitignore::GitignoreBuilder;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use tauri::async_runtime::spawn_blocking;

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
#[cfg_attr(
    feature = "profiling",
    tracing::instrument(skip(path, workspace_root), fields(category = "workspace"))
)]
#[tauri::command]
pub async fn list_directory_entries(
    path: String,
    workspace_root: Option<String>,
    max_entries: Option<usize>,
    parent_is_ignored: Option<bool>,
) -> Result<Vec<DirEntry>, String> {
    let max_entries = max_entries.unwrap_or(10_000);
    let path_buf = PathBuf::from(&path);
    let skip_gitignore = parent_is_ignored.unwrap_or(false);

    if !path_buf.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    // Resolve workspace root for gitignore matching; default to the requested path.
    let workspace_root = workspace_root
        .map(PathBuf::from)
        .filter(|p| p.is_dir())
        .unwrap_or_else(|| path_buf.clone());

    let entries = spawn_blocking(move || -> Result<Vec<DirEntry>, String> {
        // If parent is ignored, all children are ignored - skip expensive gitignore checking
        let gitignore = if skip_gitignore {
            None
        } else {
            // Build a gitignore matcher that includes parent patterns up to the workspace root.
            let mut builder = GitignoreBuilder::new(&workspace_root);
            let mut current = path_buf.clone();
            loop {
                let gitignore_path = current.join(".gitignore");
                let _ = builder.add(gitignore_path);

                if current == workspace_root {
                    break;
                }
                if let Some(parent) = current.parent() {
                    current = parent.to_path_buf();
                } else {
                    break;
                }
            }
            builder.build().ok()
        };

        let mut collected: Vec<DirEntry> = Vec::new();

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
                gitignore
                    .as_ref()
                    .map(|g| {
                        g.matched_path_or_any_parents(&child_path, is_directory)
                            .is_ignore()
                    })
                    .unwrap_or(false)
            };

            collected.push(DirEntry {
                name: dir_entry.file_name().to_string_lossy().to_string(),
                path: child_path.to_string_lossy().replace('\\', "/"),
                is_directory,
                is_ignored,
            });
        }

        collected.sort_by(|a, b| {
            if a.is_directory && !b.is_directory {
                std::cmp::Ordering::Less
            } else if !a.is_directory && b.is_directory {
                std::cmp::Ordering::Greater
            } else {
                a.name.to_lowercase().cmp(&b.name.to_lowercase())
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
