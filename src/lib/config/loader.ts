/**
 * Configuration metadata loader
 *
 * Aggregates configuration from multiple sources (vite.config, package.json,
 * tauri.conf.json) and creates a unified ConfigMetadata object.
 */

import { readDir, readTextFile } from '@tauri-apps/plugin-fs';
import {
    DEFAULT_PROJECT,
    DEFAULT_FRAMEWORK,
    DEFAULT_PACKAGE_MANAGER,
    DEFAULT_WINDOW,
    DEFAULT_BUILD,
    CONFIG_FILE_PATHS,
    CONFIG_METADATA_VERSION,
    PACKAGE_MANAGERS,
} from './constants';
import { parseViteConfig } from './parsers/vite';
import {
    packageJsonSchema,
    tauriConfigJsonSchema,
    tsConfigSchema,
} from './schemas/config-schema';
import type {
    ConfigMetadata,
    ConfigResult,
    ProjectInfo,
    TauriConfig,
    WindowConfig,
    PathAliases,
    DependencyInfo,
    Framework,
} from './schemas/metadata-types';
import { useConfigMetadataStore } from '@/stores';
import { FrontendProfiler } from '../services/FrontendProfiler';

/**
 * Parse package.json file
 */
async function parsePackageJson(
    projectRoot: string
): Promise<ConfigResult<{
    project: ProjectInfo;
    dependencies?: DependencyInfo;
    scripts?: Record<string, string>;
    isTypeScript?: boolean;
}>> {
    try {
        const content = await readTextFile(
            `${projectRoot}/${CONFIG_FILE_PATHS.PACKAGE}`
        );
        const json = JSON.parse(content);
        const result = packageJsonSchema.safeParse(json);

        if (!result.success) {
            return {
                success: false,
                errors: [`Invalid package.json: ${result.error.message}`],
            };
        }

        const pkg = result.data;
        const project: ProjectInfo = {
            name: pkg.name,
            version: pkg.version,
            description: pkg.description,
            private: pkg.private,
            type: pkg.type,
            license: pkg.license,
            author: pkg.author,
        };

        const dependencies: DependencyInfo | undefined =
            pkg.dependencies || pkg.devDependencies || pkg.peerDependencies
                ? {
                    dependencies: pkg.dependencies ?? {},
                    devDependencies: pkg.devDependencies ?? {},
                    peerDependencies: pkg.peerDependencies,
                }
                : undefined;

        // Check if TypeScript is in devDependencies
        const isTypeScript =
            pkg.devDependencies?.['typescript'] !== undefined ||
            pkg.dependencies?.['typescript'] !== undefined;

        return {
            success: true,
            data: {
                project,
                dependencies,
                scripts: pkg.scripts,
                isTypeScript,
            },
        };
    } catch (error) {
        return {
            success: false,
            errors: [
                `Failed to read package.json: ${error instanceof Error ? error.message : String(error)}`,
            ],
        };
    }
}

/**
 * Parse tauri.conf.json file
 */
async function parseTauriConfig(
    projectRoot: string
): Promise<ConfigResult<{ tauri: TauriConfig }>> {
    try {
        const content = await readTextFile(
            `${projectRoot}/${CONFIG_FILE_PATHS.TAURI}`
        );
        const json = JSON.parse(content);
        const result = tauriConfigJsonSchema.safeParse(json);

        if (!result.success) {
            return {
                success: false,
                errors: [`Invalid tauri.conf.json: ${result.error.message}`],
            };
        }

        const tauriJson = result.data;
        const window = tauriJson.app?.windows?.[0] ?? {};

        const windowConfig: WindowConfig = {
            title: window.title ?? DEFAULT_WINDOW.TITLE,
            width: window.width ?? DEFAULT_WINDOW.WIDTH,
            height: window.height ?? DEFAULT_WINDOW.HEIGHT,
            minWidth: window.minWidth ?? DEFAULT_WINDOW.MIN_WIDTH,
            minHeight: window.minHeight ?? DEFAULT_WINDOW.MIN_HEIGHT,
            maxWidth: window.maxWidth,
            maxHeight: window.maxHeight,
            decorations: window.decorations ?? DEFAULT_WINDOW.DECORATIONS,
            transparent: window.transparent ?? DEFAULT_WINDOW.TRANSPARENT,
            resizable: window.resizable,
            fullscreen: window.fullscreen,
            alwaysOnTop: window.alwaysOnTop,
        };

        const tauri: TauriConfig = {
            productName: tauriJson.productName ?? DEFAULT_PROJECT.NAME,
            version: tauriJson.version ?? DEFAULT_PROJECT.VERSION,
            identifier:
                tauriJson.identifier ??
                `com.tauri.${tauriJson.productName ?? DEFAULT_PROJECT.NAME}`,
            beforeDevCommand:
                tauriJson.build?.beforeDevCommand ?? 'bun run dev',
            beforeBuildCommand:
                tauriJson.build?.beforeBuildCommand ?? 'bun run build',
            devUrl: tauriJson.build?.devUrl ?? 'http://localhost:1420',
            frontendDist:
                tauriJson.build?.frontendDist ?? DEFAULT_BUILD.FRONTEND_DIST,
            window: windowConfig,
            bundle: tauriJson.bundle
                ? {
                    active: tauriJson.bundle.active ?? DEFAULT_BUILD.BUNDLE_ACTIVE,
                    targets:
                        tauriJson.bundle.targets ?? DEFAULT_BUILD.BUNDLE_TARGETS,
                    icon: tauriJson.bundle.icon,
                }
                : undefined,
        };

        return {
            success: true,
            data: { tauri },
        };
    } catch (error) {
        // Tauri config is optional for non-Tauri projects
        return {
            success: false,
            errors: [
                `Failed to read tauri.conf.json: ${error instanceof Error ? error.message : String(error)}`,
            ],
        };
    }
}

