import { describe, expect, it } from 'vitest';

import { getBuiltinNewFileTemplates, ensureTemplateFileName, buildCSharpNamespace } from './newFileTemplates';
import { scheduleOneNewFileTemplates } from '@/plugins/s1api/newFileTemplates';

describe('new file templates', () => {
    it('appends template extensions once', () => {
        expect(ensureTemplateFileName('NewClass', 'cs')).toBe('NewClass.cs');
        expect(ensureTemplateFileName('NewClass.cs', 'cs')).toBe('NewClass.cs');
    });

    it('builds a C# namespace from workspace-relative folders', () => {
        expect(buildCSharpNamespace('C:/Projects/BigWillyMod', 'C:/Projects/BigWillyMod/Features/NPC')).toBe(
            'BigWillyMod.Features.NPC'
        );
    });

    it('returns C# templates for dotnet workspaces', () => {
        const templates = getBuiltinNewFileTemplates({
            workspaceRoot: 'C:/Projects/BigWillyMod',
            parentPath: 'C:/Projects/BigWillyMod',
            projectProfile: {
                root_path: 'C:/Projects/BigWillyMod',
                kind: 'dotnet',
                dotnet: { solution_path: null, project_path: 'C:/Projects/BigWillyMod/BigWillyMod.csproj' },
                node: {
                    has_package_json: false,
                    has_tsconfig: false,
                    has_jsconfig: false,
                    package_manager: null,
                },
                build_system_hint: 'dotnet',
            },
            detectedProjects: [],
        });

        expect(templates.some((template) => template.id === 'builtin.csharp-class')).toBe(true);
        expect(templates.some((template) => template.id === 'builtin.csharp-interface')).toBe(true);
    });

    it('shows schedule one templates only for detected schedule one projects', () => {
        const phoneAppTemplate = scheduleOneNewFileTemplates[0];

        expect(phoneAppTemplate.matches?.({
            workspaceRoot: 'C:/Projects/BigWillyMod',
            parentPath: 'C:/Projects/BigWillyMod',
            projectProfile: null,
            detectedProjects: [],
        })).toBe(false);

        expect(phoneAppTemplate.matches?.({
            workspaceRoot: 'C:/Projects/BigWillyMod',
            parentPath: 'C:/Projects/BigWillyMod',
            projectProfile: null,
            detectedProjects: [
                {
                    type: 'schedule-one-mod',
                    name: 'Schedule 1 Mod Project',
                    confidence: 0.91,
                    metadata: {},
                },
            ],
        })).toBe(true);
    });
});
