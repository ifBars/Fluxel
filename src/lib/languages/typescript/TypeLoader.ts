/**
 * Monaco TypeScript Type Loader
 * 
 * Loads type definitions from the opened project's node_modules
 * into Monaco Editor's TypeScript language service.
 */

import { readTextFile, readDir } from '@tauri-apps/plugin-fs';
import type * as Monaco from 'monaco-editor';
import { discoverTypingsForPackages } from '../../services/NodeResolverService';
import { batchReadFiles } from '../../services/BatchFileService';
import { useTypeLoadingStore } from '@/stores';

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
 * Memory management constants to prevent Monaco worker crashes
 */
// Note: many real-world packages ship large `*.d.ts` bundles (e.g. icon packs),
// so these limits must be high enough to keep IntelliSense accurate.
const MAX_FILE_SIZE_BYTES = 2_500_000; // Skip files larger than ~2.5MB
const MAX_TOTAL_TYPES_BYTES = 50_000_000; // Stop loading after ~50MB total
const MAX_FILES_PER_PACKAGE = 200; // Limit files per package to prevent runaway loading
const BATCH_DELAY_MS = 50; // Small delay between batches to let the worker process

let totalLoadedBytes = 0;

/**
 * Batch queue for addExtraLib to prevent overwhelming the worker
 */
interface ExtraLibEntry {
    content: string;
    uri: string;
}
let pendingExtraLibs: ExtraLibEntry[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
let isFlushingBatch = false;

/**
 * Flush the pending extra libs to Monaco in a controlled manner
 */
async function flushExtraLibBatch(monaco: MonacoInstance): Promise<void> {
    if (isFlushingBatch || pendingExtraLibs.length === 0) return;

    isFlushingBatch = true;
    const batch = pendingExtraLibs.splice(0, 100); // Process 100 at a time

    for (const entry of batch) {
        try {
            monaco.typescript.typescriptDefaults.addExtraLib(entry.content, entry.uri);
            loadedTypeUris.add(entry.uri);
        } catch (error) {
            console.warn(`[TypeLoader] Failed to add extra lib ${entry.uri}:`, error);
        }
    }

    isFlushingBatch = false;

    // If there are more pending, schedule another flush with a delay
    if (pendingExtraLibs.length > 0) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
        await flushExtraLibBatch(monaco);
    }
}

/**
 * Queue an extra lib to be added, with batching to prevent worker overload
 */
function queueExtraLib(content: string, uri: string, monaco: MonacoInstance): boolean {
    // Skip if already loaded
    if (loadedTypeUris.has(uri)) return false;

    // Check file size
    const contentSize = content.length;
    if (contentSize > MAX_FILE_SIZE_BYTES) {
        console.debug(`[TypeLoader] Skipping large file (${(contentSize / 1024).toFixed(1)}KB): ${uri}`);
        return false;
    }

    // Check total memory budget
    if (totalLoadedBytes + contentSize > MAX_TOTAL_TYPES_BYTES) {
        console.warn(`[TypeLoader] Memory budget exhausted (${(totalLoadedBytes / 1024 / 1024).toFixed(1)}MB), skipping: ${uri}`);
        return false;
    }

    totalLoadedBytes += contentSize;
    pendingExtraLibs.push({ content, uri });

    // Schedule flush if not already scheduled
    if (!flushTimeout && !isFlushingBatch) {
        flushTimeout = setTimeout(async () => {
            flushTimeout = null;
            await flushExtraLibBatch(monaco);
        }, 10);
    }

    return true;
}

/**
 * Wait for all pending extra libs to be flushed
 */
async function waitForPendingLibs(monaco: MonacoInstance): Promise<void> {
    if (flushTimeout) {
        clearTimeout(flushTimeout);
        flushTimeout = null;
    }
    await flushExtraLibBatch(monaco);
}

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
    return normalized.startsWith('/')
        ? `file:///${normalized.slice(1)}`
        : `file:///${normalized}`;
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
 * Limited to MAX_FILES_PER_PACKAGE to prevent memory issues
 */
