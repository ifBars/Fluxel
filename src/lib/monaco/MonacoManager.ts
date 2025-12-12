import type * as Monaco from "monaco-editor";

type MonacoInstance = typeof Monaco;

/**
 * Monaco Manager
 * Manages Monaco editor lifecycle, themes, and models
 */
export class MonacoManager {
    private static instance: MonacoManager | null = null;
    private monaco: MonacoInstance;
    private themes = new Map<string, Monaco.editor.IStandaloneThemeData>();

    private constructor(monaco: MonacoInstance) {
        this.monaco = monaco;
    }

    /**
     * Get the singleton instance
     */
    static getInstance(monaco: MonacoInstance): MonacoManager {
        if (!MonacoManager.instance) {
            MonacoManager.instance = new MonacoManager(monaco);
        }
        return MonacoManager.instance;
    }

    /**
     * Get the Monaco instance
     */
    getMonaco(): MonacoInstance {
        return this.monaco;
    }

    /**
     * Register a custom theme
     */
    registerTheme(name: string, theme: Monaco.editor.IStandaloneThemeData): void {
        this.themes.set(name, theme);
        this.monaco.editor.defineTheme(name, theme);
        console.log(`[MonacoManager] Registered theme: ${name}`);
    }

    /**
     * Set the current theme
     */
    setTheme(name: string): void {
        this.monaco.editor.setTheme(name);
        console.log(`[MonacoManager] Set theme: ${name}`);
    }

    /**
     * Get all registered themes
     */
    getThemes(): string[] {
        return Array.from(this.themes.keys());
    }

    /**
     * Create a new model
     */
    createModel(value: string, language?: string, uri?: Monaco.Uri): Monaco.editor.ITextModel {
        return this.monaco.editor.createModel(value, language, uri);
    }

    /**
     * Get an existing model by URI
     */
    getModel(uri: Monaco.Uri): Monaco.editor.ITextModel | null {
        return this.monaco.editor.getModel(uri);
    }

    /**
     * Get all models
     */
    getAllModels(): Monaco.editor.ITextModel[] {
        return this.monaco.editor.getModels();
    }

    /**
     * Dispose all models
     */
    disposeAllModels(): void {
        const models = this.monaco.editor.getModels();
        for (const model of models) {
            try {
                if (!model.isDisposed()) {
                    model.dispose();
                }
            } catch (error) {
                console.warn('[MonacoManager] Failed to dispose model:', error);
            }
        }
        console.log(`[MonacoManager] Disposed ${models.length} models`);
    }
}

/**
 * Get or create the Monaco manager instance
 */
export function getMonacoManager(monaco: MonacoInstance): MonacoManager {
    return MonacoManager.getInstance(monaco);
}
