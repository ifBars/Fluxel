import type * as Monaco from 'monaco-editor';
import { getCSharpLSPClient } from './CSharpLSPClient';

// Track if LSP features are already registered to prevent duplicates
let lspFeaturesRegistered = false;
let lspFeaturesDisposable: Monaco.IDisposable | null = null;

/**
 * Register LSP-based language features for C# with Monaco Editor
 */
export function registerCSharpLSPFeatures(monaco: typeof Monaco): Monaco.IDisposable {
    // Prevent duplicate registration - return existing disposable
    if (lspFeaturesRegistered && lspFeaturesDisposable) {
        console.log('[LSP] C# features already registered, skipping duplicate registration');
        return lspFeaturesDisposable;
    }

    const lspClient = getCSharpLSPClient();
    const languageId = 'csharp';
    const disposables: Monaco.IDisposable[] = [];
    const markerOwner = 'csharp-ls';

    // Helper to get consistent URI
    const getModelUri = (model: Monaco.editor.ITextModel) => {
        // We need to match the URI format sent in didOpen: file:///C:/Path/To/File.cs
        // Monaco may have the file opened with scheme 'C' instead of 'file',
        // so we use toString() to get the actual path and normalize it

        // Get the raw path from Monaco
        let rawPath = model.uri.toString();

        // If it doesn't start with file://, add it
        if (!rawPath.startsWith('file:///')) {
            // Normalize slashes to forward slashes
            rawPath = rawPath.replace(/\\/g, '/');
            // Construct proper file URI
            return `file:///${rawPath}`;
        }

        return rawPath;
    };

    // Register Completion Provider (IntelliSense)
    disposables.push(monaco.languages.registerCompletionItemProvider(languageId, {
        triggerCharacters: ['.', ' ', '(', '<'],
        provideCompletionItems: async (model, position) => {
            try {
                const uri = getModelUri(model);

                const result = await lspClient.sendRequest('textDocument/completion', {
                    textDocument: { uri },
                    position: {
                        line: position.lineNumber - 1, // LSP is 0-indexed
                        character: position.column - 1,
                    },
                });

                if (!result || !result.items) {
                    return { suggestions: [] };
                }

                const suggestions = result.items.map((item: any) => ({
                    label: item.label,
                    kind: convertCompletionKind(monaco, item.kind),
                    insertText: item.insertText || item.label,
                    detail: item.detail,
                    documentation: item.documentation?.value || item.documentation,
                    range: {
                        startLineNumber: position.lineNumber,
                        startColumn: position.column,
                        endLineNumber: position.lineNumber,
                        endColumn: position.column,
                    },
                }));

                return { suggestions };
            } catch (error) {
                // Silently return empty if LSP not started yet
                return { suggestions: [] };
            }
        },
    }));

    // Register Hover Provider
    disposables.push(monaco.languages.registerHoverProvider(languageId, {
        provideHover: async (model, position) => {
            try {
                const uri = getModelUri(model);
                const result = await lspClient.sendRequest('textDocument/hover', {
                    textDocument: { uri },
                    position: {
                        line: position.lineNumber - 1,
                        character: position.column - 1,
                    },
                });

                if (!result || !result.contents) {
                    return null;
                }

                const contents = Array.isArray(result.contents)
                    ? result.contents
                    : [result.contents];

                return {
                    contents: contents.map((content: any) => ({
                        value: typeof content === 'string' ? content : content.value,
                    })),
                };
            } catch (error) {
                // Silently return null if LSP not started yet
                return null;
            }
        },
    }));

    // Register Definition Provider (Go to Definition)
    disposables.push(monaco.languages.registerDefinitionProvider(languageId, {
        provideDefinition: async (model, position) => {
            try {
                const uri = getModelUri(model);
                const result = await lspClient.sendRequest('textDocument/definition', {
                    textDocument: { uri },
                    position: {
                        line: position.lineNumber - 1,
                        character: position.column - 1,
                    },
                });

                if (!result) {
                    return null;
                }

                const locations = Array.isArray(result) ? result : [result];
                return locations.map((loc: any) => ({
                    uri: monaco.Uri.parse(loc.uri),
                    range: {
                        startLineNumber: loc.range.start.line + 1,
                        startColumn: loc.range.start.character + 1,
                        endLineNumber: loc.range.end.line + 1,
                        endColumn: loc.range.end.character + 1,
                    },
                }));
            } catch (error) {
                // Silently return null if LSP not started yet
                if (error instanceof Error && error.message.includes('not started')) {
                    return null;
                }
                console.error('[LSP] Definition error:', error);
                return null;
            }
        },
    }));

    // Register Type Definition Provider (Go to Type Definition)
    disposables.push(monaco.languages.registerTypeDefinitionProvider(languageId, {
        provideTypeDefinition: async (model, position) => {
            try {
                const uri = getModelUri(model);
                const result = await lspClient.sendRequest('textDocument/typeDefinition', {
                    textDocument: { uri },
                    position: {
                        line: position.lineNumber - 1,
                        character: position.column - 1,
                    },
                });

                if (!result) {
                    return null;
                }

                const locations = Array.isArray(result) ? result : [result];
                return locations.map((loc: any) => ({
                    uri: monaco.Uri.parse(loc.uri),
                    range: {
                        startLineNumber: loc.range.start.line + 1,
                        startColumn: loc.range.start.character + 1,
                        endLineNumber: loc.range.end.line + 1,
                        endColumn: loc.range.end.character + 1,
                    },
                }));
            } catch (error) {
                // Silently return null if LSP not started yet
                if (error instanceof Error && error.message.includes('not started')) {
                    return null;
                }
                console.error('[LSP] Type definition error:', error);
                return null;
            }
        },
    }));

    // Register Implementation Provider (Go to Implementation - for interfaces/abstract classes)
    disposables.push(monaco.languages.registerImplementationProvider(languageId, {
        provideImplementation: async (model, position) => {
            try {
                const uri = getModelUri(model);
                const result = await lspClient.sendRequest('textDocument/implementation', {
                    textDocument: { uri },
                    position: {
                        line: position.lineNumber - 1,
                        character: position.column - 1,
                    },
                });

                if (!result) {
                    return null;
                }

                const locations = Array.isArray(result) ? result : [result];
                return locations.map((loc: any) => ({
                    uri: monaco.Uri.parse(loc.uri),
                    range: {
                        startLineNumber: loc.range.start.line + 1,
                        startColumn: loc.range.start.character + 1,
                        endLineNumber: loc.range.end.line + 1,
                        endColumn: loc.range.end.character + 1,
                    },
                }));
            } catch (error) {
                // Silently return null if LSP not started yet
                if (error instanceof Error && error.message.includes('not started')) {
                    return null;
                }
                console.error('[LSP] Implementation error:', error);
                return null;
            }
        },
    }));

    // Register References Provider (Find all references)
    disposables.push(monaco.languages.registerReferenceProvider(languageId, {
        provideReferences: async (model, position, context) => {
            try {
                const uri = getModelUri(model);
                const result = await lspClient.sendRequest('textDocument/references', {
                    textDocument: { uri },
                    position: {
                        line: position.lineNumber - 1,
                        character: position.column - 1,
                    },
                    context: {
                        includeDeclaration: context.includeDeclaration,
                    },
                });

                if (!result || !Array.isArray(result)) {
                    return [];
                }

                // Parse and ensure models exist for all referenced files
                const mappedReferences = await Promise.all(result.map(async (loc: any) => {
                    const refUri = monaco.Uri.parse(loc.uri);

                    // Check if model exists for this file
                    let refModel = monaco.editor.getModel(refUri);

                    // If model doesn't exist, create it with file content
                    if (!refModel) {
                        try {
                            // Extract file path from URI (file:///C:/path/to/file.cs -> C:/path/to/file.cs)
                            const filePath = refUri.toString().replace(/^file:\/\/\//, '');

                            // Read file content via Tauri
                            const { readTextFile } = await import('@tauri-apps/plugin-fs');
                            const content = await readTextFile(filePath);

                            // Create model for the referenced file
                            monaco.editor.createModel(content, 'csharp', refUri);
                        } catch (error) {
                            console.warn('[LSP] Failed to load reference file content:', error);
                            // Continue without the model - reference will still work but no snippet
                        }
                    }

                    return {
                        uri: refUri,
                        range: {
                            startLineNumber: loc.range.start.line + 1,
                            startColumn: loc.range.start.character + 1,
                            endLineNumber: loc.range.end.line + 1,
                            endColumn: loc.range.end.character + 1,
                        },
                    };
                }));

                return mappedReferences;
            } catch (error) {
                // Silently return empty if LSP not started yet
                if (error instanceof Error && error.message.includes('not started')) {
                    return [];
                }
                console.error('[LSP] References error:', error);
                return [];
            }
        },
    }));

    // Register Signature Help
    disposables.push(monaco.languages.registerSignatureHelpProvider(languageId, {
        signatureHelpTriggerCharacters: ['(', ',', '<'],
        provideSignatureHelp: async (model, position) => {
            try {
                const uri = getModelUri(model);
                const result = await lspClient.sendRequest('textDocument/signatureHelp', {
                    textDocument: { uri },
                    position: {
                        line: position.lineNumber - 1,
                        character: position.column - 1,
                    },
                });

                if (!result) return null;

                const signatures = (result.signatures || []).map((sig: any) => ({
                    label: sig.label,
                    documentation: sig.documentation?.value || sig.documentation,
                    parameters: (sig.parameters || []).map((p: any) => ({
                        label: typeof p.label === 'string' ? p.label : p.label?.join('') ?? '',
                        documentation: p.documentation?.value || p.documentation,
                    })),
                }));

                return {
                    value: {
                        signatures,
                        activeSignature: result.activeSignature ?? 0,
                        activeParameter: result.activeParameter ?? 0,
                    },
                    dispose: () => { },
                };
            } catch (error) {
                // Silently return null if LSP not started yet
                if (error instanceof Error && error.message.includes('not started')) {
                    return null;
                }
                console.error('[LSP] Signature help error:', error);
                return null;
            }
        },
    }));

    // Register Document Symbols (outline)
    disposables.push(monaco.languages.registerDocumentSymbolProvider(languageId, {
        provideDocumentSymbols: async (model) => {
            try {
                const uri = getModelUri(model);
                const result = await lspClient.sendRequest('textDocument/documentSymbol', {
                    textDocument: { uri },
                });

                if (!result) return [];

                if (Array.isArray(result) && result.length > 0 && result[0].range) {
                    // This is SymbolInformation[] format
                    return result
                        .map((symbol: any) => convertSymbolInformation(monaco, symbol))
                        .filter((s): s is Monaco.languages.DocumentSymbol => s !== null);
                }

                if (Array.isArray(result)) {
                    // This is DocumentSymbol[] format
                    return result.map((symbol: any) => convertDocumentSymbol(monaco, symbol));
                }

                return [];
            } catch (error) {
                // Silently return empty if LSP not started yet
                if (error instanceof Error && error.message.includes('not started')) {
                    return [];
                }
                console.error('[LSP] Document symbols error:', error);
                return [];
            }
        },
    }));

    // Register Formatting
    disposables.push(monaco.languages.registerDocumentFormattingEditProvider(languageId, {
        provideDocumentFormattingEdits: async (model, options) => {
            try {
                const uri = getModelUri(model);
                const result = await lspClient.sendRequest('textDocument/formatting', {
                    textDocument: { uri },
                    options: {
                        tabSize: options.tabSize,
                        insertSpaces: options.insertSpaces,
                        trimTrailingWhitespace: true,
                        insertFinalNewline: true,
                    },
                });

                if (!Array.isArray(result)) return [];

                return result.map((edit: any) => ({
                    text: edit.newText,
                    range: new monaco.Range(
                        edit.range.start.line + 1,
                        edit.range.start.character + 1,
                        edit.range.end.line + 1,
                        edit.range.end.character + 1,
                    ),
                }));
            } catch (error) {
                // Silently return empty if LSP not started yet
                if (error instanceof Error && error.message.includes('not started')) {
                    return [];
                }
                console.error('[LSP] Formatting error:', error);
                return [];
            }
        },
    }));

    // Register Rename
    disposables.push(monaco.languages.registerRenameProvider(languageId, {
        provideRenameEdits: async (model, position, newName) => {
            try {
                const uri = getModelUri(model);
                const result = await lspClient.sendRequest('textDocument/rename', {
                    textDocument: { uri },
                    position: {
                        line: position.lineNumber - 1,
                        character: position.column - 1,
                    },
                    newName,
                });

                if (!result || !result.changes) return { edits: [] };

                const edits: Monaco.languages.IWorkspaceTextEdit[] = [];
                Object.entries(result.changes).forEach(([fileUri, textEdits]: [string, any]) => {
                    textEdits.forEach((edit: any) => {
                        edits.push({
                            resource: monaco.Uri.parse(fileUri),
                            versionId: undefined,
                            textEdit: {
                                range: new monaco.Range(
                                    edit.range.start.line + 1,
                                    edit.range.start.character + 1,
                                    edit.range.end.line + 1,
                                    edit.range.end.character + 1,
                                ),
                                text: edit.newText,
                            },
                        });
                    });
                });

                return { edits };
            } catch (error) {
                // Silently return empty if LSP not started yet
                if (error instanceof Error && error.message.includes('not started')) {
                    return { edits: [] };
                }
                console.error('[LSP] Rename error:', error);
                return { edits: [] };
            }
        },
    }));

    // Register Code Actions Provider (Quick Fixes & Refactorings)
    disposables.push(monaco.languages.registerCodeActionProvider(languageId, {
        provideCodeActions: async (model, range, context) => {
            try {
                const uri = getModelUri(model);
                const result = await lspClient.sendRequest('textDocument/codeAction', {
                    textDocument: { uri },
                    range: {
                        start: {
                            line: range.startLineNumber - 1,
                            character: range.startColumn - 1,
                        },
                        end: {
                            line: range.endLineNumber - 1,
                            character: range.endColumn - 1,
                        },
                    },
                    context: {
                        diagnostics: context.markers.map((marker: any) => ({
                            range: {
                                start: {
                                    line: marker.startLineNumber - 1,
                                    character: marker.startColumn - 1,
                                },
                                end: {
                                    line: marker.endLineNumber - 1,
                                    character: marker.endColumn - 1,
                                },
                            },
                            severity: marker.severity,
                            message: marker.message,
                            source: marker.source,
                        })),
                        only: context.only ? [context.only] : undefined,
                    },
                });

                if (!result || !Array.isArray(result)) {
                    return { actions: [], dispose: () => { } };
                }

                const actions: Monaco.languages.CodeAction[] = result.map((action: any) => {
                    const codeAction: Monaco.languages.CodeAction = {
                        title: action.title,
                        kind: action.kind,
                        diagnostics: action.diagnostics?.map((diag: any) => ({
                            severity: convertDiagnosticSeverity(monaco, diag.severity),
                            startLineNumber: diag.range.start.line + 1,
                            startColumn: diag.range.start.character + 1,
                            endLineNumber: diag.range.end.line + 1,
                            endColumn: diag.range.end.character + 1,
                            message: diag.message,
                            source: diag.source || 'csharp-ls',
                        })),
                        edit: action.edit ? {
                            edits: []
                        } : undefined,
                        isPreferred: action.isPreferred,
                    };

                    // Convert workspace edits if present
                    if (action.edit?.changes) {
                        const workspaceEdits: Monaco.languages.IWorkspaceTextEdit[] = [];
                        Object.entries(action.edit.changes).forEach(([fileUri, textEdits]: [string, any]) => {
                            textEdits.forEach((edit: any) => {
                                workspaceEdits.push({
                                    resource: monaco.Uri.parse(fileUri),
                                    versionId: undefined,
                                    textEdit: {
                                        range: new monaco.Range(
                                            edit.range.start.line + 1,
                                            edit.range.start.character + 1,
                                            edit.range.end.line + 1,
                                            edit.range.end.character + 1,
                                        ),
                                        text: edit.newText,
                                    },
                                });
                            });
                        });
                        if (codeAction.edit) {
                            codeAction.edit.edits = workspaceEdits;
                        }
                    }

                    return codeAction;
                });

                return {
                    actions,
                    dispose: () => { }
                };
            } catch (error) {
                // Silently return empty if LSP not started yet
                if (error instanceof Error && error.message.includes('not started')) {
                    return { actions: [], dispose: () => { } };
                }
                console.error('[LSP] Code actions error:', error);
                return { actions: [], dispose: () => { } };
            }
        },
    }));

    // Register Semantic Tokens Provider (LSP-based context-aware coloring)
    disposables.push(monaco.languages.registerDocumentSemanticTokensProvider(languageId, {
        getLegend: () => {
            // Define token types and modifiers that LSP uses
            return {
                tokenTypes: [
                    'namespace', 'class', 'enum', 'interface', 'struct', 'typeParameter',
                    'type', 'parameter', 'variable', 'property', 'enumMember', 'event',
                    'function', 'method', 'macro', 'keyword', 'modifier', 'comment',
                    'string', 'number', 'regexp', 'operator'
                ],
                tokenModifiers: [
                    'declaration', 'definition', 'readonly', 'static', 'deprecated',
                    'abstract', 'async', 'modification', 'documentation', 'defaultLibrary'
                ]
            };
        },
        provideDocumentSemanticTokens: async (model) => {
            try {
                const uri = getModelUri(model);
                const result = await lspClient.sendRequest('textDocument/semanticTokens/full', {
                    textDocument: { uri },
                });

                if (!result || !result.data) {
                    return { data: new Uint32Array(0) };
                }

                // LSP returns encoded semantic tokens as a flat array
                // Format: [deltaLine, deltaStart, length, tokenType, tokenModifiers]
                return {
                    data: new Uint32Array(result.data)
                };
            } catch (error) {
                // console.error('[LSP] Semantic tokens error:', error);
                return { data: new Uint32Array(0) };
            }
        },
        releaseDocumentSemanticTokens: () => {
            // No cleanup needed
        }
    }));

    // Set up diagnostics handler
    lspClient.onNotification('textDocument/publishDiagnostics', (params: any) => {
        // Ensure we are applying diagnostics to the correct model
        // LSP sends URI like file:///C:/Path...
        // Monaco model URI usually matches this if parsed correctly
        try {
            const uriStr = params.uri;
            const uri = monaco.Uri.parse(uriStr);
            const model = monaco.editor.getModel(uri);

            if (!model) {
                // Try fuzzy matching if exact match fails (case sensitivity issues etc)
                const models = monaco.editor.getModels();
                const pathFromUri = uriStr.replace('file:///', '');
                const found = models.find(m => m.uri.path.endsWith(pathFromUri) || params.uri.includes(m.uri.path));
                if (found) {
                    // Found it
                } else {
                    return;
                }
            }

            // If model is found (or need to find way to map back), apply markers. 
            // For now, use the strict URI parsing.
            if (!model) return;

            const diagnostics = params.diagnostics || [];
            const markers = diagnostics.map((diag: any) => ({
                severity: convertDiagnosticSeverity(monaco, diag.severity),
                startLineNumber: diag.range.start.line + 1,
                startColumn: diag.range.start.character + 1,
                endLineNumber: diag.range.end.line + 1,
                endColumn: diag.range.end.character + 1,
                message: diag.message,
                source: diag.source || 'csharp-ls',
            }));

            monaco.editor.setModelMarkers(model, markerOwner, markers);
        } catch (e) {
            console.error('[LSP] Error handling diagnostics:', e);
        }
    });

    console.log('[LSP] Registered C# language features including semantic tokens');

    // Mark as registered and save the disposable
    lspFeaturesRegistered = true;
    lspFeaturesDisposable = {
        dispose: () => {
            disposables.forEach(d => d.dispose());
            monaco.editor.getModels().forEach((m) => monaco.editor.setModelMarkers(m, markerOwner, []));
            // Reset flag when disposed so features can be re-registered if needed
            lspFeaturesRegistered = false;
            lspFeaturesDisposable = null;
        }
    };

    return lspFeaturesDisposable;
}

/**
 * Convert LSP completion kind to Monaco completion kind
 */
function convertCompletionKind(monaco: typeof Monaco, lspKind: number): Monaco.languages.CompletionItemKind {
    // LSP CompletionItemKind mapping
    const kindMap: Record<number, number> = {
        1: monaco.languages.CompletionItemKind.Text,
        2: monaco.languages.CompletionItemKind.Method,
        3: monaco.languages.CompletionItemKind.Function,
        4: monaco.languages.CompletionItemKind.Constructor,
        5: monaco.languages.CompletionItemKind.Field,
        6: monaco.languages.CompletionItemKind.Variable,
        7: monaco.languages.CompletionItemKind.Class,
        8: monaco.languages.CompletionItemKind.Interface,
        9: monaco.languages.CompletionItemKind.Module,
        10: monaco.languages.CompletionItemKind.Property,
        12: monaco.languages.CompletionItemKind.Value,
        13: monaco.languages.CompletionItemKind.Enum,
        14: monaco.languages.CompletionItemKind.Keyword,
        15: monaco.languages.CompletionItemKind.Snippet,
        17: monaco.languages.CompletionItemKind.File,
        18: monaco.languages.CompletionItemKind.Reference,
        19: monaco.languages.CompletionItemKind.Folder,
        21: monaco.languages.CompletionItemKind.Constant,
        22: monaco.languages.CompletionItemKind.Struct,
    };

    return kindMap[lspKind] || monaco.languages.CompletionItemKind.Text;
}

/**
 * Convert LSP diagnostic severity to Monaco marker severity
 */
function convertDiagnosticSeverity(monaco: typeof Monaco, lspSeverity: number): Monaco.MarkerSeverity {
    // LSP DiagnosticSeverity: 1 = Error, 2 = Warning, 3 = Info, 4 = Hint
    const severityMap: Record<number, number> = {
        1: monaco.MarkerSeverity.Error,
        2: monaco.MarkerSeverity.Warning,
        3: monaco.MarkerSeverity.Info,
        4: monaco.MarkerSeverity.Hint,
    };

    return severityMap[lspSeverity] || monaco.MarkerSeverity.Info;
}

function convertDocumentSymbol(monaco: typeof Monaco, symbol: any): Monaco.languages.DocumentSymbol {
    return {
        name: symbol.name,
        detail: symbol.detail,
        kind: symbolKindToMonaco(monaco, symbol.kind),
        tags: [],
        range: new monaco.Range(
            symbol.range.start.line + 1,
            symbol.range.start.character + 1,
            symbol.range.end.line + 1,
            symbol.range.end.character + 1,
        ),
        selectionRange: new monaco.Range(
            symbol.selectionRange.start.line + 1,
            symbol.selectionRange.start.character + 1,
            symbol.selectionRange.end.line + 1,
            symbol.selectionRange.end.character + 1,
        ),
        children: (symbol.children || []).map((child: any) => convertDocumentSymbol(monaco, child)),
    };
}

function convertSymbolInformation(monaco: typeof Monaco, symbol: any): Monaco.languages.DocumentSymbol | null {
    // Safety check: ensure symbol.location and symbol.location.range exist
    if (!symbol.location || !symbol.location.range) {
        console.warn('[LSP] Invalid symbol information - missing location:', symbol);
        return null;
    }

    return {
        name: symbol.name,
        detail: symbol.containerName,
        kind: symbolKindToMonaco(monaco, symbol.kind),
        tags: [],
        range: new monaco.Range(
            symbol.location.range.start.line + 1,
            symbol.location.range.start.character + 1,
            symbol.location.range.end.line + 1,
            symbol.location.range.end.character + 1,
        ),
        selectionRange: new monaco.Range(
            symbol.location.range.start.line + 1,
            symbol.location.range.start.character + 1,
            symbol.location.range.end.line + 1,
            symbol.location.range.end.character + 1,
        ),
        children: [],
    };
}

function symbolKindToMonaco(monaco: typeof Monaco, kind: number): Monaco.languages.SymbolKind {
    const map: Record<number, Monaco.languages.SymbolKind> = {
        1: monaco.languages.SymbolKind.File,
        2: monaco.languages.SymbolKind.Module,
        3: monaco.languages.SymbolKind.Namespace,
        4: monaco.languages.SymbolKind.Package,
        5: monaco.languages.SymbolKind.Class,
        6: monaco.languages.SymbolKind.Method,
        7: monaco.languages.SymbolKind.Property,
        8: monaco.languages.SymbolKind.Field,
        9: monaco.languages.SymbolKind.Constructor,
        10: monaco.languages.SymbolKind.Enum,
        11: monaco.languages.SymbolKind.Interface,
        12: monaco.languages.SymbolKind.Function,
        13: monaco.languages.SymbolKind.Variable,
        14: monaco.languages.SymbolKind.Constant,
        15: monaco.languages.SymbolKind.String,
        16: monaco.languages.SymbolKind.Number,
        17: monaco.languages.SymbolKind.Boolean,
        18: monaco.languages.SymbolKind.Array,
        19: monaco.languages.SymbolKind.Object,
        20: monaco.languages.SymbolKind.Key,
        21: monaco.languages.SymbolKind.Null,
        22: monaco.languages.SymbolKind.EnumMember,
        23: monaco.languages.SymbolKind.Struct,
        24: monaco.languages.SymbolKind.Event,
        25: monaco.languages.SymbolKind.Operator,
        26: monaco.languages.SymbolKind.TypeParameter,
    };
    return map[kind] ?? monaco.languages.SymbolKind.String;
}
