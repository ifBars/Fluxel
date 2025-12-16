# Project Settings Store

## Overview

The `useProjectSettingsStore` provides per-project persistence for C#-specific and general project settings. Settings are automatically saved to localStorage and keyed by workspace root path.

## Usage

### Basic Usage

```typescript
import { useProjectSettingsStore } from '@/stores/project';

function MyComponent() {
  const workspaceRoot = '/path/to/my/project';
  
  // Get settings for current workspace
  const settings = useProjectSettingsStore((s) => s.getSettings(workspaceRoot));
  
  // Update a single setting
  const setSettings = useProjectSettingsStore((s) => s.setSettings);
  
  const handleConfigChange = (config: string) => {
    setSettings(workspaceRoot, { selectedBuildConfiguration: config });
  };
  
  return (
    <div>
      <p>Current config: {settings.selectedBuildConfiguration ?? 'None'}</p>
      <button onClick={() => handleConfigChange('Release')}>
        Set Release
      </button>
    </div>
  );
}
```

### Integration with useCSharpStore

The `useCSharpStore` should use `useProjectSettingsStore` to persist the selected build configuration:

```typescript
// In useCSharpStore.ts
import { useProjectSettingsStore } from '@/stores/project';

// When loading configurations
loadProjectConfigurations: async (workspaceRoot) => {
  const configs = await getProjectConfigurations(workspaceRoot);
  
  // Get persisted selection
  const { getSettings, setSettings } = useProjectSettingsStore.getState();
  const savedConfig = getSettings(workspaceRoot).selectedBuildConfiguration;
  
  // Use saved config if valid, otherwise default to Debug
  const selectedConfig = configs.find((c) => c.name === savedConfig)?.name
    || configs.find((c) => c.name === 'Debug')?.name
    || configs[0]?.name
    || null;
  
  set({
    configurations: configs,
    selectedConfiguration: selectedConfig,
    lastLoadedWorkspace: workspaceRoot,
  });
},

// When user changes configuration
setSelectedConfiguration: (config) => {
  const workspaceRoot = get().lastLoadedWorkspace;
  if (workspaceRoot) {
    const { setSettings } = useProjectSettingsStore.getState();
    setSettings(workspaceRoot, { selectedBuildConfiguration: config });
  }
  set({ selectedConfiguration: config });
},
```

## API Reference

### ProjectSettings Interface

```typescript
interface ProjectSettings {
  // C# specific settings
  selectedBuildConfiguration: string | null;
  selectedStartupProject: string | null;
  
  // General per-project settings
  excludedPaths: string[];
}
```

### Store Methods

#### `getSettings(workspaceRoot: string): ProjectSettings`
Returns settings for the specified workspace. If no settings exist, returns default settings.

#### `setSettings(workspaceRoot: string, settings: Partial<ProjectSettings>): void`
Updates settings for the specified workspace. Performs a partial update - only provided fields are modified.

#### `clearSettings(workspaceRoot: string): void`
Removes all settings for the specified workspace.

#### `clearAllSettings(): void`
Removes all project settings. Use with caution!

#### `migrateSettings(): void`
Migrates settings from older versions. Called automatically on store initialization.

## Path Normalization

All workspace root paths are normalized to use forward slashes for cross-platform consistency:
- Windows: `C:\Users\Dev\MyProject` → `C:/Users/Dev/MyProject`
- Unix: `/home/dev/my-project` → `/home/dev/my-project`

## Persistence

Settings are persisted to localStorage under the key `fluxel-project-settings-store`.

The store uses Zustand's persistence middleware with automatic migration support.

## Migration Strategy

The store includes a migration system for handling schema changes:

1. **Version tracking**: The store version is set to `1`
2. **Automatic migration**: `migrateSettings()` is called on store initialization
3. **Backward compatibility**: New fields are added with default values

## Future Enhancements

Potential additions for Phase 3+ of the C# Enhancement Plan:

```typescript
interface ProjectSettings {
  // Solution/project structure
  selectedSolution: string | null;          // For multi-solution workspaces
  
  // Build settings
  parallelBuild: boolean;                   // Enable parallel project builds
  
  // Editor settings
  formatOnSave: boolean;                    // C# specific format on save
  organizeImportsOnSave: boolean;          // Remove unused usings
  
  // UI preferences
  collapseProjectNodes: boolean;           // File tree expansion state
  lastActiveBuildTarget: string | null;    // Mixed projects
}
```

## Testing

To verify the store works correctly:

```typescript
// Test persistence
const { setSettings, getSettings } = useProjectSettingsStore.getState();

const testPath = '/test/workspace';
setSettings(testPath, { selectedBuildConfiguration: 'Release' });

// Refresh page
window.location.reload();

// After reload:
const settings = getSettings(testPath);
console.assert(settings.selectedBuildConfiguration === 'Release');
```

## Related Files

- `src/stores/project/useProjectStore.ts` - Main project store
- `src/stores/project/useConfigMetadataStore.ts` - Config metadata persistence
- `src/stores/build/useCSharpStore.ts` - C# build configurations (should integrate with this store)
- `docs/CSHARP_ENHANCEMENT_PLAN.md` - Complete enhancement plan
