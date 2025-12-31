//! Plugin Loader Service
//!
//! Handles discovery and loading of community plugins from the filesystem.
//! Community plugins are located in ~/.fluxel/plugins/

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Metadata for a community plugin
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommunityPluginMeta {
    /// Unique plugin identifier
    pub id: String,
    /// Human-readable plugin name
    pub name: String,
    /// Semantic version string
    pub version: String,
    /// Plugin description
    pub description: Option<String>,
    /// Plugin author
    pub author: Option<String>,
    /// Entry point file (relative to plugin directory)
    pub main: String,
    /// Activation events
    #[serde(default)]
    pub activation_events: Vec<String>,
    /// Full path to plugin directory
    pub path: String,
}

/// Plugin manifest file structure (package.json style)
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PluginManifest {
    /// Plugin ID (defaults to directory name if not specified)
    id: Option<String>,
    /// Plugin name
    name: String,
    /// Version
    version: String,
    /// Description
    description: Option<String>,
    /// Author
    author: Option<String>,
    /// Main entry point
    #[serde(default = "default_main")]
    main: String,
    /// Activation events
    #[serde(default)]
    activation_events: Vec<String>,
}

fn default_main() -> String {
    "index.js".to_string()
}

/// Discover community plugins in the given plugins directory
///
/// Scans the directory for subdirectories containing a plugin.json manifest.
#[tauri::command]
pub async fn discover_community_plugins(
    plugins_path: String,
) -> Result<Vec<CommunityPluginMeta>, String> {
    let plugins_dir = PathBuf::from(&plugins_path);

    // Create the plugins directory if it doesn't exist
    if !plugins_dir.exists() {
        std::fs::create_dir_all(&plugins_dir)
            .map_err(|e| format!("Failed to create plugins directory: {}", e))?;
        return Ok(Vec::new());
    }

    if !plugins_dir.is_dir() {
        return Err(format!("{} is not a directory", plugins_path));
    }

    let mut plugins = Vec::new();

    // Read directory entries
    let entries = std::fs::read_dir(&plugins_dir)
        .map_err(|e| format!("Failed to read plugins directory: {}", e))?;

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        // Look for plugin.json manifest
        let manifest_path = path.join("plugin.json");
        if !manifest_path.exists() {
            // Also check for package.json as fallback
            let package_json = path.join("package.json");
            if !package_json.exists() {
                continue;
            }
            // Use package.json
            if let Some(meta) = load_plugin_manifest(&package_json, &path) {
                plugins.push(meta);
            }
        } else {
            if let Some(meta) = load_plugin_manifest(&manifest_path, &path) {
                plugins.push(meta);
            }
        }
    }

    println!(
        "[PluginLoader] Discovered {} community plugins in {}",
        plugins.len(),
        plugins_path
    );

    Ok(plugins)
}

/// Load and parse a plugin manifest file
fn load_plugin_manifest(manifest_path: &PathBuf, plugin_dir: &PathBuf) -> Option<CommunityPluginMeta> {
    let content = std::fs::read_to_string(manifest_path).ok()?;
    let manifest: PluginManifest = serde_json::from_str(&content).ok()?;

    // Use directory name as ID if not specified
    let dir_name = plugin_dir
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown");

    let id = manifest.id.unwrap_or_else(|| format!("community.{}", dir_name));

    Some(CommunityPluginMeta {
        id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        author: manifest.author,
        main: manifest.main,
        activation_events: manifest.activation_events,
        path: plugin_dir.to_string_lossy().to_string(),
    })
}

/// Get the default community plugins path for the current user
#[tauri::command]
pub fn get_community_plugins_path() -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let plugins_path = home.join(".fluxel").join("plugins");
    Ok(plugins_path.to_string_lossy().to_string())
}

/// Check if a plugin directory exists and is valid
#[tauri::command]
pub fn validate_plugin_directory(path: String) -> bool {
    let plugin_dir = PathBuf::from(&path);
    if !plugin_dir.is_dir() {
        return false;
    }

    // Check for manifest file
    let has_manifest = plugin_dir.join("plugin.json").exists()
        || plugin_dir.join("package.json").exists();

    has_manifest
}

