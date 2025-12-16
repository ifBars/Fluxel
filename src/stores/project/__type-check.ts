/**
 * Quick verification that useProjectSettingsStore is properly typed and importable
 */

import { useProjectSettingsStore, ProjectSettings } from '@/stores/project';
import type { ProjectSettings as ProjectSettingsType } from '@/stores/project/useProjectSettingsStore';

// Verify store methods exist and are properly typed
const store = useProjectSettingsStore.getState();

// Type checks
const testWorkspace = '/test/workspace';

// getSettings returns ProjectSettings
const settings: ProjectSettings = store.getSettings(testWorkspace);
const settingsAliasCheck: ProjectSettingsType = settings;

// setSettings accepts Partial<ProjectSettings>
store.setSettings(testWorkspace, {
	selectedBuildConfiguration: 'Release',
});

// Partial updates work
store.setSettings(testWorkspace, {
	excludedPaths: ['bin', 'obj'],
});

// clearSettings exists
store.clearSettings(testWorkspace);

// clearAllSettings exists
store.clearAllSettings();

// migrateSettings exists
store.migrateSettings();

// Settings have correct shape
const buildConfig: string | null = settings.selectedBuildConfiguration;
const startupProject: string | null = settings.selectedStartupProject;
const excludedPaths: string[] = settings.excludedPaths;

console.log('✅ useProjectSettingsStore type verification passed!', {
	settings,
	settingsAliasCheck,
	buildConfig,
	startupProject,
	excludedPaths,
});

export {};
