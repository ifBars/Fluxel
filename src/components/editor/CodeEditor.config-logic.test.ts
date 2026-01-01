/**
 * CodeEditor TypeScript Configuration Logic Tests
 *
 * Tests the conditional logic for configuring TypeScript language
 * based on project type.
 */

import { describe, it, expect } from 'vitest';
import type { ProjectProfile } from '@/types/project';

/**
 * Replicates the logic in CodeEditor for deciding whether to configure TypeScript
 */
function shouldConfigureTypeScript(
  currentProject: any,
  projectProfile: ProjectProfile | null
): boolean {
  return !currentProject ||
    projectProfile?.kind === 'javascript' ||
    projectProfile?.kind === 'mixed';
}

describe('CodeEditor - TypeScript Configuration Logic', () => {
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
    unknown: {
      root_path: '/test/unknown',
      kind: 'unknown',
      dotnet: { solution_path: null, project_path: null },
      node: { has_package_json: false, has_tsconfig: false, has_jsconfig: false, package_manager: null },
      build_system_hint: null,
    },
  };

  it('should configure TypeScript when no project is open', () => {
    const result = shouldConfigureTypeScript(null, null);
    expect(result).toBe(true);
  });

  it('should configure TypeScript for JavaScript projects', () => {
    const result = shouldConfigureTypeScript({ rootPath: '/test' }, profiles.javascript);
    expect(result).toBe(true);
  });

  it('should configure TypeScript for mixed projects', () => {
    const result = shouldConfigureTypeScript({ rootPath: '/test' }, profiles.mixed);
    expect(result).toBe(true);
  });

  it('should NOT configure TypeScript for pure C# projects', () => {
    const result = shouldConfigureTypeScript({ rootPath: '/test' }, profiles.dotnet);
    expect(result).toBe(false);
  });

  it('should NOT configure TypeScript for unknown projects', () => {
    const result = shouldConfigureTypeScript({ rootPath: '/test' }, profiles.unknown);
    expect(result).toBe(false);
  });

  it('should handle all project types correctly', () => {
    const testCases = [
      { kind: 'dotnet', expected: false },
      { kind: 'javascript', expected: true },
      { kind: 'mixed', expected: true },
      { kind: 'unknown', expected: false },
    ] as const;

    testCases.forEach(({ kind, expected }) => {
      const profile = profiles[kind];
      const result = shouldConfigureTypeScript({ rootPath: '/test' }, profile);
      expect(result).toBe(expected);
    });
  });
});
