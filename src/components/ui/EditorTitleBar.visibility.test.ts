/**
 * EditorTitleBar C# Configuration Selector Visibility Tests
 *
 * Tests the visibility logic for C# build configuration selector.
 */

import { describe, it, expect } from 'vitest';
import type { ProjectProfile } from '@/types/project';

/**
 * Replicates the logic in EditorTitleBarCenter for deciding what to show
 */
function getVisibilityState(
  projectProfile: ProjectProfile | null,
  configurations: any[],
  isLoadingConfigs: boolean
): { showSelector: boolean; showNoConfigs: boolean } {
  const isCSharpOrMixed = projectProfile?.kind === 'dotnet' || projectProfile?.kind === 'mixed';
  const showSelector = !isLoadingConfigs && configurations.length > 0;
  const showNoConfigs = !isLoadingConfigs && configurations.length === 0 && isCSharpOrMixed;

  return { showSelector, showNoConfigs };
}

describe('EditorTitleBarCenter - C# Configuration Selector Visibility', () => {
  const profiles: Record<string, ProjectProfile> = {
    dotnet: {
      root_path: '/test/cs-project',
      kind: 'dotnet',
      dotnet: { solution_path: '/test.sln', project_path: '/test.csproj' },
      node: { has_package_json: false, has_tsconfig: false, has_jsconfig: false, package_manager: null },
      build_system_hint: null,
    },
    javascript: {
      root_path: '/test/js-project',
      kind: 'javascript',
      dotnet: { solution_path: null, project_path: null },
      node: { has_package_json: true, has_tsconfig: false, has_jsconfig: false, package_manager: 'bun' },
      build_system_hint: null,
    },
    mixed: {
      root_path: '/test/mixed-project',
      kind: 'mixed',
      dotnet: { solution_path: '/test.sln', project_path: '/test.csproj' },
      node: { has_package_json: true, has_tsconfig: true, has_jsconfig: false, package_manager: 'bun' },
      build_system_hint: null,
    },
  };

  it('should show selector when configs are loaded and project is C#', () => {
    const configs = [{ name: 'Debug' }, { name: 'Release' }];
    const result = getVisibilityState(profiles.dotnet, configs, false);

    expect(result.showSelector).toBe(true);
    expect(result.showNoConfigs).toBe(false);
  });

  it('should show "No configs" for C# projects when configs array is empty', () => {
    const configs: any[] = [];
    const result = getVisibilityState(profiles.dotnet, configs, false);

    expect(result.showSelector).toBe(false);
    expect(result.showNoConfigs).toBe(true);
  });

  it('should show "No configs" for mixed projects when configs array is empty', () => {
    const configs: any[] = [];
    const result = getVisibilityState(profiles.mixed, configs, false);

    expect(result.showSelector).toBe(false);
    expect(result.showNoConfigs).toBe(true);
  });

  it('should NOT show "No configs" for JavaScript projects', () => {
    const configs: any[] = [];
    const result = getVisibilityState(profiles.javascript, configs, false);

    expect(result.showSelector).toBe(false);
    expect(result.showNoConfigs).toBe(false);
  });

  it('should show loading indicator when configs are loading', () => {
    const configs: any[] = [];
    const result = getVisibilityState(profiles.dotnet, configs, true);

    expect(result.showSelector).toBe(false);
    expect(result.showNoConfigs).toBe(false);
  });

  it('should show selector when configs are loaded for mixed projects', () => {
    const configs = [{ name: 'Debug' }, { name: 'Release' }];
    const result = getVisibilityState(profiles.mixed, configs, false);

    expect(result.showSelector).toBe(true);
    expect(result.showNoConfigs).toBe(false);
  });

  it('should handle all combinations of project type and config state', () => {
    const testCases = [
      {
        projectKind: 'dotnet',
        hasConfigs: true,
        isLoading: false,
        expectSelector: true,
        expectNoConfigs: false,
      },
      {
        projectKind: 'dotnet',
        hasConfigs: false,
        isLoading: false,
        expectSelector: false,
        expectNoConfigs: true,
      },
      {
        projectKind: 'dotnet',
        hasConfigs: false,
        isLoading: true,
        expectSelector: false,
        expectNoConfigs: false,
      },
      {
        projectKind: 'javascript',
        hasConfigs: false,
        isLoading: false,
        expectSelector: false,
        expectNoConfigs: false,
      },
      {
        projectKind: 'mixed',
        hasConfigs: true,
        isLoading: false,
        expectSelector: true,
        expectNoConfigs: false,
      },
      {
        projectKind: 'mixed',
        hasConfigs: false,
        isLoading: false,
        expectSelector: false,
        expectNoConfigs: true,
      },
    ] as const;

    testCases.forEach(({ projectKind, hasConfigs, isLoading, expectSelector, expectNoConfigs }) => {
      const profile = profiles[projectKind];
      const configs = hasConfigs ? [{ name: 'Debug' }] : [];
      const result = getVisibilityState(profile, configs, isLoading);

      expect(result.showSelector).toBe(expectSelector);
      expect(result.showNoConfigs).toBe(expectNoConfigs);
    });
  });
});
