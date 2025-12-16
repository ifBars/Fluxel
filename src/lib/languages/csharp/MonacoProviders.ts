import type * as Monaco from 'monaco-editor';
import { getCSharpLSPClient } from './CSharpLSPClient';
import { useDiagnosticsStore, type Diagnostic } from '@/stores/diagnostics';
import { fileUriToFsPath, lspUriToMonacoUri, monacoUriToLspUri } from '../base/fileUris';

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

    // Use standard LSP file URIs (file:///C:/...) when talking to csharp-ls.
    // Monaco models typically use an encoded drive colon (file:///c%3A/...), so convert.
    const getModelUri = (model: Monaco.editor.ITextModel) => {
        const monacoUri = model.uri.toString();
        return monacoUri.startsWith('file://') ? monacoUriToLspUri(monacoUri) : monacoUri;
    };

    // Register Completion Provider (IntelliSense)
    disposables.push(monaco.languages.registerCompletionItemProvider(languageId, {
        triggerCharacters: ['.', ' ', '(', '<'],
        provideCompletionItems: async (model, position, context) => {
            const modelLangId = model.getLanguageId();
            console.log('[LSP] Completion provider called for language:', modelLangId, 'expected:', languageId);
            
            // Ensure the model language matches
            if (modelLangId !== languageId) {
                console.warn('[LSP] Completion provider called for wrong language:', modelLangId);
                return { suggestions: [] };
            }
            
            try {
                // Check if LSP client is started
                if (!lspClient.getIsStarted()) {
                    console.warn('[LSP] Completion requested but LSP client not started');
                    return { suggestions: [] };
                }

                const uri = getModelUri(model);
                const triggerChar = context.triggerCharacter;
                const triggerKind = triggerChar ? 2 : 1; // 1 = Invoked, 2 = TriggerCharacter
                
                console.log('[LSP] Requesting completion at', uri, `line ${position.lineNumber}, col ${position.column}`, triggerChar ? `(trigger: ${triggerChar})` : '(invoked)');
                console.log('[LSP] Model URI:', model.uri.toString());
                console.log('[LSP] LSP URI:', uri);

                const completionParams: any = {
                    textDocument: { uri },
                    position: {
                        line: position.lineNumber - 1, // LSP is 0-indexed
                        character: position.column - 1,
                    },
                    context: {
                        triggerKind,
                        triggerCharacter: triggerChar,
                    },
                };

                let result;
                try {
                    result = await lspClient.sendRequest('textDocument/completion', completionParams);
                } catch (error: any) {
                    console.error('[LSP] Completion request failed:', error);
                    // Check if it's an LSP error response
                    if (error?.code) {
                        console.error('[LSP] LSP error code:', error.code, 'message:', error.message);
                    }
                    return { suggestions: [] };
                }

                console.log('[LSP] Completion response:', result ? `${result.items?.length || 0} items` : 'null', result?.isIncomplete ? '(incomplete)' : '');
                if (result) {
                    console.log('[LSP] Completion response details:', JSON.stringify(result, null, 2));
                }

                // If completion returned null, the document might not be open - try sending didOpen and retry once
                if (!result) {
                    console.warn('[LSP] Completion returned null - attempting to open document and retry');
                    
                    // Send didOpen notification with current document content (only if not already opened)
                    try {
                        if (!lspClient.isDocumentOpen(uri)) {
                        const documentText = model.getValue();
                        const currentVersion = 1; // Use version 1 for initial open
                        
                        await lspClient.sendNotification('textDocument/didOpen', {
                            textDocument: {
                                uri,
                                languageId: 'csharp',
                                version: currentVersion,
                                text: documentText,
                            },
                        });
                        }
                        
                        // Wait longer for the LSP server to process didOpen and index the document
                        // csharp-ls may need time to parse and analyze the C# code
                        await new Promise(resolve => setTimeout(resolve, 300));
                        
                        // Retry completion request
                        result = await lspClient.sendRequest('textDocument/completion', completionParams);
                        
                        if (result) {
                            const items = Array.isArray(result) ? result : (result.items || []);
                            console.log('[LSP] Completion retry successful:', `${items.length} items`);
                        } else {
                            console.warn('[LSP] Completion still returned null after didOpen retry - document may not be indexed yet');
                            // Return empty suggestions rather than failing completely
                            return { suggestions: [] };
                        }
                    } catch (retryError: any) {
                        console.error('[LSP] Failed to retry completion after didOpen:', retryError);
                        // Check if it's an LSP error response
                        if (retryError?.code) {
                            console.error('[LSP] LSP error code:', retryError.code, 'message:', retryError.message);
                        }
                        return { suggestions: [] };
                    }
                }

                // Handle both array and CompletionList formats
                const items = Array.isArray(result) ? result : (result.items || []);
                
                if (items.length === 0) {
                    return { suggestions: [] };
                }

                // Compute a stable default replace range based on the current word to avoid
                // duplicate prefixes like "AbAbstractions" when accepting suggestions.
                const word = model.getWordUntilPosition(position);
                const defaultRange: Monaco.IRange = {
                    startLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column,
                };

                const suggestions = items.map((item: any) => {
                    const textEdit = item.textEdit;
                    const lspRange = textEdit?.range ?? textEdit?.replace ?? null;

                    const range: Monaco.IRange | Monaco.languages.CompletionItemRanges = lspRange
                        ? {
                            insert: new monaco.Range(
                                lspRange.start.line + 1,
                                lspRange.start.character + 1,
                                lspRange.end.line + 1,
                                lspRange.end.character + 1,
                            ),
                            replace: new monaco.Range(
                                lspRange.start.line + 1,
                                lspRange.start.character + 1,
                                lspRange.end.line + 1,
                                lspRange.end.character + 1,
                            ),
                        }
                        : {
                            insert: new monaco.Range(
                                defaultRange.startLineNumber,
                                defaultRange.startColumn,
                                defaultRange.endLineNumber,
                                defaultRange.endColumn,
                            ),
                            replace: new monaco.Range(
                                defaultRange.startLineNumber,
                                defaultRange.startColumn,
                                defaultRange.endLineNumber,
                                defaultRange.endColumn,
                            ),
                        };

                    const insertText = textEdit?.newText || item.insertText || item.label;

                    return {
                        label: item.label,
                        kind: convertCompletionKind(monaco, item.kind),
                        insertText,
                        insertTextRules: item.insertTextFormat === 2 ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
                        detail: item.detail,
                        documentation: item.documentation?.value || item.documentation,
                        filterText: item.filterText,
                        sortText: item.sortText,
                        range,
                        // Store the original LSP item data for resolve
                        _lspItemData: item,
                    };
                });

                console.log('[LSP] Returning', suggestions.length, 'completion suggestions');
                return { 
                    suggestions,
                    incomplete: result.isIncomplete || false,
                };
            } catch (error) {
                console.error('[LSP] Completion error:', error);
                return { suggestions: [] };
            }
        },
        // Resolve completion item to get richer documentation when selected
        resolveCompletionItem: async (item) => {
            try {
                // Check if we have the original LSP item data
                const lspItemData = (item as any)._lspItemData;
                if (!lspItemData) {
                    return item;
                }

                // Send resolve request to LSP server
                const resolved = await lspClient.sendRequest('completionItem/resolve', lspItemData);

                if (!resolved) {
                    return item;
                }

                // Merge resolved data back into the completion item
                return {
                    ...item,
                    // Update documentation with richer content from resolve
                    documentation: resolved.documentation?.value || resolved.documentation || item.documentation,
                    // Update detail with more complete information
                    detail: resolved.detail || item.detail,
                    // Update additional text edits if provided (e.g., auto-imports)
                    additionalTextEdits: resolved.additionalTextEdits?.map((edit: any) => ({
                        range: new monaco.Range(
                            edit.range.start.line + 1,
                            edit.range.start.character + 1,
                            edit.range.end.line + 1,
                            edit.range.end.character + 1,
                        ),
                        text: edit.newText,
                    })),
                };
            } catch (error) {
                // If resolve fails, return the original item
                // This ensures completion still works even if resolve is not supported
                if (error instanceof Error && !error.message.includes('not started')) {
                    console.warn('[LSP] Completion resolve error:', error);
                }
                return item;
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
                    uri: monaco.Uri.parse(lspUriToMonacoUri(loc.uri)),
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
                    uri: monaco.Uri.parse(lspUriToMonacoUri(loc.uri)),
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
                    uri: monaco.Uri.parse(lspUriToMonacoUri(loc.uri)),
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
                    const refUri = monaco.Uri.parse(lspUriToMonacoUri(loc.uri));

                    // Check if model exists for this file
                    let refModel = monaco.editor.getModel(refUri);

                    // If model doesn't exist, create it with file content
                    if (!refModel) {
                        try {
                            const filePath = fileUriToFsPath(loc.uri);

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

    // Register Range Formatting (format selection only)
    disposables.push(monaco.languages.registerDocumentRangeFormattingEditProvider(languageId, {
        provideDocumentRangeFormattingEdits: async (model, range, options) => {
            try {
                const uri = getModelUri(model);
                const result = await lspClient.sendRequest('textDocument/rangeFormatting', {
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
                    options: {
                        tabSize: options.tabSize,
                        insertSpaces: options.insertSpaces,
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
                console.error('[LSP] Range formatting error:', error);
                return [];
            }
        },
    }));

    // Register Rename with resolveRenameLocation (validates before opening dialog)
    disposables.push(monaco.languages.registerRenameProvider(languageId, {
        resolveRenameLocation: async (model: Monaco.editor.ITextModel, position: Monaco.Position) => {
            try {
                const uri = getModelUri(model);
                const result = await lspClient.sendRequest('textDocument/prepareRename', {
                    textDocument: { uri },
                    position: {
                        line: position.lineNumber - 1,
                        character: position.column - 1,
                    },
                });

                // If server returns null/undefined, rename is not allowed at this position
                if (!result) {
                    return {
                        range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                        text: '',
                        rejectReason: 'Cannot rename this symbol'
                    };
                }

                // LSP can return either a Range or a PrepareRenameResult with range and placeholder
                if ('range' in result) {
                    // PrepareRenameResult format: { range, placeholder }
                    return {
                        range: new monaco.Range(
                            result.range.start.line + 1,
                            result.range.start.character + 1,
                            result.range.end.line + 1,
                            result.range.end.character + 1,
                        ),
                        text: result.placeholder || ''
                    };
                } else if ('start' in result && 'end' in result) {
                    // Plain Range format
                    return {
                        range: new monaco.Range(
                            result.start.line + 1,
                            result.start.character + 1,
                            result.end.line + 1,
                            result.end.character + 1,
                        ),
                        text: ''
                    };
                }

                // Unexpected result format
                return {
                    range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                    text: '',
                    rejectReason: 'Cannot rename this symbol'
                };
            } catch (error) {
                // Silently reject if LSP not started yet
                if (error instanceof Error && error.message.includes('not started')) {
                    return {
                        range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                        text: '',
                        rejectReason: 'Language server not ready'
                    };
                }
                console.error('[LSP] Prepare rename error:', error);
                return {
                    range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                    text: '',
                    rejectReason: 'Cannot rename this symbol'
                };
            }
        },
        provideRenameEdits: async (model: Monaco.editor.ITextModel, position: Monaco.Position, newName: string) => {
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
                            resource: monaco.Uri.parse(lspUriToMonacoUri(fileUri)),
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

    // Register Document Highlight Provider (Highlight all occurrences of symbol under cursor)
    disposables.push(monaco.languages.registerDocumentHighlightProvider(languageId, {
        provideDocumentHighlights: async (model, position) => {
            try {
                const uri = getModelUri(model);
                const result = await lspClient.sendRequest('textDocument/documentHighlight', {
                    textDocument: { uri },
                    position: {
                        line: position.lineNumber - 1, // LSP is 0-indexed
                        character: position.column - 1,
                    },
                });

                if (!result || !Array.isArray(result)) {
                    return [];
                }

                return result.map((highlight: any) => ({
                    range: {
                        startLineNumber: highlight.range.start.line + 1,
                        startColumn: highlight.range.start.character + 1,
                        endLineNumber: highlight.range.end.line + 1,
                        endColumn: highlight.range.end.character + 1,
                    },
                    kind: convertHighlightKind(monaco, highlight.kind),
                }));
            } catch (error) {
                // Silently return empty if LSP not started yet
                if (error instanceof Error && error.message.includes('not started')) {
                    return [];
                }
                console.error('[LSP] Document highlight error:', error);
                return [];
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
                                    resource: monaco.Uri.parse(lspUriToMonacoUri(fileUri)),
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
            const uri = monaco.Uri.parse(lspUriToMonacoUri(uriStr));
            const model = monaco.editor.getModel(uri);

            if (!model) {
                return;
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

            // Set Monaco markers (existing functionality - maintains squiggles)
            monaco.editor.setModelMarkers(model, markerOwner, markers);

            // Update diagnostics store (new functionality - for Problems panel)
            const filePath = uriToFilePath(uriStr);
            const storeDiagnostics = convertLspDiagnosticsToStore(uriStr, diagnostics);
            useDiagnosticsStore.getState().setDiagnostics(filePath, storeDiagnostics);
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
            
            // Clear C# diagnostics from the store
            const diagnosticsStore = useDiagnosticsStore.getState();
            monaco.editor.getModels().forEach((m) => {
                const filePath = uriToFilePath(m.uri.toString());
                diagnosticsStore.clearDiagnostics(filePath);
            });
            
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

/**
 * Convert LSP document highlight kind to Monaco document highlight kind
 */
function convertHighlightKind(monaco: typeof Monaco, lspKind?: number): Monaco.languages.DocumentHighlightKind {
    // LSP DocumentHighlightKind: 1 = Text, 2 = Read, 3 = Write
    // If kind is not provided, default to Text (1)
    const kindMap: Record<number, Monaco.languages.DocumentHighlightKind> = {
        1: monaco.languages.DocumentHighlightKind.Text,
        2: monaco.languages.DocumentHighlightKind.Read,
        3: monaco.languages.DocumentHighlightKind.Write,
    };

    return kindMap[lspKind ?? 1] || monaco.languages.DocumentHighlightKind.Text;
}


/**
 * Convert LSP diagnostic severity to store diagnostic severity
 */
function lspSeverityToStoreSeverity(lspSeverity: number): 'error' | 'warning' | 'info' | 'hint' {
    // LSP DiagnosticSeverity: 1 = Error, 2 = Warning, 3 = Info, 4 = Hint
    const severityMap: Record<number, 'error' | 'warning' | 'info' | 'hint'> = {
        1: 'error',
        2: 'warning',
        3: 'info',
        4: 'hint',
    };

    return severityMap[lspSeverity] || 'info';
}

/**
 * Convert URI to file path
 * Handles both file:///C:/path/to/file.cs and C:/path/to/file.cs formats
 */
function uriToFilePath(uri: string): string {
    return fileUriToFsPath(uri);
}

/**
 * Extract file name from file path
 */
function getFileNameFromPath(filePath: string): string {
    const parts = filePath.split(/[\\/]/);
    return parts[parts.length - 1] || filePath;
}

/**
 * Convert LSP diagnostics to store diagnostics
 */
function convertLspDiagnosticsToStore(uri: string, lspDiagnostics: any[]): Diagnostic[] {
    const filePath = uriToFilePath(uri);
    const fileName = getFileNameFromPath(filePath);

    return lspDiagnostics.map((diag, index) => {
        // Generate a unique ID for the diagnostic
        const id = `csharp-ls:${filePath}:${diag.range.start.line}:${diag.range.start.character}:${index}`;

        return {
            id,
            uri,
            filePath,
            fileName,
            severity: lspSeverityToStoreSeverity(diag.severity),
            message: diag.message,
            code: diag.code,
            source: diag.source || 'csharp-ls',
            range: {
                startLine: diag.range.start.line + 1, // Convert to 1-indexed
                startColumn: diag.range.start.character + 1, // Convert to 1-indexed
                endLine: diag.range.end.line + 1,
                endColumn: diag.range.end.character + 1,
            },
        };
    });
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
