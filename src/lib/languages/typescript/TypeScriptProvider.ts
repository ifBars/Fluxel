import { BaseLanguageProvider } from '../base/BaseLanguageProvider';
import type { MonacoInstance } from '../base/types';
import {
    configureTypeScriptLanguage,
    hydrateTypeScriptWorkspace,
    resetTypeScriptWorkspace
} from './MonacoTSConfig';
import { FrontendProfiler } from '@/lib/services';

/**
 * TypeScript language provider
 * Manages TypeScript language support in Monaco Editor
 */
export class TypeScriptProvider extends BaseLanguageProvider {
    constructor(monaco: MonacoInstance) {
        super('typescript', monaco);
    }

    /**
     * Start the TypeScript provider
     */
    async start(workspaceRoot?: string): Promise<void> {
        await FrontendProfiler.profileAsync('ts_provider_start', 'frontend_render', async () => {
            if (this.started) {
                console.log('[TypeScript] Already started');
                return;
            }

            try {
                console.log('[TypeScript] Starting TypeScript provider...');

                // Configure TypeScript language defaults
                configureTypeScriptLanguage(this.monaco);

                // Hydrate workspace if root is provided
                if (workspaceRoot) {
                    await hydrateTypeScriptWorkspace(workspaceRoot, this.monaco);
                }

                this.started = true;
                console.log('[TypeScript] Provider started successfully');
            } catch (error) {
                console.error('[TypeScript] Failed to start:', error);
                throw error;
            }
        });
    }

    /**
     * Stop the TypeScript provider
     */
    async stop(): Promise<void> {
        await FrontendProfiler.profileAsync('ts_provider_stop', 'frontend_render', async () => {
            if (!this.started) {
                return;
            }

            try {
                console.log('[TypeScript] Stopping provider...');

                // Reset TypeScript workspace
                resetTypeScriptWorkspace(this.monaco);

                this.dispose();
                this.started = false;
                console.log('[TypeScript] Provider stopped');
            } catch (error) {
                console.error('[TypeScript] Error stopping:', error);
            }
        });
    }

    /**
     * Reload workspace with new project root
     */
    async reloadWorkspace(workspaceRoot: string): Promise<void> {
        await FrontendProfiler.profileAsync('ts_reload_workspace', 'frontend_render', async () => {
            console.log('[TypeScript] Reloading workspace:', workspaceRoot);
            resetTypeScriptWorkspace(this.monaco);
            await hydrateTypeScriptWorkspace(workspaceRoot, this.monaco);
        }, { workspaceRoot });
    }
}
