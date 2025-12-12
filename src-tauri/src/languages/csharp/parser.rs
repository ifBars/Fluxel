//! C# Project File Parser
//!
//! Parses .csproj files to extract build configurations.

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildConfiguration {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_framework: Option<String>,
}

/// Parse .csproj file to extract build configurations
pub fn parse_csproj_configurations(path: &Path) -> Result<Vec<BuildConfiguration>, String> {
    // Read the .csproj file
    let content =
        fs::read_to_string(path).map_err(|e| format!("Failed to read .csproj file: {}", e))?;

    let mut configurations = HashSet::new();
    let mut config_frameworks: std::collections::HashMap<String, Option<String>> =
        std::collections::HashMap::new();

    // Parse XML using simple string matching
    // Look for PropertyGroup elements with Condition attributes
    for line in content.lines() {
        let trimmed = line.trim();

        // Extract configuration from Condition attribute
        // Pattern: Condition="'$(Configuration)|$(Platform)'=='Debug|AnyCPU'"
        // or: Condition=" '$(Configuration)' == 'Debug' "
        if trimmed.contains("<PropertyGroup") && trimmed.contains("Condition") {
            if let Some(config_name) = extract_configuration_from_condition(trimmed) {
                configurations.insert(config_name.clone());

                // Try to find target framework in the following lines
                // This is a simplified approach - in real XML parsing we'd look within the PropertyGroup
                config_frameworks.insert(config_name, None);
            }
        }

        // Also check for TargetFramework within conditional PropertyGroups
        // This is simplified - we're not tracking which PropertyGroup we're in
        if trimmed.contains("<TargetFramework>") {
            if let Some(tf) = extract_target_framework(trimmed) {
                // Store the last seen configuration's framework
                // This is imprecise but works for simple cases
                if let Some(last_config) = configurations.iter().last() {
                    config_frameworks.insert(last_config.clone(), Some(tf));
                }
            }
        }
    }

    // If no configurations found with Condition, return defaults
    if configurations.is_empty() {
        return Ok(vec![
            BuildConfiguration {
                name: "Debug".to_string(),
                target_framework: extract_default_target_framework(&content),
            },
            BuildConfiguration {
                name: "Release".to_string(),
                target_framework: extract_default_target_framework(&content),
            },
        ]);
    }

    // Convert to sorted vector
    let mut result: Vec<BuildConfiguration> = configurations
        .into_iter()
        .map(|name| BuildConfiguration {
            name: name.clone(),
            target_framework: config_frameworks.get(&name).and_then(|opt| opt.clone()),
        })
        .collect();

    result.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(result)
}

/// Extract configuration name from a Condition attribute
fn extract_configuration_from_condition(line: &str) -> Option<String> {
    // Handle: Condition="'$(Configuration)|$(Platform)'=='Debug|AnyCPU'"
    if let Some(start_idx) = line.find("=='") {
        if let Some(config_end) = line[start_idx + 3..].find('|') {
            let config = &line[start_idx + 3..start_idx + 3 + config_end];
            return Some(config.to_string());
        }
    }

    // Handle: Condition=" '$(Configuration)' == 'Debug' "
    if let Some(idx) = line.find("$(Configuration)") {
        // Look for the value after ==
        if let Some(eq_idx) = line[idx..].find("==") {
            let after_eq = &line[idx + eq_idx + 2..];
            // Extract text between quotes
            if let Some(quote1) = after_eq.find('\'') {
                if let Some(quote2) = after_eq[quote1 + 1..].find('\'') {
                    let config = &after_eq[quote1 + 1..quote1 + 1 + quote2];
                    return Some(config.trim().to_string());
                }
            }
            if let Some(quote1) = after_eq.find('"') {
                if let Some(quote2) = after_eq[quote1 + 1..].find('"') {
                    let config = &after_eq[quote1 + 1..quote1 + 1 + quote2];
                    return Some(config.trim().to_string());
                }
            }
        }
    }

    None
}

/// Extract TargetFramework from a line
fn extract_target_framework(line: &str) -> Option<String> {
    if let Some(start) = line.find("<TargetFramework>") {
        if let Some(end) = line.find("</TargetFramework>") {
            let tf = &line[start + 17..end];
            return Some(tf.trim().to_string());
        }
    }
    None
}

/// Extract the default (unconditional) target framework
fn extract_default_target_framework(content: &str) -> Option<String> {
    for line in content.lines() {
        let trimmed = line.trim();
        // Only look for unconditional TargetFramework (not in conditional PropertyGroup)
        if trimmed.contains("<TargetFramework>") && !trimmed.contains("Condition") {
            return extract_target_framework(trimmed);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_configuration_from_condition() {
        let line1 =
            r#"  <PropertyGroup Condition="'$(Configuration)|$(Platform)'=='Debug|AnyCPU'">"#;
        assert_eq!(
            extract_configuration_from_condition(line1),
            Some("Debug".to_string())
        );

        let line2 = r#"  <PropertyGroup Condition=" '$(Configuration)' == 'Release' ">"#;
        assert_eq!(
            extract_configuration_from_condition(line2),
            Some("Release".to_string())
        );
    }

    #[test]
    fn test_extract_target_framework() {
        let line = "    <TargetFramework>net6.0</TargetFramework>";
        assert_eq!(extract_target_framework(line), Some("net6.0".to_string()));
    }
}
