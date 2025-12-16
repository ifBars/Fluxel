/**
 * Integration Example: How to update useCSharpStore to use useProjectSettingsStore
 * 
 * This file demonstrates the changes needed to integrate per-project settings
 * persistence into the existing C# store.
 * 
 * Location: src/stores/build/useCSharpStore.ts
 */

import { create } from 'zustand';
import { getProjectConfigurations, BuildConfiguration } from '@/lib/languages/csharp';
import { useProjectSettingsStore } from '@/stores/project';

interface CSharpStore {
	configurations: BuildConfiguration[];
	selectedConfiguration: string | null;
	lastLoadedWorkspace: string | null;
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
		// CHANGE: Persist the selection to project settings store
		const workspaceRoot = get().lastLoadedWorkspace;
		if (workspaceRoot) {
			const { setSettings } = useProjectSettingsStore.getState();
			setSettings(workspaceRoot, { selectedBuildConfiguration: config });
		}
		set({ selectedConfiguration: config });
	},

	loadProjectConfigurations: async (workspaceRoot) => {
		// Skip if we've already loaded configurations for this workspace
		if (get().lastLoadedWorkspace === workspaceRoot && get().configurations.length > 0) {
			if (import.meta.env.DEV) {
				console.log('[CSharp] Configurations already loaded for:', workspaceRoot);
			}
			return;
		}

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

			// CHANGE: Restore previously selected configuration from project settings
			const { getSettings } = useProjectSettingsStore.getState();
			const savedSettings = getSettings(workspaceRoot);
			const savedConfig = savedSettings.selectedBuildConfiguration;

			// Try to use saved config if it's valid, otherwise default to Debug or first available
			const selectedConfig = 
				(savedConfig && configs.find((c) => c.name === savedConfig)?.name) || // Saved config (if valid)
				configs.find((c) => c.name === 'Debug')?.name ||                       // Default to Debug
				configs[0]?.name ||                                                     // First available
				null;

			if (import.meta.env.DEV && savedConfig && savedConfig !== selectedConfig) {
				console.warn(
					`[CSharp] Saved configuration "${savedConfig}" not found in available configs. Using "${selectedConfig}" instead.`
				);
			}

			set({
				configurations: configs,
				selectedConfiguration: selectedConfig,
				lastLoadedWorkspace: workspaceRoot,
				isLoadingConfigs: false,
			});

			// CHANGE: If we're using a different config than saved, update the settings
			if (selectedConfig !== savedConfig) {
				const { setSettings } = useProjectSettingsStore.getState();
				setSettings(workspaceRoot, { selectedBuildConfiguration: selectedConfig });
			}

			if (import.meta.env.DEV) {
				console.log('[CSharp] Store updated - configs:', configs.length, 'selected:', selectedConfig);
			}
		} catch (error) {
			console.error('[CSharp] Failed to load configurations:', error);
			if (error instanceof Error) {
				console.error('[CSharp] Error details:', error.message);
			}
			set({
				configurations: [],
				selectedConfiguration: null,
				lastLoadedWorkspace: null,
				isLoadingConfigs: false,
			});
		}
	},

	reset: () => {
		if (import.meta.env.DEV) {
			console.log('[CSharp] Resetting store');
		}
		// Note: We don't clear project settings on reset - they should persist
		set({
			configurations: [],
			selectedConfiguration: null,
			lastLoadedWorkspace: null,
			isLoadingConfigs: false,
		});
	},
}));

/**
 * USAGE IN COMPONENTS
 * 
 * The component usage remains the same - no changes needed:
 */

// Example: BuildPanel.tsx
/*
function BuildPanel() {
	const workspaceRoot = useProjectStore((s) => s.currentProject?.rootPath);
	const { configurations, selectedConfiguration, setSelectedConfiguration } = useCSharpStore();

	// Load configurations when workspace changes
	useEffect(() => {
		if (workspaceRoot) {
			useCSharpStore.getState().loadProjectConfigurations(workspaceRoot);
		}
	}, [workspaceRoot]);

	return (
		<div>
			<select
				value={selectedConfiguration ?? ''}
				onChange={(e) => setSelectedConfiguration(e.target.value)}
			>
				{configurations.map((config) => (
					<option key={config.name} value={config.name}>
						{config.name}
					</option>
				))}
			</select>
		</div>
	);
}
*/

/**
 * MIGRATION NOTES
 * 
 * 1. The useCSharpStore no longer needs Zustand persistence since
 *    useProjectSettingsStore handles that.
 * 
 * 2. The selectedConfiguration is now automatically restored when
 *    loadProjectConfigurations is called for a workspace.
 * 
 * 3. Each workspace has its own saved configuration, so switching
 *    between projects will remember the correct build configuration.
 * 
 * 4. If a saved configuration no longer exists (e.g., was removed from
 *    .csproj), the store falls back to Debug or the first available config.
 */
