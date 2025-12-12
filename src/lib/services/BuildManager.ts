import { Command } from '@tauri-apps/plugin-shell';
import { buildCSharpProject } from '@/lib/languages/csharp';
import { useCSharpStore, type BuildSystem } from '@/stores';

export interface BuildOptions {
    projectRoot: string;
    buildSystem: BuildSystem;
    customBuildCommand?: string;
}

export interface BuildResult {
    success: boolean;
    output: string;
    error?: string;
}

/**
 * Detect project type based on files in the root directory
 */
async function detectProjectType(projectRoot: string): Promise<'dotnet' | 'javascript' | 'unknown'> {
    try {
        const { readDir } = await import('@tauri-apps/plugin-fs');
        const entries = await readDir(projectRoot);

        const hasCsproj = entries.some(entry => entry.name?.endsWith('.csproj'));
        const hasPackageJson = entries.some(entry => entry.name === 'package.json');

        if (hasCsproj) return 'dotnet';
        if (hasPackageJson) return 'javascript';

        return 'unknown';
    } catch (error) {
        console.error('Error detecting project type:', error);
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

    try {
        // Manual/Custom build command
        if (buildSystem === 'manual') {
            if (!customBuildCommand || customBuildCommand.trim() === '') {
                return {
                    success: false,
                    output: '',
                    error: 'No custom build command specified. Please configure it in Settings > Build.',
                };
            }

            return await executeShellCommand(customBuildCommand, projectRoot);
        }

        // Auto-detect project type
        if (buildSystem === 'auto') {
            const projectType = await detectProjectType(projectRoot);

            if (projectType === 'dotnet') {
                return await executeDotNetBuild(projectRoot);
            } else if (projectType === 'javascript') {
                // Default to bun as per user rules
                return await executeBunBuild(projectRoot);
            } else {
                return {
                    success: false,
                    output: '',
                    error: 'Could not detect project type. Please select a specific build system in Settings > Build.',
                };
            }
        }

        // Specific build systems
        switch (buildSystem) {
            case 'dotnet':
                return await executeDotNetBuild(projectRoot);
            case 'bun':
                return await executeBunBuild(projectRoot);
            case 'npm':
                return await executeNpmBuild(projectRoot);
            default:
                return {
                    success: false,
                    output: '',
                    error: `Unknown build system: ${buildSystem}`,
                };
        }
    } catch (error) {
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
    try {
        const { selectedConfiguration } = useCSharpStore.getState();
        console.log(`[BuildManager] Building with configuration: ${selectedConfiguration || 'default'}`);
        const output = await buildCSharpProject(projectRoot, selectedConfiguration || undefined);
        return {
            success: true,
            output: stripAnsi(output || 'Build succeeded'),
        };
    } catch (error) {
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
    try {
        // Parse command into program and args
        const parts = command.trim().split(/\s+/);
        const program = parts[0];
        const args = parts.slice(1);

        const cmd = Command.create(program, args, { cwd });
        const result = await cmd.execute();

        const rawOutput = result.stdout || result.stderr || successMessage || 'Command executed successfully';
        const cleanOutput = stripAnsi(rawOutput);

        if (result.code === 0) {
            return {
                success: true,
                output: cleanOutput,
            };
        } else {
            return {
                success: false,
                output: cleanOutput, // Sometimes useful info is in stdout even on failure
                error: result.stderr ? stripAnsi(result.stderr) : `Command failed with exit code ${result.code}`,
            };
        }
    } catch (error) {
        return {
            success: false,
            output: '',
            error: error instanceof Error ? stripAnsi(error.message) : String(error),
        };
    }
}