/**
 * Parse tsconfig.json file
 */
async function parseTsConfig(
    projectRoot: string
): Promise<ConfigResult<{ pathAliases?: PathAliases }>> {
    try {
        const content = await readTextFile(
            `${projectRoot}/${CONFIG_FILE_PATHS.TSCONFIG}`
        );
        const json = JSON.parse(content);
        const result = tsConfigSchema.safeParse(json);

        if (!result.success) {
            return {
                success: false,
                errors: [`Invalid tsconfig.json: ${result.error.message}`],
            };
        }

        const tsConfig = result.data;
        const pathAliases: PathAliases | undefined =
            tsConfig.compilerOptions?.baseUrl || tsConfig.compilerOptions?.paths
                ? {
                    baseUrl: tsConfig.compilerOptions.baseUrl,
                    paths: tsConfig.compilerOptions.paths,
                }
                : undefined;

        return {
            success: true,
            data: { pathAliases },
        };
    } catch (error) {
        // tsconfig.json is optional
        return {
            success: false,
            errors: [
                `Failed to read tsconfig.json: ${error instanceof Error ? error.message : String(error)}`,
            ],
        };
    }
}

/**
 * Detect framework from package.json dependencies
 */
function detectFramework(
    dependencies?: DependencyInfo
): Framework {
    if (!dependencies) return DEFAULT_FRAMEWORK;

    const allDeps = {
        ...dependencies.dependencies,
        ...dependencies.devDependencies,
    };

    if (allDeps['react']) return 'react';
    if (allDeps['vue']) return 'vue';
    if (allDeps['svelte']) return 'svelte';
    if (allDeps['solid-js']) return 'solid';
    if (allDeps['preact']) return 'preact';

    return DEFAULT_FRAMEWORK;
}

/**
 * Detect package manager from lock files
 */
async function detectPackageManager(
    projectRoot: string
): Promise<(typeof PACKAGE_MANAGERS)[number]> {
    const lockfilePriority: Array<{
        file: string;
        manager: (typeof PACKAGE_MANAGERS)[number];
    }> = [
            { file: 'bun.lockb', manager: 'bun' },
            { file: 'bun.lock', manager: 'bun' },
            { file: 'pnpm-lock.yaml', manager: 'pnpm' },
            { file: 'yarn.lock', manager: 'yarn' },
            { file: 'package-lock.json', manager: 'npm' },
        ];

    try {
        const entries = await readDir(projectRoot);
        const names = new Set(entries.map((entry) => entry.name).filter(Boolean));

        for (const { file, manager } of lockfilePriority) {
            if (names.has(file)) {
                return manager;
            }
        }
    } catch (error) {
        console.warn('Failed to detect package manager; defaulting to bun:', error);
    }

    return DEFAULT_PACKAGE_MANAGER;
}

/**
 * Load and aggregate all configuration metadata for a project
 */
