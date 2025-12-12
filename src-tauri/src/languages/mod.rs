//! Language Server Support Module
//!
//! This module provides infrastructure for managing language servers and
//! language-specific support in Fluxel.
//!
//! ## Structure
//!
//! - `lsp_manager` - Generic LSP manager for process lifecycle and communication
//! - `csharp` - C# language support (csharp-ls)
//!
//! ## Adding New Languages
//!
//! To add support for a new language:
//! 1. Create a new module (e.g., `python.rs`)
//! 2. Implement Tauri commands using the `LSPManager` from `lsp_manager`
//! 3. Export the commands from this module
//! 4. Register the commands in `lib.rs`

pub mod csharp;
pub mod lsp_manager;

// Re-export commonly used types
pub use lsp_manager::LSPState;
