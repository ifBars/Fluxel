import Editor, { loader, useMonaco } from "@monaco-editor/react";
import * as monacoApi from "monaco-editor";
import type * as Monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

// Use the bundled Monaco instead of the CDN loader (avoids tracking-prevention blocks)
loader.config({ monaco: monacoApi });
import { useEffect, useCallback, useState, useRef } from "react";
import { useSettingsStore, useEditorStore, type EditorTab, useProjectStore } from "@/stores";
import { loadProjectTypes, clearProjectTypes } from "../../lib/monacoTypeLoader";
import { registerProjectSourceFiles, clearProjectSourceModels } from "../../lib/monacoProjectSourceManager";
import { registerInlineCompletionProvider } from "../../lib/ollama";
import { registerCSharpLanguage } from "../../lib/csharpConfig";
import { getCSharpLSPClient } from "../../lib/lspClient";
import { registerCSharpLSPFeatures } from "../../lib/csharpMonacoIntegration";
import { File, Save, Circle } from "lucide-react";

// Ensure Monaco workers are resolved by Vite/Tauri instead of the default CDN lookup
const configureMonacoWorkers = () => {
    if (typeof self === "undefined") return;

    const globalSelf = self as unknown as {
        MonacoEnvironment?: {
            getWorker?: (moduleId: string, label: string) => Worker;
            __fluxelConfigured?: boolean;
        };
    };

    if (globalSelf.MonacoEnvironment?.__fluxelConfigured) {
        return;
    }

    globalSelf.MonacoEnvironment = {
        getWorker(_moduleId: string, label: string) {
            switch (label) {
                case "json":
                    return new jsonWorker();
                case "css":
                case "scss":
                case "less":
                    return new cssWorker();
                case "html":
                case "handlebars":
                case "razor":
                    return new htmlWorker();
                case "typescript":
                case "javascript":
                    return new tsWorker();
                default:
                    return new editorWorker();
            }
        },
        __fluxelConfigured: true,
    };
};

configureMonacoWorkers();

interface CodeEditorProps {
    activeTab: EditorTab | null;
}

