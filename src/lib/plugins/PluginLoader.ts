/**
 * Plugin Loader
 * 
 * Handles loading plugins from both bundled (core) and dynamic (community) sources.
 */

import type { FluxelPlugin, PluginLoadResult } from './types';
import { getPluginHost } from './PluginHost';

/**
 * Interface for community plugin metadata read from disk
 */
export interface CommunityPluginMeta {
    id: string;
    name: string;
    version: string;
    description?: string;
    author?: string;
    main: string; // Entry point file
    activationEvents: string[];
    path: string; // Full path to plugin directory
}

/**
 * Plugin Loader - Handles static and dynamic plugin loading
 */
export class PluginLoader {
    private static instance: PluginLoader | null = null;
    private corePlugins: FluxelPlugin[] = [];
    private communityPluginsPath: string | null = null;

    private constructor() {}

    /**
     * Get the singleton instance
     */
    static getInstance(): PluginLoader {
        if (!PluginLoader.instance) {
            PluginLoader.instance = new PluginLoader();
        }
        return PluginLoader.instance;
    }

    /**
     * Register a core plugin (bundled at build time)
     */
    registerCorePlugin(plugin: FluxelPlugin): void {
        // Check if plugin is already registered to prevent duplicates
        const existingIndex = this.corePlugins.findIndex(p => p.id === plugin.id);
        if (existingIndex !== -1) {
            console.log(`[PluginLoader] Core plugin ${plugin.id} is already registered, skipping`);
            return;
        }
        
        this.corePlugins.push(plugin);
        console.log(`[PluginLoader] Registered core plugin: ${plugin.id}`);
    }

    /**
     * Set the path for community plugins
     */
    setCommunityPluginsPath(path: string): void {
        this.communityPluginsPath = path;
        console.log(`[PluginLoader] Community plugins path: ${path}`);
    }

    /**
     * Load all core plugins into the plugin host
     */
    async loadCorePlugins(): Promise<PluginLoadResult[]> {
        const results: PluginLoadResult[] = [];
        const host = getPluginHost();

        for (const plugin of this.corePlugins) {
            try {
                host.register(plugin, 'core');
                results.push({ success: true, plugin });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`[PluginLoader] Failed to load core plugin ${plugin.id}:`, error);
                results.push({ success: false, error: errorMessage });
            }
        }

        console.log(`[PluginLoader] Loaded ${results.filter(r => r.success).length}/${this.corePlugins.length} core plugins`);
        return results;
    }

    /**
     * Discover and load community plugins from the plugins directory
     * Note: This requires Tauri backend support to read the filesystem
     */
    async loadCommunityPlugins(): Promise<PluginLoadResult[]> {
        if (!this.communityPluginsPath) {
            console.log('[PluginLoader] No community plugins path configured');
            return [];
        }

        const results: PluginLoadResult[] = [];

        try {
            // Import Tauri APIs for filesystem access
            const { invoke } = await import('@tauri-apps/api/core');
            
            // Call Tauri backend to discover plugins
            const pluginMetas = await invoke<CommunityPluginMeta[]>('discover_community_plugins', {
                pluginsPath: this.communityPluginsPath,
            }).catch(() => {
                // Command might not exist yet
                console.log('[PluginLoader] Community plugin discovery not available');
                return [] as CommunityPluginMeta[];
            });

            for (const meta of pluginMetas) {
                const result = await this.loadCommunityPlugin(meta);
                results.push(result);
            }

            console.log(`[PluginLoader] Loaded ${results.filter(r => r.success).length}/${pluginMetas.length} community plugins`);
        } catch (error) {
            console.error('[PluginLoader] Failed to load community plugins:', error);
        }

        return results;
    }

    /**
     * Load a single community plugin
     */
    private async loadCommunityPlugin(meta: CommunityPluginMeta): Promise<PluginLoadResult> {
        try {
            // For now, community plugins need to be ESM modules that can be imported
            // In the future, we could use dynamic import with blob URLs or a sandboxed runtime
            console.log(`[PluginLoader] Loading community plugin: ${meta.id} from ${meta.path}`);

            // Note: Dynamic import of local files in Tauri requires special handling
            // For now, we log that community plugin loading is not yet fully implemented
            console.warn(`[PluginLoader] Community plugin loading from filesystem not yet implemented: ${meta.id}`);
            
            return {
                success: false,
                error: 'Community plugin loading not yet fully implemented',
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[PluginLoader] Failed to load community plugin ${meta.id}:`, error);
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Load all plugins (core + community)
     */
    async loadAllPlugins(): Promise<{ core: PluginLoadResult[]; community: PluginLoadResult[] }> {
        const core = await this.loadCorePlugins();
        const community = await this.loadCommunityPlugins();
        return { core, community };
    }

    /**
     * Get registered core plugins
     */
    getCorePlugins(): FluxelPlugin[] {
        return [...this.corePlugins];
    }

    /**
     * Clear all registered plugins (for testing)
     */
    clear(): void {
        this.corePlugins = [];
    }
}

/**
 * Get the plugin loader singleton
 */
export function getPluginLoader(): PluginLoader {
    return PluginLoader.getInstance();
}

/**
 * Helper to get the community plugins directory path
 * Returns ~/.fluxel/plugins on all platforms
 */
export async function getCommunityPluginsPath(): Promise<string | null> {
    try {
        const { homeDir, join } = await import('@tauri-apps/api/path');
        const home = await homeDir();
        return await join(home, '.fluxel', 'plugins');
    } catch (error) {
        console.error('[PluginLoader] Failed to get community plugins path:', error);
        return null;
    }
}

