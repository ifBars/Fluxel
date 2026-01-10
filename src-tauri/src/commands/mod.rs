//! Commands Module
//!
//! This module contains all Tauri commands organized by domain.
//!
//! ## Structure
//!
//! - `workspace` - Directory listing, file search operations
//! - `build` - C# project build commands
//! - `launch` - Application launch state and initialization
//! - `minimax` - MiniMax API proxy commands

pub mod build;
pub mod launch;
pub mod minimax;
pub mod terminal;
pub mod workspace;

// Re-export commonly used types
pub use build::ProjectConfigCache;
pub use launch::LaunchState;
pub use workspace::GitignoreCache;
