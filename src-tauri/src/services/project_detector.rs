//! Project detection utilities
//!
//! Determines basic project type/capabilities for a workspace root so the frontend can
//! initialize the right language services and tooling (C#/.NET, JS/TS with Bun, etc.).

use crate::languages::lsp_manager::{find_project_file, find_solution_file};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::async_runtime::spawn_blocking;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PackageManager {
    Bun,
    Pnpm,
    Yarn,
    Npm,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProjectKind {
    Dotnet,
    Javascript,
    Mixed,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DotnetInfo {
    pub solution_path: Option<String>,
    pub project_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NodeInfo {
    pub has_package_json: bool,
    pub has_tsconfig: bool,
    pub has_jsconfig: bool,
    pub package_manager: Option<PackageManager>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectProfile {
    pub root_path: String,
    pub kind: ProjectKind,
    pub dotnet: DotnetInfo,
    pub node: NodeInfo,
    /// Suggested build system for "auto" mode.
    pub build_system_hint: Option<String>,
}

fn detect_node_info(root: &Path) -> NodeInfo {
    let has_package_json = root.join("package.json").is_file();
    let has_tsconfig = root.join("tsconfig.json").is_file();
    let has_jsconfig = root.join("jsconfig.json").is_file();

    // Prefer explicit lockfiles over package.json heuristics.
    let package_manager = if root.join("bun.lockb").is_file() || root.join("bun.lock").is_file() {
        Some(PackageManager::Bun)
    } else if root.join("pnpm-lock.yaml").is_file() {
        Some(PackageManager::Pnpm)
    } else if root.join("yarn.lock").is_file() {
        Some(PackageManager::Yarn)
    } else if root.join("package-lock.json").is_file() {
        Some(PackageManager::Npm)
    } else {
        None
    };

    NodeInfo {
        has_package_json,
        has_tsconfig,
        has_jsconfig,
        package_manager,
    }
}

fn detect_dotnet_info(root: &Path) -> DotnetInfo {
    let solution_path = find_solution_file(root)
        .map(|p| p.to_string_lossy().replace('\\', "/"));
    let project_path = find_project_file(root).map(|p| p.to_string_lossy().replace('\\', "/"));

    DotnetInfo {
        solution_path,
        project_path,
    }
}

fn project_kind(dotnet: &DotnetInfo, node: &NodeInfo) -> ProjectKind {
    let has_dotnet = dotnet.solution_path.is_some() || dotnet.project_path.is_some();
    let has_node = node.has_package_json || node.has_tsconfig || node.has_jsconfig;

    match (has_dotnet, has_node) {
        (true, true) => ProjectKind::Mixed,
        (true, false) => ProjectKind::Dotnet,
        (false, true) => ProjectKind::Javascript,
        (false, false) => ProjectKind::Unknown,
    }
}

fn build_system_hint(kind: &ProjectKind, node: &NodeInfo) -> Option<String> {
    match kind {
        ProjectKind::Dotnet => Some("dotnet".to_string()),
        ProjectKind::Javascript => Some(
            match node.package_manager {
                Some(PackageManager::Bun) => "bun",
                Some(PackageManager::Pnpm) => "pnpm",
                Some(PackageManager::Yarn) => "yarn",
                Some(PackageManager::Npm) => "npm",
                None => "bun", // Fluxel defaults to bun in several places
            }
            .to_string(),
        ),
        ProjectKind::Mixed => Some("auto".to_string()),
        ProjectKind::Unknown => None,
    }
}

#[tauri::command]
pub async fn detect_project_profile(workspace_root: String) -> Result<ProjectProfile, String> {
    #[cfg(feature = "profiling")]
    let _span = tracing::span!(tracing::Level::INFO, "detect_project_profile", workspace_root = %workspace_root).entered();
    
    let root = PathBuf::from(&workspace_root);
    if !root.is_dir() {
        return Err(format!(
            "Workspace root is not a directory or does not exist: {}",
            workspace_root
        ));
    }

    #[cfg(feature = "profiling")]
    drop(_span); // Drop span before await to ensure Send trait

    spawn_blocking(move || {
        #[cfg(feature = "profiling")]
        let _blocking_span = tracing::span!(tracing::Level::INFO, "project_detection_blocking").entered();
        
        #[cfg(feature = "profiling")]
        let _dotnet_span = tracing::span!(tracing::Level::DEBUG, "detect_dotnet_info").entered();
        let dotnet = detect_dotnet_info(&root);
        #[cfg(feature = "profiling")]
        drop(_dotnet_span);
        
        #[cfg(feature = "profiling")]
        let _node_span = tracing::span!(tracing::Level::DEBUG, "detect_node_info").entered();
        let node = detect_node_info(&root);
        #[cfg(feature = "profiling")]
        drop(_node_span);
        
        let kind = project_kind(&dotnet, &node);
        let hint = build_system_hint(&kind, &node);

        Ok(ProjectProfile {
            root_path: root.to_string_lossy().replace('\\', "/"),
            kind,
            dotnet,
            node,
            build_system_hint: hint,
        })
    })
    .await
    .map_err(|e| format!("Failed to detect project: {e}"))?
}

