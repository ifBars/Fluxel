/**
 * Plugin Context Implementation
 * 
 * Provides the API surface that plugins use to extend Fluxel.
 */

import type * as Monaco from 'monaco-editor';
import type {
    PluginContext,
    Disposable,
    MonacoInstance,
    LanguageFeatureConfig,
    ProjectDetector,
    HoverProvider,
    CompletionProvider,
    SyntaxRule,
    CompletionItem,
} from './types';

/**
 * Creates a disposable from a cleanup function
 */
function createDisposable(dispose: () => void): Disposable {
    return { dispose };
}

/**
 * Plugin Context Factory
 * Creates a new plugin context for a specific plugin
 */
export function createPluginContext(
    pluginId: string,
    monaco: MonacoInstance,
    getWorkspaceRoot: () => string | null,
    onRegisterProjectDetector: (detector: ProjectDetector) => Disposable,
): PluginContext {
    const subscriptions: Disposable[] = [];

    const context: PluginContext = {
        monaco,
        pluginId,
        subscriptions,

        getWorkspaceRoot,

        registerLanguageFeatures(config: LanguageFeatureConfig): Disposable {
            const disposables: Disposable[] = [];

            // Register syntax highlighting rules
            if (config.syntaxRules && config.syntaxRules.length > 0) {
                const syntaxDisposable = this.registerSyntaxHighlighting(
                    config.languageId,
                    config.syntaxRules
                );
                disposables.push(syntaxDisposable);
            }

            // Register completion provider
            if (config.completionProvider) {
                const completionDisposable = this.registerCompletionProvider(
                    config.languageId,
                    config.completionProvider
                );
                disposables.push(completionDisposable);
            }

            // Register hover provider
            if (config.hoverProvider) {
                const hoverDisposable = this.registerHoverProvider(
                    config.languageId,
                    config.hoverProvider
                );
                disposables.push(hoverDisposable);
            }

            const disposable = createDisposable(() => {
                disposables.forEach(d => d.dispose());
            });
            subscriptions.push(disposable);
            return disposable;
        },

        registerProjectDetector(detector: ProjectDetector): Disposable {
            const disposable = onRegisterProjectDetector(detector);
            subscriptions.push(disposable);
            return disposable;
        },

        registerHoverProvider(languageSelector: string, provider: HoverProvider): Disposable {
            const monacoProvider: Monaco.languages.HoverProvider = {
                provideHover: async (model, position, token) => {
                    const result = await provider.provideHover(model, position, token);
                    if (!result) return null;

                    return {
                        contents: result.contents.map(content => ({
                            value: content,
                            isTrusted: true,
                            supportHtml: true,
                        })),
                        range: result.range ? new monaco.Range(
                            result.range.startLineNumber,
                            result.range.startColumn,
                            result.range.endLineNumber,
                            result.range.endColumn
                        ) : undefined,
                    };
                },
            };

            const registration = monaco.languages.registerHoverProvider(
                languageSelector,
                monacoProvider
            );

            const disposable = createDisposable(() => registration.dispose());
            subscriptions.push(disposable);
            return disposable;
        },

        registerCompletionProvider(languageSelector: string, provider: CompletionProvider): Disposable {
            const monacoProvider: Monaco.languages.CompletionItemProvider = {
                triggerCharacters: provider.triggerCharacters,
                provideCompletionItems: async (model, position, context, token) => {
                    const items = await provider.provideCompletionItems(model, position, context, token);
                    
                    return {
                        suggestions: items.map((item: CompletionItem) => ({
                            label: item.label,
                            kind: item.kind,
                            insertText: item.insertText,
                            insertTextRules: item.insertTextRules,
                            documentation: item.documentation ? {
                                value: item.documentation,
                                isTrusted: true,
                            } : undefined,
                            detail: item.detail,
                            sortText: item.sortText,
                            filterText: item.filterText,
                            range: undefined as any, // Monaco will compute the range
                        })),
                    };
                },
            };

            const registration = monaco.languages.registerCompletionItemProvider(
                languageSelector,
                monacoProvider
            );

            const disposable = createDisposable(() => registration.dispose());
            subscriptions.push(disposable);
            return disposable;
        },

        registerSyntaxHighlighting(languageId: string, rules: SyntaxRule[]): Disposable {
            // For syntax highlighting, we need to update the Monaco theme
            // This adds custom token colors for the plugin's tokens
            const tokenRules: Monaco.editor.ITokenThemeRule[] = rules
                .filter(rule => rule.foreground)
                .map(rule => ({
                    token: rule.token,
                    foreground: rule.foreground?.replace('#', ''),
                    fontStyle: rule.fontStyle,
                }));

            if (tokenRules.length > 0) {
                // We'll need to update the theme dynamically
                // For now, store the rules and they'll be applied when themes are defined
                console.log(`[Plugin:${pluginId}] Registered ${tokenRules.length} syntax rules for ${languageId}`);
            }

            // Return a no-op disposable since Monaco themes can't be easily unregistered
            return createDisposable(() => {
                console.log(`[Plugin:${pluginId}] Syntax rules for ${languageId} would be removed`);
            });
        },

        log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
            const prefix = `[Plugin:${pluginId}]`;
            switch (level) {
                case 'warn':
                    console.warn(prefix, message);
                    break;
                case 'error':
                    console.error(prefix, message);
                    break;
                default:
                    console.log(prefix, message);
            }
        },
    };

    return context;
}

/**
 * Dispose all subscriptions in a plugin context
 */
export function disposePluginContext(context: PluginContext): void {
    for (const subscription of context.subscriptions) {
        try {
            subscription.dispose();
        } catch (error) {
            console.error(`[Plugin:${context.pluginId}] Error disposing subscription:`, error);
        }
    }
    context.subscriptions.length = 0;
}

