use crate::services::ProcessManager;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use tauri::{AppHandle, Emitter, Manager, Runtime, State};

#[derive(Clone, serde::Serialize)]
struct TerminalOutput {
    pid: u32,
    data: String,
}

#[derive(Clone, serde::Serialize)]
struct TerminalExit {
    pid: u32,
    code: Option<i32>,
}

#[tauri::command]
pub fn execute_shell_command<R: Runtime>(
    app: AppHandle<R>,
    command: String,
    args: Vec<String>,
    cwd: Option<String>,
    state: State<'_, ProcessManager>,
) -> Result<u32, String> {
    // Build the full command string
    let full_command = if args.is_empty() {
        command
    } else {
        format!("{} {}", command, args.join(" "))
    };

    // Use the system shell to execute commands
    // This allows running shell built-ins (like 'dir', 'echo') and uses PATH resolution
    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = Command::new("cmd");
        c.args(["/C", &full_command]);
        c
    };

    #[cfg(not(target_os = "windows"))]
    let mut cmd = {
        let mut c = Command::new("sh");
        c.args(["-c", &full_command]);
        c
    };

    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }

    // Configure pipes for streaming
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW flag to prevent popup windows for console apps
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn command: {}", e))?;
    let pid = child.id();

    // Register PID
    state.register(pid);

    let stdout = child.stdout.take().ok_or("Failed to open stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to open stderr")?;

    // Spawn thread for stdout
    let app_clone = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for l in reader.lines().map_while(Result::ok) {
            let _ = app_clone.emit("terminal://output", TerminalOutput { pid, data: l });
        }
    });

    // Spawn thread for stderr
    let app_clone = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for l in reader.lines().map_while(Result::ok) {
            // We emit to same event or different?
            // BuildPanel.tsx expects 'error' type for stderr.
            // But let's use a distinct event or just include type in payload.
            // For now, let's use a "terminal://stderr" event to be explicit.
            let _ = app_clone.emit("terminal://stderr", TerminalOutput { pid, data: l });
        }
    });

    // Spawn thread to wait for exit
    let app_clone = app.clone();
    std::thread::spawn(move || {
        let result = child.wait();

        let code = match result {
            Ok(status) => status.code(),
            Err(_) => None,
        };

        // Unregister from process manager (need to get state again inside thread)
        if let Some(pm) = app_clone.try_state::<ProcessManager>() {
            pm.unregister(pid);
        }

        let _ = app_clone.emit("terminal://exit", TerminalExit { pid, code });
    });

    Ok(pid)
}

#[tauri::command]
pub fn kill_shell_process(pid: u32, state: State<'_, ProcessManager>) -> Result<(), String> {
    state.kill_pid(pid);
    Ok(())
}
