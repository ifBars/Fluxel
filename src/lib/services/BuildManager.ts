import { Command } from '@tauri-apps/plugin-shell';
import { buildCSharpProject, type BuildDiagnostic } from '@/lib/languages/csharp';
import { useCSharpStore, useDiagnosticsStore, type BuildSystem, type Diagnostic } from '@/stores';
import { invoke } from '@tauri-apps/api/core';
import type { ProjectProfile } from '@/types/project';
import { FrontendProfiler } from './FrontendProfiler';

export interface BuildOptions {
    projectRoot: string;
    buildSystem: BuildSystem;
    customBuildCommand?: string;
}

export interface BuildResult {
    success: boolean;
    output: string;
    error?: string;
    /** Parsed diagnostics from the build (only for dotnet builds) */
    diagnostics?: BuildDiagnostic[];
    /** Build duration in milliseconds */
    durationMs?: number;
}

/**
 * Convert a BuildDiagnostic from the Rust backend to the Diagnostic format used by the store.
 */
function convertBuildDiagnosticToStoreDiagnostic(
    diagnostic: BuildDiagnostic,
    index: number
): Diagnostic {
    // Extract file name from path
    const fileName = diagnostic.file_path.split(/[/\\]/).pop() || diagnostic.file_path;

    return {
        id: `build-${diagnostic.code}-${diagnostic.file_path}-${diagnostic.line}-${diagnostic.column}-${index}`,
        uri: `file://${diagnostic.file_path}`,
        filePath: diagnostic.file_path,
        fileName,
        severity: diagnostic.severity === 'error' ? 'error' : 'warning',
        message: diagnostic.message,
        code: diagnostic.code,
        source: 'build',
        range: {
            startLine: diagnostic.line,
            startColumn: diagnostic.column,
            // For build diagnostics, we don't have end position, so use same as start
            endLine: diagnostic.line,
            endColumn: diagnostic.column,
        },
    };
}

/**
 * Detect project type based on files in the root directory
 */
