import { create } from 'zustand';
import { getProjectConfigurations, BuildConfiguration } from '@/lib/csharpBuild';

interface CSharpStore {
    configurations: BuildConfiguration[];
    selectedConfiguration: string | null;

    setConfigurations: (configs: BuildConfiguration[]) => void;
    setSelectedConfiguration: (config: string | null) => void;
    loadProjectConfigurations: (workspaceRoot: string) => Promise<void>;
    reset: () => void;
}

export const useCSharpStore = create<CSharpStore>((set) => ({
    configurations: [],
    selectedConfiguration: null,

    setConfigurations: (configs) => set({ configurations: configs }),

    setSelectedConfiguration: (config) => set({ selectedConfiguration: config }),

    loadProjectConfigurations: async (workspaceRoot) => {
        try {
            console.log('[CSharp] Loading configurations for:', workspaceRoot);
            const configs = await getProjectConfigurations(workspaceRoot);
            console.log('[CSharp] Received configurations:', configs);

            if (!configs || configs.length === 0) {
                console.warn('[CSharp] No configurations returned, check if .csproj exists');
            }

            const selectedConfig = configs.find((c) => c.name === 'Debug')?.name || configs[0]?.name || null;

            set({
                configurations: configs,
                selectedConfiguration: selectedConfig,
            });

            console.log('[CSharp] Store updated - configs:', configs.length, 'selected:', selectedConfig);
        } catch (error) {
            console.error('[CSharp] Failed to load configurations:', error);
            if (error instanceof Error) {
                console.error('[CSharp] Error details:', error.message);
            }
            set({ configurations: [], selectedConfiguration: null });
        }
    },

    reset: () => {
        console.log('[CSharp] Resetting store');
        set({ configurations: [], selectedConfiguration: null });
    },
}));
