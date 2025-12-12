// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod csproj_parser;
mod git_manager;
mod lsp_manager;
mod node_services;

use csproj_parser::BuildConfiguration;
use ignore::gitignore::GitignoreBuilder;
use lsp_manager::LSPState;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::time::Duration;
use tauri::{async_runtime::spawn_blocking, Emitter, Manager};
use tokio::process::Command;
use tokio::time::sleep;

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

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// List the immediate children of a directory without blocking the UI thread.
/// Runs on a blocking thread pool and applies .gitignore rules (from the provided workspace root) when available.
#[tauri::command]
async fn list_directory_entries(
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

#[tauri::command]
fn search_files(
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
                    match_end: match_end,
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

// ============================================================================
// LSP Commands
// ============================================================================

#[tauri::command]
async fn start_csharp_ls(
    state: tauri::State<'_, LSPState>,
    window: tauri::Window,
    workspace_root: Option<String>,
) -> Result<(), String> {
    println!(
        "[Tauri] start_csharp_ls called with workspace: {:?}",
        workspace_root
    );
    let mut manager = state.manager.lock().await;
    manager.start(window, workspace_root).await
}

#[tauri::command]
async fn send_lsp_message(
    state: tauri::State<'_, LSPState>,
    message: String,
) -> Result<(), String> {
    let mut manager = state.manager.lock().await;
    manager.send_message(message).await
}

#[tauri::command]
async fn stop_csharp_ls(state: tauri::State<'_, LSPState>) -> Result<(), String> {
    let mut manager = state.manager.lock().await;
    manager.stop().await
}

// ============================================================================
// Build Commands
// ============================================================================

#[tauri::command]
async fn get_project_configurations(
    workspace_root: String,
) -> Result<Vec<BuildConfiguration>, String> {
    let root = PathBuf::from(&workspace_root);
    if !root.is_dir() {
        return Err(format!(
            "Workspace root is not a directory or does not exist: {}",
            workspace_root
        ));
    }

    // Find .csproj file in workspace
    let csproj_path = walkdir::WalkDir::new(&root)
        .max_depth(3)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .find(|entry| {
            entry
                .path()
                .extension()
                .map(|ext| ext == "csproj")
                .unwrap_or(false)
        })
        .map(|entry| entry.into_path());

    if let Some(csproj) = csproj_path {
        csproj_parser::parse_csproj_configurations(&csproj)
    } else {
        // No .csproj found, return empty list so the dropdown is hidden
        Ok(vec![])
    }
}

#[tauri::command]
async fn build_csharp_project(
    workspace_root: String,
    configuration: Option<String>,
) -> Result<String, String> {
    let root = PathBuf::from(&workspace_root);
    if !root.is_dir() {
        return Err(format!(
            "Workspace root is not a directory or does not exist: {}",
            workspace_root
        ));
    }

    println!("[Tauri] Running dotnet build in {:?}", root);

    let mut cmd = Command::new("dotnet");
    cmd.arg("build").current_dir(&root);

    // Add configuration flag if specified
    if let Some(config) = configuration {
        println!("[Tauri] Using configuration: {}", config);
        cmd.arg("--configuration").arg(config);
    }

    let output = cmd
        .output()
        .await
        .map_err(|err| format!("Failed to execute dotnet build: {err}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if output.status.success() {
        Ok(format!("{}{}", stdout, stderr))
    } else {
        Err(format!(
            "dotnet build failed (code {:?}):\n{}\n{}",
            output.status.code(),
            stdout,
            stderr
        ))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(LSPState::new())
        .setup(|app| {
            // If the app was launched with a file/folder argument (e.g., from context menu),
            // normalize it to a folder path and emit it to the frontend after the window is ready.
            if let Some(raw_arg) = std::env::args().nth(1) {
                let mut path = PathBuf::from(&raw_arg);

                if path.is_file() {
                    if let Some(parent) = path.parent() {
                        path = parent.to_path_buf();
                    }
                }

                if path.is_dir() {
                    let normalized = path.to_string_lossy().replace('\\', "/");
                    if let Some(window) = app.get_webview_window("main") {
                        tauri::async_runtime::spawn(async move {
                            // Give the frontend a moment to register listeners.
                            sleep(Duration::from_millis(300)).await;
                            let _ = window.emit("external-open", normalized);
                        });
                    }
                } else {
                    println!(
                        "[Tauri] Skipping external-open: provided path is not a directory: {}",
                        raw_arg
                    );
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            list_directory_entries,
            search_files,
            start_csharp_ls,
            send_lsp_message,
            stop_csharp_ls,
            get_project_configurations,
            build_csharp_project,
            node_services::resolve_node_module,
            node_services::discover_package_typings,
            node_services::analyze_module_graph,
            git_manager::git_status,
            git_manager::git_commit,
            git_manager::git_push,
            git_manager::git_pull,
            git_manager::git_read_file_at_head,
            git_manager::git_discard_changes
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