async function detectProjectType(projectRoot: string): Promise<'dotnet' | 'javascript' | 'unknown'> {
    const span = FrontendProfiler.startSpan('detect_project_type', 'frontend_network');
    try {
        const profile = await invoke<ProjectProfile>('detect_project_profile', {
            workspaceRoot: projectRoot,
            traceParent: span.id,
        });

        await span.end({
            projectKind: profile.kind,
            projectRoot
        });

        if (profile.kind === 'dotnet' || profile.kind === 'mixed') return 'dotnet';
        if (profile.kind === 'javascript') return 'javascript';
        return 'unknown';
    } catch (error) {
        // Fallback to a quick root scan if the backend detector isn't available.
        try {
            const { readDir } = await import('@tauri-apps/plugin-fs');
            const entries = await readDir(projectRoot);

            const hasCsproj = entries.some(entry => entry.name?.endsWith('.csproj') || entry.name?.endsWith('.sln'));
            const hasPackageJson = entries.some(entry => entry.name === 'package.json');

            const result = hasCsproj ? 'dotnet' : hasPackageJson ? 'javascript' : 'unknown';
            await span.end({
                projectKind: result,
                projectRoot,
                fallback: 'true'
            });

            if (hasCsproj) return 'dotnet';
            if (hasPackageJson) return 'javascript';
        } catch {
            // ignore
        }

        console.error('Error detecting project type:', error);
        await span.end({
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return 'unknown';
    }
}

/**
 * Helper to strip ANSI escape codes from string
 */
function stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

/**
 * Execute a build command
 */
export async function executeBuild(options: BuildOptions): Promise<BuildResult> {
    const { projectRoot, buildSystem, customBuildCommand } = options;
    const buildSpan = FrontendProfiler.startSpan('execute_build', 'frontend_network');

    try {
        // Manual/Custom build command
        if (buildSystem === 'manual') {
            if (!customBuildCommand || customBuildCommand.trim() === '') {
                await buildSpan.end({
                    buildSystem,
                    error: 'No custom build command'
                });
                return {
                    success: false,
                    output: '',
                    error: 'No custom build command specified. Please configure it in Settings > Build.',
                };
            }

            const result = await executeShellCommand(customBuildCommand, projectRoot);
            await buildSpan.end({
                buildSystem,
                success: result.success.toString(),
                customCommand: customBuildCommand
            });
            return result;
        }

        // Auto-detect project type
        if (buildSystem === 'auto') {
            const projectType = await detectProjectType(projectRoot);

            if (projectType === 'dotnet') {
                const result = await executeDotNetBuild(projectRoot);
                await buildSpan.end({
                    buildSystem,
                    detectedType: projectType,
                    success: result.success.toString(),
                    diagnosticCount: (result.diagnostics?.length || 0).toString()
                });
                return result;
            } else if (projectType === 'javascript') {
                // Default to bun as per user rules
                const result = await executeBunBuild(projectRoot);
                await buildSpan.end({
                    buildSystem,
                    detectedType: projectType,
                    success: result.success.toString()
                });
                return result;
            } else {
                await buildSpan.end({
                    buildSystem,
                    error: 'Could not detect project type'
                });
                return {
                    success: false,
                    output: '',
                    error: 'Could not detect project type. Please select a specific build system in Settings > Build.',
                };
            }
        }

        // Specific build systems
        let result: BuildResult;
        switch (buildSystem) {
            case 'dotnet':
                result = await executeDotNetBuild(projectRoot);
                break;
            case 'bun':
                result = await executeBunBuild(projectRoot);
                break;
            case 'npm':
                result = await executeNpmBuild(projectRoot);
                break;
            default:
                await buildSpan.end({
                    buildSystem,
                    error: 'Unknown build system'
                });
                return {
                    success: false,
                    output: '',
                    error: `Unknown build system: ${buildSystem}`,
                };
        }

        await buildSpan.end({
            buildSystem,
            success: result.success.toString(),
            durationMs: result.durationMs?.toString() || 'unknown'
        });
        return result;
    } catch (error) {
        await buildSpan.end({
            buildSystem,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return {
            success: false,
            output: '',
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Execute .NET build
 */
async function executeDotNetBuild(projectRoot: string): Promise<BuildResult> {
    const span = FrontendProfiler.startSpan('dotnet_build', 'frontend_network');
    try {
        const { selectedConfiguration } = useCSharpStore.getState();
        console.log(`[BuildManager] Building with configuration: ${selectedConfiguration || 'default'}`);

        const result = await buildCSharpProject(projectRoot, selectedConfiguration || undefined);

        // Convert build diagnostics to store format and update the diagnostics store
        const storeDiagnostics = result.diagnostics.map((diag, index) =>
            convertBuildDiagnosticToStoreDiagnostic(diag, index)
        );

        // Update the diagnostics store with build diagnostics
        const { setBuildDiagnostics } = useDiagnosticsStore.getState();
        setBuildDiagnostics(storeDiagnostics);

        console.log(`[BuildManager] Build ${result.success ? 'succeeded' : 'failed'} with ${result.diagnostics.length} diagnostics in ${result.duration_ms}ms`);

        await span.end({
            success: result.success.toString(),
            diagnosticCount: result.diagnostics.length.toString(),
            errorCount: result.diagnostics.filter(d => d.severity === 'error').length.toString(),
            warningCount: result.diagnostics.filter(d => d.severity === 'warning').length.toString(),
            durationMs: result.duration_ms.toString(),
            configuration: selectedConfiguration || 'default'
        });

        if (result.success) {
            return {
                success: true,
                output: stripAnsi(result.raw_output || 'Build succeeded'),
                diagnostics: result.diagnostics,
                durationMs: result.duration_ms,
            };
        } else {
            return {
                success: false,
                output: stripAnsi(result.raw_output),
                error: `Build failed with ${result.diagnostics.filter(d => d.severity === 'error').length} error(s)`,
                diagnostics: result.diagnostics,
                durationMs: result.duration_ms,
            };
        }
    } catch (error) {
        // Clear build diagnostics on error
        const { clearBuildDiagnostics } = useDiagnosticsStore.getState();
        clearBuildDiagnostics();

        await span.end({
            error: error instanceof Error ? error.message : 'Unknown error'
        });

        return {
            success: false,
            output: '',
            error: error instanceof Error ? stripAnsi(error.message) : String(error),
        };
    }
}

/**
 * Execute bun build
 */
async function executeBunBuild(projectRoot: string): Promise<BuildResult> {
    return await executeShellCommand('bun run build', projectRoot);
}

/**
 * Execute npm build
 */
async function executeNpmBuild(projectRoot: string): Promise<BuildResult> {
    return await executeShellCommand('npm run build', projectRoot);
}

/**
 * Execute TypeScript type checking
 */
export async function executeTypeCheck(projectRoot: string): Promise<BuildResult> {
    return await executeShellCommand('bun x tsc --noEmit', projectRoot, 'No type errors found.');
}

/**
 * Generic shell command executor
 */
async function executeShellCommand(command: string, cwd: string, successMessage?: string): Promise<BuildResult> {
    const span = FrontendProfiler.startSpan('execute_shell_command', 'frontend_network');
    try {
        // Parse command into program and args
        const parts = command.trim().split(/\s+/);
        const program = parts[0];
        const args = parts.slice(1);

        const cmd = Command.create(program, args, { cwd });
        const result = await cmd.execute();

        const rawOutput = result.stdout || result.stderr || successMessage || 'Command executed successfully';
        const cleanOutput = stripAnsi(rawOutput);

        await span.end({
            command: program,
            exitCode: (result.code ?? -1).toString(),
            success: (result.code === 0).toString(),
            outputLength: cleanOutput.length.toString()
        });

        if (result.code === 0) {
            return {
                success: true,
                output: cleanOutput,
            };
        } else {
            return {
                success: false,
                output: cleanOutput, // Sometimes useful info is in stdout even on failure
                error: result.stderr ? stripAnsi(result.stderr) : `Command failed with exit code ${result.code ?? -1}`,
            };
        }
    } catch (error) {
        await span.end({
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return {
            success: false,
            output: '',
            error: error instanceof Error ? stripAnsi(error.message) : String(error),
        };
    }
}
