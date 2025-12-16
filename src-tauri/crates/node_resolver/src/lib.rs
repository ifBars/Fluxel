//! Node-style module resolver and lightweight module analyzer for Fluxel.
//! Provides Rust-native functions for resolving Node.js modules, discovering package typings,
//! and analyzing module dependency graphs.

use std::collections::HashSet;
use std::fs;

use anyhow::{Context, Result};
use camino::{Utf8Path, Utf8PathBuf};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use swc_core::common::{sync::Lrc, FileName, SourceMap};
use swc_core::ecma::ast::EsVersion;
use swc_core::ecma::ast::{
    Decl, DefaultDecl, ExportDecl, ExportDefaultDecl, ExportDefaultExpr, ExportSpecifier,
    ImportDecl, ModuleDecl, ModuleItem, Pat,
};
use swc_core::ecma::parser::{EsSyntax, Parser, StringInput, Syntax, TsSyntax};
use swc_core::ecma::visit::Visit;
use thiserror::Error;

#[derive(Debug, Error)]
enum ResolveError {
    #[error("specifier is empty")]
    EmptySpecifier,
    #[error("importer path missing")]
    MissingImporter,
    #[error("failed to read package.json: {0}")]
    PackageJson(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolveOptions {
    pub conditions: Vec<String>,
    pub extensions: Vec<String>,
    pub prefer_cjs: bool,
}

impl Default for ResolveOptions {
    fn default() -> Self {
        Self {
            conditions: vec!["import".to_string(), "default".to_string()],
            extensions: vec![
                ".ts".to_string(),
                ".tsx".to_string(),
                ".js".to_string(),
                ".mjs".to_string(),
                ".cjs".to_string(),
            ],
            prefer_cjs: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolveRequest {
    pub specifier: String,
    pub importer: String,
    pub project_root: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ModuleFormat {
    Esm,
    CommonJs,
    TypeDefinition,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolveResponse {
    pub resolved_path: Option<String>,
    pub format: ModuleFormat,
    pub matched_export: Option<String>,
    pub package_json: Option<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypingsResponse {
    pub package_name: String,
    pub files: Vec<String>,
    pub package_json: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyzeResponse {
    pub imports: Vec<String>,
    pub exports: Vec<String>,
    pub transformed: String,
}

/// Resolve a module using Node semantics.
pub fn resolve_module_native(
    req: ResolveRequest,
    options: Option<ResolveOptions>,
) -> Result<ResolveResponse> {
    let opts = options.unwrap_or_default();
    let mut conditions = opts.conditions.clone();
    if opts.prefer_cjs && !conditions.iter().any(|c| c == "require") {
        conditions.insert(0, "require".to_string());
    }
    if req.specifier.trim().is_empty() {
        return Err(ResolveError::EmptySpecifier.into());
    }
    let importer_path = Utf8PathBuf::from(req.importer.clone());
    let importer_dir = importer_path
        .parent()
        .map(|p| p.to_owned())
        .ok_or(ResolveError::MissingImporter)?;
    let project_root = req.project_root.as_ref().map(Utf8PathBuf::from);

    let mut warnings = Vec::new();
    let mut matched_export = None;
    let mut package_json_path = None;

    let normalized_specifier = req.specifier.replace('\\', "/");
    let resolved = if is_relative(&normalized_specifier) || normalized_specifier.starts_with('/') {
        resolve_path_like(&importer_dir, &normalized_specifier, &opts.extensions)
    } else {
        let (pkg_name, subpath) = split_package_specifier(&normalized_specifier);
        let pkg_dir = resolve_package_dir(
            &importer_dir,
            project_root.as_ref().map(|v| v.as_ref()),
            &pkg_name,
        );
        if let Some(pkg_dir) = pkg_dir {
            package_json_path = Some(pkg_dir.join("package.json").to_string());
            let pkg_json = read_package_json(&pkg_dir).ok();
            let export_target = pkg_json
                .as_ref()
                .and_then(|pkg| resolve_exports(pkg, &subpath, &pkg_dir, &conditions));
            if let Some(target) = export_target.clone() {
                matched_export = Some(target.to_string());
                resolve_path_like(&pkg_dir, target.as_str(), &opts.extensions)
            } else {
                // fallback to main/module/types/index
                resolve_pkg_main(&pkg_dir, pkg_json.as_ref(), &opts.extensions)
            }
        } else {
            warnings.push(format!(
                "Package '{}' not found from {:?}",
                pkg_name, importer_dir
            ));
            None
        }
    };

    let format = resolved
        .as_ref()
        .map(|path| detect_format(path))
        .unwrap_or(ModuleFormat::Unknown);

    Ok(ResolveResponse {
        resolved_path: resolved.map(|p| p.to_string()),
        format,
        matched_export,
        package_json: package_json_path,
        warnings,
    })
}

/// Locate .d.ts files for a package.
/// This function checks multiple sources:
/// 1. Export conditions with "types" key
/// 2. Top-level "types" / "typings" fields in package.json
/// 3. Common fallback paths (index.d.ts, dist/index.d.ts, etc.)
/// 4. @types/* fallback packages
/// 5. Recursively discovers related .d.ts files in the same directory
pub fn discover_typings_native(
    package_name: &str,
    project_root: &Utf8Path,
) -> Result<TypingsResponse> {
    let mut files = Vec::new();
    let mut pkg_json_path = None;
    let mut visited_dirs: HashSet<String> = HashSet::new();

    if let Some(pkg_dir) = resolve_package_dir(project_root, Some(project_root), package_name) {
        pkg_json_path = Some(pkg_dir.join("package.json").to_string());

        if let Ok(pkg_json) = read_package_json(&pkg_dir) {
            // 1. Check export conditions for "types" first (modern packages)
            if let Some(exports) = pkg_json.get("exports") {
                // Check root export
                if let Some(types_path) = resolve_exports_types(exports, ".", &pkg_dir) {
                    if types_path.is_file() {
                        files.push(types_path.to_string());
                        // Recursively discover related .d.ts files in the same directory
                        if let Some(parent) = types_path.parent() {
                            discover_dts_in_dir(parent, &mut files, &mut visited_dirs);
                        }
                    }
                }
            }

            // 2. Check top-level "types" / "typings" fields
            if let Some(types) = pkg_json
                .get("types")
                .or_else(|| pkg_json.get("typings"))
                .and_then(|v| v.as_str())
            {
                let candidate = pkg_dir.join(types);
                if candidate.is_file() {
                    files.push(candidate.to_string());
                    // Recursively discover related .d.ts files
                    if let Some(parent) = candidate.parent() {
                        discover_dts_in_dir(parent, &mut files, &mut visited_dirs);
                    }
                }
            }
        }

        // 3. Common fallback paths
        for candidate in [
            "index.d.ts",
            "index.d.mts",
            "dist/index.d.ts",
            "lib/index.d.ts",
            "types/index.d.ts",
            "build/index.d.ts",
        ] {
            let candidate_path = pkg_dir.join(candidate);
            if candidate_path.is_file() {
                files.push(candidate_path.to_string());
                // Recursively discover related .d.ts files
                if let Some(parent) = candidate_path.parent() {
                    discover_dts_in_dir(parent, &mut files, &mut visited_dirs);
                }
            }
        }
    }

    // 4. Try @types fallback
    let types_pkg = format!(
        "@types/{}",
        package_name.trim_start_matches('@').replace('/', "__")
    );
    if let Some(types_dir) = resolve_package_dir(project_root, Some(project_root), &types_pkg) {
        let types_index = types_dir.join("index.d.ts");
        if types_index.is_file() {
            files.push(types_index.to_string());
            pkg_json_path.get_or_insert(types_dir.join("package.json").to_string());
            // Recursively discover all .d.ts files in @types package
            discover_dts_in_dir(&types_dir, &mut files, &mut visited_dirs);
        }
    }

    files.sort();
    files.dedup();

    Ok(TypingsResponse {
        package_name: package_name.to_string(),
        files,
        package_json: pkg_json_path,
    })
}

/// Resolve "types" condition from exports field
fn resolve_exports_types(
    exports: &Value,
    subpath: &str,
    pkg_dir: &Utf8Path,
) -> Option<Utf8PathBuf> {
    // Prioritize "types" condition for type definitions
    let types_conditions = vec![
        "types".to_string(),
        "typings".to_string(),
        "default".to_string(),
    ];

    let target = if subpath == "." {
        select_export_target_with_conditions(exports, &types_conditions)
    } else if let Some(obj) = exports.as_object() {
        let key = format!("./{}", subpath.trim_start_matches("./"));
        if let Some(value) = obj.get(&key) {
            select_export_target_with_conditions(value, &types_conditions)
        } else if let Some(value) = obj.get(".") {
            select_export_target_with_conditions(value, &types_conditions)
        } else {
            None
        }
    } else {
        None
    }?;

    let normalized = pkg_dir.join(target.trim_start_matches("./"));
    Some(normalized)
}

/// Select export target with specific conditions (prioritizing types)
fn select_export_target_with_conditions(value: &Value, conditions: &[String]) -> Option<String> {
    match value {
        Value::String(s) => {
            // Only return if it's a .d.ts file
            if s.ends_with(".d.ts") || s.ends_with(".d.mts") || s.ends_with(".d.cts") {
                Some(s.to_string())
            } else {
                None
            }
        }
        Value::Array(arr) => {
            for entry in arr {
                if let Some(target) = select_export_target_with_conditions(entry, conditions) {
                    return Some(target);
                }
            }
            None
        }
        Value::Object(map) => {
            // First check for "types" specifically
            if let Some(val) = map.get("types") {
                if let Some(target) = select_export_target_with_conditions(val, conditions) {
                    return Some(target);
                }
                // If "types" is a direct string (not necessarily .d.ts in the condition check)
                if let Value::String(s) = val {
                    return Some(s.to_string());
                }
            }
            // Then check other conditions
            for condition in conditions {
                if let Some(val) = map.get(condition) {
                    if let Some(target) = select_export_target_with_conditions(val, conditions) {
                        return Some(target);
                    }
                }
            }
            // Fallback to "default"
            if let Some(default) = map.get("default") {
                return select_export_target_with_conditions(default, conditions);
            }
            None
        }
        _ => None,
    }
}

/// Recursively discover .d.ts files in a directory with depth and file count limits
/// to prevent excessive memory usage during type discovery.
///
/// # Limits
/// - MAX_DEPTH: 2 levels to avoid deep recursion
/// - MAX_FILES_PER_PACKAGE: 50 files to cap memory usage
fn discover_dts_in_dir(dir: &Utf8Path, files: &mut Vec<String>, visited: &mut HashSet<String>) {
    discover_dts_in_dir_impl(dir, files, visited, 0);
}

/// Internal implementation with depth tracking
fn discover_dts_in_dir_impl(
    dir: &Utf8Path,
    files: &mut Vec<String>,
    visited: &mut HashSet<String>,
    depth: usize,
) {
    const MAX_DEPTH: usize = 2;
    const MAX_FILES_PER_PACKAGE: usize = 50;

    // Early exit if limits reached
    if depth > MAX_DEPTH || files.len() >= MAX_FILES_PER_PACKAGE {
        return;
    }

    let dir_str = dir.to_string();
    if visited.contains(&dir_str) {
        return;
    }
    visited.insert(dir_str);

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            // Check file limit on each iteration
            if files.len() >= MAX_FILES_PER_PACKAGE {
                return;
            }

            let path = entry.path();
            if let Some(path_str) = path.to_str() {
                let utf8_path = Utf8PathBuf::from(path_str.replace('\\', "/"));

                if path.is_file() {
                    let name = utf8_path.file_name().unwrap_or("");
                    if name.ends_with(".d.ts")
                        || name.ends_with(".d.mts")
                        || name.ends_with(".d.cts")
                    {
                        files.push(utf8_path.to_string());
                    }
                } else if path.is_dir() && depth < MAX_DEPTH {
                    let subdir_name = utf8_path.file_name().unwrap_or("");
                    // Skip node_modules and hidden directories
                    if subdir_name != "node_modules" && !subdir_name.starts_with('.') {
                        // Recurse with incremented depth
                        discover_dts_in_dir_impl(&utf8_path, files, visited, depth + 1);
                    }
                }
            }
        }
    }
}

/// Parse a module and return its import/export graph. Transformation is currently identity.
pub fn analyze_module_native(module_path: &Utf8Path) -> Result<AnalyzeResponse> {
    let code = fs::read_to_string(module_path)
        .with_context(|| format!("Failed to read {}", module_path))?;

    let cm: Lrc<SourceMap> = Default::default();
    let fm = cm.new_source_file(
        FileName::Custom(module_path.to_string()).into(),
        code.clone(),
    );
    let is_ts = matches!(module_path.extension(), Some("ts" | "tsx" | "mts" | "cts"));
    let syntax = if is_ts {
        Syntax::Typescript(TsSyntax {
            tsx: module_path.extension().map(|e| e == "tsx").unwrap_or(false),
            decorators: true,
            ..Default::default()
        })
    } else {
        Syntax::Es(EsSyntax {
            jsx: true,
            ..Default::default()
        })
    };

    let lexer = swc_core::ecma::parser::lexer::Lexer::new(
        syntax,
        EsVersion::EsNext,
        StringInput::from(&*fm),
        None,
    );
    let mut parser = Parser::new_from(lexer);
    let module = parser
        .parse_module()
        .map_err(|err| anyhow::Error::msg(format!("Parse error: {:?}", err)))?;

    let mut visitor = GraphVisitor::default();
    visitor.visit_module(&module);

    Ok(AnalyzeResponse {
        imports: visitor.imports.into_iter().collect(),
        exports: visitor.exports.into_iter().collect(),
        transformed: code,
    })
}

#[derive(Default)]
struct GraphVisitor {
    imports: HashSet<String>,
    exports: HashSet<String>,
}

impl Visit for GraphVisitor {
    fn visit_module_item(&mut self, item: &ModuleItem) {
        if let ModuleItem::ModuleDecl(decl) = item {
            match decl {
                ModuleDecl::Import(ImportDecl { src, .. }) => {
                    self.imports
                        .insert(src.value.as_str().unwrap_or("").to_string());
                }
                ModuleDecl::ExportDecl(ExportDecl { decl, .. }) => match decl {
                    Decl::Class(c) => {
                        self.exports.insert(c.ident.sym.to_string());
                    }
                    Decl::Fn(f) => {
                        self.exports.insert(f.ident.sym.to_string());
                    }
                    Decl::Var(v) => {
                        for d in &v.decls {
                            collect_pats(&mut self.exports, &d.name);
                        }
                    }
                    _ => {}
                },
                ModuleDecl::ExportAll(export_all) => {
                    self.exports.insert(format!(
                        "*from:{}",
                        export_all.src.value.as_str().unwrap_or("")
                    ));
                }
                ModuleDecl::ExportNamed(named) => {
                    for spec in &named.specifiers {
                        match spec {
                            ExportSpecifier::Named(named) => {
                                let exported = named.exported.as_ref().unwrap_or(&named.orig);
                                match exported {
                                    swc_core::ecma::ast::ModuleExportName::Ident(id) => {
                                        self.exports.insert(id.sym.to_string());
                                    }
                                    swc_core::ecma::ast::ModuleExportName::Str(s) => {
                                        self.exports
                                            .insert(s.value.as_str().unwrap_or("").to_string());
                                    }
                                }
                            }
                            ExportSpecifier::Default(_) => {
                                self.exports.insert("default".to_string());
                            }
                            ExportSpecifier::Namespace(ns) => match &ns.name {
                                swc_core::ecma::ast::ModuleExportName::Ident(id) => {
                                    self.exports.insert(format!("*as:{}", id.sym));
                                }
                                swc_core::ecma::ast::ModuleExportName::Str(s) => {
                                    self.exports
                                        .insert(format!("*as:{}", s.value.as_str().unwrap_or("")));
                                }
                            },
                        }
                    }
                }
                ModuleDecl::ExportDefaultDecl(ExportDefaultDecl { decl, .. }) => match decl {
                    DefaultDecl::Class(c) => {
                        if let Some(id) = &c.ident {
                            self.exports.insert(id.sym.to_string());
                        } else {
                            self.exports.insert("default".to_string());
                        }
                    }
                    DefaultDecl::Fn(f) => {
                        if let Some(id) = &f.ident {
                            self.exports.insert(id.sym.to_string());
                        } else {
                            self.exports.insert("default".to_string());
                        }
                    }
                    DefaultDecl::TsInterfaceDecl(_) => {
                        self.exports.insert("default".to_string());
                    }
                },
                ModuleDecl::ExportDefaultExpr(ExportDefaultExpr { .. }) => {
                    self.exports.insert("default".to_string());
                }
                _ => {}
            }
        }
        swc_core::ecma::visit::Visit::visit_module_item(self, item);
    }
}

fn collect_pats(exports: &mut HashSet<String>, pat: &Pat) {
    match pat {
        Pat::Ident(id) => {
            exports.insert(id.id.sym.to_string());
        }
        Pat::Array(arr) => {
            for elem in arr.elems.iter().flatten() {
                collect_pats(exports, elem);
            }
        }
        Pat::Object(obj) => {
            for prop in &obj.props {
                match prop {
                    swc_core::ecma::ast::ObjectPatProp::KeyValue(kv) => {
                        if let swc_core::ecma::ast::PropName::Ident(id) = &kv.key {
                            exports.insert(id.sym.to_string());
                        }
                    }
                    swc_core::ecma::ast::ObjectPatProp::Assign(assign) => {
                        exports.insert(assign.key.sym.to_string());
                    }
                    swc_core::ecma::ast::ObjectPatProp::Rest(_) => {}
                }
            }
        }
        _ => {}
    }
}

fn is_relative(spec: &str) -> bool {
    spec.starts_with("./") || spec.starts_with("../")
}

fn split_package_specifier(spec: &str) -> (String, String) {
    if let Some(stripped) = spec.strip_prefix("@") {
        if let Some((scope, rest)) = stripped.split_once('/') {
            if let Some((pkg, after)) = rest.split_once('/') {
                return (format!("@{}/{}", scope, pkg), format!("./{}", after));
            } else {
                return (format!("@{}/{}", scope, rest), ".".to_string());
            }
        }
    }

    if let Some((pkg, after)) = spec.split_once('/') {
        (pkg.to_string(), format!("./{}", after))
    } else {
        (spec.to_string(), ".".to_string())
    }
}

fn resolve_package_dir(
    start: &Utf8Path,
    project_root: Option<&Utf8Path>,
    package: &str,
) -> Option<Utf8PathBuf> {
    let mut current = start.to_path_buf();
    loop {
        let candidate = current.join("node_modules").join(package);
        if candidate.exists() {
            return Some(candidate);
        }
        if let Some(root) = project_root {
            if current == root {
                break;
            }
        }
        if !current.pop() {
            break;
        }
    }
    None
}

fn resolve_path_like(
    base: &Utf8Path,
    specifier: &str,
    extensions: &[String],
) -> Option<Utf8PathBuf> {
    let target = if specifier.starts_with('/') {
        Utf8PathBuf::from(specifier)
    } else {
        base.join(specifier)
    };

    resolve_with_extensions(&target, extensions)
}

fn resolve_with_extensions(target: &Utf8Path, extensions: &[String]) -> Option<Utf8PathBuf> {
    if target.is_file() {
        return Some(target.to_owned());
    }

    // Try extension variations
    for ext in extensions {
        let candidate = Utf8PathBuf::from(format!("{}{}", target, ext));
        if candidate.is_file() {
            return Some(candidate);
        }
    }

    // Directory index fallback
    if target.is_dir() {
        for ext in extensions {
            let candidate = target.join(format!("index{}", ext));
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    None
}

fn resolve_pkg_main(
    pkg_dir: &Utf8Path,
    pkg_json: Option<&Value>,
    extensions: &[String],
) -> Option<Utf8PathBuf> {
    if let Some(pkg) = pkg_json {
        if let Some(types) = pkg
            .get("types")
            .or_else(|| pkg.get("typings"))
            .and_then(|v| v.as_str())
        {
            let candidate = pkg_dir.join(types);
            if let Some(resolved) = resolve_with_extensions(&candidate, extensions) {
                return Some(resolved);
            }
        }
        for key in ["module", "main", "browser"] {
            if let Some(entry) = pkg.get(key).and_then(|v| v.as_str()) {
                let candidate = pkg_dir.join(entry);
                if let Some(resolved) = resolve_with_extensions(&candidate, extensions) {
                    return Some(resolved);
                }
            }
        }
    }
    resolve_with_extensions(pkg_dir, extensions)
}

fn resolve_exports(
    pkg: &Value,
    subpath: &str,
    pkg_dir: &Utf8Path,
    conditions: &[String],
) -> Option<Utf8PathBuf> {
    let exports = pkg.get("exports")?;
    let target = if subpath == "." {
        select_export_target(exports, conditions)
    } else if let Some(obj) = exports.as_object() {
        let key = format!("./{}", subpath.trim_start_matches("./"));
        if let Some(value) = obj.get(&key) {
            select_export_target(value, conditions)
        } else {
            // simple star pattern support
            obj.iter().find_map(|(pattern, value)| {
                if let Some(star_pos) = pattern.find('*') {
                    let prefix = &pattern[..star_pos];
                    let suffix = &pattern[star_pos + 1..];
                    if key.starts_with(prefix) && key.ends_with(suffix) {
                        let matched = &key[prefix.len()..key.len() - suffix.len()];
                        let mapped = select_export_target(value, conditions)?;
                        return Some(mapped.replace('*', matched));
                    }
                }
                None
            })
        }
    } else {
        None
    }?;
    let normalized = pkg_dir.join(target.trim_start_matches("./"));
    Some(normalized)
}

fn select_export_target(value: &Value, conditions: &[String]) -> Option<String> {
    match value {
        Value::String(s) => Some(s.to_string()),
        Value::Array(arr) => {
            for entry in arr {
                if let Some(target) = select_export_target(entry, conditions) {
                    return Some(target);
                }
            }
            None
        }
        Value::Object(map) => {
            for condition in conditions {
                if let Some(val) = map.get(condition) {
                    if let Some(target) = select_export_target(val, conditions) {
                        return Some(target);
                    }
                }
            }
            // fallback to "default"
            if let Some(default) = map.get("default") {
                return select_export_target(default, conditions);
            }
            None
        }
        _ => None,
    }
}

fn detect_format(path: &Utf8Path) -> ModuleFormat {
    let path_str = path.as_str();
    if path_str.ends_with(".d.ts") || path_str.ends_with(".d.mts") || path_str.ends_with(".d.cts") {
        return ModuleFormat::TypeDefinition;
    }
    match path.extension() {
        Some("cjs") => ModuleFormat::CommonJs,
        Some("mjs") => ModuleFormat::Esm,
        Some("cts") => ModuleFormat::CommonJs,
        Some("mts") => ModuleFormat::Esm,
        Some("ts") | Some("tsx") => ModuleFormat::Esm,
        Some("js") | Some("jsx") => ModuleFormat::Esm,
        _ => ModuleFormat::Unknown,
    }
}

fn read_package_json(dir: &Utf8Path) -> Result<Value> {
    let pkg_path = dir.join("package.json");
    let content =
        fs::read_to_string(&pkg_path).map_err(|e| ResolveError::PackageJson(format!("{e}")))?;
    let parsed: Value =
        serde_json::from_str(&content).map_err(|e| ResolveError::PackageJson(format!("{e}")))?;
    Ok(parsed)
}
