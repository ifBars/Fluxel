//! Services Module
//!
//! This module contains general-purpose services used by the Fluxel editor.
//!
//! ## Structure
//!
//! - `batch_file_reader` - Batch file reading for efficient type loading
//! - `git` - Git operations (status, commit, push, pull)
//! - `node_resolver` - Node.js module resolution service
//! - `process_manager` - Child process lifecycle management
//! - `project_detector` - Project type detection

pub mod batch_file_reader;
pub mod git;
pub mod node_resolver;
pub mod process_manager;
pub mod project_detector;

// Re-export commonly used types
pub use process_manager::ProcessManager;
