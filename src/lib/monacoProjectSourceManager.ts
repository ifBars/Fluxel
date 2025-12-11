/**
 * Monaco Project Source Manager
 *
 * Provides TypeScript IntelliSense by:
 * 1. Creating Monaco models for all source files (enables relative imports)
 * 2. Configuring compiler baseUrl and paths (enables @/* imports)
 * 3. Using setEagerModelSync to sync models with TypeScript worker
 */

import { readTextFile } from '@tauri-apps/plugin-fs';
import type * as Monaco from 'monaco-editor';
import {
    normalizePath,
    readTsConfig,
    readDirectory
} from './monacoTypeLoader';

// Type alias for Monaco instance
type MonacoInstance = typeof Monaco;

/**
 * Track created models
 */
const createdModels = new Map<string, Monaco.editor.ITextModel>();

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
 * Create a URI matching Monaco React's format
 * Monaco React uses plain paths like "C:/path/to/file.tsx" (no file:// scheme!)
 */
function createModelUri(filePath: string): string {
    // Just normalize slashes and return the path as-is
    // This matches what Monaco React Editor creates
    return filePath.replace(/\\/g, '/');
}

/**
 * Create models for all source files
 * This enables relative imports to work
 */
async function createModelsForSourceFiles(
    sourceFiles: string[],
    monaco: MonacoInstance
): Promise<number> {
    let createdCount = 0;
    let skippedCount = 0;

    for (const filePath of sourceFiles) {
        try {
            // Use URI format that matches Monaco React Editor
            const uriString = createModelUri(filePath);
            const uri = monaco.Uri.parse(uriString);

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

            // Read file content
            const content = await readTextFile(normalizePath(filePath));

            // Detect language
            const language = detectLanguage(filePath);

            // Create model - this makes relative imports work!
            const model = monaco.editor.createModel(content, language, uri);
            createdModels.set(uriString, model);
            createdCount++;
        } catch (error) {
            console.debug('[Project Source] Failed to create model:', filePath, error);
        }
    }

    console.log(`[Project Source] Created ${createdCount} new models, skipped ${skippedCount} existing`);
    console.log(`[Project Source] Sample created URI:`, sourceFiles[0] ? createModelUri(sourceFiles[0]) : 'none');
    return createdCount;
}

/**
 * Configure Monaco's compiler options to support path aliases
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

    // Resolve baseUrl relative to project root
    const resolvedBaseUrl = baseUrl === '.' ? projectRoot : normalizePath(`${projectRoot}/${baseUrl}`);

    console.log('[Project Source] Configuring compiler options:');
    console.log('  - baseUrl:', resolvedBaseUrl);
    console.log('  - paths:', paths);

    // Update compiler options
    monaco.typescript.typescriptDefaults.setCompilerOptions({
        ...currentOptions,
        baseUrl: resolvedBaseUrl,
        paths: paths,
        // These are critical for module resolution
        moduleResolution: monaco.typescript.ModuleResolutionKind.NodeJs,
        allowJs: true,
        checkJs: false,
    });
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

    console.log('[Project Source] ===== Starting registration =====');
    console.log('[Project Source] Project root:', projectRoot);
    const startTime = performance.now();

    try {
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
        console.log(`[Project Source] Found ${sourceFiles.length} source files`);

        // Create models for all source files (enables relative imports)
        await createModelsForSourceFiles(sourceFiles, monaco);

        const endTime = performance.now();
        console.log(`[Project Source] ===== Registration complete in ${(endTime - startTime).toFixed(0)}ms =====`);
        console.log(`[Project Source] Total models in registry: ${createdModels.size}`);

        // Debug: List all models
        const allModels = monaco.editor.getModels();
        console.log(`[Project Source] Total models in Monaco: ${allModels.length}`);
        if (allModels.length > 0) {
            console.log(`[Project Source] First 5 model URIs:`, allModels.slice(0, 5).map(m => m.uri.toString()));
        }

    } catch (error) {
        console.error('[Project Source] Registration failed:', error);
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
    console.log('[Project Source] Models cleared');
}
