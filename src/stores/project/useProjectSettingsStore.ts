import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Per-project settings for C# and other project-specific configuration.
 * These settings are persisted per workspace root and survive across sessions.
 */
export interface ProjectSettings {
	/** C# specific settings */
	/** Selected build configuration (e.g., "Debug", "Release") */
	selectedBuildConfiguration: string | null;
	/** Selected startup project path for solutions with multiple projects */
	selectedStartupProject: string | null;

	/** General per-project settings */
	/** Paths to exclude from file tree and search */
	excludedPaths: string[];
}

interface ProjectSettingsState {
	/**
	 * Settings keyed by normalized workspace root path.
	 * Uses forward slashes for cross-platform consistency.
	 */
	settingsByProject: Record<string, ProjectSettings>;

	/**
	 * Get settings for a specific workspace.
	 * Returns default settings if none exist for the workspace.
	 */
	getSettings: (workspaceRoot: string) => ProjectSettings;

	/**
	 * Update settings for a specific workspace.
	 * Performs partial update - only provided fields are modified.
	 */
	setSettings: (workspaceRoot: string, settings: Partial<ProjectSettings>) => void;

	/**
	 * Clear settings for a specific workspace.
	 * Useful when a project is deleted or moved.
	 */
	clearSettings: (workspaceRoot: string) => void;

	/**
	 * Clear all project settings.
	 * Useful for cleanup or reset operations.
	 */
	clearAllSettings: () => void;

	/**
	 * Migrate old settings format or clean up stale entries.
	 * Called automatically on store initialization.
	 */
	migrateSettings: () => void;
}

/** Default settings for new projects */
const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
	selectedBuildConfiguration: null,
	selectedStartupProject: null,
	excludedPaths: [],
};

/**
 * Normalize workspace root path to use forward slashes.
 * This ensures consistent keys across Windows and Unix-like systems.
 */
function normalizeWorkspaceRoot(path: string): string {
	return path.replace(/\\/g, '/').trim();
}

export const useProjectSettingsStore = create<ProjectSettingsState>()(
	persist(
		(set, get) => ({
			settingsByProject: {},

			getSettings: (workspaceRoot: string): ProjectSettings => {
				const normalized = normalizeWorkspaceRoot(workspaceRoot);
				const stored = get().settingsByProject[normalized];

				// Return stored settings or defaults
				if (stored) {
					// Ensure all default fields exist (for backward compatibility)
					return {
						...DEFAULT_PROJECT_SETTINGS,
						...stored,
					};
				}

				return { ...DEFAULT_PROJECT_SETTINGS };
			},

			setSettings: (workspaceRoot: string, settings: Partial<ProjectSettings>) => {
				const normalized = normalizeWorkspaceRoot(workspaceRoot);

				set((state) => {
					// Get existing settings or defaults
					const existing = state.settingsByProject[normalized] ?? {
						...DEFAULT_PROJECT_SETTINGS,
					};

					// Merge with new settings
					const updated: ProjectSettings = {
						...existing,
						...settings,
					};

					return {
						settingsByProject: {
							...state.settingsByProject,
							[normalized]: updated,
						},
					};
				});
			},

			clearSettings: (workspaceRoot: string) => {
				const normalized = normalizeWorkspaceRoot(workspaceRoot);

				set((state) => {
					const { [normalized]: _, ...rest } = state.settingsByProject;
					return { settingsByProject: rest };
				});
			},

			clearAllSettings: () => {
				set({ settingsByProject: {} });
			},

			migrateSettings: () => {
				// Migration logic for future schema changes
				// Currently no migration needed, but this provides extensibility

				const state = get();
				const migrated: Record<string, ProjectSettings> = {};
				let needsUpdate = false;

				for (const [path, settings] of Object.entries(state.settingsByProject)) {
					// Ensure path is normalized
					const normalizedPath = normalizeWorkspaceRoot(path);
					if (normalizedPath !== path) {
						needsUpdate = true;
					}

					// Ensure all required fields exist
					const migratedSettings: ProjectSettings = {
						...DEFAULT_PROJECT_SETTINGS,
						...settings,
					};

					// Check if migration actually changed anything
					if (JSON.stringify(migratedSettings) !== JSON.stringify(settings)) {
						needsUpdate = true;
					}

					migrated[normalizedPath] = migratedSettings;
				}

				// Only update if migration changed something
				if (needsUpdate) {
					set({ settingsByProject: migrated });
				}

				// Cleanup: Remove settings for workspaces that haven't been used in 90 days
				// Note: This requires tracking lastUsed timestamps in the future
				// For now, we keep all settings to avoid data loss
			},
		}),
		{
			name: 'fluxel-project-settings-store',
			version: 1,
			// Run migration on initialization
			onRehydrateStorage: () => (state) => {
				if (state) {
					state.migrateSettings();
				}
			},
		}
	)
);
