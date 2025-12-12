//! Launch Commands
//!
//! Commands for application launch state and initialization.

use std::sync::Mutex;
use tauri::State;

/// State for storing launch path from CLI arguments
pub struct LaunchState(pub Mutex<Option<String>>);

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
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Get the launch path passed via CLI arguments (e.g., from context menu)
#[tauri::command]
pub fn get_launch_path(state: State<LaunchState>) -> Option<String> {
    let mut path = state.0.lock().unwrap();
    path.take()
}
