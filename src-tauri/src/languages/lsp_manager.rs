//! Generic LSP Manager for managing language server processes.
//!
//! This module provides a generic `LSPManager` that can be used to manage
//! any LSP-compliant language server. Language-specific implementations
//! (like C#) should use this manager and provide their own configuration.

use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use walkdir::WalkDir;

/// Configuration for starting a language server
#[derive(Debug, Clone)]
pub struct LSPServerConfig {
    /// The command to run the language server
    pub command: String,
    /// Arguments to pass to the language server
    pub args: Vec<String>,
    /// Environment variables to set
    pub env: Vec<(String, String)>,
    /// Working directory for the language server
    pub working_dir: Option<PathBuf>,
    /// Event name to emit LSP messages to the frontend
    pub event_name: String,
}

impl Default for LSPServerConfig {
    fn default() -> Self {
        Self {
            command: String::new(),
            args: Vec::new(),
            env: Vec::new(),
            working_dir: None,
            event_name: "lsp-message".to_string(),
        }
    }
}

/// LSP Manager handles the lifecycle and communication with a language server process
pub struct LSPManager {
    process: Option<Child>,
    stdin_handle: Option<tokio::process::ChildStdin>,
    /// Name of the language server (for logging purposes)
    server_name: String,
}

impl LSPManager {
    pub fn new(server_name: &str) -> Self {
        Self {
            process: None,
            stdin_handle: None,
            server_name: server_name.to_string(),
        }
    }

    /// Check if the language server process is running
    #[allow(dead_code)]
    pub fn is_running(&self) -> bool {
        self.process.is_some()
    }

    /// Start the language server with the given configuration
    pub async fn start_with_config(
        &mut self,
        window: tauri::Window,
        config: LSPServerConfig,
    ) -> Result<(), String> {
        // If a process is already running, stop it first
        if self.process.is_some() {
            println!(
                "[LSPManager:{}] Process already running, stopping it first...",
                self.server_name
            );
            self.stop().await?;
            // Give the OS time to fully clean up the process
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        }

        println!(
            "[LSPManager:{}] Starting language server...",
            self.server_name
        );

        let mut cmd = Command::new(&config.command);

        // Add arguments
        for arg in &config.args {
            cmd.arg(arg);
        }

        // Set environment variables
        for (key, value) in &config.env {
            cmd.env(key, value);
        }

        // Set working directory if specified
        if let Some(ref working_dir) = config.working_dir {
            println!(
                "[LSPManager:{}] Setting working directory to {:?}",
                self.server_name, working_dir
            );
            cmd.current_dir(working_dir);
        }

        let mut child = cmd
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start {}. Error: {}", self.server_name, e))?;

        // Get stdin handle for sending messages
        let stdin = child.stdin.take().ok_or("Failed to get stdin handle")?;

        // Get stdout handle for receiving messages
        let stdout = child.stdout.take().ok_or("Failed to get stdout handle")?;

        // Get stderr for logging
        let stderr = child.stderr.take().ok_or("Failed to get stderr handle")?;

        self.stdin_handle = Some(stdin);
        self.process = Some(child);

        println!(
            "[LSPManager:{}] Language server started successfully",
            self.server_name
        );

        let server_name = self.server_name.clone();
        let event_name = config.event_name.clone();

        // Spawn task to read stdout
        let server_name_stdout = server_name.clone();
        tokio::spawn(async move {
            Self::handle_stdout(stdout, window.clone(), &event_name, &server_name_stdout).await;
        });

        // Spawn task to read stderr
        let server_name_stderr = server_name.clone();
        tokio::spawn(async move {
            Self::handle_stderr(stderr, &server_name_stderr).await;
        });

        Ok(())
    }

    /// Stop the language server process
    pub async fn stop(&mut self) -> Result<(), String> {
        println!(
            "[LSPManager:{}] Stopping language server...",
            self.server_name
        );

        if let Some(mut process) = self.process.take() {
            // Kill the process forcefully to ensure cleanup
            if let Err(e) = process.kill().await {
                eprintln!(
                    "[LSPManager:{}] Error killing process: {}",
                    self.server_name, e
                );
            }

            // Wait for the process to actually exit (with timeout)
            let wait_result =
                tokio::time::timeout(std::time::Duration::from_secs(3), process.wait()).await;

            match wait_result {
                Ok(Ok(status)) => {
                    println!(
                        "[LSPManager:{}] Language server exited with status: {:?}",
                        self.server_name, status
                    );
                }
                Ok(Err(e)) => {
                    eprintln!(
                        "[LSPManager:{}] Error waiting for process exit: {}",
                        self.server_name, e
                    );
                }
                Err(_) => {
                    eprintln!(
                        "[LSPManager:{}] Timeout waiting for process to exit, force killing...",
                        self.server_name
                    );
                    // On Windows, we might need to force kill
                    #[cfg(target_os = "windows")]
                    {
                        let _ = process.kill().await;
                    }
                }
            }

            self.stdin_handle = None;
            println!("[LSPManager:{}] Language server stopped", self.server_name);
        }

        Ok(())
    }

