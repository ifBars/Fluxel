/**
 * Lazy Type Resolver
 * 
 * On-demand type loading with smooth UX.
 * Only loads types for packages that are actually imported.
 */

import type * as Monaco from 'monaco-editor';
import { batchReadFiles, batchDiscoverTypings } from '../../services';
import { normalizePath, toFileUri } from './TypeLoader';
import { useTypeLoadingStore } from '@/stores';

type MonacoInstance = typeof Monaco;

/** Essential packages loaded immediately on project open */
const ESSENTIAL_PACKAGES = [
    // React ecosystem
    'react', 'react-dom',
    // Build tools
    'vite',
];

/** Maximum packages to load in one batch */
const MAX_BATCH_SIZE = 10;

export class LazyTypeResolver {
    private loadedPackages = new Set<string>();
    private loadingPackages = new Set<string>();
    private pendingPackages: string[] = [];
    private monaco: MonacoInstance;
    private projectRoot: string;
    private loadedTypeUris = new Set<string>();
    private isProcessing = false;

    constructor(monaco: MonacoInstance, projectRoot: string) {
        this.monaco = monaco;
        this.projectRoot = projectRoot;
    }

    /**
     * Get the list of essential packages to load immediately.
     */
    getEssentialPackages(): string[] {
        return [...ESSENTIAL_PACKAGES];
    }

    /**
     * Check if a package's types are already loaded.
     */
    isPackageLoaded(packageName: string): boolean {
        return this.loadedPackages.has(packageName);
    }

    /**
     * Mark a package as loaded (for external loading).
     */
    markPackageLoaded(packageName: string): void {
        this.loadedPackages.add(packageName);
        this.loadingPackages.delete(packageName);
    }

    /**
     * Called when a file is opened or modified.
     * Parses imports and ensures types are loaded.
     */
    async ensureTypesForFile(content: string): Promise<void> {
        const imports = this.parseImports(content);
        const unloadedPackages = imports.filter(pkg =>
            !this.loadedPackages.has(pkg) &&
            !this.loadingPackages.has(pkg) &&
            !this.pendingPackages.includes(pkg)
        );

        if (unloadedPackages.length > 0) {
            // Add to pending queue
            this.pendingPackages.push(...unloadedPackages);

            // Process queue if not already processing
            if (!this.isProcessing) {
                await this.processQueue();
            }
        }
    }

    /**
     * Process the pending packages queue in batches.
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessing || this.pendingPackages.length === 0) {
            return;
        }

        this.isProcessing = true;
        const store = useTypeLoadingStore.getState();

        try {
            while (this.pendingPackages.length > 0) {
                // Take a batch from the queue
                const batch = this.pendingPackages.splice(0, MAX_BATCH_SIZE);

                // Filter out any that got loaded while we were processing
                const toLoad = batch.filter(pkg =>
                    !this.loadedPackages.has(pkg) &&
                    !this.loadingPackages.has(pkg)
                );

                if (toLoad.length > 0) {
                    // Update UI
                    store.startLoading(
                        `Loading types: ${toLoad.slice(0, 3).join(', ')}${toLoad.length > 3 ? '...' : ''}`,
                        toLoad.length
                    );

                    // Mark as loading
                    toLoad.forEach(pkg => this.loadingPackages.add(pkg));

                    try {
                        await this.loadPackageTypesBatch(toLoad);

                        // Mark as loaded
                        toLoad.forEach(pkg => {
                            this.loadingPackages.delete(pkg);
                            this.loadedPackages.add(pkg);
                        });

                        store.updateProgress(toLoad.length);
                    } catch (error) {
                        console.error('[LazyTypeResolver] Failed to load types:', error);
                        // Remove from loading state even on error
                        toLoad.forEach(pkg => this.loadingPackages.delete(pkg));
                    }
                }
            }
        } finally {
            this.isProcessing = false;
            store.finishLoading();
        }
    }

    /**
     * Load types for a batch of packages using batch operations.
     */
    private async loadPackageTypesBatch(packages: string[]): Promise<void> {
        // Discover typings for all packages in one IPC call
        const typings = await batchDiscoverTypings(packages, this.projectRoot);

        // Collect all files to read
        const allFiles: string[] = [];
        for (const typing of typings) {
            allFiles.push(...typing.files);
        }

        if (allFiles.length === 0) {
            return;
        }

        // Read all files in one IPC call
        const contents = await batchReadFiles(allFiles);

        // Register all types
        for (const [filePath, content] of Object.entries(contents)) {
            const virtualPath = this.toVirtualPath(filePath);

            // Skip if already loaded
            if (this.loadedTypeUris.has(virtualPath)) {
                continue;
            }

            try {
                this.monaco.typescript.typescriptDefaults.addExtraLib(content as string, virtualPath);
                this.loadedTypeUris.add(virtualPath);
            } catch (error) {
                console.debug('[LazyTypeResolver] Failed to add lib:', virtualPath, error);
            }
        }

        // Log progress
        console.log(`[LazyTypeResolver] Loaded ${Object.keys(contents).length} type files for ${packages.length} packages`);
    }

    /**
     * Convert an absolute path to a virtual node_modules path for Monaco.
     */
    private toVirtualPath(absolutePath: string): string {
        return toFileUri(normalizePath(absolutePath));
    }

    /**
     * Parse import statements from file content.
     * Returns bare package names (not relative imports).
     */
    private parseImports(content: string): string[] {
        // Match both import and require statements
        const importRegex = /(?:import|from|require\s*\()\s*['"]([^'"./][^'"]*)['"]/g;
        const packages = new Set<string>();
        let match;

        while ((match = importRegex.exec(content))) {
            const spec = match[1];
            // Skip node built-ins
            if (spec.startsWith('node:')) {
                continue;
            }
            // Extract package root (e.g., '@tanstack/react-query' -> '@tanstack/react-query')
            const root = spec.startsWith('@')
                ? spec.split('/').slice(0, 2).join('/')
                : spec.split('/')[0];
            packages.add(root);
        }

        return Array.from(packages);
    }

    /**
     * Clear loaded types (for project switch).
     */
    clear(): void {
        this.loadedPackages.clear();
        this.loadingPackages.clear();
        this.pendingPackages = [];
        this.loadedTypeUris.clear();
        this.isProcessing = false;
    }
}

// Singleton instance
let resolverInstance: LazyTypeResolver | null = null;

/**
 * Get or create the lazy type resolver.
 */
export function getLazyTypeResolver(
    monaco?: MonacoInstance,
    projectRoot?: string
): LazyTypeResolver | null {
    if (monaco && projectRoot) {
        // Create new instance if project changed
        if (resolverInstance && resolverInstance['projectRoot'] !== projectRoot) {
            resolverInstance.clear();
            resolverInstance = new LazyTypeResolver(monaco, projectRoot);
        } else if (!resolverInstance) {
            resolverInstance = new LazyTypeResolver(monaco, projectRoot);
        }
    }
    return resolverInstance;
}

/**
 * Clear the resolver instance (for project switch).
 */
export function clearLazyTypeResolver(): void {
    if (resolverInstance) {
        resolverInstance.clear();
        resolverInstance = null;
    }
}
