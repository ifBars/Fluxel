/**
 * ProjectManager Logic Tests
 *
 * Tests project type detection and service orchestration logic.
 */

import { describe, it, expect } from 'vitest';
import { shouldLoadCSharpConfigurations, shouldHydrateTypeScriptWorkspace } from '@/lib/services';
import type { ProjectProfile } from '@/types/project';

describe('ProjectManager - C# Configuration Loading Logic', () => {
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
    mixedWithCsproj: {
      root_path: '/test/mixed-project',
      kind: 'mixed',
      dotnet: { solution_path: '/test.sln', project_path: '/test.csproj' },
      node: { has_package_json: true, has_tsconfig: false, has_jsconfig: false, package_manager: 'bun' },
      build_system_hint: null,
    },
    mixedWithoutCsproj: {
      root_path: '/test/mixed-project-no-cs',
      kind: 'mixed',
      dotnet: { solution_path: null, project_path: null },
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

  describe('shouldLoadCSharpConfigurations', () => {
    it('should return true for dotnet projects', () => {
      const result = shouldLoadCSharpConfigurations(profiles.dotnet);
      expect(result).toBe(true);
      expect(result).toBe(true);
    });

    it('should return true for mixed projects with .csproj', () => {
      const result = shouldLoadCSharpConfigurations(profiles.mixedWithCsproj);
      expect(result).toBe(true);
    });

    it('should return true for mixed projects without .csproj', () => {
      // Mixed projects should always load C# configs, even without .csproj
      const result = shouldLoadCSharpConfigurations(profiles.mixedWithoutCsproj);
      expect(result).toBe(true);
    });

    it('should return false for JavaScript projects', () => {
      const result = shouldLoadCSharpConfigurations(profiles.javascript);
      expect(result).toBe(false);
    });

    it('should return false for unknown projects', () => {
      const result = shouldLoadCSharpConfigurations(profiles.unknown);
      expect(result).toBe(false);
    });

    it('should return false for null profile', () => {
      const result = shouldLoadCSharpConfigurations(null);
      expect(result).toBe(false);
    });
  });
});

describe('ProjectManager - TypeScript Workspace Hydration Logic', () => {
  const profiles: Record<string, ProjectProfile> = {
    dotnet: {
      root_path: '/test/cs-project',
      kind: 'dotnet',
      dotnet: { solution_path: '/test.sln', project_path: '/test.csproj' },
      node: { has_package_json: false, has_tsconfig: false, has_jsconfig: false, package_manager: null },
      build_system_hint: null,
    },
    javascriptWithTsconfig: {
      root_path: '/test/js-project',
      kind: 'javascript',
      dotnet: { solution_path: null, project_path: null },
      node: { has_package_json: true, has_tsconfig: true, has_jsconfig: false, package_manager: 'bun' },
      build_system_hint: null,
    },
    javascriptWithJsconfig: {
      root_path: '/test/js-project-no-ts',
      kind: 'javascript',
      dotnet: { solution_path: null, project_path: null },
      node: { has_package_json: true, has_tsconfig: false, has_jsconfig: true, package_manager: 'bun' },
      build_system_hint: null,
    },
    javascriptNoConfig: {
      root_path: '/test/js-no-config',
      kind: 'javascript',
      dotnet: { solution_path: null, project_path: null },
      node: { has_package_json: false, has_tsconfig: false, has_jsconfig: false, package_manager: null },
      build_system_hint: null,
    },
    mixedWithTs: {
      root_path: '/test/mixed-project',
      kind: 'mixed',
      dotnet: { solution_path: '/test.sln', project_path: '/test.csproj' },
      node: { has_package_json: true, has_tsconfig: true, has_jsconfig: false, package_manager: 'bun' },
      build_system_hint: null,
    },
    mixedWithJs: {
      root_path: '/test/mixed-project-no-ts',
      kind: 'mixed',
      dotnet: { solution_path: '/test.sln', project_path: '/test.csproj' },
      node: { has_package_json: true, has_tsconfig: false, has_jsconfig: true, package_manager: 'bun' },
      build_system_hint: null,
    },
    mixedNoTs: {
      root_path: '/test/mixed-no-ts',
      kind: 'mixed',
      dotnet: { solution_path: '/test.sln', project_path: '/test.csproj' },
      node: { has_package_json: true, has_tsconfig: false, has_jsconfig: false, package_manager: 'bun' },
      build_system_hint: null,
    },
  };

  describe('shouldHydrateTypeScriptWorkspace', () => {
    it('should return false for dotnet projects', () => {
      const result = shouldHydrateTypeScriptWorkspace(profiles.dotnet);
      expect(result).toBe(false);
    });

    it('should return true for JavaScript projects with tsconfig', () => {
      const result = shouldHydrateTypeScriptWorkspace(profiles.javascriptWithTsconfig);
      expect(result).toBe(true);
    });

    it('should return true for JavaScript projects with jsconfig', () => {
      const result = shouldHydrateTypeScriptWorkspace(profiles.javascriptWithJsconfig);
      expect(result).toBe(true);
    });

    it('should return false for JavaScript projects without configs', () => {
      const result = shouldHydrateTypeScriptWorkspace(profiles.javascriptNoConfig);
      expect(result).toBe(false);
    });

    it('should return true for mixed projects with tsconfig', () => {
      const result = shouldHydrateTypeScriptWorkspace(profiles.mixedWithTs);
      expect(result).toBe(true);
    });

    it('should return true for mixed projects with jsconfig', () => {
      const result = shouldHydrateTypeScriptWorkspace(profiles.mixedWithJs);
      expect(result).toBe(true);
    });

    it('should return false for mixed projects without TS artifacts', () => {
      const result = shouldHydrateTypeScriptWorkspace(profiles.mixedNoTs);
      expect(result).toBe(false);
    });

    it('should return false for null profile', () => {
      const result = shouldHydrateTypeScriptWorkspace(null);
      expect(result).toBe(false);
    });
  });
});
