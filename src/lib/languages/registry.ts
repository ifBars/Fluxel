import type { ILanguageProvider, MonacoInstance } from './base/types';

/**
 * Language provider factory function
 */
export type LanguageProviderFactory = (monaco: MonacoInstance) => ILanguageProvider;

/**
 * Language Registry
 * Centralized management for all language providers
 */
export class LanguageRegistry {
    private static instance: LanguageRegistry | null = null;
    private providers = new Map<string, ILanguageProvider>();
    private factories = new Map<string, LanguageProviderFactory>();
    private monaco: MonacoInstance | null = null;

    private constructor() {}

    /**
     * Get the singleton instance
     */
    static getInstance(): LanguageRegistry {
        if (!LanguageRegistry.instance) {
            LanguageRegistry.instance = new LanguageRegistry();
        }
        return LanguageRegistry.instance;
    }

    /**
     * Initialize the registry with Monaco instance
     */
    initialize(monaco: MonacoInstance): void {
        this.monaco = monaco;
        console.log('[LanguageRegistry] Initialized with Monaco');
    }

    /**
     * Register a language provider factory
     */
    registerFactory(languageId: string, factory: LanguageProviderFactory): void {
        this.factories.set(languageId, factory);
        console.log(`[LanguageRegistry] Registered factory for: ${languageId}`);
    }

    /**
     * Get a language provider by ID (creates if needed)
     */
    getProvider(languageId: string): ILanguageProvider | null {
        // Return existing provider if available
        if (this.providers.has(languageId)) {
            return this.providers.get(languageId)!;
        }

        // Create new provider from factory
        const factory = this.factories.get(languageId);
        if (!factory) {
            console.warn(`[LanguageRegistry] No factory registered for: ${languageId}`);
            return null;
        }

        if (!this.monaco) {
            console.error('[LanguageRegistry] Monaco not initialized');
            return null;
        }

        const provider = factory(this.monaco);
        this.providers.set(languageId, provider);
        console.log(`[LanguageRegistry] Created provider for: ${languageId}`);
        return provider;
    }

    /**
     * Start a language provider
     */
    async startProvider(languageId: string, workspaceRoot?: string): Promise<void> {
        const provider = this.getProvider(languageId);
        if (!provider) {
            throw new Error(`No provider found for language: ${languageId}`);
        }

        await provider.start(workspaceRoot);
        console.log(`[LanguageRegistry] Started provider: ${languageId}`);
    }

    /**
     * Stop a language provider
     */
    async stopProvider(languageId: string): Promise<void> {
        const provider = this.providers.get(languageId);
        if (!provider) {
            console.warn(`[LanguageRegistry] No active provider for: ${languageId}`);
            return;
        }

        await provider.stop();
        console.log(`[LanguageRegistry] Stopped provider: ${languageId}`);
    }

    /**
     * Unregister a language provider
     */
    unregister(languageId: string): void {
        const provider = this.providers.get(languageId);
        if (provider) {
            provider.dispose();
            this.providers.delete(languageId);
        }
        this.factories.delete(languageId);
        console.log(`[LanguageRegistry] Unregistered: ${languageId}`);
    }

    /**
     * Get all registered language IDs
     */
    getRegisteredLanguages(): string[] {
        return Array.from(this.factories.keys());
    }

    /**
     * Get all active providers
     */
    getActiveProviders(): string[] {
        return Array.from(this.providers.keys());
    }

    /**
     * Check if a language is registered
     */
    hasLanguage(languageId: string): boolean {
        return this.factories.has(languageId);
    }

    /**
     * Check if a provider is active
     */
    isProviderActive(languageId: string): boolean {
        const provider = this.providers.get(languageId);
        return provider ? provider.isStarted() : false;
    }

    /**
     * Stop all providers and clear registry
     */
    async dispose(): Promise<void> {
        console.log('[LanguageRegistry] Disposing all providers...');

        // Stop all active providers
        const stopPromises = Array.from(this.providers.values()).map(provider => provider.stop());
        await Promise.all(stopPromises);

        // Dispose all providers
        for (const provider of this.providers.values()) {
            provider.dispose();
        }

        this.providers.clear();
        this.factories.clear();
        console.log('[LanguageRegistry] All providers disposed');
    }
}

/**
 * Get the language registry singleton
 */
export function getLanguageRegistry(): LanguageRegistry {
    return LanguageRegistry.getInstance();
}
