/**
 * Monaco TypeScript Type Loader
 * 
 * Loads type definitions from the opened project's node_modules
 * into Monaco Editor's TypeScript language service.
 */

import { readTextFile, readDir } from '@tauri-apps/plugin-fs';
import type * as Monaco from 'monaco-editor';

// Type alias for Monaco instance
type MonacoInstance = typeof Monaco;

export interface PackageJson {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
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
    };
    include?: string[];
    exclude?: string[];
}

/**
 * Cache for loaded type definition URIs to avoid duplicates
 */
const loadedTypeUris = new Set<string>();

/**
 * Normalize path separators for cross-platform compatibility
 */
export function normalizePath(path: string): string {
    return path.replace(/\\/g, '/');
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
    monaco: MonacoInstance
): Promise<void> {
    const typesPath = normalizePath(`${projectRoot}/node_modules/@types`);

    // Check if @types directory exists
    const entries = await readDirectory(typesPath);
    if (entries.length === 0) {
        return;
    }

    // Load each @types package
    for (const entry of entries) {
        if (!entry.isDirectory) continue;

        const packagePath = normalizePath(`${typesPath}/${entry.name}`);

        // Find all type definition files in the package
        const typeFiles = await findAllTypeFiles(packagePath);

        // Also check for package.json specified types
        const pkgTypeFiles = await findTypeDefinitions(packagePath, entry.name);
        const allTypeFiles = [...new Set([...typeFiles, ...pkgTypeFiles])];

        for (const typeFile of allTypeFiles) {
            try {
                const content = await readTextFile(typeFile);
                const uri = `file:///${typeFile}`;

                // Avoid loading duplicates
                if (loadedTypeUris.has(uri)) {
                    continue;
                }

                // Add to Monaco
                monaco.typescript.typescriptDefaults.addExtraLib(
                    content,
                    uri
                );

                loadedTypeUris.add(uri);
            } catch (error) {
                console.warn(`Failed to load type file ${typeFile}:`, error);
            }
        }
    }
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
                const content = await readTextFile(typeFile);
                const uri = `file:///${typeFile}`;

                if (loadedTypeUris.has(uri)) {
                    continue;
                }

                monaco.typescript.typescriptDefaults.addExtraLib(
                    content,
                    uri
                );

                loadedTypeUris.add(uri);
            } catch (error) {
                // Silently skip packages without types
            }
        }
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
        try {
            const content = await readTextFile(viteEnvPath);
            const uri = `file:///${viteEnvPath}`;

            if (!loadedTypeUris.has(uri)) {
                monaco.typescript.typescriptDefaults.addExtraLib(
                    content,
                    uri
                );
                loadedTypeUris.add(uri);
            }
        } catch (error) {
            console.warn('Failed to load vite-env.d.ts:', error);
        }
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
            'ES2020',
            'DOM',
            'DOM.Iterable',
        ],
        moduleResolution: monaco.typescript.ModuleResolutionKind.NodeJs,
        allowJs: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
        strict: true,
        jsx: monaco.typescript.JsxEmit.React,
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

    if (compilerOptions.lib) {
        monacoOptions.lib = compilerOptions.lib;
    }

    if (compilerOptions.moduleResolution) {
        if (compilerOptions.moduleResolution === 'node' || compilerOptions.moduleResolution === 'node16' || compilerOptions.moduleResolution === 'nodenext') {
            monacoOptions.moduleResolution = monaco.typescript.ModuleResolutionKind.NodeJs;
        } else if (compilerOptions.moduleResolution === 'bundler') {
            // Monaco doesn't have bundler resolution, use NodeJs as fallback
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

    // Apply compiler options
    monaco.typescript.typescriptDefaults.setCompilerOptions(monacoOptions);

    // Configure path mappings if present
    if (compilerOptions.baseUrl && compilerOptions.paths) {
        // Monaco uses a different format for path mappings
        // We'll need to set up the paths manually
        // Note: Monaco's path mapping support is limited, but we can try
        const paths: Record<string, string[]> = {};
        for (const [pattern, replacements] of Object.entries(compilerOptions.paths)) {
            paths[pattern] = replacements.map(r =>
                normalizePath(`${projectRoot}/${compilerOptions.baseUrl}/${r}`)
            );
        }
        // Monaco doesn't directly support tsconfig paths, but we can document them
        console.log('Path mappings detected:', paths);
    }
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

    console.log('Loading project types from:', projectRoot);

    // Clear previously loaded types
    loadedTypeUris.clear();

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
    }

    // Load @types packages
    await loadTypesPackages(projectRoot, monaco);

    // Load types from regular packages
    await loadPackageTypes(projectRoot, allPackages, monaco);

    // Load Vite-specific types
    await loadViteTypes(projectRoot, monaco);

    // Add Node.js types if @types/node is present
    const hasNodeTypes = allPackages.some(pkg => pkg === '@types/node' || pkg.startsWith('@types/node'));
    if (hasNodeTypes) {
        // Node types are typically loaded via @types/node, but we can also add
        // common Node globals manually if needed
        try {
            const nodeTypesPath = normalizePath(`${projectRoot}/node_modules/@types/node`);
            const nodeIndexPath = normalizePath(`${nodeTypesPath}/index.d.ts`);
            if (await fileExists(nodeIndexPath)) {
                const nodeTypes = await readTextFile(nodeIndexPath);
                const uri = `file:///${nodeIndexPath}`;
                if (!loadedTypeUris.has(uri)) {
                    monaco.typescript.typescriptDefaults.addExtraLib(
                        nodeTypes,
                        uri
                    );
                    loadedTypeUris.add(uri);
                }
            }
        } catch (error) {
            console.warn('Failed to load @types/node:', error);
        }
    }

    console.log(`Loaded ${loadedTypeUris.size} type definition files`);
}

/**
 * Clear all loaded type definitions
 */
export function clearProjectTypes(monaco: MonacoInstance): void {
    if (!monaco) return;

    // Clear the cache
    loadedTypeUris.clear();

    // Reset compiler options to defaults
    monaco.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.typescript.ScriptTarget.ES2020,
        module: monaco.typescript.ModuleKind.ESNext,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        moduleResolution: monaco.typescript.ModuleResolutionKind.NodeJs,
        allowJs: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
        strict: true,
        jsx: monaco.typescript.JsxEmit.React,
    });

    // Note: Monaco doesn't provide a direct way to remove all extra libs
    // They will be replaced when loadProjectTypes is called again
}

