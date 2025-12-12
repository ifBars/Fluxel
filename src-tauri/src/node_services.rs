use camino::Utf8PathBuf;
use fluxel_node_resolver::{
    analyze_module_native, discover_typings_native, resolve_module_native, AnalyzeResponse,
    ResolveOptions, ResolveRequest, ResolveResponse, TypingsResponse,
};

fn build_options(
    conditions: Option<Vec<String>>,
    extensions: Option<Vec<String>>,
    prefer_cjs: Option<bool>,
) -> ResolveOptions {
    let mut opts = ResolveOptions::default();
    if let Some(conds) = conditions {
        if !conds.is_empty() {
            opts.conditions = conds;
        }
    }
    if let Some(exts) = extensions {
        if !exts.is_empty() {
            opts.extensions = exts;
        }
    }
    if let Some(prefer) = prefer_cjs {
        opts.prefer_cjs = prefer;
    }
    opts
}

#[tauri::command]
pub async fn resolve_node_module(
    specifier: String,
    importer: String,
    project_root: Option<String>,
    conditions: Option<Vec<String>>,
    extensions: Option<Vec<String>>,
    prefer_cjs: Option<bool>,
) -> Result<ResolveResponse, String> {
    let opts = build_options(conditions, extensions, prefer_cjs);
    resolve_module_native(
        ResolveRequest {
            specifier,
            importer,
            project_root,
        },
        Some(opts),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn discover_package_typings(
    package_name: String,
    project_root: String,
) -> Result<TypingsResponse, String> {
    let root = Utf8PathBuf::from(project_root.clone());
    discover_typings_native(&package_name, &root).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn analyze_module_graph(path: String) -> Result<AnalyzeResponse, String> {
    let module_path = Utf8PathBuf::from(path);
    analyze_module_native(&module_path).map_err(|e| e.to_string())
}
