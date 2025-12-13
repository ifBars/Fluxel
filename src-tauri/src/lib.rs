// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod commands;
mod languages;
#[cfg(feature = "profiling")]
mod profiling;
mod services;

use commands::LaunchState;
use languages::LSPState;
use services::ProcessManager;

use std::path::PathBuf;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(LSPState::new())
        .manage(LaunchState::new())
        .manage(ProcessManager::new())
        .setup(|app| {
            #[cfg(feature = "profiling")]
            let _setup_span = tracing::span!(tracing::Level::INFO, "tauri_setup").entered();

            // Initialize profiling subsystem (feature-gated)
            #[cfg(feature = "profiling")]
            {
                let _profiler_span = tracing::span!(tracing::Level::INFO, "profiler_init").entered();
                let profiler = profiling::init();
                app.manage(profiler);
            }

            // Check for CLI args (e.g. context menu launch)
            #[cfg(feature = "profiling")]
            let _launch_args_span = tracing::span!(tracing::Level::INFO, "check_launch_args").entered();
            
            if let Some(raw_arg) = std::env::args().nth(1) {
                let mut path = PathBuf::from(&raw_arg);

                if path.is_file() {
                    if let Some(parent) = path.parent() {
                        path = parent.to_path_buf();
                    }
                }

                if path.is_dir() {
                    let normalized = path.to_string_lossy().replace('\\', "/");
                    // Store in state for frontend to pick up
                    if let Some(state) = app.try_state::<LaunchState>() {
                        *state.0.lock().unwrap() = Some(normalized);
                    }
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Launch Commands
            commands::launch::greet,
            commands::launch::get_launch_path,
            // Workspace Commands
            commands::workspace::list_directory_entries,
            commands::workspace::search_files,
            // Build Commands
            commands::build::get_project_configurations,
            commands::build::build_csharp_project,
            // LSP Commands (from languages module)
            languages::csharp::lsp::start_csharp_ls,
            languages::csharp::lsp::send_lsp_message,
            languages::csharp::lsp::stop_csharp_ls,
            // Node Resolution (from services module)
            services::node_resolver::resolve_node_module,
            services::node_resolver::discover_package_typings,
            services::node_resolver::analyze_module_graph,
            // Project Detection
            services::project_detector::detect_project_profile,
            // Batch File Operations (for efficient type loading)
            services::batch_file_reader::batch_read_files,
            services::batch_file_reader::batch_discover_typings,
            services::batch_file_reader::count_package_type_files,
            // Git Commands
            services::git::git_status,
            services::git::git_commit,
            services::git::git_push,
            services::git::git_pull,
            services::git::git_read_file_at_head,
            services::git::git_discard_changes,
            // Profiling Commands (feature-gated)
            #[cfg(feature = "profiling")]
            profiling::commands::profiler_set_enabled,
            #[cfg(feature = "profiling")]
            profiling::commands::profiler_get_status,
            #[cfg(feature = "profiling")]
            profiling::commands::profiler_get_recent_spans,
            #[cfg(feature = "profiling")]
            profiling::commands::profiler_get_attribution,
            #[cfg(feature = "profiling")]
            profiling::commands::profiler_clear,
            // Process Manager Commands
            services::process_manager::register_child_process,
            services::process_manager::unregister_child_process,
            services::process_manager::kill_all_child_processes
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // Handle app exit to clean up child processes
            if let tauri::RunEvent::Exit = event {
                println!("[Tauri] Application exiting, cleaning up child processes...");
                if let Some(pm) = app_handle.try_state::<ProcessManager>() {
                    pm.kill_all();
                }
            }
        });
}
