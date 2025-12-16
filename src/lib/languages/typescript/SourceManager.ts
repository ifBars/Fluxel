/**
 * Monaco Project Source Manager
 *
 * Provides TypeScript IntelliSense by:
 * 1. Creating Monaco models for all source files (enables relative imports)
 * 2. Configuring compiler baseUrl and paths (enables @/* imports)
 * 3. Using setEagerModelSync to sync models with TypeScript worker
 */

import type * as Monaco from 'monaco-editor';
import {
    normalizePath,
    readTsConfig,
    readDirectory,
    toFileUri
} from './TypeLoader';
import { MonacoVfs } from '../../monaco/MonacoVFS';

// Type alias for Monaco instance
type MonacoInstance = typeof Monaco;

/**
 * Track created models
 */
const createdModels = new Map<string, Monaco.editor.ITextModel>();
let projectVfs: MonacoVfs | null = null;
let lastRoot: string | null = null;
let isRegistering = false; // Guard against concurrent/duplicate registration

function getVfs(monaco: MonacoInstance): MonacoVfs {
    if (!projectVfs) {
        projectVfs = new MonacoVfs(monaco);
    }
    return projectVfs;
}

/**
 * Check if a directory should be excluded from scanning
 */
function shouldExcludeDirectory(dirName: string): boolean {
    const excludeDirs = [
        'node_modules',
        '.git',
        'dist',
        'build',
        '.next',
        'out',
        'target',
        '.turbo',
        '.vercel',
        '.cache',
        'coverage',
        '__pycache__',
        '.pytest_cache',
        '.vscode',
        '.idea',
    ];
    return excludeDirs.includes(dirName);
}

/**
 * Check if a file is a source file we want to index
 */
function isSourceFile(fileName: string): boolean {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx';
}

/**
 * Detect language from file extension
 */
function detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'ts':
        case 'tsx':
            return 'typescript';
        case 'js':
        case 'jsx':
            return 'javascript';
        default:
            return 'typescript';
    }
}

/**
 * Recursively scan directory for source files
 */
async function scanProjectSourceFiles(
    dirPath: string,
    fileLimit: number = 10000,
    currentFiles: string[] = []
): Promise<string[]> {
    if (currentFiles.length >= fileLimit) {
        console.warn('[Project Source] Reached file limit, stopping scan');
        return currentFiles;
    }

    try {
        const entries = await readDirectory(dirPath);

        for (const entry of entries) {
            const fullPath = normalizePath(`${dirPath}/${entry.name}`);

            if (entry.isDirectory) {
                if (!shouldExcludeDirectory(entry.name)) {
                    await scanProjectSourceFiles(fullPath, fileLimit, currentFiles);
                }
            } else if (isSourceFile(entry.name)) {
                currentFiles.push(fullPath);
            }
        }
    } catch (error) {
        console.debug('[Project Source] Failed to read directory:', dirPath, error);
    }

    return currentFiles;
}


/**
 * Create models for all source files
 * This enables relative imports to work
 */
async function createModelsForSourceFiles(
    sourceFiles: string[],
    monaco: MonacoInstance
): Promise<number> {
    const vfs = getVfs(monaco);
    let createdCount = 0;
    let skippedCount = 0;

    for (const filePath of sourceFiles) {
        try {
            // CRITICAL: Use Uri.file() to properly create file:/// URIs on Windows
            // Uri.parse("C:/path") incorrectly treats "C:" as a scheme
            const normalizedPath = normalizePath(filePath);
            const uri = monaco.Uri.file(normalizedPath);
            const uriString = uri.toString();

            // Skip if model already exists
            if (monaco.editor.getModel(uri)) {
                skippedCount++;
                continue;
            }

            // Skip if we already created it
            if (createdModels.has(uriString)) {
                skippedCount++;
                continue;
            }

            await vfs.createOrUpdateModel(filePath, detectLanguage(filePath));
            createdModels.set(uriString, monaco.editor.getModel(uri)!);
            createdCount++;
        } catch (error) {
            console.debug('[Project Source] Failed to create model:', filePath, error);
        }
    }

    console.log(`[Project Source] Created ${createdCount} new models, skipped ${skippedCount} existing`);
    console.log(`[Project Source] Sample created URI:`, sourceFiles[0] ? normalizePath(sourceFiles[0]) : 'none');
    return createdCount;
}

