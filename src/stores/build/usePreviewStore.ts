import { create } from 'zustand';
import { getConfigMetadata } from '@/lib/config/loader';

interface PreviewState {
    // Preview URL for the iframe
    previewUrl: string | null;

    // Status of the dev server
    isServerRunning: boolean;
    isLoading: boolean;
    error: string | null;

    // Server settings
    port: number;

    // Actions
    setPreviewUrl: (url: string | null) => void;
    setServerRunning: (running: boolean) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setPort: (port: number) => void;
    startPreview: (projectPath: string) => Promise<void>;
    stopPreview: () => void;
    refreshPreview: () => void;
}

export const usePreviewStore = create<PreviewState>((set, get) => ({
    previewUrl: null,
    isServerRunning: false,
    isLoading: false,
    error: null,
    port: 5173, // Default Vite port

    setPreviewUrl: (url) => set({ previewUrl: url }),
    setServerRunning: (running) => set({ isServerRunning: running }),
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
    setPort: (port) => set({ port }),

    startPreview: async (projectPath: string) => {
        set({ isLoading: true, error: null });

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
    },

    stopPreview: () => {
        set({
            previewUrl: null,
            isServerRunning: false,
            error: null
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
