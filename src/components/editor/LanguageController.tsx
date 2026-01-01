import { useEffect } from 'react';
import { useMonaco } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { useProjectStore } from '@/stores';
import { getLanguageRegistry } from '@/lib/languages/registry';
import { CSharpProvider } from '@/lib/languages/csharp';

/**
 * Controller that manages the lifecycle of language services (LSP, Providers)
 * for the active project. safely persisted across tab changes.
 */
export function LanguageController() {
    const monaco = useMonaco() as unknown as typeof Monaco;
    const { projectProfile, projectInitStatus, currentProject } = useProjectStore();

    // Initialize Language Registry & Providers
    useEffect(() => {
        if (!monaco) return;

        const registry = getLanguageRegistry();

        // Initialize if not already
        registry.initialize(monaco);

        // Register C# Provider if not exists
        if (!registry.hasLanguage('csharp')) {
            registry.registerFactory('csharp', (m) => new CSharpProvider(m));
        }

        // Cleanup on unmount (project close)
        return () => {
            // We don't necessarily want to destroy the registry on unmount if we're just
            // hiding the UI, but for now, we can rely on the registry's built-in checks.
            // Disposal happens when the app closes or registry is manually reset.
        };
    }, [monaco]);

    // Manage C# Provider Lifecycle based on Project
    useEffect(() => {
        if (!monaco || projectInitStatus !== 'ready' || !projectProfile) return;

        const registry = getLanguageRegistry();
        const shouldActiveCSharp = projectProfile.kind === 'dotnet' || projectProfile.kind === 'mixed';

        const manageProvider = async () => {
            try {
                if (shouldActiveCSharp) {
                    // Start provider if it's not active
                    // checks are internal to startProvider/CSharpProvider
                    await registry.startProvider('csharp', currentProject?.rootPath);
                } else {
                    // Stop if active but shouldn't be
                    if (registry.isProviderActive('csharp')) {
                        await registry.stopProvider('csharp');
                    }
                }
            } catch (error) {
                console.error('[LanguageController] Failed to manage C# provider:', error);
            }
        };

        void manageProvider();

        return () => {
            // When profile changes or component unmounts, we don't necessarily stop.
            // The ProjectManager/ProjectStore handles the heavy LSP process stop.
            // This controller mainly ensures the *UI providers* are effectively managed/synced.
        };
    }, [monaco, projectProfile, projectInitStatus, currentProject?.rootPath]);

    return null; // Headless component
}
