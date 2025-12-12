/**
 * Monaco TypeScript Type Loader
 * 
 * Loads type definitions from the opened project's node_modules
 * into Monaco Editor's TypeScript language service.
 */

import { readTextFile, readDir } from '@tauri-apps/plugin-fs';
import type * as Monaco from 'monaco-editor';
import { discoverTypingsForPackages } from './nodeResolverService';

// Type alias for Monaco instance
type MonacoInstance = typeof Monaco;

export interface PackageJson {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    types?: string;
    typings?: string;
}

export interface TsConfig {
    compilerOptions?: {
        target?: string;
        module?: string;
        lib?: string[];
        moduleResolution?: string;
        baseUrl?: string;
        paths?: Record<string, string[]>;
        types?: string[];
        typeRoots?: string[];
        esModuleInterop?: boolean;
        allowSyntheticDefaultImports?: boolean;
        skipLibCheck?: boolean;
        strict?: boolean;
        strictNullChecks?: boolean;
        noImplicitAny?: boolean;
        noUnusedLocals?: boolean;
        noUnusedParameters?: boolean;
        noImplicitThis?: boolean;
        alwaysStrict?: boolean;
        useUnknownInCatchVariables?: boolean;
    };
    include?: string[];
    exclude?: string[];
}

/**
 * Cache for loaded type definition URIs to avoid duplicates
 */
const loadedTypeUris = new Set<string>();

/**
 * Track which project is currently loaded to prevent duplicate loading
 */
let currentLoadedProject: string | null = null;
let isLoadingTypes = false;

/**
 * Normalize path separators for cross-platform compatibility
 */
export function normalizePath(path: string): string {
    return path.replace(/\\/g, '/');
}

/**
 * Convert a file path to a proper file:/// URI for Monaco's VFS
 * This MUST match the exact format that monaco.Uri.file().toString() produces:
 * - file:///c%3A/path (lowercase drive letter, URL-encoded colon)
 */
export function toFileUri(path: string): string {
    const normalized = normalizePath(path);
    // Windows paths like C:/... need file:///c%3A/... to match monaco.Uri.file() format
    const windowsDriveMatch = normalized.match(/^([A-Za-z]):/);
    if (windowsDriveMatch) {
        const driveLetter = windowsDriveMatch[1].toLowerCase();
        const restOfPath = normalized.slice(2); // Skip "C:"
        return `file:///${driveLetter}%3A${restOfPath}`;
    }
    // Unix paths like /home/... need file:///home/...
    return `file://${normalized}`;
}

/**
 * Read and parse package.json
 */
async function readPackageJson(projectRoot: string): Promise<PackageJson | null> {
    try {
        const content = await readTextFile(normalizePath(`${projectRoot}/package.json`));
        return JSON.parse(content) as PackageJson;
    } catch (error) {
        // Silent failure is expected for non-Node projects
        return null;
    }
}

/**
 * Read and parse tsconfig.json
 */
export async function readTsConfig(projectRoot: string): Promise<TsConfig | null> {
    try {
        const content = await readTextFile(normalizePath(`${projectRoot}/tsconfig.json`));
        return JSON.parse(content) as TsConfig;
    } catch (error) {
        // Silent failure is expected for non-TS projects
        return null;
    }
}

/**
 * Check if a file exists
 */
export async function fileExists(path: string): Promise<boolean> {
    try {
        await readTextFile(path);
        return true;
    } catch {
        return false;
    }
}

/**
 * Read a directory and return entries
 */
export async function readDirectory(path: string): Promise<Array<{ name: string; isDirectory: boolean }>> {
    try {
        const entries = await readDir(path);
        return entries.map(entry => ({
            name: entry.name,
            isDirectory: entry.isDirectory,
        }));
    } catch {
        return [];
    }
}

/**
 * Find type definition files in a package directory
 */
