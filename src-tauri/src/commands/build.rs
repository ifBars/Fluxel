//! Build Commands
//!
//! Commands for building C# projects.

use std::path::PathBuf;
use tokio::process::Command;

use crate::languages::csharp::parser::{parse_csproj_configurations, BuildConfiguration};

/// Get available build configurations from a C# project
#[tauri::command]
pub async fn get_project_configurations(
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
        parse_csproj_configurations(&csproj)
    } else {
        // No .csproj found, return empty list so the dropdown is hidden
        Ok(vec![])
    }
}

/// Build a C# project using dotnet build
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
