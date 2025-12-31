//! Build Commands
//!
//! Commands for building C# projects.

use ignore::WalkBuilder;
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;
use tokio::process::Command;
use tokio::sync::RwLock;

use crate::languages::csharp::parser::{parse_csproj_configurations, BuildConfiguration};

// ============================================================================
// Build Diagnostic Types
// ============================================================================

/// A single diagnostic extracted from build output.
/// Matches the MSBuild output format: `File.cs(line,col): severity CODE: message`
#[derive(Debug, Clone, Serialize)]
pub struct BuildDiagnostic {
    /// Full path to the file containing the diagnostic
    pub file_path: String,
    /// Line number (1-based)
    pub line: u32,
    /// Column number (1-based)
    pub column: u32,
    /// Severity: "error" or "warning"
    pub severity: String,
    /// Diagnostic code (e.g., "CS1002", "CS0168")
    pub code: String,
    /// Human-readable message
    pub message: String,
}

/// Result of a build operation with parsed diagnostics.
#[derive(Debug, Clone, Serialize)]
pub struct BuildResult {
    /// Whether the build succeeded
    pub success: bool,
    /// Raw build output (stdout + stderr combined)
    pub raw_output: String,
    /// Parsed diagnostics from the build output
    pub diagnostics: Vec<BuildDiagnostic>,
    /// Build duration in milliseconds
    pub duration_ms: u64,
}

// ============================================================================
// Build Output Parsing
// ============================================================================

/// Parse MSBuild-format diagnostics from build output.
///
/// Handles lines in the format:
/// - `Program.cs(10,5): error CS1002: ; expected`
/// - `C:\path\to\File.cs(15,8): warning CS0168: Variable is declared but never used`
/// - `/unix/path/File.cs(20,1): error CS0246: Type not found`
///
/// Also handles paths with spaces and special characters.
#[cfg_attr(
    feature = "profiling",
    tracing::instrument(skip(output, workspace_root), fields(category = "file_io"))
)]
fn parse_build_diagnostics(output: &str, workspace_root: &str) -> Vec<BuildDiagnostic> {
    let mut diagnostics = Vec::new();

    // Regex pattern for MSBuild diagnostic format:
    // ... (rest of the comments)
    let pattern =
        regex::Regex::new(r"(?m)^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+(\w+):\s*(.+?)$")
            .expect("Failed to compile diagnostic regex");

    for caps in pattern.captures_iter(output) {
        let raw_path = caps.get(1).map(|m| m.as_str().trim()).unwrap_or("");
        let line: u32 = caps
            .get(2)
            .and_then(|m| m.as_str().parse().ok())
            .unwrap_or(1);
        let column: u32 = caps
            .get(3)
            .and_then(|m| m.as_str().parse().ok())
            .unwrap_or(1);
        let severity = caps
            .get(4)
            .map(|m| m.as_str())
            .unwrap_or("error")
            .to_lowercase();
        let code = caps.get(5).map(|m| m.as_str()).unwrap_or("").to_string();
        let message = caps
            .get(6)
            .map(|m| m.as_str().trim())
            .unwrap_or("")
            .to_string();

        // Normalize the file path
        let file_path = normalize_diagnostic_path(raw_path, workspace_root);

        diagnostics.push(BuildDiagnostic {
            file_path,
            line,
            column,
            severity,
            code,
            message,
        });
    }

    #[cfg(feature = "profiling")]
    tracing::info!("Parsed {} diagnostics from build output", diagnostics.len());

    diagnostics
}

