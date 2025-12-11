import { invoke } from '@tauri-apps/api/core';

export interface BuildConfiguration {
    name: string;
    target_framework?: string;
}

/**
 * Get available build configurations for the current workspace.
 * Parses .csproj file to extract configurations.
 */
export async function getProjectConfigurations(workspaceRoot: string): Promise<BuildConfiguration[]> {
    if (!workspaceRoot) {
        throw new Error('No workspace root provided.');
    }

    return invoke<BuildConfiguration[]>('get_project_configurations', {
        workspaceRoot: workspaceRoot,
    });
}

/**
 * Run `dotnet build` for the current workspace.
 * Returns combined stdout/stderr output.
 */
export async function buildCSharpProject(
    workspaceRoot: string,
    configuration?: string
): Promise<string> {
    if (!workspaceRoot) {
        throw new Error('No workspace root provided for build.');
    }

    return invoke<string>('build_csharp_project', {
        workspaceRoot: workspaceRoot,
        configuration: configuration,
    });
}

