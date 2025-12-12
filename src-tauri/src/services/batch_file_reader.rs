//! Batch File Reader Service
//!
//! Provides efficient batch file reading operations for the TypeScript type loader.
//! Uses parallel I/O via Tokio to minimize latency when loading many type files.

use camino::Utf8PathBuf;
use fluxel_node_resolver::{discover_typings_native, TypingsResponse};
use futures::future::join_all;
use std::collections::HashMap;
use tokio::fs;

/// Read multiple files in parallel and return their contents.
/// Returns a map of path -> content for successfully read files.
/// Files that fail to read are silently skipped.
#[tauri::command]
pub async fn batch_read_files(paths: Vec<String>) -> Result<HashMap<String, String>, String> {
    let tasks: Vec<_> = paths
        .into_iter()
        .map(|path| async move {
            let content = fs::read_to_string(&path).await.ok()?;
            Some((path, content))
        })
        .collect();

    let results = join_all(tasks).await;
    let map: HashMap<String, String> = results.into_iter().flatten().collect();

    Ok(map)
}

/// Batch discover typings for multiple packages in parallel.
/// More efficient than calling discover_package_typings N times via IPC.
#[tauri::command]
pub async fn batch_discover_typings(
    package_names: Vec<String>,
    project_root: String,
) -> Result<Vec<TypingsResponse>, String> {
    let root = Utf8PathBuf::from(&project_root);

    // Discover typings for each package (this is synchronous but fast)
    let results: Vec<TypingsResponse> = package_names
        .iter()
        .filter_map(|name| discover_typings_native(name, &root).ok())
        .collect();

    Ok(results)
}

/// Get the count of type files that would be loaded for given packages.
/// Useful for progress indication.
#[tauri::command]
pub async fn count_package_type_files(
    package_names: Vec<String>,
    project_root: String,
) -> Result<usize, String> {
    let root = Utf8PathBuf::from(&project_root);

    let total: usize = package_names
        .iter()
        .filter_map(|name| discover_typings_native(name, &root).ok())
        .map(|res| res.files.len())
        .sum();

    Ok(total)
}