async function findTypeDefinitions(
    packagePath: string,
    packageName: string
): Promise<string[]> {
    const typeFiles: string[] = [];

    // Check for package.json types/typings field
    try {
        const pkgJsonPath = normalizePath(`${packagePath}/package.json`);
        const pkgContent = await readTextFile(pkgJsonPath);
        const pkg = JSON.parse(pkgContent) as PackageJson;

        if (pkg.types) {
            const typesPath = normalizePath(`${packagePath}/${pkg.types}`);
            if (await fileExists(typesPath)) {
                typeFiles.push(typesPath);
            }
        }
        if (pkg.typings) {
            const typingsPath = normalizePath(`${packagePath}/${pkg.typings}`);
            if (await fileExists(typingsPath)) {
                typeFiles.push(typingsPath);
            }
        }
    } catch {
        // Ignore errors
    }

    // Check common type definition locations
    const commonPaths = [
        'index.d.ts',
        'index.d.mts',
        `${packageName}.d.ts`,
        'types/index.d.ts',
        'dist/index.d.ts',
        'lib/index.d.ts',
    ];

    for (const relPath of commonPaths) {
        const fullPath = normalizePath(`${packagePath}/${relPath}`);
        if (await fileExists(fullPath)) {
            typeFiles.push(fullPath);
        }
    }

    return typeFiles;
}

/**
 * Recursively find all .d.ts files in a directory
 */
async function findAllTypeFiles(dirPath: string): Promise<string[]> {
    const typeFiles: string[] = [];

    try {
        const entries = await readDirectory(dirPath);

        for (const entry of entries) {
            const fullPath = normalizePath(`${dirPath}/${entry.name}`);

            if (entry.isDirectory) {
                // Skip node_modules subdirectories to avoid infinite recursion
                if (entry.name === 'node_modules') {
                    continue;
                }
                // Recursively search subdirectories
                const subFiles = await findAllTypeFiles(fullPath);
                typeFiles.push(...subFiles);
            } else if (entry.name.endsWith('.d.ts') || entry.name.endsWith('.d.mts')) {
                typeFiles.push(fullPath);
            }
        }
    } catch (error) {
        // Silently skip directories we can't read
    }

    return typeFiles;
}

/**
 * Load type definitions from @types packages
 */