/**
 * Configure path aliases for Monaco TypeScript
 */
function configurePathAliases(
    projectRoot: string,
    tsConfig: any,
    monaco: MonacoInstance
): void {
    const currentOptions = monaco.typescript.typescriptDefaults.getCompilerOptions();

    // Get path mappings
    const paths = tsConfig?.compilerOptions?.paths || {};
    const baseUrl = tsConfig?.compilerOptions?.baseUrl || '.';

    // Resolve baseUrl relative to project root and normalize
    const normalizedRoot = normalizePath(projectRoot);
    const resolvedBaseUrlFs = baseUrl === '.'
        ? normalizedRoot
        : normalizePath(`${normalizedRoot}/${baseUrl}`);

    // Monaco TS worker uses URI-style file names (file:///c%3A/...), so paths must match.
    const baseUrlUri = toFileUri(resolvedBaseUrlFs);

    // IMPORTANT: Path replacements must preserve wildcards for TypeScript path mapping
    // TypeScript's path mapping works by:
    // 1. Matching the import against the pattern (e.g., @/components/ui/slider matches @/*)
    // 2. Replacing * in the replacement pattern with the matched part (components/ui/slider)
    // 3. Resolving the result relative to baseUrl
    // Monaco's TypeScript worker needs absolute URIs, but we can use relative paths
    // that will be resolved relative to the baseUrl URI
    const resolvedPaths: Record<string, string[]> = {};
    for (const [pattern, replacements] of Object.entries(paths)) {
        resolvedPaths[pattern] = (replacements as string[]).map((r: string) => {
            // If the replacement contains a wildcard, preserve it as a relative path
            // Monaco will resolve it relative to baseUrl
            if (r.includes('*')) {
                // Ensure it starts with ./ for relative path
                return r.startsWith('./') ? r : `./${r}`;
            } else {
                // For non-wildcard paths, resolve to absolute URI
                const absFs = r.startsWith('/')
                    ? normalizePath(r)
                    : normalizePath(`${resolvedBaseUrlFs}/${r}`);
                return toFileUri(absFs);
            }
        });
    }

    console.log('[Project Source] Configuring compiler options:');
    console.log('  - baseUrl:', baseUrlUri);
    console.log('  - paths:', resolvedPaths);

    monaco.typescript.typescriptDefaults.setCompilerOptions({
        ...currentOptions,
        // Ensure default libs remain enabled when patching paths/baseUrl.
        noLib: false,
        lib: currentOptions.lib && currentOptions.lib.length > 0
            ? currentOptions.lib
            : ['es2015', 'es2020', 'dom', 'dom.iterable'],
        baseUrl: baseUrlUri,
        paths: resolvedPaths,
        moduleResolution: monaco.typescript.ModuleResolutionKind.NodeJs,
        allowJs: true,
        checkJs: false,
    });

    // Defensive: if something cleared libs, reassert ES+DOM so core globals exist.
    const patchedOptions = monaco.typescript.typescriptDefaults.getCompilerOptions();
    if (!patchedOptions.lib || patchedOptions.lib.length === 0) {
        monaco.typescript.typescriptDefaults.setCompilerOptions({
            ...patchedOptions,
            noLib: false,
            lib: ['es2015', 'es2020', 'dom', 'dom.iterable'],
        });
    }
}

/**
 * Main function to register project source files for IntelliSense
 */