export async function loadConfigMetadata(
    projectRoot: string
): Promise<ConfigResult<ConfigMetadata>> {
    const span = FrontendProfiler.startSpan('load_config_metadata', 'frontend_network');
    
    // Guard: Skip if already cached for this project
    const cached = useConfigMetadataStore.getState().getMetadata(projectRoot);
    if (cached) {
        await span.end({ cached: 'true', projectRoot });
        return { success: true, data: cached };
    }

    const errors: string[] = [];

    const defaultWindowConfig: WindowConfig = {
        title: DEFAULT_WINDOW.TITLE,
        width: DEFAULT_WINDOW.WIDTH,
        height: DEFAULT_WINDOW.HEIGHT,
        minWidth: DEFAULT_WINDOW.MIN_WIDTH,
        minHeight: DEFAULT_WINDOW.MIN_HEIGHT,
        decorations: DEFAULT_WINDOW.DECORATIONS,
        transparent: DEFAULT_WINDOW.TRANSPARENT,
    };

    try {
        // Parse all config files AND detect package manager in parallel
        const [pkgResult, viteResult, tauriResult, tsResult, packageManager] = await Promise.all([
            parsePackageJson(projectRoot),
            parseViteConfig(projectRoot),
            parseTauriConfig(projectRoot),
            parseTsConfig(projectRoot),
            detectPackageManager(projectRoot),
        ]);

        // Collect errors
        if (!pkgResult.success) {
            errors.push(...(pkgResult.errors ?? []));
        }
        if (!viteResult.success) {
            errors.push(...(viteResult.errors ?? []));
        }
        if (!tauriResult.success) {
            // Tauri config is optional, so we'll create a default
        }
        if (!tsResult.success) {
            // tsconfig is optional
        }

        // Use package.json data or defaults
        const pkgData = pkgResult.success
            ? pkgResult.data
            : {
                project: {
                    name: DEFAULT_PROJECT.NAME,
                    version: DEFAULT_PROJECT.VERSION,
                    description: DEFAULT_PROJECT.DESCRIPTION,
                },
                dependencies: undefined,
                scripts: undefined,
                isTypeScript: false,
            };

        // Use vite config data or defaults
        const viteData = viteResult.success
            ? viteResult.data
            : {
                devServer: {
                    host: 'localhost',
                    port: 1420,
                    strictPort: true,
                    clearScreen: false,
                },
                hmr: {
                    enabled: true,
                    port: 1421,
                    protocol: 'ws' as const,
                },
                build: {
                    outDir: DEFAULT_BUILD.DIST_DIR,
                },
            };

        // Use tauri config data or create minimal default
        const tauriData = tauriResult.success
            ? tauriResult.data.tauri
            : {
                productName: pkgData.project.name,
                version: pkgData.project.version,
                identifier: `com.tauri.${pkgData.project.name}`,
                beforeDevCommand: 'bun run dev',
                beforeBuildCommand: 'bun run build',
                devUrl: `http://localhost:${viteData.devServer.port}`,
                frontendDist: DEFAULT_BUILD.FRONTEND_DIST,
                window: defaultWindowConfig,
            };

        // Build complete metadata
        const metadata: ConfigMetadata = {
            version: CONFIG_METADATA_VERSION,
            lastUpdated: new Date().toISOString(),
            project: pkgData.project,
            framework: detectFramework(pkgData.dependencies),
            packageManager,
            devServer: viteData.devServer,
            hmr: viteData.hmr,
            tauri: tauriData,
            build: viteData.build,
            pathAliases: tsResult.success ? tsResult.data.pathAliases : undefined,
            dependencies: pkgData.dependencies,
            scripts: pkgData.scripts,
            isTypeScript: pkgData.isTypeScript,
        };

        // Store in metadata store
        useConfigMetadataStore.getState().setMetadata(projectRoot, metadata);

        await span.end({
            projectRoot,
            packageManager,
            framework: metadata.framework,
            isTypeScript: pkgData.isTypeScript?.toString() || 'false',
            errorCount: errors.length.toString(),
            success: (errors.length === 0).toString()
        });

        if (errors.length > 0) {
            return {
                success: false,
                errors,
            };
        }

        return {
            success: true,
            data: metadata,
        };
    } catch (error) {
        await span.end({ 
            error: error instanceof Error ? error.message : 'Unknown error',
            projectRoot 
        });
        throw error;
    }
}

/**
 * Get cached metadata for a project, or load it if not cached
 */
export async function getConfigMetadata(
    projectRoot: string,
    forceReload = false
): Promise<ConfigMetadata | null> {
    if (!forceReload) {
        const cached = useConfigMetadataStore.getState().getMetadata(projectRoot);
        if (cached) {
            return cached;
        }
    }

    const result = await loadConfigMetadata(projectRoot);
    return result.success ? result.data : null;
}

