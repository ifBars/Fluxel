import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import type { Project } from '@/types/fs';
import type { ProjectProfile } from '@/types/project';
import { getCSharpLSPClient } from '@/lib/languages/csharp';
import { FrontendProfiler } from '@/lib/services/FrontendProfiler';

interface ProjectState {
    /** Currently open project */
    currentProject: Project | null;
    /** List of recently opened projects */
    recentProjects: Project[];

    /** Detected project capabilities/profile (from Rust) */
    projectProfile: ProjectProfile | null;
    /** Project initialization status */
    projectInitStatus: 'idle' | 'detecting' | 'ready' | 'error';
    /** Error (if detection/init fails) */
    projectInitError?: string;

    /** C# language server lifecycle status */
    csharpLspStatus: 'stopped' | 'starting' | 'ready' | 'error';
    csharpLspError?: string;

    /** Open a project by path */
    openProject: (rootPath: string) => void;
    /** Close the current project */
    closeProject: () => void;
    /** Re-detect project profile for current project */
    refreshProjectProfile: () => Promise<void>;
    /** Ensure C# LSP is started+initialized (no-op if not applicable) */
    ensureCSharpLspReady: () => Promise<void>;
    /** Clear recent projects list */
    clearRecentProjects: () => void;
}

const MAX_RECENT_PROJECTS = 10;

function errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}

export const useProjectStore = create<ProjectState>()(
    persist(
        (set, get) => ({
            currentProject: null,
            recentProjects: [],
            projectProfile: null,
            projectInitStatus: 'idle',
            csharpLspStatus: 'stopped',

            openProject: (rootPath: string) => {
                FrontendProfiler.profileSync('openProject', 'workspace', () => {
                // If switching workspaces, stop any running C# server first to avoid MSBuild conflicts.
                const lspClient = getCSharpLSPClient();
                const previousWorkspace = lspClient.getWorkspaceRoot();
                if (previousWorkspace && previousWorkspace !== rootPath) {
                    set({ csharpLspStatus: 'stopped', csharpLspError: undefined });
                    void FrontendProfiler.profileAsync('csharp_lsp_stop_workspace_switch', 'lsp_request', async () => {
                        await lspClient.stop();
                    }, { previousWorkspace, newWorkspace: rootPath }).catch(() => {
                        // Best-effort; ignore
                    });
                }

                // Extract project name from path
                const name = rootPath.split(/[\\/]/).pop() ?? 'Unknown';
                const project: Project = {
                    name,
                    rootPath,
                    lastOpened: new Date(),
                };

                // Update recent projects (remove if exists, add to front)
                const recentProjects = get().recentProjects.filter(
                    (p) => p.rootPath !== rootPath
                );
                recentProjects.unshift(project);

                // Keep only MAX_RECENT_PROJECTS
                if (recentProjects.length > MAX_RECENT_PROJECTS) {
                    recentProjects.pop();
                }

                set({
                    currentProject: project,
                    recentProjects,
                    projectProfile: null,
                    projectInitStatus: 'detecting',
                    projectInitError: undefined,
                });

                // Kick off detection/services in the background; never block folder opening UX.
                void get().refreshProjectProfile();
                }, { rootPath });
            },

            closeProject: () => {
                set({
                    currentProject: null,
                    projectProfile: null,
                    projectInitStatus: 'idle',
                    projectInitError: undefined,
                });

                // Stop C# LSP in background (prevents MSBuild assembly conflicts on reopen).
                void (async () => {
                    const lspClient = getCSharpLSPClient();
                    try {
                        await lspClient.stop();
                    } catch {
                        // Best-effort cleanup
                    } finally {
                        set({
                            csharpLspStatus: 'stopped',
                            csharpLspError: undefined,
                        });
                    }
                })();
            },

            refreshProjectProfile: async () => {
                await FrontendProfiler.profileAsync('refreshProjectProfile', 'workspace', async () => {
                const project = get().currentProject;
                if (!project?.rootPath) {
                    set({
                        projectProfile: null,
                        projectInitStatus: 'idle',
                        projectInitError: undefined,
                    });
                    return;
                }

                set({ projectInitStatus: 'detecting', projectInitError: undefined });

                try {
                    const detectSpan = FrontendProfiler.startSpan('invoke:detect_project_profile', 'tauri_command');
                    const profile = await invoke<ProjectProfile>('detect_project_profile', {
                        workspace_root: project.rootPath,
                        traceParent: detectSpan.id,
                    });
                    await detectSpan.end({ workspaceRoot: project.rootPath });

                    // If project changed during detection, drop the result.
                    if (get().currentProject?.rootPath !== project.rootPath) {
                        return;
                    }

                    set({ projectProfile: profile, projectInitStatus: 'ready' });

                    // Proactively start C# services for dotnet/mixed workspaces.
                    if (profile.kind === 'dotnet' || profile.kind === 'mixed') {
                        void get().ensureCSharpLspReady();
                    } else {
                        const lspClient = getCSharpLSPClient();
                        if (lspClient.getIsStarted()) {
                            void (async () => {
                                try {
                                    await lspClient.stop();
                                } catch {
                                    // ignore
                                } finally {
                                    if (get().currentProject?.rootPath === project.rootPath) {
                                        set({ csharpLspStatus: 'stopped', csharpLspError: undefined });
                                    }
                                }
                            })();
                        }
                    }
                } catch (error) {
                    if (get().currentProject?.rootPath !== project.rootPath) return;
                    set({
                        projectInitStatus: 'error',
                        projectInitError: errorMessage(error),
                        projectProfile: null,
                    });
                }
                });
            },

            ensureCSharpLspReady: async () => {
                const project = get().currentProject;
                const rootPath = project?.rootPath;
                await FrontendProfiler.profileAsync('ensureCSharpLspReady', 'lsp_request', async () => {
                if (!project?.rootPath) return;
                if (get().csharpLspStatus === 'starting' || get().csharpLspStatus === 'ready') return;

                set({ csharpLspStatus: 'starting', csharpLspError: undefined });

                const lspClient = getCSharpLSPClient();
                try {
                    await lspClient.start(project.rootPath);
                    await lspClient.initialize(project.rootPath);

                    // If project changed during startup, stop the server we started.
                    if (get().currentProject?.rootPath !== project.rootPath) {
                        await lspClient.stop();
                        return;
                    }

                    set({ csharpLspStatus: 'ready', csharpLspError: undefined });
                } catch (error) {
                    const msg = errorMessage(error);

                    // Best-effort cleanup to avoid zombie processes with loaded MSBuild assemblies.
                    try {
                        await lspClient.stop();
                    } catch {
                        // ignore
                    }

                    if (get().currentProject?.rootPath !== project.rootPath) return;
                    set({
                        csharpLspStatus: 'error',
                        csharpLspError: msg,
                    });
                }
                }, { ...(rootPath && { rootPath }) });
            },

            clearRecentProjects: () => {
                set({ recentProjects: [] });
            },
        }),
        {
            name: 'fluxel-project-store',
            // Only persist recentProjects, not currentProject
            partialize: (state) => ({ recentProjects: state.recentProjects }),
        }
    )
);
