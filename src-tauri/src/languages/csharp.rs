//! C# Language Server Support
//!
//! This module provides Tauri commands for managing the C# language server (csharp-ls).
//! It uses the generic LSPManager from the lsp_manager module.

use std::path::PathBuf;

use super::lsp_manager::{
    check_csharp_ls_installed, find_project_file, find_solution_file, get_path_with_dotnet_tools,
    install_csharp_ls, LSPServerConfig, LSPState,
};

/// Start the C# language server (csharp-ls)
///
/// This command will:
/// 1. Check if csharp-ls is installed, and install it if not
/// 2. Find a .sln or .csproj file in the workspace
/// 3. Start the language server with appropriate configuration
#[tauri::command]
pub async fn start_csharp_ls(
    state: tauri::State<'_, LSPState>,
    window: tauri::Window,
    workspace_root: Option<String>,
) -> Result<(), String> {
    println!(
        "[Tauri:csharp] start_csharp_ls called with workspace: {:?}",
        workspace_root
    );

    // Check if csharp-ls is installed
    println!("[Tauri:csharp] Checking if csharp-ls is installed...");
    if !check_csharp_ls_installed().await {
        println!("[Tauri:csharp] csharp-ls not found, attempting to install...");

        // Try to install it
        install_csharp_ls().await?;

        // Verify installation
        if !check_csharp_ls_installed().await {
            return Err(
                "Failed to install csharp-ls. Please install manually:\ndotnet tool install --global csharp-ls".to_string()
            );
        }
    } else {
        println!("[Tauri:csharp] csharp-ls is already installed");
    }

    // Determine working directory
    let working_dir = workspace_root
        .as_ref()
        .map(|root| PathBuf::from(root))
        .filter(|p| p.is_dir());

    // Build arguments - find solution or project file
    let mut args = Vec::new();

    if let Some(ref root) = working_dir {
        // Try to find solution file first, then fall back to .csproj
        if let Some(solution) = find_solution_file(root) {
            println!(
                "[Tauri:csharp] Using solution file {:?} for csharp-ls",
                solution
            );
            args.push("-s".to_string());
            args.push(solution.to_string_lossy().to_string());
        } else if let Some(project) = find_project_file(root) {
            println!(
                "[Tauri:csharp] Using project file {:?} for csharp-ls",
                project
            );
            args.push("-s".to_string());
            args.push(project.to_string_lossy().to_string());
        } else {
            println!("[Tauri:csharp] No .sln or .csproj found, csharp-ls will auto-discover");
        }
    }

    // Build environment with dotnet tools path
    let mut env = Vec::new();
    if let Some(path) = get_path_with_dotnet_tools() {
        env.push(("PATH".to_string(), path));
    }

    // Create LSP server configuration
    let config = LSPServerConfig {
        command: "csharp-ls".to_string(),
        args,
        env,
        working_dir,
        event_name: "lsp-message".to_string(),
    };

    // Start the language server
    let mut manager = state.manager.lock().await;
    manager.start_with_config(window, config).await
}

/// Stop the C# language server
#[tauri::command]
pub async fn stop_csharp_ls(state: tauri::State<'_, LSPState>) -> Result<(), String> {
    println!("[Tauri:csharp] stop_csharp_ls called");
    let mut manager = state.manager.lock().await;
    manager.stop().await
}

/// Send an LSP message to the C# language server
#[tauri::command]
pub async fn send_lsp_message(
    state: tauri::State<'_, LSPState>,
    message: String,
) -> Result<(), String> {
    let mut manager = state.manager.lock().await;
    manager.send_message(message).await
}
