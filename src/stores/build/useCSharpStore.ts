import { create } from 'zustand';
import { getProjectConfigurations, BuildConfiguration } from '@/lib/languages/csharp';

interface CSharpStore {
    configurations: BuildConfiguration[];
    selectedConfiguration: string | null;
    lastLoadedWorkspace: string | null;
    /** Loading state for configuration fetching */
    isLoadingConfigs: boolean;

    setConfigurations: (configs: BuildConfiguration[]) => void;
    setSelectedConfiguration: (config: string | null) => void;
    loadProjectConfigurations: (workspaceRoot: string) => Promise<void>;
    reset: () => void;
}

export const useCSharpStore = create<CSharpStore>((set, get) => ({
    configurations: [],
    selectedConfiguration: null,
    lastLoadedWorkspace: null,
    isLoadingConfigs: false,

    setConfigurations: (configs) => set({ configurations: configs }),

    setSelectedConfiguration: (config) => set({ selectedConfiguration: config }),

    loadProjectConfigurations: async (workspaceRoot) => {
        // Skip if we've already loaded configurations for this workspace
        if (get().lastLoadedWorkspace === workspaceRoot && get().configurations.length > 0) {
            if (import.meta.env.DEV) {
                console.log('[CSharp] Configurations already loaded for:', workspaceRoot);
            }
            return;
        }

        // Set loading state
        set({ isLoadingConfigs: true });

        try {
            if (import.meta.env.DEV) {
                console.log('[CSharp] Loading configurations for:', workspaceRoot);
            }
            const configs = await getProjectConfigurations(workspaceRoot);

            if (import.meta.env.DEV) {
                console.log('[CSharp] Received configurations:', configs);
            }

            if (!configs || configs.length === 0) {
                if (import.meta.env.DEV) {
                    console.warn('[CSharp] No configurations returned, check if .csproj exists');
                }
            }

            const selectedConfig = configs.find((c) => c.name === 'Debug')?.name || configs[0]?.name || null;

            set({
                configurations: configs,
                selectedConfiguration: selectedConfig,
                lastLoadedWorkspace: workspaceRoot,
                isLoadingConfigs: false,
            });

            if (import.meta.env.DEV) {
                console.log('[CSharp] Store updated - configs:', configs.length, 'selected:', selectedConfig);
            }
        } catch (error) {
            console.error('[CSharp] Failed to load configurations:', error);
            if (error instanceof Error) {
                console.error('[CSharp] Error details:', error.message);
            }
            set({ configurations: [], selectedConfiguration: null, lastLoadedWorkspace: null, isLoadingConfigs: false });
        }
    },

    reset: () => {
        if (import.meta.env.DEV) {
            console.log('[CSharp] Resetting store');
        }
        set({ configurations: [], selectedConfiguration: null, lastLoadedWorkspace: null, isLoadingConfigs: false });
    },
}));

