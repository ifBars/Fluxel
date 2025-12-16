import { create } from 'zustand';
import { getConfigMetadata } from '@/lib/config/loader';
import { Command, Child } from '@tauri-apps/plugin-shell';
import { registerProcess, unregisterProcess } from '@/lib/services/processManager';
import { FrontendProfiler } from '@/lib/services/FrontendProfiler';
import { invoke } from '@tauri-apps/api/core';
import type { ProjectProfile } from '@/types/project';

interface PreviewState {
    // Preview URL for the iframe
    previewUrl: string | null;

    // Status of the dev server
    isServerRunning: boolean;
    isLoading: boolean;
    error: string | null;

    // Server settings
    port: number;
    devServerChild: Child | null;

    // Actions
    setPreviewUrl: (url: string | null) => void;
    setServerRunning: (running: boolean) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setPort: (port: number) => void;
    startPreview: (projectPath: string, autoStart?: boolean) => Promise<void>;
    stopPreview: () => Promise<void>;
    refreshPreview: () => void;
}

export const usePreviewStore = create<PreviewState>((set, get) => ({
    previewUrl: null,
    isServerRunning: false,
    isLoading: false,
    error: null,
    port: 5173, // Default Vite port
    devServerChild: null,

    setPreviewUrl: (url) => set({ previewUrl: url }),
    setServerRunning: (running) => set({ isServerRunning: running }),
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
    setPort: (port) => set({ port }),

startPreview: async (projectPath: string, autoStart = true) => {
        await FrontendProfiler.profileAsync('startPreview', 'tauri_command', async () => {
            set({ isLoading: true, error: null });

            // Check project type before starting preview - don't start for pure C# projects
            try {
                const profile = await invoke<ProjectProfile>('detect_project_profile', {
                    workspace_root: projectPath,
                });

                if (profile.kind === 'dotnet') {
                    set({
                        error: 'Web preview is not available for C#/.NET projects. Use the Build Panel for project management.',
                        isLoading: false,
                        isServerRunning: false,
                        previewUrl: null
                    });
                    return;
                }
            } catch (error) {
                // Continue if project detection fails
                console.warn('Failed to detect project type for preview:', error);
            }

            try {
            // Load config metadata to get the configured dev server port
            const metadata = await getConfigMetadata(projectPath);
            const configuredPort = metadata?.devServer?.port ?? get().port;

            // Update port in store if we found a configured port
            if (metadata?.devServer?.port) {
                set({ port: configuredPort });
            }

            // Exclude Tauri app ports (1420 = dev server, 1421 = HMR)
            const TAURI_PORTS = [1420, 1421];

            // Build list of ports to try, starting with configured port
            const portsToTry = [
                configuredPort,
                ...(configuredPort !== 5173 ? [5173] : []), // Add default Vite port if different
                5174,
                3000,
                3001,
                8080,
                4000,
            ]
                .filter((p) => !TAURI_PORTS.includes(p)) // Exclude Tauri ports
                .filter((p, index, arr) => arr.indexOf(p) === index); // Remove duplicates

            for (const testPort of portsToTry) {
                const url = `http://localhost:${testPort}`;

                try {
                    // Try to fetch from the URL to check if server is running
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 2000);

                    await fetch(url, {
                        signal: controller.signal,
                        mode: 'no-cors' // Allow cross-origin requests
                    });

                    clearTimeout(timeoutId);

                    // Server is running! (We've already excluded Tauri ports above)
                    set({
                        previewUrl: url,
                        isServerRunning: true,
                        isLoading: false,
                        port: testPort
                    });
                    return;
                } catch {
                    // Port not available, try next
                    continue;
                }
            }

            // If no server found and we haven't tried auto-starting yet
            if (autoStart) {
                set({
                    isLoading: true,
                    error: 'Starting dev server (bun run dev)...',
                    isServerRunning: false,
                    previewUrl: null
                });

                try {
                    // Kill existing process if any (e.g. from a previous failed/slow attempt)
                    const existingChild = get().devServerChild;
                    if (existingChild) {
                        try {
                            await existingChild.kill();
                        } catch (e) {
                            // Ignore errors if already dead
                        }
                    }

                    console.log('Auto-starting dev server...');
                    const cmd = Command.create('bun', ['run', 'dev'], { cwd: projectPath });
                    const child = await cmd.spawn();
                    set({ devServerChild: child });

                    // Register the process with the backend for cleanup on app exit
                    if (child.pid) {
                        await registerProcess(child.pid);
                    }

                    // Wait for server to start up
                    await new Promise(resolve => setTimeout(resolve, 3000));

                    // Retry connection (without auto-starting again)
                    return get().startPreview(projectPath, false);
                } catch (err) {
                    console.error('Failed to auto-start dev server:', err);
                    set({
                        error: `Failed to auto-start dev server: ${err}. Please run "bun run dev" manually.`,
                        isLoading: false
                    });
                    return;
                }
            }

                // No server found
                set({
                    error: `No dev server found. Please start your dev server (e.g., "bun run dev" or "npm run dev") and try again.`,
                    isLoading: false,
                    isServerRunning: false,
                    previewUrl: null
                });
            } catch (error) {
                set({
                    error: `Failed to connect to dev server: ${error}`,
                    isLoading: false
                });
            }
        }, { projectPath, autoStart: autoStart.toString() });
    },

    stopPreview: async () => {
        await FrontendProfiler.profileAsync('stopPreview', 'tauri_command', async () => {
            const { devServerChild } = get();
            if (devServerChild) {
                // Unregister from process manager first
                if (devServerChild.pid) {
                    await unregisterProcess(devServerChild.pid).catch(console.error);
                }

                try {
                    await devServerChild.kill();
                } catch (e) {
                    console.error('Failed to stop dev server:', e);
                }
            }

            set({
                previewUrl: null,
                isServerRunning: false,
                error: null,
                devServerChild: null
            });
        });
    },

    refreshPreview: () => {
        const { previewUrl } = get();
        if (previewUrl) {
            // Force iframe refresh by temporarily clearing and resetting
            set({ previewUrl: null });
            setTimeout(() => set({ previewUrl }), 50);
        }
    },
}));
