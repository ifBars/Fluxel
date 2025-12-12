import { invoke } from "@tauri-apps/api/core";

export type ModuleFormat = "Esm" | "CommonJs" | "TypeDefinition" | "Unknown";

export interface ResolveOptions {
    conditions?: string[];
    extensions?: string[];
    preferCjs?: boolean;
}

export interface ResolveResponse {
    resolved_path: string | null;
    format: ModuleFormat;
    matched_export: string | null;
    package_json: string | null;
    warnings: string[];
}

export interface TypingsResponse {
    package_name: string;
    files: string[];
    package_json: string | null;
}

export interface AnalyzeResponse {
    imports: string[];
    exports: string[];
    transformed: string;
}

export async function resolveNodeModule(
    specifier: string,
    importer: string,
    projectRoot: string,
    options?: ResolveOptions
): Promise<ResolveResponse> {
    // Tauri v2 expects camelCase from JS (auto-converts to snake_case in Rust)
    const payload = {
        specifier,
        importer,
        projectRoot,
        conditions: options?.conditions,
        extensions: options?.extensions,
        preferCjs: options?.preferCjs,
    };

    return invoke<ResolveResponse>("resolve_node_module", payload);
}

export async function discoverPackageTypings(
    packageName: string,
    projectRoot: string
): Promise<TypingsResponse> {
    // Tauri v2 expects camelCase from JS (auto-converts to snake_case in Rust)
    return invoke<TypingsResponse>("discover_package_typings", {
        packageName,
        projectRoot,
    });
}

export async function discoverTypingsForPackages(
    packageNames: string[],
    projectRoot: string
): Promise<TypingsResponse[]> {
    const tasks = packageNames.map((pkg) => discoverPackageTypings(pkg, projectRoot));
    return Promise.all(tasks);
}

export async function analyzeModuleGraph(path: string): Promise<AnalyzeResponse> {
    return invoke<AnalyzeResponse>("analyze_module_graph", { path });
}