async function findAllTypeFiles(dirPath: string, currentCount: number = 0): Promise<string[]> {
    const typeFiles: string[] = [];

    // Respect per-package file limit
    if (currentCount >= MAX_FILES_PER_PACKAGE) {
        return typeFiles;
    }

    try {
        const entries = await readDirectory(dirPath);

        for (const entry of entries) {
            // Stop if we've hit the limit
            if (typeFiles.length + currentCount >= MAX_FILES_PER_PACKAGE) {
                break;
            }

            const fullPath = normalizePath(`${dirPath}/${entry.name}`);

            if (entry.isDirectory) {
                // Skip node_modules subdirectories to avoid infinite recursion
                if (entry.name === 'node_modules') {
                    continue;
                }
                // Recursively search subdirectories with updated count
                const subFiles = await findAllTypeFiles(fullPath, currentCount + typeFiles.length);
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

    // Wait for all queued types to be processed
    await waitForPendingLibs(monaco);
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

    // Skip if we've already loaded this type
    if (virtualPath && loadedTypeUris.has(virtualPath)) return;

    try {
        const content = await readTextFile(normalizedPath);

        // Use the queue-based system for controlled memory usage
        if (virtualPath) {
            const queued = queueExtraLib(content, virtualPath, monaco);

            // DIAGNOSTIC: Log first few type additions
            if (queued && loadedTypeUris.size <= 10) {
                console.log(`[TypeLoader] Queued: ${packageName || 'unknown'} -> ${virtualPath}`);
            }
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

        // Collect all files to read in one batch
        const allFilesToRead: string[] = [];
        const fileToPackage = new Map<string, string>();

        for (const res of responses) {
            if (res.files.length > 0) {
                loadedPackages++;
                for (const file of res.files) {
                    const normalizedFile = normalizePath(file);
                    allFilesToRead.push(normalizedFile);
                    fileToPackage.set(normalizedFile, res.package_name);
                }
            }
        }

        // Batch read all files in one IPC call
        if (allFilesToRead.length > 0) {
            const fileContents = await batchReadFiles(allFilesToRead);

            // Register all types using the queue-based system
            for (const [filePath, content] of Object.entries(fileContents)) {
                const virtualPath = toFileUri(filePath);

                // Skip if already loaded or use queue system which handles this
                if (loadedTypeUris.has(virtualPath)) continue;

                // Use queue-based system for controlled memory usage
                const queued = queueExtraLib(content, virtualPath, monaco);
                if (queued) {
                    totalFiles++;

                    // Collect references from first few files
                    if (collectReferences && totalFiles <= 50) {
                        for (const root of extractBarePackageRoots(content)) {
                            referencedPackages.add(root);
                        }
                    }
                }
            }

            // Wait for the batch to be processed
            await waitForPendingLibs(monaco);
        }

        // Ensure TS can read package.json for modern packages with exports/types
        for (const res of responses) {
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

    // Monaco doesn't automatically resolve `/// <reference types="vite/client" />`
    // unless the referenced d.ts files are present in its virtual FS.
    const viteClientPath = normalizePath(`${projectRoot}/node_modules/vite/client.d.ts`);
    if (await fileExists(viteClientPath)) {
        await addExtraLibFromFile(viteClientPath, monaco, 'vite/client');
    }

    const viteImportMetaPath = normalizePath(`${projectRoot}/node_modules/vite/types/importMeta.d.ts`);
    if (await fileExists(viteImportMetaPath)) {
        await addExtraLibFromFile(viteImportMetaPath, monaco, 'vite/importMeta');
    }
}
/**
 * Load TypeScript default lib files from node_modules/typescript/lib
 * This is necessary because Monaco's bundled libs may not load correctly
 * when using Vite or other modern bundlers.
 * 
 * NOTE: We load ES + DOM libs from the project's `typescript` install to ensure
 * globals like `setTimeout`, `Window`, and `ImportMeta` exist in the worker.
 */
async function loadDefaultLibFiles(
    projectRoot: string,
    monaco: MonacoInstance,
    libs: string[]
): Promise<void> {
    try {
        const tsLibPath = normalizePath(`${projectRoot}/node_modules/typescript/lib`);

        // Check if typescript is installed
        const entries = await readDirectory(tsLibPath);
        if (entries.length === 0) {
            console.log('[TypeLoader] TypeScript not found in node_modules, skipping default lib loading');
            return;
        }

        // Map lib names to their corresponding files
        // We load ES libs and a minimal set of DOM libs needed for browser/Vite projects.
        const libFileMap: Record<string, string[]> = {
            'es5': ['lib.es5.d.ts'],
            'es6': ['lib.es2015.d.ts', 'lib.es2015.core.d.ts', 'lib.es2015.collection.d.ts',
                'lib.es2015.generator.d.ts', 'lib.es2015.iterable.d.ts', 'lib.es2015.promise.d.ts',
                'lib.es2015.proxy.d.ts', 'lib.es2015.reflect.d.ts', 'lib.es2015.symbol.d.ts',
                'lib.es2015.symbol.wellknown.d.ts'],
            'es2015': ['lib.es2015.d.ts', 'lib.es2015.core.d.ts', 'lib.es2015.collection.d.ts',
                'lib.es2015.generator.d.ts', 'lib.es2015.iterable.d.ts', 'lib.es2015.promise.d.ts',
                'lib.es2015.proxy.d.ts', 'lib.es2015.reflect.d.ts', 'lib.es2015.symbol.d.ts',
                'lib.es2015.symbol.wellknown.d.ts'],
            'es2016': ['lib.es2016.d.ts', 'lib.es2016.array.include.d.ts'],
            'es2017': ['lib.es2017.d.ts', 'lib.es2017.object.d.ts', 'lib.es2017.sharedmemory.d.ts',
                'lib.es2017.string.d.ts', 'lib.es2017.typedarrays.d.ts'],
            'es2018': ['lib.es2018.d.ts', 'lib.es2018.asyncgenerator.d.ts', 'lib.es2018.asynciterable.d.ts',
                'lib.es2018.promise.d.ts', 'lib.es2018.regexp.d.ts'],
            'es2019': ['lib.es2019.d.ts', 'lib.es2019.array.d.ts', 'lib.es2019.object.d.ts',
                'lib.es2019.string.d.ts', 'lib.es2019.symbol.d.ts'],
            'es2020': ['lib.es2020.d.ts', 'lib.es2020.bigint.d.ts', 'lib.es2020.promise.d.ts',
                'lib.es2020.sharedmemory.d.ts', 'lib.es2020.string.d.ts', 'lib.es2020.symbol.wellknown.d.ts',
                'lib.es2020.intl.d.ts', 'lib.es2020.date.d.ts', 'lib.es2020.number.d.ts'],
            'es2021': ['lib.es2021.d.ts', 'lib.es2021.promise.d.ts', 'lib.es2021.string.d.ts',
                'lib.es2021.weakref.d.ts'],
            'es2022': ['lib.es2022.d.ts', 'lib.es2022.array.d.ts', 'lib.es2022.error.d.ts',
                'lib.es2022.object.d.ts', 'lib.es2022.string.d.ts', 'lib.es2022.regexp.d.ts'],
            // DOM libs
            'dom': ['lib.dom.d.ts', 'lib.dom.iterable.d.ts', 'lib.dom.asynciterable.d.ts'],
            'dom.iterable': ['lib.dom.iterable.d.ts'],
            'dom.asynciterable': ['lib.dom.asynciterable.d.ts'],
            // WebWorker libs (optional, only if requested via compilerOptions.lib)
            'webworker': ['lib.webworker.d.ts', 'lib.webworker.iterable.d.ts', 'lib.webworker.asynciterable.d.ts'],
            'webworker.iterable': ['lib.webworker.iterable.d.ts'],
            'webworker.asynciterable': ['lib.webworker.asynciterable.d.ts'],
            'webworker.importscripts': ['lib.webworker.importscripts.d.ts', 'lib.webworker.d.ts'],
        };

        // Always load ES5 as the base - it contains fundamental types
        const filesToLoad = new Set<string>(['lib.es5.d.ts']);

        // Add files for each requested lib (only if we have a mapping for it)
        for (const lib of libs) {
            const normalizedLib = lib.toLowerCase();
            const files = libFileMap[normalizedLib];
            if (files) {
                files.forEach(f => filesToLoad.add(f));
            }
        }

        console.log(`[TypeLoader] Loading ${filesToLoad.size} default lib files (ES + DOM libs)`);
        let loadedCount = 0;

        for (const fileName of filesToLoad) {
            const filePath = normalizePath(`${tsLibPath}/${fileName}`);
            const libUri = `lib:${fileName}`;

            // Skip if already loaded
            if (loadedTypeUris.has(libUri)) {
                continue;
            }

            try {
                const content = await readTextFile(filePath);
                // Use a special lib: URI scheme so Monaco recognizes these as default libs
                monaco.typescript.typescriptDefaults.addExtraLib(content, libUri);
                loadedTypeUris.add(libUri);
                loadedCount++;
            } catch (error) {
                // Silent failure - file may not exist
                console.debug(`[TypeLoader] Could not load lib file: ${fileName}`);
            }
        }

        console.log(`[TypeLoader] Loaded ${loadedCount} default lib files`);
    } catch (error) {
        console.error('[TypeLoader] Failed to load default lib files:', error);
        // Don't rethrow - this is a non-critical enhancement
    }
}

/**
 * Load project-level .d.ts files (like vite-env.d.ts, global.d.ts)
 * These contain type declarations for image imports, custom modules, etc.
 */
async function loadProjectDeclarationFiles(
    projectRoot: string,
    monaco: MonacoInstance
): Promise<void> {
    // Common locations for project type declarations
    const declarationFiles = [
        'vite-env.d.ts',
        'src/vite-env.d.ts',
        'env.d.ts',
        'src/env.d.ts',
        'types.d.ts',
        'src/types.d.ts',
        'global.d.ts',
        'src/global.d.ts',
    ];

    let loadedCount = 0;

    for (const relPath of declarationFiles) {
        const filePath = normalizePath(`${projectRoot}/${relPath}`);
        try {
            const content = await readTextFile(filePath);
            const uri = toFileUri(filePath);

            if (!loadedTypeUris.has(uri)) {
                monaco.typescript.typescriptDefaults.addExtraLib(content, uri);
                loadedTypeUris.add(uri);
                loadedCount++;
                console.log(`[TypeLoader] Loaded project declaration: ${relPath}`);
            }
        } catch {
            // File doesn't exist, skip silently
        }
    }

    if (loadedCount > 0) {
        console.log(`[TypeLoader] Loaded ${loadedCount} project declaration files`);
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
            'es2015',
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
            normalizedLibs.unshift('es2020', 'es2015');
        } else if (!normalizedLibs.includes('es2015')) {
            // Explicitly add es2015 if missing, even if other es libs are present.
            // This ensures Promise, Map, Set, etc. are definitely available.
            normalizedLibs.unshift('es2015');
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

    // Import FrontendProfiler dynamically to avoid circular dependencies
    const { FrontendProfiler } = await import('@/lib/services/FrontendProfiler');
    
    await FrontendProfiler.profileAsync('loadProjectTypes', 'workspace', async () => {
        // Get the store for status updates
        const store = useTypeLoadingStore.getState();
        store.startLoading('Initializing TypeScript...');

        try {
        // Clear previously loaded types if switching projects
        if (currentLoadedProject !== projectRoot) {
            loadedTypeUris.clear();
            totalLoadedBytes = 0; // Reset memory budget for new project
            pendingExtraLibs = []; // Clear any pending queued libs
        }
        currentLoadedProject = projectRoot;

        store.updateProgress(0, 'Reading project configuration...');

        // Read configuration files
        const packageJson = await readPackageJson(projectRoot);
        const tsConfig = await readTsConfig(projectRoot);

        // Configure compiler options first
        configureCompilerOptions(tsConfig, projectRoot, monaco);

        // Load TypeScript default lib files explicitly
        // This is required because Vite-bundled Monaco doesn't auto-load built-in libs
        const compilerOpts = monaco.typescript.typescriptDefaults.getCompilerOptions();
        const libsToLoad = (compilerOpts.lib as string[]) || ['es2015', 'es2020', 'dom', 'dom.iterable'];
        await loadDefaultLibFiles(projectRoot, monaco, libsToLoad);

        // Load project-level .d.ts files (e.g., vite-env.d.ts for image imports)
        await loadProjectDeclarationFiles(projectRoot, monaco);

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

        store.updateProgress(0, `Loading types for ${directPackages.length} packages...`);
        const referenced = await loadResolverTypings(projectRoot, directPackages, monaco, true);

        const transitivePackages: string[] = [];
        const MAX_TRANSITIVE_PACKAGES = 10; // Reduced from 50 for faster initial load
        for (const root of referenced) {
            if (directPackages.includes(root)) continue;
            if (transitivePackages.length >= MAX_TRANSITIVE_PACKAGES) break;
            const pjPath = normalizePath(`${projectRoot}/node_modules/${root}/package.json`);
            if (await fileExists(pjPath)) {
                transitivePackages.push(root);
            }
        }

        if (transitivePackages.length > 0) {
            store.updateProgress(0, `Loading ${transitivePackages.length} transitive packages...`);
            console.log(`[TypeLoader] Loading transitive typings for ${transitivePackages.length} packages referenced by types...`);
            await loadResolverTypings(projectRoot, transitivePackages, monaco, false);
        }

        // Fallback: Load @types packages and direct package scans
        store.updateProgress(0, 'Loading @types packages...');
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
            store.finishLoading();
        }
    }, { projectRoot, typeCount: loadedTypeUris.size.toString() });
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
        lib: ['es2015', 'es2020', 'dom', 'dom.iterable'],
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
