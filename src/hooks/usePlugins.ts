/**
 * usePlugins Hook
 * 
 * Handles plugin system initialization and lifecycle management.
 * Provides a React-friendly interface to the plugin system.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useMonaco } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';

import { getPluginHost, getPluginLoader, getCommunityPluginsPath } from '@/lib/plugins';
import { registerCorePlugins } from '@/plugins';
import { usePluginStore, useProjectStore } from '@/stores';

/**
 * Options for the usePlugins hook
 */
interface UsePluginsOptions {
    /** Whether to automatically initialize plugins on mount */
    autoInit?: boolean;
    /** Whether to load community plugins from ~/.fluxel/plugins/ */
    loadCommunity?: boolean;
}

/**
 * Return value from the usePlugins hook
 */
interface UsePluginsReturn {
    /** Whether the plugin system is initialized */
    isInitialized: boolean;
    /** Whether plugins are currently loading */
    isLoading: boolean;
    /** Error message if initialization failed */
    error: string | null;
    /** Manually trigger plugin initialization */
    initialize: () => Promise<void>;
    /** Trigger activation for a specific event */
    triggerActivation: (event: string) => Promise<void>;
}

/**
 * Hook for managing the Fluxel plugin system
 * 
 * @param options - Configuration options
 * @returns Plugin system state and controls
 * 
 * @example
 * ```tsx
 * function EditorPage() {
 *     const { isInitialized, isLoading } = usePlugins({ autoInit: true });
 *     // ...
 * }
 * ```
 */
export function usePlugins(options: UsePluginsOptions = {}): UsePluginsReturn {
    const { autoInit = true, loadCommunity = true } = options;
    
    const monaco = useMonaco() as unknown as typeof Monaco | null;
    const { currentProject } = useProjectStore();
    const { 
        isInitialized, 
        isLoading, 
        error, 
        setIsLoading, 
        setError, 
        initialize: initStore 
    } = usePluginStore();
    
    const isInitializingRef = useRef(false);
    const hasInitializedRef = useRef(false);

    /**
     * Initialize the plugin system
     */
    const initialize = useCallback(async () => {
        if (isInitializingRef.current || hasInitializedRef.current) {
            return;
        }

        if (!monaco) {
            console.log('[usePlugins] Waiting for Monaco to load...');
            return;
        }

        isInitializingRef.current = true;
        setIsLoading(true);
        setError(null);

        try {
            console.log('[usePlugins] Initializing plugin system...');

            // Initialize the plugin host with Monaco
            const host = getPluginHost();
            host.initialize(monaco);

            // Register core plugins
            registerCorePlugins();

            // Set community plugins path
            if (loadCommunity) {
                const communityPath = await getCommunityPluginsPath();
                if (communityPath) {
                    getPluginLoader().setCommunityPluginsPath(communityPath);
                }
            }

            // Load all plugins
            const loader = getPluginLoader();
            const results = await loader.loadAllPlugins();

            console.log('[usePlugins] Plugin load results:', {
                core: results.core.filter(r => r.success).length,
                community: results.community.filter(r => r.success).length,
            });

            // Initialize the store (subscribes to events)
            initStore();

            hasInitializedRef.current = true;
            console.log('[usePlugins] Plugin system initialized');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error('[usePlugins] Failed to initialize plugin system:', err);
            setError(errorMessage);
        } finally {
            setIsLoading(false);
            isInitializingRef.current = false;
        }
    }, [monaco, loadCommunity, initStore, setIsLoading, setError]);

    /**
     * Trigger activation for a specific event
     * @param event - The activation event (e.g., "onLanguage:csharp")
     */
    const triggerActivation = useCallback(async (event: string) => {
        const host = getPluginHost();
        await host.triggerActivation(event as any);
    }, []);

    // Auto-initialize when Monaco is available
    useEffect(() => {
        if (autoInit && monaco && !hasInitializedRef.current && !isInitializingRef.current) {
            void initialize();
        }
    }, [autoInit, monaco, initialize]);

    // Update workspace root when project changes
    useEffect(() => {
        if (!hasInitializedRef.current) return;

        const host = getPluginHost();
        const workspaceRoot = currentProject?.rootPath ?? null;
        host.setWorkspaceRoot(workspaceRoot);

        // Trigger project detection
        if (workspaceRoot) {
            void host.detectProjects();
        }
    }, [currentProject?.rootPath]);

    return {
        isInitialized,
        isLoading,
        error,
        initialize,
        triggerActivation,
    };
}

/**
 * Hook for triggering plugin activation on language changes
 * 
 * Automatically triggers the `onLanguage:*` activation event when
 * a file of that language is opened for the first time.
 * 
 * @param language - The language ID of the currently active file
 */
export function usePluginLanguageActivation(language: string | null): void {
    const { isInitialized } = usePluginStore();
    const activatedLanguagesRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!isInitialized || !language) return;

        // Only trigger once per language
        if (activatedLanguagesRef.current.has(language)) return;
        activatedLanguagesRef.current.add(language);

        const host = getPluginHost();
        void host.triggerActivation(`onLanguage:${language}`);
    }, [isInitialized, language]);
}

