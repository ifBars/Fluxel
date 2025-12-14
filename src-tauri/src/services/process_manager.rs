//! Process Manager Service
//!
//! Manages the lifecycle of spawned child processes.
//! This ensures dev servers and other child processes are killed when the app exits.

use std::collections::HashSet;
use std::sync::Mutex;
use tauri::State;

/// Manages the lifecycle of spawned child processes
pub struct ProcessManager {
    /// Set of PIDs being tracked
    tracked_pids: Mutex<HashSet<u32>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            tracked_pids: Mutex::new(HashSet::new()),
        }
    }

    /// Register a child process PID for tracking
    pub fn register(&self, pid: u32) {
        let mut pids = self.tracked_pids.lock().unwrap();
        pids.insert(pid);
        println!("[ProcessManager] Registered PID: {}", pid);
    }

    /// Unregister a child process PID (e.g., after it exits normally)
    pub fn unregister(&self, pid: u32) {
        let mut pids = self.tracked_pids.lock().unwrap();
        pids.remove(&pid);
        println!("[ProcessManager] Unregistered PID: {}", pid);
    }

    /// Kill all tracked processes - called on app exit
    pub fn kill_all(&self) {
        let pids = self.tracked_pids.lock().unwrap();
        if pids.is_empty() {
            println!("[ProcessManager] No tracked processes to kill");
            return;
        }

        println!(
            "[ProcessManager] Killing {} tracked process(es)",
            pids.len()
        );

        for &pid in pids.iter() {
            kill_process_tree(pid);
        }
    }

    /// Kill a specific process by PID
    pub fn kill_pid(&self, pid: u32) {
        kill_process_tree(pid);
        self.unregister(pid);
    }
}

impl Default for ProcessManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Kill a process and all its children
/// On Windows, uses taskkill with /T flag to kill process tree
/// On Unix, uses kill with negative PID to kill process group
fn kill_process_tree(pid: u32) {
    println!("[ProcessManager] Killing process tree for PID: {}", pid);

    #[cfg(target_os = "windows")]
    {
        // Use taskkill with /T to kill all child processes
        // /F = forceful termination, /T = terminate child processes
        let result = std::process::Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .output();

        match result {
            Ok(output) => {
                if output.status.success() {
                    println!(
                        "[ProcessManager] Successfully killed PID {} and children",
                        pid
                    );
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    // Don't log error if process already exited
                    if !stderr.contains("not found") {
                        println!("[ProcessManager] Failed to kill PID {}: {}", pid, stderr);
                    }
                }
            }
            Err(e) => {
                println!(
                    "[ProcessManager] Error executing taskkill for PID {}: {}",
                    pid, e
                );
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        // On Unix, try to kill the process group
        // Negative PID kills the entire process group

        // First try SIGTERM
        let _ = std::process::Command::new("kill")
            .args(["-TERM", &format!("-{}", pid)])
            .output();

        // Give it a moment, then SIGKILL if needed
        std::thread::sleep(std::time::Duration::from_millis(100));

        let _ = std::process::Command::new("kill")
            .args(["-KILL", &format!("-{}", pid)])
            .output();

        println!(
            "[ProcessManager] Sent kill signals to process group {}",
            pid
        );
    }
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Register a child process PID for cleanup on app exit
#[tauri::command]
pub fn register_child_process(pid: u32, state: State<'_, ProcessManager>) {
    state.register(pid);
}

/// Unregister a child process PID (call when process exits normally)
#[tauri::command]
pub fn unregister_child_process(pid: u32, state: State<'_, ProcessManager>) {
    state.unregister(pid);
}

/// Kill all tracked child processes (can be called from frontend on cleanup)
#[tauri::command]
pub fn kill_all_child_processes(state: State<'_, ProcessManager>) {
    state.kill_all();
}