export async function registerProjectSourceFiles(
    projectRoot: string,
    monaco: MonacoInstance
): Promise<void> {
    if (!projectRoot || !monaco) {
        console.warn('[Project Source] Invalid project root or Monaco instance');
        return;
    }

    // Guard against true concurrent registration only
    if (isRegistering) {
        console.log('[Project Source] Already registering, skipping concurrent call');
        return;
    }

    // Check if this is a re-registration for the same project
    const isReregistration = lastRoot === projectRoot && createdModels.size > 0;

    isRegistering = true;

    // Only log verbosely on first registration
    if (!isReregistration) {
        console.log('[Project Source] ===== Starting registration =====');
        console.log('[Project Source] Project root:', projectRoot);
    }
    const startTime = performance.now();

    try {
        if (lastRoot && lastRoot !== projectRoot) {
            clearProjectSourceModels(monaco);
        }
        lastRoot = projectRoot;

        // Read tsconfig.json
        const tsConfig = await readTsConfig(projectRoot);

        if (!tsConfig?.compilerOptions?.paths) {
            console.warn('[Project Source] No path mappings in tsconfig.json');
        } else {
            // Configure compiler options with path mappings
            configurePathAliases(projectRoot, tsConfig, monaco);
        }

        // Scan source files
        const srcPath = normalizePath(`${projectRoot}/src`);
        const sourceFiles = await scanProjectSourceFiles(srcPath);

        // Only log on first registration
        if (!isReregistration) {
            console.log(`[Project Source] Found ${sourceFiles.length} source files`);
        }

        // Create models for all source files (enables relative imports)
        await createModelsForSourceFiles(sourceFiles, monaco);

        const endTime = performance.now();

        // Only log completion details on first registration
        if (!isReregistration) {
            console.log(`[Project Source] ===== Registration complete in ${(endTime - startTime).toFixed(0)}ms =====`);
            console.log(`[Project Source] Total models in registry: ${createdModels.size}`);

            // Debug: List all models
            const allModels = monaco.editor.getModels();
            console.log(`[Project Source] Total models in Monaco: ${allModels.length}`);
            if (allModels.length > 0) {
                console.log(`[Project Source] First 5 model URIs:`, allModels.slice(0, 5).map(m => m.uri.toString()));
            }
        }

        // DIAGNOSTIC: Only log diagnostics on first registration
        if (!isReregistration) {
            const allModels = monaco.editor.getModels();

            // DIAGNOSTIC: Check TypeScript worker configuration
            console.log('\n[DIAGNOSTIC] ===== TypeScript Configuration Check =====');
            const compilerOptions = monaco.typescript.typescriptDefaults.getCompilerOptions();
            console.log('[DIAGNOSTIC] Compiler Options:', {
                baseUrl: compilerOptions.baseUrl,
                paths: compilerOptions.paths,
                moduleResolution: compilerOptions.moduleResolution,
                target: compilerOptions.target,
                module: compilerOptions.module,
                lib: compilerOptions.lib,
                noLib: compilerOptions.noLib,
                strict: compilerOptions.strict,
            });
            console.log('[DIAGNOSTIC] Compiler Options (full):', JSON.stringify({
                ...compilerOptions,
                // Avoid giant circular structures; keep only primitives/arrays.
                paths: compilerOptions.paths,
            }));

            // DIAGNOSTIC: Check extra libs
            const extraLibs = monaco.typescript.typescriptDefaults.getExtraLibs();
            console.log(`[DIAGNOSTIC] Extra libs loaded: ${Object.keys(extraLibs).length}`);
            if (Object.keys(extraLibs).length > 0) {
                const sampleLibs = Object.keys(extraLibs).slice(0, 5);
                console.log('[DIAGNOSTIC] Sample extra lib URIs:', sampleLibs);
            }

            // DIAGNOSTIC: Test a specific model for diagnostics
            if (allModels.length > 0) {
                const testModel = allModels.find((m: Monaco.editor.ITextModel) => m.getLanguageId() === 'typescript' || m.getLanguageId() === 'typescriptreact');
                if (testModel) {
                    console.log('\n[DIAGNOSTIC] Testing model:', testModel.uri.toString());
                    console.log('[DIAGNOSTIC] Model language:', testModel.getLanguageId());
                    console.log('[DIAGNOSTIC] Model line count:', testModel.getLineCount());

                    // Get diagnostics from TypeScript worker
                    setTimeout(async () => {
                        try {
                            const worker = await monaco.typescript.getTypeScriptWorker();
                            const client = await worker(testModel.uri);

                            const syntaxDiag = await client.getSyntacticDiagnostics(testModel.uri.toString());
                            const semanticDiag = await client.getSemanticDiagnostics(testModel.uri.toString());
                            const suggestionDiag = await client.getSuggestionDiagnostics(testModel.uri.toString());

                            console.log('[DIAGNOSTIC] Syntax diagnostics:', syntaxDiag.length);
                            console.log('[DIAGNOSTIC] Semantic diagnostics:', semanticDiag.length);
                            console.log('[DIAGNOSTIC] Suggestion diagnostics:', suggestionDiag.length);

                            if (semanticDiag.length > 0) {
                                console.log('[DIAGNOSTIC] First 3 semantic errors:', semanticDiag.slice(0, 3).map(d => ({
                                    code: d.code,
                                    message: d.messageText,
                                    start: d.start,
                                    length: d.length,
                                })));
                            }

                            // Note: getProgram() and getSourceFiles() are not available on the worker client
                            // TypeScript diagnostics are sufficient to verify the worker is functioning
                        } catch (error) {
                            console.error('[DIAGNOSTIC] Failed to get worker diagnostics:', error);
                        }
                    }, 1000);
                } else {
                    console.warn('[DIAGNOSTIC] No TypeScript/TSX models found for testing');
                }
            }

            // DIAGNOSTIC: Check for URI consistency issues
            console.log('\n[DIAGNOSTIC] ===== URI Consistency Check =====');
            const modelUris = allModels.map((m: Monaco.editor.ITextModel) => m.uri.toString());
            const typesUris = Object.keys(extraLibs);

            const modelHasFileScheme = modelUris.filter((u: string) => u.startsWith('file:///')).length;
            const modelNoFileScheme = modelUris.filter((u: string) => !u.startsWith('file:///')).length;
            const typesHasFileScheme = typesUris.filter((u: string) => u.startsWith('file:///')).length;
            const typesNoFileScheme = typesUris.filter((u: string) => !u.startsWith('file:///')).length;

            console.log('[DIAGNOSTIC] Model URIs:', {
                total: modelUris.length,
                withFileScheme: modelHasFileScheme,
                withoutFileScheme: modelNoFileScheme,
            });

            console.log('[DIAGNOSTIC] Type definition URIs:', {
                total: typesUris.length,
                withFileScheme: typesHasFileScheme,
                withoutFileScheme: typesNoFileScheme,
            });

            if (modelNoFileScheme > 0 && typesHasFileScheme > 0) {
                console.error('[DIAGNOSTIC] ⚠️ URI MISMATCH DETECTED! Models use plain paths but types use file:// URIs');
                console.error('[DIAGNOSTIC] This will prevent TypeScript from resolving imports correctly');
                console.log('[DIAGNOSTIC] Sample model URI (no scheme):', modelUris.find((u: string) => !u.startsWith('file:///')));
                console.log('[DIAGNOSTIC] Sample type URI (with scheme):', typesUris.find((u: string) => u.startsWith('file:///')));
            } else if (modelHasFileScheme > 0 && modelNoFileScheme > 0) {
                console.warn('[DIAGNOSTIC] ⚠️ MIXED URI FORMATS in models - some have file:// scheme, some don\'t');
            }

            console.log('[DIAGNOSTIC] ===== End URI Consistency Check =====\n');
            console.log('[DIAGNOSTIC] ===== End Configuration Check =====\n');
        }

    } catch (error) {
        console.error('[Project Source] Registration failed:', error);
    } finally {
        isRegistering = false;
    }
}

/**
 * Clear all created models
 */
export function clearProjectSourceModels(monaco: MonacoInstance): void {
    if (!monaco) return;

    console.log('[Project Source] Clearing models...');

    // Dispose all models we created
    for (const [uriString, model] of createdModels.entries()) {
        try {
            if (!model.isDisposed()) {
                model.dispose();
            }
        } catch (error) {
            console.debug('[Project Source] Failed to dispose model:', uriString, error);
        }
    }

    createdModels.clear();
    if (projectVfs) {
        projectVfs.clear();
        projectVfs = null;
    }
    console.log('[Project Source] Models cleared');
}
