import { invoke } from '@tauri-apps/api/core';
import { FrontendProfiler } from '../../services/FrontendProfiler';

export interface BuildConfiguration {
    name: string;
    target_framework?: string;
}

/**
 * A single diagnostic from build output.
 * Matches MSBuild format: `File.cs(line,col): severity CODE: message`
 */
export interface BuildDiagnostic {
    /** Full path to the file containing the diagnostic */
    file_path: string;
    /** Line number (1-based) */
    line: number;
    /** Column number (1-based) */
    column: number;
    /** Severity: "error" or "warning" */
    severity: string;
    /** Diagnostic code (e.g., "CS1002", "CS0168") */
    code: string;
    /** Human-readable message */
    message: string;
}

/**
 * Result of a C# build operation with parsed diagnostics.
 */
export interface CSharpBuildResult {
    /** Whether the build succeeded */
    success: boolean;
    /** Raw build output (stdout + stderr combined) */
    raw_output: string;
    /** Parsed diagnostics from the build output */
    diagnostics: BuildDiagnostic[];
    /** Build duration in milliseconds */
    duration_ms: number;
}

/**
 * Get available build configurations for the current workspace.
 * Parses .csproj file to extract configurations.
 */
export async function getProjectConfigurations(workspaceRoot: string): Promise<BuildConfiguration[]> {
    if (!workspaceRoot) {
        throw new Error('No workspace root provided.');
    }

    const span = FrontendProfiler.startSpan('invoke:get_project_configurations', 'tauri_command');
    try {
        const result = await invoke<BuildConfiguration[]>('get_project_configurations', {
            workspaceRoot: workspaceRoot,
            traceParent: span.id,
        });
        await span.end({ workspaceRoot });
        return result;
    } catch (e) {
        span.cancel();
        throw e;
    }
}

/**
 * Run `dotnet build` for the current workspace.
 * Returns a structured BuildResult with parsed diagnostics.
 */
export async function buildCSharpProject(
    workspaceRoot: string,
    configuration?: string
): Promise<CSharpBuildResult> {
    if (!workspaceRoot) {
        throw new Error('No workspace root provided for build.');
    }

    const span = FrontendProfiler.startSpan('invoke:build_csharp_project', 'tauri_command');
    try {
        const result = await invoke<CSharpBuildResult>('build_csharp_project', {
            workspaceRoot: workspaceRoot,
            configuration: configuration,
            traceParent: span.id,
        });
        await span.end({ 
            workspaceRoot, 
            configuration: configuration || 'default',
            success: result.success.toString()
        });
        return result;
    } catch (e) {
        span.cancel();
        throw e;
    }
}

