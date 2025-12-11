use serde_json::Value;
use std::env;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use walkdir::WalkDir;

/// LSP Manager handles the lifecycle and communication with csharp-ls
pub struct LSPManager {
    process: Option<Child>,
    stdin_handle: Option<tokio::process::ChildStdin>,
}

impl LSPManager {
    pub fn new() -> Self {
        Self {
            process: None,
            stdin_handle: None,
        }
    }

    /// Find a solution file within the workspace root (depth-limited to avoid slow walks)
    fn find_solution_file(workspace_root: &Path) -> Option<PathBuf> {
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
    fn find_project_file(workspace_root: &Path) -> Option<PathBuf> {
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

    /// Check if csharp-ls is installed
    async fn check_csharp_ls_installed() -> bool {
        let mut cmd = Command::new("csharp-ls");
        Self::inject_dotnet_tool_path(&mut cmd);

        match cmd.arg("--version").output().await {
            Ok(output) => output.status.success(),
            Err(_) => false,
        }
    }

    /// Install csharp-ls using dotnet tool
    async fn install_csharp_ls() -> Result<(), String> {
        println!("[LSPManager] Installing csharp-ls...");

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
            println!("[LSPManager] csharp-ls installed successfully");
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("Failed to install csharp-ls: {}", stderr))
        }
    }