export default function CodeEditor({ activeTab }: CodeEditorProps) {
    const {
        theme, fontSize, showMinimap, showLineNumbers, tabSize, wordWrap,
        autocompleteEnabled, autocompleteModel, autocompleteEndpoint, autocompleteDebounceMs
    } = useSettingsStore();
    const { updateContent, saveFile, isDirty, pendingReveal, clearPendingReveal, setCursorPosition, openFile } = useEditorStore();
    const { currentProject } = useProjectStore();
    const monaco = useMonaco() as unknown as typeof Monaco;
    const [isSaving, setIsSaving] = useState(false);
    const [editorInstance, setEditorInstance] = useState<Monaco.editor.IStandaloneCodeEditor | null>(null);
    const autocompleteDisposableRef = useRef<{ dispose: () => void } | null>(null);
    const lspClientRef = useRef(getCSharpLSPClient());
    const lspInitializedRef = useRef(false);
    const docVersionsRef = useRef<Record<string, number>>({});

    // When switching tabs, wait for the new editor instance before revealing a position.
    useEffect(() => {
        setEditorInstance(null);
    }, [activeTab?.id]);

    // Configure Monaco TypeScript defaults and load project types
    useEffect(() => {
        if (!monaco) return;

        // Keep models in sync with the TS worker so local imports resolve
        monaco.typescript.typescriptDefaults.setEagerModelSync(true);

        // Configure TypeScript defaults with Node-style module resolution
        monaco.typescript.typescriptDefaults.setCompilerOptions({
            target: monaco.typescript.ScriptTarget.ES2020,
            module: monaco.typescript.ModuleKind.ESNext,
            lib: ["ES2020", "DOM", "DOM.Iterable"],
            moduleResolution: monaco.typescript.ModuleResolutionKind.NodeJs,
            allowJs: true,
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            skipLibCheck: true,
            strict: true,
            jsx: monaco.typescript.JsxEmit.React,
        });

        // Set up diagnostics options
        monaco.typescript.typescriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: false,
            noSyntaxValidation: false,
            noSuggestionDiagnostics: false,
        });

        // Load project types if a project is open
        if (currentProject?.rootPath) {
            // First load external type definitions from node_modules
            loadProjectTypes(currentProject.rootPath, monaco)
                .then(() => {
                    // Then register project source files and set up path aliases
                    return registerProjectSourceFiles(currentProject.rootPath, monaco);
                })
                .catch((error) => {
                    console.error("Failed to load project:", error);
                });
        } else {
            // Clear types if no project is open
            clearProjectTypes(monaco);
            clearProjectSourceModels(monaco);
        }

        // Cleanup on unmount or project change
        return () => {
            if (monaco && !currentProject?.rootPath) {
                clearProjectTypes(monaco);
                clearProjectSourceModels(monaco);
            }
        };
    }, [monaco, currentProject?.rootPath]);

    // Register C# language configuration and LSP features
    useEffect(() => {
        if (!monaco) return;
        registerCSharpLanguage(monaco);
        const lspFeatures = registerCSharpLSPFeatures(monaco);

        return () => {
            lspFeatures.dispose();
        };
    }, [monaco]);

    // Define custom Fluxel themes
    useEffect(() => {
        if (!monaco) return;

        // Define custom themes and force apply whenever Monaco loads or theme changes.
        monaco.editor.defineTheme("fluxel-dark", {
            base: "vs-dark",
            inherit: true,
            rules: [
                // C# syntax highlighting rules
                { token: 'keyword', foreground: 'c586c0', fontStyle: 'bold' },
                { token: 'keyword.type', foreground: '4ec9b0' },
                { token: 'keyword.preprocessor', foreground: '9b9b9b' },
                { token: 'string', foreground: 'ce9178' },
                { token: 'string.escape', foreground: 'd7ba7d' },
                { token: 'string.char', foreground: 'ce9178' },
                { token: 'string.invalid', foreground: 'f44747' },
                { token: 'number', foreground: 'b5cea8' },
                { token: 'number.hex', foreground: 'b5cea8' },
                { token: 'number.binary', foreground: 'b5cea8' },
                { token: 'number.float', foreground: 'b5cea8' },
                { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
                { token: 'comment.doc', foreground: '6a9955', fontStyle: 'italic' },
                { token: 'operator', foreground: 'd4d4d4' },
                { token: 'delimiter', foreground: 'd4d4d4' },
                { token: 'delimiter.angle', foreground: 'd4d4d4' },
                { token: 'delimiter.square', foreground: 'd4d4d4' },
                { token: 'delimiter.parenthesis', foreground: 'd4d4d4' },
                { token: 'attribute', foreground: '4fc1ff' },
                // Type names (class names, interface names, etc.) - distinct cyan/teal color
                { token: 'type.identifier', foreground: '4ec9b0', fontStyle: 'bold' },
                // Regular identifiers (variable names, method names) - lighter blue
                { token: 'identifier', foreground: '9cdcfe' },
            ],
            colors: {
                "editor.background": "#1a1a1a",
                "editorCursor.foreground": "#f97316",
                "editor.selectionBackground": "#f9731633",
                "editorLineNumber.activeForeground": "#f97316",
                "editor.lineHighlightBackground": "#ffffff08",
            },
        });

        monaco.editor.defineTheme("fluxel-light", {
            base: "vs",
            inherit: true,
            rules: [
                // C# syntax highlighting rules
                { token: 'keyword', foreground: '0000ff', fontStyle: 'bold' },
                { token: 'keyword.type', foreground: '0078d4' },
                { token: 'keyword.preprocessor', foreground: '808080' },
                { token: 'string', foreground: 'a31515' },
                { token: 'string.escape', foreground: 'bf8803' },
                { token: 'string.char', foreground: 'a31515' },
                { token: 'string.invalid', foreground: 'cd3131' },
                { token: 'number', foreground: '098658' },
                { token: 'number.hex', foreground: '098658' },
                { token: 'number.binary', foreground: '098658' },
                { token: 'number.float', foreground: '098658' },
                { token: 'comment', foreground: '008000', fontStyle: 'italic' },
                { token: 'comment.doc', foreground: '008000', fontStyle: 'italic' },
                { token: 'operator', foreground: '000000' },
                { token: 'delimiter', foreground: '000000' },
                { token: 'delimiter.angle', foreground: '000000' },
                { token: 'delimiter.square', foreground: '000000' },
                { token: 'delimiter.parenthesis', foreground: '000000' },
                { token: 'attribute', foreground: '2b91af' },
                // Type names (class names, interface names, etc.) - distinct blue/teal color
                { token: 'type.identifier', foreground: '0078d4', fontStyle: 'bold' },
                // Regular identifiers (variable names, method names) - darker blue
                { token: 'identifier', foreground: '001080' },
            ],
            colors: {
                "editor.background": "#fafafa",
                "editorCursor.foreground": "#f97316",
                "editor.selectionBackground": "#f9731633",
                "editorLineNumber.activeForeground": "#f97316",
            },
        });

        monaco.editor.setTheme(theme === "dark" ? "fluxel-dark" : "fluxel-light");
    }, [monaco, theme]);

    // Register Ollama inline completion provider
    useEffect(() => {
        if (!monaco) {
            return;
        }

        // Dispose previous provider if exists
        if (autocompleteDisposableRef.current) {
            autocompleteDisposableRef.current.dispose();
            autocompleteDisposableRef.current = null;
        }

        // Only register if autocomplete is enabled
        if (!autocompleteEnabled) {
            return;
        }

        // Register the inline completion provider
        autocompleteDisposableRef.current = registerInlineCompletionProvider(monaco, {
            endpoint: autocompleteEndpoint,
            model: autocompleteModel,
            debounceMs: autocompleteDebounceMs,
        });

        return () => {
            if (autocompleteDisposableRef.current) {
                autocompleteDisposableRef.current.dispose();
                autocompleteDisposableRef.current = null;
            }
        };
    }, [monaco, autocompleteEnabled, autocompleteEndpoint, autocompleteModel, autocompleteDebounceMs]);

    const [lspReady, setLspReady] = useState(false);

    // Restart LSP client when workspace changes or closes
    useEffect(() => {
        const lspClient = lspClientRef.current;
        (async () => {
            // If the workspace is removed, stop the server
            if (!currentProject?.rootPath && lspInitializedRef.current) {
                await lspClient.stop();
                lspInitializedRef.current = false;
                setLspReady(false);
                docVersionsRef.current = {};
                return;
            }

            // If workspace changes, restart the server
            if (
                currentProject?.rootPath &&
                lspClient.getWorkspaceRoot() &&
                lspClient.getWorkspaceRoot() !== currentProject.rootPath
            ) {
                await lspClient.stop();
                // Wait a moment for the process to fully terminate
                await new Promise(resolve => setTimeout(resolve, 500));
                lspInitializedRef.current = false;
                setLspReady(false);
                docVersionsRef.current = {};
            }
        })();
    }, [currentProject?.rootPath]);

    // Initializer
    useEffect(() => {
        const lspClient = lspClientRef.current;

        // Only initialize once per project
        if (activeTab?.language === 'csharp' && currentProject?.rootPath && !lspInitializedRef.current) {
            lspInitializedRef.current = true;
            setLspReady(false);

            lspClient.start(currentProject.rootPath)
                .then(() => {
                    // Initialize the language server
                    return lspClient.initialize(currentProject.rootPath);
                })
                .then(() => {
                    setLspReady(true);
                })
                .catch(async (error) => {
                    console.error('[CodeEditor] Failed to start LSP:', error);

                    // Check if this is the MSBuild assembly loading error
                    const errorMsg = typeof error === 'object' && error?.message ? error.message : String(error);
                    if (errorMsg.includes('MSBuild assemblies were already loaded') ||
                        errorMsg.includes('RegisterInstance')) {
                        console.error('[CodeEditor] MSBuild assembly conflict detected. Try closing and reopening Fluxel.');
                    }

                    // If initialization failed, make sure to stop the server process
                    // to avoid leaving zombie processes with loaded MSBuild assemblies
                    try {
                        await lspClient.stop();
                        // Wait for process cleanup
                        await new Promise(resolve => setTimeout(resolve, 500));
                    } catch (stopError) {
                        console.error('[CodeEditor] Error stopping LSP after failure:', stopError);
                    }

                    lspInitializedRef.current = false; // Allow retry on error
                    setLspReady(false);
                });
        }

        return () => {
            // No cleanup needed here
        };
    }, [currentProject?.rootPath, activeTab?.language]);

    // Send textDocument/didOpen when C# file is opened
    useEffect(() => {
        const lspClient = lspClientRef.current;

        if (activeTab?.language === 'csharp' && lspReady && activeTab) {
            const uri = `file:///${activeTab.path.replace(/\\/g, '/')}`;
            docVersionsRef.current[uri] = 1;

            lspClient.sendNotification('textDocument/didOpen', {
                textDocument: {
                    uri,
                    languageId: 'csharp',
                    version: 1,
                    text: activeTab.content,
                },
            }).catch((error) => {
                console.error('[CodeEditor] Failed to send didOpen:', error);
            });

            // Send didClose when the tab changes or component unmounts
            return () => {
                lspClient.sendNotification('textDocument/didClose', {
                    textDocument: {
                        uri,
                    },
                }).catch((error) => {
                    console.error('[CodeEditor] Failed to send didClose:', error);
                });
                delete docVersionsRef.current[uri];
            };
        }
    }, [activeTab?.id, activeTab?.language, activeTab?.path, lspReady]);

    // Handle pending editor actions (from menu)
    useEffect(() => {
        if (!editorInstance || !useEditorStore.getState().pendingAction) return;

        const unsubscribe = useEditorStore.subscribe((state) => {
            const action = state.pendingAction;
            if (!action || !editorInstance) return;

            // Execute the action
            switch (action) {
                case 'undo':
                    editorInstance.trigger('menu', 'undo', null);
                    break;
                case 'redo':
                    editorInstance.trigger('menu', 'redo', null);
                    break;
                case 'cut':
                    editorInstance.trigger('menu', 'editor.action.clipboardCutAction', null);
                    break;
                case 'copy':
                    editorInstance.trigger('menu', 'editor.action.clipboardCopyAction', null);
                    break;
                case 'paste':
                    editorInstance.trigger('menu', 'editor.action.clipboardPasteAction', null);
                    break;
                case 'selectAll':
                    editorInstance.setSelection(editorInstance.getModel()?.getFullModelRange() || new monaco.Selection(1, 1, 1, 1));
                    break;
                case 'find':
                    editorInstance.trigger('menu', 'actions.find', null);
                    break;
                case 'replace':
                    editorInstance.trigger('menu', 'editor.action.startFindReplaceAction', null);
                    break;
                case 'gotoLine':
                    editorInstance.trigger('menu', 'editor.action.gotoLine', null);
                    break;
                case 'formatDocument':
                    editorInstance.trigger('menu', 'editor.action.formatDocument', null);
                    break;
                case 'fold':
                    editorInstance.trigger('menu', 'editor.fold', null);
                    break;
                case 'unfold':
                    editorInstance.trigger('menu', 'editor.unfold', null);
                    break;
            }

            // Clear the action after execution
            useEditorStore.getState().clearPendingAction();
        });

        return () => unsubscribe();
    }, [editorInstance]);

    // Handle save keyboard shortcut
    const handleSave = useCallback(async () => {
        if (activeTab && !isSaving) {
            setIsSaving(true);
            try {
                await saveFile(activeTab.id);

                // Notify LSP server of save events for C#
                if (activeTab.language === 'csharp' && lspReady) {
                    const lspClient = lspClientRef.current;
                    const uri = `file:///${activeTab.path.replace(/\\/g, '/')}`;
                    await lspClient.sendNotification('textDocument/didSave', {
                        textDocument: { uri },
                        text: activeTab.content,
                    }).catch((error) => {
                        console.error('[CodeEditor] Failed to send didSave:', error);
                    });
                }
            } finally {
                setIsSaving(false);
            }
        }
    }, [activeTab, saveFile, isSaving, lspReady]);

    // Handle content changes
    const handleEditorChange = useCallback((value: string | undefined) => {
        if (activeTab && value !== undefined) {
            updateContent(activeTab.id, value);

            // Send textDocument/didChange for C# files
            if (activeTab.language === 'csharp' && lspReady) {
                const lspClient = lspClientRef.current;
                const uri = `file:///${activeTab.path.replace(/\\/g, '/')}`;
                const nextVersion = (docVersionsRef.current[uri] ?? 1) + 1;
                docVersionsRef.current[uri] = nextVersion;
                lspClient.sendNotification('textDocument/didChange', {
                    textDocument: {
                        uri,
                        version: nextVersion,
                    },
                    contentChanges: [
                        {
                            text: value,
                        },
                    ],
                }).catch((error) => {
                    console.error('[CodeEditor] Failed to send didChange:', error);
                });
            }
        }
    }, [activeTab, updateContent, lspReady]);

    // Handle editor mount (for future extensions)
    const handleEditorMount = useCallback((editor: Monaco.editor.IStandaloneCodeEditor) => {
        setEditorInstance(editor);

        // Override the openCodeEditor handler so "Go to Definition" works across files
        // Monaco's editor.ICodeEditorService.openCodeEditor is called when navigating to definitions
        const editorService = (editor as any)._codeEditorService;
        if (editorService) {
            const originalOpenCodeEditor = editorService.openCodeEditor.bind(editorService);
            editorService.openCodeEditor = async (
                input: { resource: Monaco.Uri; options?: { selection?: Monaco.IRange } },
                source: any,
                sideBySide?: boolean
            ) => {
                // Try opening in the UI first
                const targetPath = input.resource.path.startsWith('/')
                    ? input.resource.path.substring(1)
                    : input.resource.path;
                const normalizedPath = targetPath.replace(/\//g, '/');

                // Open the file via the editor store
                await openFile(normalizedPath, {
                    line: input.options?.selection?.startLineNumber ?? 1,
                    column: input.options?.selection?.startColumn ?? 1,
                });

                // Return the editor for that model (if it exists)
                return originalOpenCodeEditor(input, source, sideBySide);
            };
        }
    }, [openFile]);

    // Track cursor position changes
    useEffect(() => {
        if (!editorInstance || !activeTab) {
            if (!activeTab) {
                setCursorPosition(null);
            }
            return;
        }

        const updateCursorInfo = () => {
            const selection = editorInstance.getSelection();
            if (selection) {
                const model = editorInstance.getModel();
                if (model) {
                    const start = selection.getStartPosition();
                    const end = selection.getEndPosition();
                    const selectionLength = model.getValueInRange({
                        startLineNumber: start.lineNumber,
                        startColumn: start.column,
                        endLineNumber: end.lineNumber,
                        endColumn: end.column,
                    }).length;

                    setCursorPosition({
                        line: start.lineNumber,
                        column: start.column,
                        selectionLength: selectionLength,
                    });
                }
            }
        };

        // Initial update
        updateCursorInfo();

        // Listen to cursor position changes
        const cursorDisposable = editorInstance.onDidChangeCursorPosition(() => {
            updateCursorInfo();
        });

        // Listen to selection changes
        const selectionDisposable = editorInstance.onDidChangeCursorSelection(() => {
            updateCursorInfo();
        });

        // Cleanup
        return () => {
            cursorDisposable.dispose();
            selectionDisposable.dispose();
        };
    }, [editorInstance, activeTab, setCursorPosition]);


    // Reveal pending selection/line when requested (e.g., from search results)
    useEffect(() => {
        if (!editorInstance || !pendingReveal || !activeTab || pendingReveal.tabId !== activeTab.id) {
            return;
        }

        const model = editorInstance.getModel();
        const maxLine = model?.getLineCount() ?? pendingReveal.line;
        const lineNumber = Math.min(Math.max(pendingReveal.line, 1), maxLine);
        const maxColumn = model?.getLineMaxColumn(lineNumber) ?? pendingReveal.column;
        const column = Math.min(Math.max(pendingReveal.column, 1), maxColumn);

        editorInstance.revealLineInCenter(lineNumber);
        editorInstance.setSelection({
            startLineNumber: lineNumber,
            startColumn: column,
            endLineNumber: lineNumber,
            endColumn: column,
        });

        clearPendingReveal();
    }, [editorInstance, pendingReveal, activeTab, clearPendingReveal]);

    // Register keyboard shortcut for save
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSave]);

    // Format file path for breadcrumb display
    const formatPath = (path: string): string[] => {
        const parts = path.split('/').filter(Boolean);
        return parts.length > 3
            ? ['...', ...parts.slice(-2)]
            : parts;
    };

    // Show placeholder if no active tab
    if (!activeTab) {
        return (
            <div className="h-full w-full flex flex-col bg-background">
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <div className="text-center max-w-md px-8">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-muted/50 flex items-center justify-center">
                            <File className="w-8 h-8 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm font-medium text-foreground mb-1">No file selected</p>
                        <p className="text-xs opacity-70">Open a file from the explorer to start editing</p>
                    </div>
                </div>
            </div>
        );
    }

    const dirty = isDirty(activeTab.id);
    const pathParts = formatPath(activeTab.path);

    return (
        <div className="h-full w-full flex flex-col overflow-hidden bg-background">
            {/* Editor Header */}
            <div className="h-8 border-b border-border bg-muted/20 flex items-center justify-between px-3 shrink-0">
                {/* File Path Breadcrumb */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <File className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
                        {pathParts.map((part, index) => (
                            <div key={index} className="flex items-center gap-1.5">
                                {index > 0 && (
                                    <span className="text-muted-foreground/40">/</span>
                                )}
                                <span className="truncate">{part}</span>
                            </div>
                        ))}
                    </div>
                    {dirty && (
                        <Circle className="w-2 h-2 fill-primary text-primary shrink-0 ml-1.5" />
                    )}
                </div>

                {/* Save Button */}
                <button
                    onClick={handleSave}
                    disabled={!dirty || isSaving}
                    className={`
                        flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium
                        transition-all shrink-0
                        ${dirty && !isSaving
                            ? 'bg-primary/10 text-primary hover:bg-primary/20'
                            : 'text-muted-foreground opacity-50 cursor-not-allowed'
                        }
                    `}
                    title={dirty ? "Save (Ctrl+S)" : "No changes to save"}
                >
                    <Save className="w-3 h-3" />
                    <span>{isSaving ? "Saving..." : "Save"}</span>
                </button>
            </div>

            {/* Monaco Editor */}
            <div className="flex-1 overflow-hidden relative">
                <Editor
                    key={activeTab.id}
                    height="100%"
                    path={activeTab.path}
                    language={activeTab.language}
                    value={activeTab.content}
                    onChange={handleEditorChange}
                    onMount={handleEditorMount}
                    theme={theme === "dark" ? "fluxel-dark" : "fluxel-light"}
                    options={{
                        minimap: { enabled: showMinimap },
                        fontSize: fontSize,
                        fontFamily: "'JetBrains Mono', monospace",
                        smoothScrolling: true,
                        cursorBlinking: "smooth",
                        padding: { top: 8, bottom: 8 },
                        automaticLayout: true,
                        wordWrap: wordWrap ? "on" : "off",
                        lineNumbers: showLineNumbers ? "on" : "off",
                        tabSize: tabSize,
                        renderWhitespace: "selection",
                        bracketPairColorization: { enabled: true },
                        guides: {
                            bracketPairs: true,
                            indentation: true,
                        },
                        scrollBeyondLastLine: false,
                        renderLineHighlight: "all",
                        inlineSuggest: {
                            enabled: autocompleteEnabled,
                        },
                        // Enable inline suggestions feature
                        suggest: {
                            showInlineDetails: true,
                        },
                    }}
                />
            </div>
        </div>
    );
}
