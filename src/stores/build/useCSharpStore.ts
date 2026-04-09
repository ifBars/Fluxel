import { create } from 'zustand';
import { getProjectConfigurations, BuildConfiguration } from '@/lib/languages/csharp';
import { getCSharpLSPClient } from '@/lib/languages/csharp/CSharpLSPClient';
import { choosePreferredBuildConfiguration } from '@/lib/languages/csharp/workspaceConfiguration';
import { FrontendProfiler } from '@/lib/services';
import { useProjectSettingsStore } from '@/stores/project/useProjectSettingsStore';

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

    setSelectedConfiguration: (config) => {
        const workspaceRoot = get().lastLoadedWorkspace;
        set({ selectedConfiguration: config });

        if (!workspaceRoot) {
            return;
        }

        useProjectSettingsStore.getState().setSettings(workspaceRoot, {
            selectedBuildConfiguration: config,
        });

        const lspClient = getCSharpLSPClient();
        if (!config || lspClient.getWorkspaceRoot() !== workspaceRoot || !lspClient.getIsStarted()) {
            return;
        }

        void (async () => {
            try {
                await lspClient.stop();
                await lspClient.start(workspaceRoot);
                await lspClient.initialize(workspaceRoot);
            } catch (error) {
                console.error('[CSharp] Failed to reload LSP for configuration change:', error);
            }
        })();
    },

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

        const span = FrontendProfiler.startSpan('load_project_configurations', 'frontend_network');

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
                    console.warn('[CSharp] No configurations returned, check if .csproj exists', {
                        workspaceRoot,
                        configCount: 0
                    });
                }
            }

            const savedConfig = useProjectSettingsStore.getState()
                .getSettings(workspaceRoot)
                .selectedBuildConfiguration;
            const selectedConfig = choosePreferredBuildConfiguration(configs, savedConfig);

            if (import.meta.env.DEV) {
                console.log('[CSharp] About to update store with', {
                    configsCount: configs.length,
                    selectedConfig,
                    lastLoadedWorkspace: get().lastLoadedWorkspace,
                    currentWorkspaceRoot: workspaceRoot,
                    loading: true
                });
            }

            set({
                configurations: configs,
                selectedConfiguration: selectedConfig,
                lastLoadedWorkspace: workspaceRoot,
                isLoadingConfigs: false,
            });

            if (selectedConfig) {
                useProjectSettingsStore.getState().setSettings(workspaceRoot, {
                    selectedBuildConfiguration: selectedConfig,
                });
            }

            if (import.meta.env.DEV) {
                console.log('[CSharp] Store updated', {
                    configs: configs.length,
                    selected: selectedConfig,
                    root: workspaceRoot,
                    newLastLoadedWorkspace: workspaceRoot
                });
            }

            await span.end({
                workspaceRoot,
                configCount: configs.length.toString(),
                selectedConfig: selectedConfig || 'none',
                success: 'true'
            });

            if (import.meta.env.DEV) {
                const finalState = get();
                console.log('[CSharp] Final store state verification', {
                    configurations: finalState.configurations,
                    selectedConfiguration: finalState.selectedConfiguration,
                    lastLoadedWorkspace: finalState.lastLoadedWorkspace,
                    isLoadingConfigs: finalState.isLoadingConfigs,
                });
            }
        } catch (error) {
            console.error('[CSharp] Failed to load configurations:', error);
            if (error instanceof Error) {
                console.error('[CSharp] Error details:', error.message);
            }
            set({ configurations: [], selectedConfiguration: null, lastLoadedWorkspace: null, isLoadingConfigs: false });
            await span.end({
                error: error instanceof Error ? error.message : 'Unknown error',
                workspaceRoot
            });
        }
    },

    reset: () => {
        if (import.meta.env.DEV) {
            console.log('[CSharp] Resetting store');
        }
        set({ configurations: [], selectedConfiguration: null, lastLoadedWorkspace: null, isLoadingConfigs: false });
    },
}));
