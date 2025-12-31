/**
 * Plugin Store
 * 
 * Zustand store for managing plugin state in the UI.
 * Follows the same patterns as useSettingsStore and useWorkbenchStore.
 */

import { create } from 'zustand';

import type { RegisteredPlugin, DetectedProject } from '@/lib/plugins/types';
import { getPluginHost } from '@/lib/plugins';

/**
 * Plugin store state interface
 */
export interface PluginStoreState {
    // State
    /** All registered plugins */
    plugins: RegisteredPlugin[];
    /** Detected project types */
    detectedProjects: DetectedProject[];
    /** Whether plugins have been initialized */
    isInitialized: boolean;
    /** Whether plugins are currently loading */
    isLoading: boolean;
    /** Error message if initialization failed */
    error: string | null;

    // Actions
    /** Initialize the plugin store (syncs with PluginHost) */
    initialize: () => void;
    /** Refresh plugins from the host */
    refresh: () => void;
    /** Activate a plugin by ID */
    activatePlugin: (pluginId: string) => Promise<boolean>;
    /** Deactivate a plugin by ID */
    deactivatePlugin: (pluginId: string) => Promise<void>;
    /** Get plugin by ID */
    getPlugin: (pluginId: string) => RegisteredPlugin | undefined;
    /** Check if a plugin is active */
    isPluginActive: (pluginId: string) => boolean;
    /** Set loading state */
    setIsLoading: (isLoading: boolean) => void;
    /** Set error state */
    setError: (error: string | null) => void;
}

/**
 * Plugin store for managing plugin state in the UI
 */
export const usePluginStore = create<PluginStoreState>((set, get) => ({
    // Initial state
    plugins: [],
    detectedProjects: [],
    isInitialized: false,
    isLoading: false,
    error: null,

    // Actions
    initialize: () => {
        const host = getPluginHost();
        
        // Subscribe to plugin events
        host.on('plugin:registered', () => get().refresh());
        host.on('plugin:activated', () => get().refresh());
        host.on('plugin:deactivated', () => get().refresh());
        host.on('plugin:error', () => get().refresh());
        host.on('project:detected', () => {
            set({ detectedProjects: host.getDetectedProjects() });
        });

        // Initial sync
        set({
            plugins: host.getPlugins(),
            detectedProjects: host.getDetectedProjects(),
            isInitialized: true,
        });

        console.log('[PluginStore] Initialized');
    },

    refresh: () => {
        const host = getPluginHost();
        set({
            plugins: host.getPlugins(),
            detectedProjects: host.getDetectedProjects(),
        });
    },

    activatePlugin: async (pluginId: string) => {
        const host = getPluginHost();
        set({ isLoading: true, error: null });

        try {
            const result = await host.activatePlugin(pluginId);
            get().refresh();
            
            if (!result.success) {
                set({ error: result.error ?? 'Unknown error' });
                return false;
            }
            
            return true;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            set({ error: errorMessage });
            return false;
        } finally {
            set({ isLoading: false });
        }
    },

    deactivatePlugin: async (pluginId: string) => {
        const host = getPluginHost();
        set({ isLoading: true, error: null });

        try {
            await host.deactivatePlugin(pluginId);
            get().refresh();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            set({ error: errorMessage });
        } finally {
            set({ isLoading: false });
        }
    },

    getPlugin: (pluginId: string) => {
        return get().plugins.find(p => p.manifest.id === pluginId);
    },

    isPluginActive: (pluginId: string) => {
        const plugin = get().plugins.find(p => p.manifest.id === pluginId);
        return plugin?.state === 'active';
    },

    setIsLoading: (isLoading: boolean) => set({ isLoading }),
    
    setError: (error: string | null) => set({ error }),
}));