async function loadTypesPackages(
    projectRoot: string,
    monaco: MonacoInstance,
    tsConfig: TsConfig | null
): Promise<void> {
    const typesPath = normalizePath(`${projectRoot}/node_modules/@types`);

    // Check if @types directory exists
    const entries = await readDirectory(typesPath);
    if (entries.length === 0) {
        return;
    }

    const compilerOptions = tsConfig?.compilerOptions;
    const configuredTypes = compilerOptions?.types?.filter(Boolean) ?? null;
    const configuredLibs = (compilerOptions?.lib ?? []).map(lib => lib.toLowerCase());
    const hasDomLib = configuredLibs.some(lib => lib.includes('dom'));

    const allowedTypePackages = configuredTypes
        ? new Set(
            configuredTypes.map(typeName => {
                const normalized = typeName.replace(/^@types\//, '');
                const lastSegment = normalized.split('/').pop() ?? normalized;
                return lastSegment;
            })
        )
        : null;

    // Load each @types package
    for (const entry of entries) {
        if (!entry.isDirectory) continue;

        // If tsconfig specifies "types", only load those packages.
        if (allowedTypePackages && !allowedTypePackages.has(entry.name)) {
            continue;
        }

        // Heuristic: for browser/DOM projects, don't load @types/node globals
        // unless explicitly requested via compilerOptions.types.
        if (!allowedTypePackages && hasDomLib && entry.name === 'node') {
            continue;
        }

        const packagePath = normalizePath(`${typesPath}/${entry.name}`);

        // Find all type definition files in the package
        const typeFiles = await findAllTypeFiles(packagePath);

        // Also check for package.json specified types
        const pkgTypeFiles = await findTypeDefinitions(packagePath, entry.name);
        const allTypeFiles = [...new Set([...typeFiles, ...pkgTypeFiles])];

        for (const typeFile of allTypeFiles) {
            // Use the shared addExtraLibFromFile function for consistent handling
            await addExtraLibFromFile(typeFile, monaco, `@types/${entry.name}`);
        }
    }
}


/**
 * Convert an absolute path to a virtual node_modules path that Monaco understands
 * for module resolution. Monaco expects types at paths like:
 * - file:///node_modules/react/index.d.ts
 * - file:///node_modules/@types/react/index.d.ts
 */
function toVirtualNodeModulesPath(absolutePath: string): string | null {
    const normalized = normalizePath(absolutePath);
    // Use the real absolute URI so TS resolution sees the actual path on disk
    return toFileUri(normalized);
}

async function addExtraLibFromFile(path: string, monaco: MonacoInstance, packageName?: string): Promise<void> {
    const normalizedPath = normalizePath(path);

    // Get the virtual node_modules path for Monaco's module resolution
    const virtualPath = toVirtualNodeModulesPath(normalizedPath);

    // Skip if we've already loaded this type (check by virtual path first, then absolute)
    if (virtualPath && loadedTypeUris.has(virtualPath)) return;

    // Also get the full file URI for completeness
    const fileUri = toFileUri(normalizedPath);
    if (loadedTypeUris.has(fileUri)) return;

    try {
        const content = await readTextFile(normalizedPath);

        // PRIMARY: Register with virtual node_modules path for module resolution
        // This is what Monaco TypeScript uses to resolve imports like 'react-router-dom'
        if (virtualPath) {
            monaco.typescript.typescriptDefaults.addExtraLib(content, virtualPath);
            loadedTypeUris.add(virtualPath);
        }

        // SECONDARY: Also add with absolute file URI for editor features (go-to-definition)
        // Only add if it's a different URI to avoid duplicates
        if (fileUri !== virtualPath) {
            monaco.typescript.typescriptDefaults.addExtraLib(content, fileUri);
            loadedTypeUris.add(fileUri);
        }

        // DIAGNOSTIC: Log first few type additions
        if (loadedTypeUris.size <= 10) {
            console.log(`[TypeLoader] Added: ${packageName || 'unknown'} -> ${virtualPath || fileUri}`);
        }
    } catch (error) {
        console.warn(`[TypeLoader] Failed to load type file ${normalizedPath}:`, error);
    }
}

async function loadResolverTypings(
    projectRoot: string,
    packageNames: string[],
    monaco: MonacoInstance,
    collectReferences: boolean = false
): Promise<Set<string>> {
    const referencedPackages = new Set<string>();
    if (packageNames.length === 0) return referencedPackages;

    console.log(`[TypeLoader] Loading types for ${packageNames.length} packages...`);
    let loadedPackages = 0;
    let totalFiles = 0;

    try {
        const responses = await discoverTypingsForPackages(packageNames, projectRoot);
        for (const res of responses) {
            if (res.files.length > 0) {
                loadedPackages++;

                if (collectReferences) {
                    const filesForRefs = res.files
                        .filter(f => f.endsWith('.d.ts') || f.endsWith('.d.mts') || f.endsWith('.d.cts'))
                        .slice(0, 3);
                    for (const file of filesForRefs) {
                        try {
                            const content = await readTextFile(normalizePath(file));
                            for (const root of extractBarePackageRoots(content)) {
                                referencedPackages.add(root);
                            }
                        } catch {
                            // ignore
                        }
                    }
                }

                for (const file of res.files) {
                    await addExtraLibFromFile(file, monaco, res.package_name);
                    totalFiles++;
                }
            }
            // Ensure TS can read package.json for modern packages with exports/types
            await addPackageJsonForPackage(projectRoot, res.package_name, monaco);
        }

        console.log(`[TypeLoader] Loaded ${totalFiles} type files from ${loadedPackages}/${packageNames.length} packages`);
    } catch (error) {
        console.warn('[TypeLoader] Resolver typings failed:', error);
    }

    return referencedPackages;
}

/**
 * Load type definitions from regular packages that include types
 */
async function loadPackageTypes(
    projectRoot: string,
    packageNames: string[],
    monaco: MonacoInstance
): Promise<void> {
    for (const packageName of packageNames) {
        // Skip @types packages (handled separately)
        if (packageName.startsWith('@types/')) {
            continue;
        }

        const packagePath = normalizePath(`${projectRoot}/node_modules/${packageName}`);
        const typeFiles = await findTypeDefinitions(packagePath, packageName);

        for (const typeFile of typeFiles) {
            try {
                await addExtraLibFromFile(typeFile, monaco);
            } catch (error) {
                // Silently skip packages without types
            }
        }

        // Also add package.json for TS exports/types resolution
        await addPackageJsonForPackage(projectRoot, packageName, monaco);
    }
}

/**
 * Load Vite-specific type definitions
 */
async function loadViteTypes(
    projectRoot: string,
    monaco: MonacoInstance
): Promise<void> {
    const viteEnvPath = normalizePath(`${projectRoot}/src/vite-env.d.ts`);
    if (await fileExists(viteEnvPath)) {
        await addExtraLibFromFile(viteEnvPath, monaco, 'vite-env');
    }
}

/**
 * Configure Monaco TypeScript compiler options from tsconfig.json
 */
function configureCompilerOptions(
    tsConfig: TsConfig | null,
    projectRoot: string,
    monaco: MonacoInstance
): void {
    const compilerOptions = tsConfig?.compilerOptions || {};

    const monacoOptions: Monaco.typescript.CompilerOptions = {
        target: monaco.typescript.ScriptTarget.ES2020,
        module: monaco.typescript.ModuleKind.ESNext,
        lib: [
            'es2020',
            'dom',
            'dom.iterable',
        ],
        noLib: false,
        moduleResolution: monaco.typescript.ModuleResolutionKind.NodeJs,
        allowJs: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
        // Default to non-strict unless tsconfig enables it.
        // This keeps Monaco diagnostics aligned with the project's build.
        strict: compilerOptions.strict ?? false,
        jsx: monaco.typescript.JsxEmit.ReactJSX,
        // Use URI-formatted typeRoots so they match Monaco file names
        typeRoots: [toFileUri(normalizePath(`${projectRoot}/node_modules/@types`))],
        allowImportingTsExtensions: true,
    };

    // Map tsconfig options to Monaco options
    if (compilerOptions.target) {
        const targetMap: Record<string, Monaco.typescript.ScriptTarget> = {
            ES3: monaco.typescript.ScriptTarget.ES3,
            ES5: monaco.typescript.ScriptTarget.ES5,
            ES6: monaco.typescript.ScriptTarget.ES2015,
            ES2015: monaco.typescript.ScriptTarget.ES2015,
            ES2016: monaco.typescript.ScriptTarget.ES2016,
            ES2017: monaco.typescript.ScriptTarget.ES2017,
            ES2018: monaco.typescript.ScriptTarget.ES2018,
            ES2019: monaco.typescript.ScriptTarget.ES2019,
            ES2020: monaco.typescript.ScriptTarget.ES2020,
            ESNext: monaco.typescript.ScriptTarget.ESNext,
        };
        if (targetMap[compilerOptions.target]) {
            monacoOptions.target = targetMap[compilerOptions.target];
        }
    }

    if (compilerOptions.module) {
        const moduleMap: Record<string, Monaco.typescript.ModuleKind> = {
            ESNext: monaco.typescript.ModuleKind.ESNext,
            CommonJS: monaco.typescript.ModuleKind.CommonJS,
            AMD: monaco.typescript.ModuleKind.AMD,
            UMD: monaco.typescript.ModuleKind.UMD,
            System: monaco.typescript.ModuleKind.System,
            ES2015: monaco.typescript.ModuleKind.ES2015,
            ES2020: monaco.typescript.ModuleKind.ESNext,
        };
        if (moduleMap[compilerOptions.module]) {
            monacoOptions.module = moduleMap[compilerOptions.module];
        }
    }

    if (compilerOptions.lib && compilerOptions.lib.length > 0) {
        // Monaco expects lowercase lib strings (e.g., 'dom' not 'DOM')
        const normalizedLibs = compilerOptions.lib.map(lib => lib.toLowerCase());

        // Ensure an ES lib is present for Promise/iterators/etc.
        const hasEsLib = normalizedLibs.some(lib => lib.startsWith('es'));
        if (!hasEsLib) {
            normalizedLibs.unshift('es2020');
        }

        // Always ensure DOM types are available for web development
        // even if the project's tsconfig doesn't include them
        const essentialLibs = ['dom', 'dom.iterable'];
        for (const essentialLib of essentialLibs) {
            if (!normalizedLibs.includes(essentialLib)) {
                normalizedLibs.push(essentialLib);
            }
        }

        monacoOptions.lib = normalizedLibs;
        console.log('[TypeLoader] Loaded lib from tsconfig:', compilerOptions.lib, '-> normalized:', monacoOptions.lib);
    }

    if (compilerOptions.moduleResolution) {
        const res = compilerOptions.moduleResolution.toLowerCase();
        if (res === 'nodenext' || res === 'node16' || res === 'bundler') {
            monacoOptions.moduleResolution = monaco.typescript.ModuleResolutionKind.NodeJs;
        } else if (res === 'node') {
            monacoOptions.moduleResolution = monaco.typescript.ModuleResolutionKind.NodeJs;
        }
    }

    if (compilerOptions.esModuleInterop !== undefined) {
        monacoOptions.esModuleInterop = compilerOptions.esModuleInterop;
    }

    if (compilerOptions.allowSyntheticDefaultImports !== undefined) {
        monacoOptions.allowSyntheticDefaultImports = compilerOptions.allowSyntheticDefaultImports;
    }

    if (compilerOptions.skipLibCheck !== undefined) {
        monacoOptions.skipLibCheck = compilerOptions.skipLibCheck;
    }

    // Respect explicit strictness-related overrides even when "strict" is false.
    if (compilerOptions.strictNullChecks !== undefined) {
        monacoOptions.strictNullChecks = compilerOptions.strictNullChecks;
    }
    if (compilerOptions.noImplicitAny !== undefined) {
        monacoOptions.noImplicitAny = compilerOptions.noImplicitAny;
    }
    if (compilerOptions.noUnusedLocals !== undefined) {
        monacoOptions.noUnusedLocals = compilerOptions.noUnusedLocals;
    }
    if (compilerOptions.noUnusedParameters !== undefined) {
        monacoOptions.noUnusedParameters = compilerOptions.noUnusedParameters;
    }
    if (compilerOptions.noImplicitThis !== undefined) {
        monacoOptions.noImplicitThis = compilerOptions.noImplicitThis;
    }
    if (compilerOptions.alwaysStrict !== undefined) {
        monacoOptions.alwaysStrict = compilerOptions.alwaysStrict;
    }
    if (compilerOptions.useUnknownInCatchVariables !== undefined) {
        monacoOptions.useUnknownInCatchVariables = compilerOptions.useUnknownInCatchVariables;
    }

    // Apply compiler options to both TS and JS defaults so JS files stay in sync.
    monaco.typescript.typescriptDefaults.setCompilerOptions(monacoOptions);
    monaco.typescript.javascriptDefaults.setCompilerOptions(monacoOptions);

    // Configure path mappings if present
    if (compilerOptions.baseUrl && compilerOptions.paths) {
        const paths: Record<string, string[]> = {};
        for (const [pattern, replacements] of Object.entries(compilerOptions.paths)) {
            paths[pattern] = replacements.map(r =>
                // Convert each replacement to a Monaco-style file URI
                toFileUri(
                    normalizePath(`${projectRoot}/${compilerOptions.baseUrl}/${r}`)
                )
            );
        }
        const hydratedWithPaths = {
            ...monacoOptions,
            // Monaco uses URI file names (file:///c%3A/...), so baseUrl must match
            baseUrl: toFileUri(normalizePath(`${projectRoot}/${compilerOptions.baseUrl}`)),
            paths,
        };
        monaco.typescript.typescriptDefaults.setCompilerOptions(hydratedWithPaths);
        monaco.typescript.javascriptDefaults.setCompilerOptions(hydratedWithPaths);
    }
}

/**
 * Add a package's package.json to Monaco so TS can read types/exports fields.
 */
async function addPackageJsonForPackage(
    projectRoot: string,
    packageName: string,
    monaco: MonacoInstance
): Promise<void> {
    const pkgJsonPath = normalizePath(`${projectRoot}/node_modules/${packageName}/package.json`);
    if (await fileExists(pkgJsonPath)) {
        await addExtraLibFromFile(pkgJsonPath, monaco, `${packageName}/package.json`);
    }
}

/**
 * Extract bare package roots referenced in a typings file.
 * Example: "@tanstack/query-core/foo" -> "@tanstack/query-core"
 *          "react/jsx-runtime" -> "react"
 */
function extractBarePackageRoots(content: string): string[] {
    const roots: string[] = [];
    const regex = /(?:from|import)\s*["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content))) {
        const spec = match[1] || match[2];
        if (!spec) continue;
        if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('node:')) continue;
        let root = spec;
        if (root.startsWith('@')) {
            const parts = root.split('/');
            if (parts.length >= 2) root = `${parts[0]}/${parts[1]}`;
        } else {
            root = root.split('/')[0];
        }
        roots.push(root);
    }
    return roots;
}