    /// Start the csharp-ls language server process
    pub async fn start(
        &mut self,
        window: tauri::Window,
        workspace_root: Option<String>,
    ) -> Result<(), String> {
        // If a process is already running, stop it first to avoid MSBuild assembly conflicts
        if self.process.is_some() {
            println!("[LSPManager] Process already running, stopping it first...");
            self.stop().await?;
            // Give the OS time to fully clean up the process
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        }

        println!("[LSPManager] Checking if csharp-ls is installed...");

        // Check if csharp-ls is installed
        if !Self::check_csharp_ls_installed().await {
            println!("[LSPManager] csharp-ls not found, attempting to install...");

            // Try to install it
            Self::install_csharp_ls().await?;

            // Verify installation
            if !Self::check_csharp_ls_installed().await {
                return Err(
                    "Failed to install csharp-ls. Please install manually:\ndotnet tool install --global csharp-ls".to_string()
                );
            }
        } else {
            println!("[LSPManager] csharp-ls is already installed");
        }

        println!("[LSPManager] Starting csharp-ls...");

        let working_dir = workspace_root
            .as_ref()
            .map(|root| PathBuf::from(root))
            .filter(|p| p.is_dir());

        // Try to find solution file first, then fall back to .csproj
        let solution_arg = working_dir
            .as_deref()
            .and_then(|root| Self::find_solution_file(root));

        let project_arg = if solution_arg.is_none() {
            working_dir
                .as_deref()
                .and_then(|root| Self::find_project_file(root))
        } else {
            None
        };

        // Spawn csharp-ls process
        let mut cmd = Command::new("csharp-ls");
        Self::inject_dotnet_tool_path(&mut cmd);

        if let Some(root) = working_dir.as_ref() {
            println!("[LSPManager] Setting working directory to {:?}", root);
            cmd.current_dir(root);
        }

        // Pass solution file with -s flag
        if let Some(solution) = solution_arg.as_ref() {
            println!(
                "[LSPManager] Using solution file {:?} for csharp-ls",
                solution
            );
            cmd.arg("-s").arg(solution);
        } else if let Some(project) = project_arg.as_ref() {
            // Pass project file with -s flag (csharp-ls accepts both)
            println!(
                "[LSPManager] Using project file {:?} for csharp-ls",
                project
            );
            cmd.arg("-s").arg(project);
        } else {
            println!("[LSPManager] No .sln or .csproj found, csharp-ls will auto-discover");
        }

        let mut child = cmd
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            format!(
                "Failed to start csharp-ls. Make sure it's installed via 'dotnet tool install --global csharp-ls'. Error: {}",
                e
            )
        })?;

        // Get stdin handle for sending messages
        let stdin = child.stdin.take().ok_or("Failed to get stdin handle")?;

        // Get stdout handle for receiving messages
        let stdout = child.stdout.take().ok_or("Failed to get stdout handle")?;

        // Get stderr for logging
        let stderr = child.stderr.take().ok_or("Failed to get stderr handle")?;

        self.stdin_handle = Some(stdin);
        self.process = Some(child);

        println!("[LSPManager] csharp-ls started successfully");

        // Spawn task to read stdout
        tokio::spawn(async move {
            Self::handle_stdout(stdout, window.clone()).await;
        });

        // Spawn task to read stderr
        tokio::spawn(async move {
            Self::handle_stderr(stderr).await;
        });

        Ok(())
    }

    /// Stop the language server process
    pub async fn stop(&mut self) -> Result<(), String> {
        println!("[LSPManager] Stopping csharp-ls...");

        if let Some(mut process) = self.process.take() {
            // Kill the process forcefully to ensure cleanup
            if let Err(e) = process.kill().await {
                eprintln!("[LSPManager] Error killing process: {}", e);
            }

            // Wait for the process to actually exit (with timeout)
            let wait_result = tokio::time::timeout(
                std::time::Duration::from_secs(3),
                process.wait()
            ).await;

            match wait_result {
                Ok(Ok(status)) => {
                    println!("[LSPManager] csharp-ls exited with status: {:?}", status);
                }
                Ok(Err(e)) => {
                    eprintln!("[LSPManager] Error waiting for process exit: {}", e);
                }
                Err(_) => {
                    eprintln!("[LSPManager] Timeout waiting for process to exit, force killing...");
                    // On Windows, we might need to force kill
                    #[cfg(target_os = "windows")]
                    {
                        let _ = process.kill().await;
                    }
                }
            }

            self.stdin_handle = None;
            println!("[LSPManager] csharp-ls stopped");
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

    /// Ensure %USERPROFILE%/.dotnet/tools (or $HOME/.dotnet/tools) is on PATH for the child command.
    /// Tauri on Windows may not inherit the user PATH that contains the dotnet global tools directory.
    fn inject_dotnet_tool_path(cmd: &mut Command) {
        if let Some(tool_dir) = Self::dotnet_tool_dir() {
            let mut paths: Vec<std::path::PathBuf> =
                env::split_paths(&env::var_os("PATH").unwrap_or_default()).collect();
            if !paths.iter().any(|p| p.as_os_str() == tool_dir.as_os_str()) {
                paths.push(tool_dir);
            }
            cmd.env("PATH", env::join_paths(paths).unwrap_or_default());
        }
    }

    /// Resolve the dotnet tool directory for the current platform.
    fn dotnet_tool_dir() -> Option<std::path::PathBuf> {
        dirs::home_dir().map(|home| {
            #[cfg(target_os = "windows")]
            {
                home.join(".dotnet").join("tools")
            }
            #[cfg(not(target_os = "windows"))]
            {
                home.join(".dotnet").join("tools")
            }
        })
    }

    /// Handle stdout from the language server
    async fn handle_stdout(stdout: tokio::process::ChildStdout, window: tauri::Window) {
        let mut reader = BufReader::new(stdout);
        let mut content_length: usize = 0;

        loop {
            let mut header_line = String::new();

            match reader.read_line(&mut header_line).await {
                Ok(0) => break, // EOF
                Ok(_) => {}
                Err(e) => {
                    eprintln!("[LSPManager] Error reading stdout: {}", e);
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
                            let _ = window.emit("lsp-message", json);
                        }
                    }
                    Err(e) => {
                        eprintln!("[LSPManager] Error reading message content: {}", e);
                    }
                }
                content_length = 0;
            }
        }

        println!("[LSPManager] stdout closed");
    }

    /// Handle stderr from the language server (for logging)
    async fn handle_stderr(stderr: tokio::process::ChildStderr) {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();

        while let Ok(Some(line)) = lines.next_line().await {
            eprintln!("[csharp-ls stderr] {}", line);
        }

        println!("[LSPManager] stderr closed");
    }
}

/// Global state for the LSP manager
pub struct LSPState {
    pub manager: Arc<Mutex<LSPManager>>,
}

impl LSPState {
    pub fn new() -> Self {
        Self {
            manager: Arc::new(Mutex::new(LSPManager::new())),
        }
    }
}