/// Normalize a path from build output to an absolute path.
///
/// Handles:
/// - Already absolute paths (Windows: C:\..., Unix: /...)
/// - Relative paths (resolved against workspace_root)
/// - Windows backslash normalization
fn normalize_diagnostic_path(raw_path: &str, workspace_root: &str) -> String {
    let path = PathBuf::from(raw_path);

    // Check if the path is already absolute
    if path.is_absolute() {
        // On Windows, normalize path separators
        #[cfg(windows)]
        {
            return path.to_string_lossy().replace('/', "\\");
        }
        #[cfg(not(windows))]
        {
            return path.to_string_lossy().to_string();
        }
    }

    // Relative path - resolve against workspace root
    let workspace = PathBuf::from(workspace_root);
    let resolved = workspace.join(&path);

    // Canonicalize if possible, otherwise use the joined path
    match resolved.canonicalize() {
        Ok(canonical) => {
            #[cfg(windows)]
            {
                // Remove Windows UNC prefix (\\?\) if present
                let path_str = canonical.to_string_lossy().to_string();
                if let Some(stripped) = path_str.strip_prefix(r"\\?\") {
                    stripped.to_string()
                } else {
                    path_str
                }
            }
            #[cfg(not(windows))]
            {
                canonical.to_string_lossy().to_string()
            }
        }
        Err(_) => resolved.to_string_lossy().to_string(),
    }
}

/// Cache for project configurations to avoid repeated file system walks
#[derive(Clone, Default)]
pub struct ProjectConfigCache {
    cache: Arc<RwLock<HashMap<String, Vec<BuildConfiguration>>>>,
}

impl ProjectConfigCache {
    pub fn new() -> Self {
        Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn get(&self, workspace_root: &str) -> Option<Vec<BuildConfiguration>> {
        let cache = self.cache.read().await;
        cache.get(workspace_root).cloned()
    }

    pub async fn set(&self, workspace_root: String, configs: Vec<BuildConfiguration>) {
        let mut cache = self.cache.write().await;
        cache.insert(workspace_root, configs);
    }

    #[allow(dead_code)]
    pub async fn clear(&self, workspace_root: &str) {
        let mut cache = self.cache.write().await;
        cache.remove(workspace_root);
    }

    #[allow(dead_code)]
    pub async fn clear_all(&self) {
        let mut cache = self.cache.write().await;
        cache.clear();
    }
}

/// Get available build configurations from a C# project
/// Uses caching to avoid repeated file system walks for the same workspace
#[cfg_attr(
    feature = "profiling",
    tracing::instrument(skip(workspace_root, cache), fields(category = "tauri_command", workspace_root = %workspace_root))
)]
#[tauri::command]
pub async fn get_project_configurations(
    workspace_root: String,
    cache: tauri::State<'_, ProjectConfigCache>,
    trace_parent: Option<String>,
) -> Result<Vec<BuildConfiguration>, String> {
    let _ = trace_parent; // Suppress unused warning
                          // Check cache first
    if let Some(cached_configs) = cache.get(&workspace_root).await {
        #[cfg(feature = "profiling")]
        tracing::info!("Using cached configurations");
        return Ok(cached_configs);
    }

    #[cfg(feature = "profiling")]
    tracing::info!("Starting configuration search");

    let root = PathBuf::from(&workspace_root);
    if !root.is_dir() {
        return Err(format!(
            "Workspace root is not a directory or does not exist: {}",
            workspace_root
        ));
    }

    // Optimize: Check common locations first before doing a full walkdir search
    let csproj_path = {
        // Try to find .csproj in common locations first
        let mut found_path: Option<PathBuf> = None;

        // Check root directory for .csproj files
        if let Ok(entries) = std::fs::read_dir(&root) {
            for entry in entries.flatten() {
                if let Some(ext) = entry.path().extension() {
                    if ext == "csproj" && entry.path().is_file() {
                        found_path = Some(entry.path());
                        break;
                    }
                }
            }
        }

        // If not found in root, check src/ directory
        if found_path.is_none() {
            let src_dir = root.join("src");
            if src_dir.is_dir() {
                if let Ok(entries) = std::fs::read_dir(&src_dir) {
                    for entry in entries.flatten() {
                        if let Some(ext) = entry.path().extension() {
                            if ext == "csproj" && entry.path().is_file() {
                                found_path = Some(entry.path());
                                break;
                            }
                        }
                    }
                }
            }
        }

        // If still not found, fall back to walkdir search (but limit depth and don't follow symlinks)
        found_path.or_else(|| {
            #[cfg(feature = "profiling")]
            let _search_span =
                tracing::info_span!("search_recursive", category = "file_io").entered();

            WalkBuilder::new(&root)
                .max_depth(Some(3))
                .follow_links(false) // Don't follow symlinks for better performance
                .git_ignore(true) // Respect .gitignore
                .build()
                .filter_map(|entry| entry.ok())
                .find(|entry| {
                    entry
                        .path()
                        .extension()
                        .map(|ext| ext == "csproj")
                        .unwrap_or(false)
                        && entry.path().is_file()
                })
                .map(|entry| entry.into_path())
        })
    };

    #[cfg(feature = "profiling")]
    tracing::info!("Parsing configurations");

    let configs = if let Some(csproj) = csproj_path {
        #[cfg(feature = "profiling")]
        tracing::info!("Found .csproj at: {:?}", csproj);
        parse_csproj_configurations(&csproj)?
    } else {
        // No .csproj found, return empty list so the dropdown is hidden
        #[cfg(feature = "profiling")]
        tracing::info!("No .csproj file found");
        vec![]
    };

    // Cache the result
    #[cfg(feature = "profiling")]
    {
        tracing::info!("Caching {} configurations", configs.len());
    }
    cache.set(workspace_root.clone(), configs.clone()).await;

    Ok(configs)
}