    /// Send an LSP message to the language server
    pub async fn send_message(&mut self, message: String) -> Result<(), String> {
        if let Some(stdin) = &mut self.stdin_handle {
            let content_length = message.len();
            let header = format!("Content-Length: {}\r\n\r\n", content_length);
            let full_message = format!("{}{}", header, message);

            stdin
                .write_all(full_message.as_bytes())
                .await
                .map_err(|e| format!("Failed to write to stdin: {}", e))?;

            stdin
                .flush()
                .await
                .map_err(|e| format!("Failed to flush stdin: {}", e))?;

            Ok(())
        } else {
            Err("Language server stdin not available".to_string())
        }
    }

    /// Handle stdout from the language server
    async fn handle_stdout(
        stdout: tokio::process::ChildStdout,
        window: tauri::Window,
        event_name: &str,
        server_name: &str,
    ) {
        let mut reader = BufReader::new(stdout);
        let mut content_length: usize = 0;

        loop {
            let mut header_line = String::new();

            match reader.read_line(&mut header_line).await {
                Ok(0) => break, // EOF
                Ok(_) => {}
                Err(e) => {
                    eprintln!("[LSPManager:{}] Error reading stdout: {}", server_name, e);
                    break;
                }
            }

            let header_line = header_line.trim();

            // Parse Content-Length header
            if header_line.starts_with("Content-Length:") {
                if let Some(len_str) = header_line.strip_prefix("Content-Length:") {
                    content_length = len_str.trim().parse().unwrap_or(0);
                }
            }
            // Empty line indicates end of headers, content follows
            else if header_line.is_empty() && content_length > 0 {
                // Read exactly content_length bytes from the inner reader
                let mut buffer = vec![0u8; content_length];
                match reader.read_exact(&mut buffer).await {
                    Ok(_) => {
                        // Parse and emit the LSP message to frontend
                        if let Ok(json) = serde_json::from_slice::<Value>(&buffer) {
                            let _ = window.emit(event_name, json);
                        }
                    }
                    Err(e) => {
                        eprintln!(
                            "[LSPManager:{}] Error reading message content: {}",
                            server_name, e
                        );
                    }
                }
                content_length = 0;
            }
        }

        println!("[LSPManager:{}] stdout closed", server_name);
    }

    /// Handle stderr from the language server (for logging)
    async fn handle_stderr(stderr: tokio::process::ChildStderr, server_name: &str) {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();

        while let Ok(Some(line)) = lines.next_line().await {
            eprintln!("[{} stderr] {}", server_name, line);
        }

        println!("[LSPManager:{}] stderr closed", server_name);
    }
}

// =============================================================================
// C# Language Server Specific Helpers
// =============================================================================

/// Find a solution file within the workspace root (depth-limited to avoid slow walks)
pub fn find_solution_file(workspace_root: &Path) -> Option<PathBuf> {
    WalkDir::new(workspace_root)
        .max_depth(3)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .find(|entry| {
            entry
                .path()
                .extension()
                .map(|ext| ext == "sln")
                .unwrap_or(false)
        })
        .map(|entry| entry.into_path())
}

/// Find a .csproj file within the workspace root (fallback when no .sln exists)
pub fn find_project_file(workspace_root: &Path) -> Option<PathBuf> {
    WalkDir::new(workspace_root)
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
        .map(|entry| entry.into_path())
}

/// Resolve the dotnet tool directory for the current platform.
pub fn dotnet_tool_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|home| home.join(".dotnet").join("tools"))
}

/// Get the PATH with dotnet tools directory included
pub fn get_path_with_dotnet_tools() -> Option<String> {
    if let Some(tool_dir) = dotnet_tool_dir() {
        let mut paths: Vec<PathBuf> =
            std::env::split_paths(&std::env::var_os("PATH").unwrap_or_default()).collect();
        if !paths.iter().any(|p| p.as_os_str() == tool_dir.as_os_str()) {
            paths.push(tool_dir);
        }
        std::env::join_paths(paths)
            .ok()
            .and_then(|p| p.into_string().ok())
    } else {
        None
    }
}

/// Check if csharp-ls is installed
pub async fn check_csharp_ls_installed() -> bool {
    let mut cmd = Command::new("csharp-ls");

    // Inject dotnet tool path
    if let Some(path) = get_path_with_dotnet_tools() {
        cmd.env("PATH", path);
    }

    match cmd.arg("--version").output().await {
        Ok(output) => output.status.success(),
        Err(_) => false,
    }
}

/// Install csharp-ls using dotnet tool
pub async fn install_csharp_ls() -> Result<(), String> {
    println!("[LSPManager:csharp-ls] Installing csharp-ls...");

    let output = Command::new("dotnet")
        .args(["tool", "install", "--global", "csharp-ls"])
        .output()
        .await
        .map_err(|e| {
            format!(
                "Failed to run dotnet tool install: {}. Is .NET SDK installed?",
                e
            )
        })?;

    if output.status.success() {
        println!("[LSPManager:csharp-ls] csharp-ls installed successfully");
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed to install csharp-ls: {}", stderr))
    }
}

// =============================================================================
// Global State Management
// =============================================================================

/// Global state for managing language server instances
pub struct LSPState {
    pub manager: Arc<Mutex<LSPManager>>,
}

impl LSPState {
    pub fn new() -> Self {
        Self {
            manager: Arc::new(Mutex::new(LSPManager::new("csharp-ls"))),
        }
    }
}
