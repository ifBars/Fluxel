//! Launch Commands
//!
//! Commands for application launch state and initialization.

use serde::Serialize;
use std::sync::Mutex;
use tauri::State;

/// Launch info containing workspace path and optional file to open
#[derive(Debug, Clone, Serialize)]
pub struct LaunchInfo {
    /// The workspace/directory path to open
    pub workspace_path: String,
    /// Optional file path to open after workspace loads (when user right-clicks a file)
    pub file_path: Option<String>,
}

/// State for storing launch info from CLI arguments
pub struct LaunchState(pub Mutex<Option<LaunchInfo>>);

impl LaunchState {
    pub fn new() -> Self {
        Self(Mutex::new(None))
    }
}

impl Default for LaunchState {
    fn default() -> Self {
        Self::new()
    }
}

/// A simple greeting command for testing
#[cfg_attr(
    feature = "profiling",
    tracing::instrument(skip(name), fields(category = "workspace"))
)]
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Get the launch info passed via CLI arguments (e.g., from context menu)
/// Returns workspace_path (always a directory) and optionally file_path (when user right-clicked a file)
#[cfg_attr(
    feature = "profiling",
    tracing::instrument(skip(state), fields(category = "workspace"))
)]
#[tauri::command]
pub fn get_launch_path(state: State<LaunchState>) -> Option<LaunchInfo> {
    let mut info = state.0.lock().unwrap();
    info.take()
}