/// Build a C# project using dotnet build.
///
/// Returns a structured `BuildResult` containing:
/// - Success status
/// - Raw build output
/// - Parsed diagnostics (errors/warnings with file locations)
/// - Build duration in milliseconds
#[cfg_attr(
    feature = "profiling",
    tracing::instrument(
        skip(workspace_root, configuration),
        fields(
            category = "tauri_command",
            workspace_root = %workspace_root,
            configuration = configuration.as_deref().unwrap_or("default")
        )
    )
)]
#[tauri::command]
pub async fn build_csharp_project(
    workspace_root: String,
    configuration: Option<String>,
    trace_parent: Option<String>,
) -> Result<BuildResult, String> {
    let _ = trace_parent; // Suppress unused warning
    let root = PathBuf::from(&workspace_root);
    if !root.is_dir() {
        return Err(format!(
            "Workspace root is not a directory or does not exist: {}",
            workspace_root
        ));
    }

    println!("[Tauri] Running dotnet build in {:?}", root);

    #[cfg(feature = "profiling")]
    let config_str = configuration.as_deref().unwrap_or("default");
    #[cfg(feature = "profiling")]
    tracing::info!("Starting dotnet build with configuration: {}", config_str);

    let start_time = Instant::now();

    #[cfg(feature = "profiling")]
    tracing::info!("Executing dotnet build command");

    let mut cmd = Command::new("dotnet");
    cmd.arg("build").current_dir(&root);

    // Add configuration flag if specified
    if let Some(ref config) = configuration {
        println!("[Tauri] Using configuration: {}", config);
        cmd.arg("--configuration").arg(config);
    }

    let output = cmd
        .output()
        .await
        .map_err(|err| format!("Failed to execute dotnet build: {err}"))?;

    let duration_ms = start_time.elapsed().as_millis() as u64;

    #[cfg(feature = "profiling")]
    tracing::info!("dotnet build completed in {}ms", duration_ms);

    // parse_build_diagnostics is instrumented internally
    #[cfg(feature = "profiling")]
    tracing::info!("Parsing diagnostics");

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let raw_output = format!("{}{}", stdout, stderr);

    // Parse diagnostics from the combined output
    let diagnostics = parse_build_diagnostics(&raw_output, &workspace_root);

    let success = output.status.success();

    #[cfg(feature = "profiling")]
    {
        let error_count = diagnostics.iter().filter(|d| d.severity == "error").count();
        let warning_count = diagnostics
            .iter()
            .filter(|d| d.severity == "warning")
            .count();
        tracing::info!(
            "Build {} in {}ms: {} errors, {} warnings",
            if success { "succeeded" } else { "failed" },
            duration_ms,
            error_count,
            warning_count
        );
    }

    println!(
        "[Tauri] Build {} in {}ms with {} diagnostics",
        if success { "succeeded" } else { "failed" },
        duration_ms,
        diagnostics.len()
    );

    Ok(BuildResult {
        success,
        raw_output,
        diagnostics,
        duration_ms,
    })
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_error() {
        let output = "Program.cs(10,5): error CS1002: ; expected";
        let diagnostics = parse_build_diagnostics(output, "/project");

        assert_eq!(diagnostics.len(), 1);
        assert_eq!(diagnostics[0].line, 10);
        assert_eq!(diagnostics[0].column, 5);
        assert_eq!(diagnostics[0].severity, "error");
        assert_eq!(diagnostics[0].code, "CS1002");
        assert_eq!(diagnostics[0].message, "; expected");
    }

    #[test]
    fn test_parse_simple_warning() {
        let output = "MyFile.cs(15,8): warning CS0168: Variable is declared but never used";
        let diagnostics = parse_build_diagnostics(output, "/project");

        assert_eq!(diagnostics.len(), 1);
        assert_eq!(diagnostics[0].line, 15);
        assert_eq!(diagnostics[0].column, 8);
        assert_eq!(diagnostics[0].severity, "warning");
        assert_eq!(diagnostics[0].code, "CS0168");
        assert_eq!(
            diagnostics[0].message,
            "Variable is declared but never used"
        );
    }

    #[test]
    fn test_parse_windows_path() {
        let output = r"C:\Users\dev\Project\File.cs(20,1): error CS0246: Type not found";
        let diagnostics = parse_build_diagnostics(output, r"C:\Users\dev\Project");

        assert_eq!(diagnostics.len(), 1);
        assert_eq!(diagnostics[0].line, 20);
        assert_eq!(diagnostics[0].column, 1);
        assert_eq!(diagnostics[0].severity, "error");
        assert_eq!(diagnostics[0].code, "CS0246");
        // On Windows, the path should be normalized
        #[cfg(windows)]
        assert!(diagnostics[0].file_path.contains("File.cs"));
    }

    #[test]
    fn test_parse_path_with_spaces() {
        let output = r"C:\My Projects\Test App\Program.cs(5,3): warning CS0219: Variable assigned but never used";
        let diagnostics = parse_build_diagnostics(output, r"C:\My Projects\Test App");

        assert_eq!(diagnostics.len(), 1);
        assert_eq!(diagnostics[0].line, 5);
        assert_eq!(diagnostics[0].column, 3);
        assert_eq!(diagnostics[0].severity, "warning");
        assert_eq!(diagnostics[0].code, "CS0219");
    }

    #[test]
    fn test_parse_multiple_diagnostics() {
        let output = r#"
Build started...
Program.cs(10,5): error CS1002: ; expected
Program.cs(15,1): error CS0246: Type or namespace 'Foo' not found
Helper.cs(3,10): warning CS0168: Variable declared but never used
Build failed.
"#;
        let diagnostics = parse_build_diagnostics(output, "/project");

        assert_eq!(diagnostics.len(), 3);

        assert_eq!(diagnostics[0].severity, "error");
        assert_eq!(diagnostics[0].code, "CS1002");

        assert_eq!(diagnostics[1].severity, "error");
        assert_eq!(diagnostics[1].code, "CS0246");

        assert_eq!(diagnostics[2].severity, "warning");
        assert_eq!(diagnostics[2].code, "CS0168");
    }

    #[test]
    fn test_parse_no_diagnostics() {
        let output = "Build succeeded.\n    0 Warning(s)\n    0 Error(s)";
        let diagnostics = parse_build_diagnostics(output, "/project");
        assert_eq!(diagnostics.len(), 0);
    }

    #[test]
    fn test_parse_relative_path() {
        let output = "src/Program.cs(10,5): error CS1002: ; expected";
        let diagnostics = parse_build_diagnostics(output, "/project");

        assert_eq!(diagnostics.len(), 1);
        // The path should be resolved against the workspace root
        assert!(diagnostics[0].file_path.contains("Program.cs"));
    }

    #[test]
    fn test_parse_message_with_special_characters() {
        let output = r#"File.cs(1,1): error CS0103: The name 'Console' does not exist in the current context (are you missing a using directive?)"#;
        let diagnostics = parse_build_diagnostics(output, "/project");

        assert_eq!(diagnostics.len(), 1);
        assert!(diagnostics[0].message.contains("Console"));
        assert!(diagnostics[0].message.contains("using directive"));
    }
}