/**
 * Main function to load all type definitions for a project
 */
export async function loadProjectTypes(
    projectRoot: string,
    monaco: MonacoInstance
): Promise<void> {
    if (!projectRoot || !monaco) {
        return;
    }

    // Prevent duplicate loading (React Strict Mode can cause double effects)
    if (isLoadingTypes) {
        console.log('[TypeLoader] Already loading types, skipping duplicate call');
        return;
    }

    // If already loaded for this project, skip reloading
    if (currentLoadedProject === projectRoot && loadedTypeUris.size > 0) {
        console.log('[TypeLoader] Types already loaded for this project');
        return;
    }

    isLoadingTypes = true;
    console.log('[TypeLoader] Loading project types from:', projectRoot);

    try {
        // Clear previously loaded types if switching projects
        if (currentLoadedProject !== projectRoot) {
            loadedTypeUris.clear();
        }
        currentLoadedProject = projectRoot;

        // Read configuration files
        const packageJson = await readPackageJson(projectRoot);
        const tsConfig = await readTsConfig(projectRoot);

        // Configure compiler options first
        configureCompilerOptions(tsConfig, projectRoot, monaco);

        // Collect all package names from dependencies
        const allPackages: string[] = [];
        if (packageJson) {
            if (packageJson.dependencies) {
                allPackages.push(...Object.keys(packageJson.dependencies));
            }
            if (packageJson.devDependencies) {
                allPackages.push(...Object.keys(packageJson.devDependencies));
            }
            if (packageJson.peerDependencies) {
                allPackages.push(...Object.keys(packageJson.peerDependencies));
            }
        }

        const compilerOptions = tsConfig?.compilerOptions;
        const configuredLibs = (compilerOptions?.lib ?? []).map(lib => lib.toLowerCase());
        const hasDomLib = configuredLibs.some(lib => lib.includes('dom'));
        const configuredTypes = compilerOptions?.types?.filter(Boolean) ?? null;
        const wantsNodeTypes = configuredTypes
            ? configuredTypes.some(t => {
                const normalized = t.replace(/^@types\//, '');
                return normalized === 'node' || normalized.endsWith('/node');
            })
            : false;

        // Only load Node ambient globals if explicitly requested via "types"
        // or if the project doesn't look like a DOM/browser project.
        const shouldLoadNodeTypes = wantsNodeTypes || !hasDomLib;

        // Use backend resolver to find type definitions for direct packages.
        // Avoid pulling in @types/node for DOM projects unless requested.
        const directPackages = shouldLoadNodeTypes
            ? allPackages
            : allPackages.filter(pkg => !(pkg === '@types/node' || pkg.startsWith('@types/node/')));
        const referenced = await loadResolverTypings(projectRoot, directPackages, monaco, true);

        const transitivePackages: string[] = [];
        const MAX_TRANSITIVE_PACKAGES = 50;
        for (const root of referenced) {
            if (directPackages.includes(root)) continue;
            if (transitivePackages.length >= MAX_TRANSITIVE_PACKAGES) break;
            const pjPath = normalizePath(`${projectRoot}/node_modules/${root}/package.json`);
            if (await fileExists(pjPath)) {
                transitivePackages.push(root);
            }
        }

        if (transitivePackages.length > 0) {
            console.log(`[TypeLoader] Loading transitive typings for ${transitivePackages.length} packages referenced by types...`);
            await loadResolverTypings(projectRoot, transitivePackages, monaco, false);
        }

        // Fallback: Load @types packages and direct package scans
        await loadTypesPackages(projectRoot, monaco, tsConfig);
        await loadPackageTypes(projectRoot, directPackages, monaco);
        if (transitivePackages.length > 0) {
            await loadPackageTypes(projectRoot, transitivePackages, monaco);
        }

        // Load Vite-specific types
        await loadViteTypes(projectRoot, monaco);

        // Add Node.js types if @types/node is present and we want Node globals.
        const hasNodeTypes = directPackages.some(pkg => pkg === '@types/node' || pkg.startsWith('@types/node'));
        if (hasNodeTypes && shouldLoadNodeTypes) {
            const nodeTypesPath = normalizePath(`${projectRoot}/node_modules/@types/node`);
            const nodeIndexPath = normalizePath(`${nodeTypesPath}/index.d.ts`);
            if (await fileExists(nodeIndexPath)) {
                await addExtraLibFromFile(nodeIndexPath, monaco, '@types/node');
            }

            // Node's fetch/Response types are provided via undici-types. If those
            // ambient types aren't loaded, Response will be missing members like ok/json.
            const undiciTypesPath = normalizePath(`${projectRoot}/node_modules/undici-types`);
            if ((await readDirectory(undiciTypesPath)).length > 0) {
                const undiciTypeFiles = await findAllTypeFiles(undiciTypesPath);
                for (const typeFile of undiciTypeFiles) {
                    await addExtraLibFromFile(typeFile, monaco, 'undici-types');
                }
            }
        }

        console.log(`[TypeLoader] Loaded ${loadedTypeUris.size} type definition files`);

        // DIAGNOSTIC: Show URI format being used for types
        if (loadedTypeUris.size > 0) {
            const sampleUris = Array.from(loadedTypeUris).slice(0, 3);
            console.log('[TypeLoader] Sample type definition URIs:', sampleUris);
        }
    } catch (error) {
        console.error('[TypeLoader] Failed to load project types:', error);
    } finally {
        isLoadingTypes = false;
    }
}

/**
 * Clear all loaded type definitions
 */
export function clearProjectTypes(monaco: MonacoInstance): void {
    if (!monaco) return;

    // Clear the cache
    loadedTypeUris.clear();
    currentLoadedProject = null;

    // Reset compiler options to defaults
    monaco.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.typescript.ScriptTarget.ES2020,
        module: monaco.typescript.ModuleKind.ESNext,
        lib: ['es2020', 'dom', 'dom.iterable'],
        moduleResolution: monaco.typescript.ModuleResolutionKind.NodeJs,
        allowJs: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
        strict: true,
        jsx: monaco.typescript.JsxEmit.React,
        allowImportingTsExtensions: true,
    });

    // Note: Monaco doesn't provide a direct way to remove all extra libs
    // They will be replaced when loadProjectTypes is called again
}
