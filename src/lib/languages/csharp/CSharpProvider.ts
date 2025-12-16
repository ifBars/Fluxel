import { BaseLanguageProvider } from '../base/BaseLanguageProvider';
import type { MonacoInstance } from '../base/types';
import { getCSharpLSPClient } from './CSharpLSPClient';
import { registerCSharpLanguage } from './Config';
import { registerCSharpLSPFeatures } from './MonacoProviders';
import { FrontendProfiler } from '@/lib/services/FrontendProfiler';

/**
 * C# language provider
 * Manages C# language support including LSP client and Monaco integration
 */
export class CSharpProvider extends BaseLanguageProvider {
    private lspClient: ReturnType<typeof getCSharpLSPClient>;

    constructor(monaco: MonacoInstance) {
        super('csharp', monaco);
        this.lspClient = getCSharpLSPClient();
    }

    /**
     * Start the C# provider
     */
    async start(workspaceRoot?: string): Promise<void> {
        await FrontendProfiler.profileAsync('csharp_provider_start', 'frontend_render', async () => {
            if (this.started) {
                console.log('[CSharp] Already started');
                return;
            }

            try {
                console.log('[CSharp] Starting C# provider...');

                // Register C# language configuration and syntax highlighting
                registerCSharpLanguage(this.monaco);

                // Register LSP-based Monaco providers (completion, hover, etc.)
                const lspDisposable = registerCSharpLSPFeatures(this.monaco);
                this.addDisposable(lspDisposable);

                // Start LSP client if workspace is provided
                if (workspaceRoot) {
                    await this.lspClient.start(workspaceRoot);
                    await this.lspClient.initialize(workspaceRoot);
                }

                this.started = true;
                console.log('[CSharp] Provider started successfully');
            } catch (error) {
                console.error('[CSharp] Failed to start:', error);
                throw error;
            }
        });
    }

    /**
     * Stop the C# provider
     */
    async stop(): Promise<void> {
        await FrontendProfiler.profileAsync('csharp_provider_stop', 'frontend_render', async () => {
            if (!this.started) {
                return;
            }

            try {
                console.log('[CSharp] Stopping provider...');

                // Stop LSP client
                await this.lspClient.stop();

                // Dispose all resources
                this.dispose();

                this.started = false;
                console.log('[CSharp] Provider stopped');
            } catch (error) {
                console.error('[CSharp] Error stopping:', error);
            }
        });
    }

    /**
     * Get the LSP client instance
     */
    getLSPClient() {
        return this.lspClient;
    }

    /**
     * Reload workspace with new project root
     */
    async reloadWorkspace(workspaceRoot: string): Promise<void> {
        await FrontendProfiler.profileAsync('csharp_reload_workspace', 'frontend_render', async () => {
            console.log('[CSharp] Reloading workspace:', workspaceRoot);

            if (this.lspClient.getIsStarted()) {
                await this.lspClient.stop();
            }

            await this.lspClient.start(workspaceRoot);
            await this.lspClient.initialize(workspaceRoot);
        }, { workspaceRoot });
    }
}
