//! Build Commands
//!
//! Commands for building C# projects.

use ignore::WalkBuilder;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::process::Command;
use tokio::sync::RwLock;

use crate::languages::csharp::parser::{parse_csproj_configurations, BuildConfiguration};

/// Cache for project configurations to avoid repeated file system walks
#[derive(Clone, Default)]
pub struct ProjectConfigCache {
    cache: Arc<RwLock<HashMap<String, Vec<BuildConfiguration>>>>,
}

impl ProjectConfigCache {
    pub fn new() -> Self {
        Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn get(&self, workspace_root: &str) -> Option<Vec<BuildConfiguration>> {
        let cache = self.cache.read().await;
        cache.get(workspace_root).cloned()
    }

    pub async fn set(&self, workspace_root: String, configs: Vec<BuildConfiguration>) {
        let mut cache = self.cache.write().await;
        cache.insert(workspace_root, configs);
    }

    #[allow(dead_code)]
    pub async fn clear(&self, workspace_root: &str) {
        let mut cache = self.cache.write().await;
        cache.remove(workspace_root);
    }

    #[allow(dead_code)]
    pub async fn clear_all(&self) {
        let mut cache = self.cache.write().await;
        cache.clear();
    }
}

/// Get available build configurations from a C# project
/// Uses caching to avoid repeated file system walks for the same workspace
#[cfg_attr(
    feature = "profiling",
    tracing::instrument(skip(workspace_root, cache), fields(category = "tauri_command"))
)]
#[tauri::command]
pub async fn get_project_configurations(
    workspace_root: String,
    cache: tauri::State<'_, ProjectConfigCache>,
) -> Result<Vec<BuildConfiguration>, String> {
    // Check cache first
    if let Some(cached_configs) = cache.get(&workspace_root).await {
        return Ok(cached_configs);
    }

    let root = PathBuf::from(&workspace_root);
    if !root.is_dir() {
        return Err(format!(
            "Workspace root is not a directory or does not exist: {}",
            workspace_root
        ));
    }

    // Optimize: Check common locations first before doing a full walkdir search
    let csproj_path = {
        // Try to find .csproj in common locations first
        let mut found_path: Option<PathBuf> = None;

        // Check root directory for .csproj files
        if let Ok(entries) = std::fs::read_dir(&root) {
            for entry in entries.flatten() {
                if let Some(ext) = entry.path().extension() {
                    if ext == "csproj" && entry.path().is_file() {
                        found_path = Some(entry.path());
                        break;
                    }
                }
            }
        }

        // If not found in root, check src/ directory
        if found_path.is_none() {
            let src_dir = root.join("src");
            if src_dir.is_dir() {
                if let Ok(entries) = std::fs::read_dir(&src_dir) {
                    for entry in entries.flatten() {
                        if let Some(ext) = entry.path().extension() {
                            if ext == "csproj" && entry.path().is_file() {
                                found_path = Some(entry.path());
                                break;
                            }
                        }
                    }
                }
            }
        }

        // If still not found, fall back to walkdir search (but limit depth and don't follow symlinks)
        found_path.or_else(|| {
            WalkBuilder::new(&root)
                .max_depth(Some(3))
                .follow_links(false) // Don't follow symlinks for better performance
                .git_ignore(true) // Respect .gitignore
                .build()
                .filter_map(|entry| entry.ok())
                .find(|entry| {
                    entry
                        .path()
                        .extension()
                        .map(|ext| ext == "csproj")
                        .unwrap_or(false)
                        && entry.path().is_file()
                })
                .map(|entry| entry.into_path())
        })
    };

    let configs = if let Some(csproj) = csproj_path {
        parse_csproj_configurations(&csproj)?
    } else {
        // No .csproj found, return empty list so the dropdown is hidden
        vec![]
    };

    // Cache the result
    cache.set(workspace_root.clone(), configs.clone()).await;

    Ok(configs)
}

/// Build a C# project using dotnet build
#[cfg_attr(
    feature = "profiling",
    tracing::instrument(
        skip(workspace_root, configuration),
        fields(category = "tauri_command")
    )
)]
#[tauri::command]
pub async fn build_csharp_project(
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
