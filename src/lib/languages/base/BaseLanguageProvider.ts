import type { ILanguageProvider, MonacoInstance } from './types';

/**
 * Base class for language providers
 * Provides common functionality and interface for all language providers
 */
export abstract class BaseLanguageProvider implements ILanguageProvider {
    protected started = false;
    protected disposables: Array<{ dispose(): void }> = [];

    constructor(
        public readonly languageId: string,
        protected monaco: MonacoInstance
    ) {}

    /**
     * Start the language provider
     * Subclasses should override this to provide language-specific initialization
     */
    abstract start(workspaceRoot?: string): Promise<void>;

    /**
     * Stop the language provider
     * Subclasses should override this to provide language-specific cleanup
     */
    abstract stop(): Promise<void>;

    /**
     * Check if the provider is started
     */
    isStarted(): boolean {
        return this.started;
    }

    /**
     * Dispose of all resources
     */
    dispose(): void {
        // Dispose all registered disposables
        for (const disposable of this.disposables) {
            try {
                disposable.dispose();
            } catch (error) {
                console.warn(`[${this.languageId}] Failed to dispose resource:`, error);
            }
        }
        this.disposables = [];
        this.started = false;
    }

    /**
     * Register a disposable resource
     */
    protected addDisposable(disposable: { dispose(): void }): void {
        this.disposables.push(disposable);
    }
}
