import Editor, { DiffEditor, loader, useMonaco } from "@monaco-editor/react";
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
import { useProfiler } from "@/hooks/useProfiler";
import { usePluginLanguageActivation } from "@/hooks/usePlugins";
import { toFileUri } from "@/lib/languages/typescript";
import { registerInlineCompletionProvider } from "../../lib/ollama";
import { CSharpProvider, getCSharpLSPClient, registerCSharpColorThemes } from "@/lib/languages/csharp";
import { configureTypeScriptLanguage, hydrateTypeScriptWorkspace, resetTypeScriptWorkspace } from "@/lib/languages/typescript";
import { hasTypeScriptIndicators } from "@/lib/languages/typescript/TypeLoader";
import { getLazyTypeResolver } from "@/lib/languages/typescript/LazyTypeResolver";
import { shouldHydrateTypeScriptWorkspace } from "@/lib/services/ProjectManager";
import { fsPathToLspUri } from "@/lib/languages/base/fileUris";
import { getLanguageRegistry } from "@/lib/languages/registry";
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
    const { ProfilerWrapper, startSpan, trackInteraction } = useProfiler('CodeEditor');

    // Trigger plugin activation for the active file's language
    usePluginLanguageActivation(activeTab?.language ?? null);
    
    const {
        theme,
        // Font settings
        fontSize, fontFamily, lineHeight, fontLigatures, fontWeight, letterSpacing,
        // Cursor settings
        cursorStyle, cursorBlinking, cursorWidth, cursorSmoothCaretAnimation,
        // Whitespace settings
        tabSize, insertSpaces, renderWhitespace, renderIndentGuides, highlightActiveIndentGuide,
        // Display settings
        showLineNumbers, lineNumbers, renderLineHighlight, bracketPairColorization,
        bracketPairGuides, folding, foldingHighlight, glyphMargin,
        // Behavior settings
        wordWrap, wordWrapColumn, smoothScrolling, scrollBeyondLastLine, stickyScroll,
        autoClosingBrackets, autoClosingQuotes, formatOnPaste,
        // Minimap settings
        showMinimap, minimapSide, minimapScale, minimapMaxColumn, minimapShowSlider,
        // Autocomplete settings
        autocompleteEnabled, autocompleteModel, autocompleteEndpoint, autocompleteDebounceMs
    } = useSettingsStore();
    const { updateContent, saveFile, isDirty, pendingReveal, clearPendingReveal, setCursorPosition, openFile } = useEditorStore();
    const { currentProject, projectProfile, projectInitStatus, csharpLspStatus, ensureCSharpLspReady } = useProjectStore();
    const monaco = useMonaco() as unknown as typeof Monaco;
    const [isSaving, setIsSaving] = useState(false);
    const [editorInstance, setEditorInstance] = useState<Monaco.editor.IStandaloneCodeEditor | null>(null);
    const [diffEditorInstance, setDiffEditorInstance] = useState<Monaco.editor.IStandaloneDiffEditor | null>(null);
    const autocompleteDisposableRef = useRef<{ dispose: () => void } | null>(null);
    const lspClientRef = useRef(getCSharpLSPClient());
    const docVersionsRef = useRef<Record<string, number>>({});
    const hydratedProjectRootRef = useRef<string | null>(null);
    const openedDocsRef = useRef<Set<string>>(new Set());
    const currentOpenUriRef = useRef<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // When switching tabs, wait for the new editor instance before revealing a position.
    useEffect(() => {
        setEditorInstance(null);

        // Clear the diff editor ref when switching away from diff mode.
        // The @monaco-editor/react DiffEditor component handles its own disposal via React lifecycle.
        // Manual disposal here was causing a race condition where models were disposed
        // before the DiffEditor finished resetting, causing:
        // "TextModel got disposed before DiffEditorWidget model got reset" error.
        if (activeTab?.type !== 'diff') {
            setDiffEditorInstance(null);
        }
    }, [activeTab?.id, activeTab?.type]);

    // Configure Monaco TypeScript to behave like VSCode (full IntelliSense)
    useEffect(() => {
        if (!monaco) return;

        // Only configure TypeScript language for TS/JS/mixed projects
        // Skip for pure C# projects to avoid polluting editor with TS/JS options
        const shouldConfigureTS = !currentProject ||
            projectProfile?.kind === 'javascript' ||
            projectProfile?.kind === 'mixed';

        if (shouldConfigureTS) {
            if (import.meta.env.DEV) {
                console.log('[CodeEditor] Configuring TypeScript language', {
                    hasProject: !!currentProject,
                    projectKind: projectProfile?.kind,
                    projectRoot: currentProject?.rootPath
                });
            }
            configureTypeScriptLanguage(monaco);
        } else if (import.meta.env.DEV) {
            console.log('[CodeEditor] Skipping TypeScript configuration for C# project', {
                projectKind: projectProfile?.kind,
                projectRoot: currentProject?.rootPath
            });
        }
    }, [monaco, currentProject?.rootPath, projectProfile?.kind]);

    // Hydrate Monaco with project types/models when the workspace changes
    useEffect(() => {
        if (!monaco) return;
        const projectRoot = currentProject?.rootPath ?? null;

        // Always clear stale models when closing or switching projects
        if (!projectRoot) {
            resetTypeScriptWorkspace(monaco);
            hydratedProjectRootRef.current = null;
            return;
        }

        if (hydratedProjectRootRef.current && hydratedProjectRootRef.current !== projectRoot) {
            resetTypeScriptWorkspace(monaco);
            hydratedProjectRootRef.current = null;
        }

        // Wait for project profile detection so we don't hydrate irrelevant workspaces
        if (projectInitStatus === 'error') {
            hydratedProjectRootRef.current = null;
            resetTypeScriptWorkspace(monaco);
            return;
        }

        // If project detection hasn't completed yet, don't hydrate yet
        // (we'll handle proactive loading in the file-opened effect below)
        if (projectInitStatus !== 'ready') {
            return;
        }

        if (!shouldHydrateTypeScriptWorkspace(projectProfile)) {
            hydratedProjectRootRef.current = null;
            resetTypeScriptWorkspace(monaco);
            return;
        }

        if (hydratedProjectRootRef.current === projectRoot) {
            return;
        }

        let cancelled = false;
        const hydrate = async () => {
            try {
                await hydrateTypeScriptWorkspace(projectRoot, monaco);
                if (!cancelled) {
                    hydratedProjectRootRef.current = projectRoot;
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('[Monaco] Failed to hydrate TypeScript workspace:', error);
                }
            }
        };

        hydrate();

        return () => {
            cancelled = true;
        };
    }, [monaco, currentProject?.rootPath, projectProfile, projectInitStatus]);

    // Proactively trigger type loading when a TypeScript/JavaScript file is opened
    // This ensures types are loaded even if project detection hasn't completed yet
    useEffect(() => {
        if (!monaco || !activeTab) return;
        const projectRoot = currentProject?.rootPath ?? null;
        if (!projectRoot) return;

        // Only trigger for TypeScript/JavaScript files
        const isTypeScriptFile = activeTab.language === 'typescript' || activeTab.language === 'javascript';
        if (!isTypeScriptFile) return;

        // Skip if types are already loaded for this project
        if (hydratedProjectRootRef.current === projectRoot) return;

        // Even if project detection failed, try to load types if we have a TS/JS file open
        // This handles cases where detection fails but the project is still valid
        if (projectInitStatus === 'error') {
            let cancelled = false;
            const loadTypesOnError = async () => {
                try {
                    const hasIndicators = await hasTypeScriptIndicators(projectRoot);
                    if (!cancelled && hasIndicators && hydratedProjectRootRef.current !== projectRoot) {
                        await hydrateTypeScriptWorkspace(projectRoot, monaco);
                        if (!cancelled) {
                            hydratedProjectRootRef.current = projectRoot;
                        }
                    }
                } catch (error) {
                    if (!cancelled) {
                        console.error('[Monaco] Failed to load types after detection error:', error);
                    }
                }
            };

            loadTypesOnError();

            return () => {
                cancelled = true;
            };
        }

        // If project detection is ready, check if types should be loaded
        if (projectInitStatus === 'ready') {
            // If the main effect already determined types should be loaded, it will handle it
            if (shouldHydrateTypeScriptWorkspace(projectProfile)) {
                // The main hydration effect will handle loading (or already has)
                return;
            }
            
            // If we reach here, the project profile says it's not a TypeScript project,
            // but the user just opened a TypeScript file. Load types on-demand anyway.
            // This handles cases where tsconfig.json is missing but .ts files exist.
            let cancelled = false;
            const loadTypesOnDemand = async () => {
                try {
                    const hasIndicators = await hasTypeScriptIndicators(projectRoot);
                    if (!cancelled && hasIndicators && hydratedProjectRootRef.current !== projectRoot) {
                        await hydrateTypeScriptWorkspace(projectRoot, monaco);
                        if (!cancelled) {
                            hydratedProjectRootRef.current = projectRoot;
                        }
                    }
                } catch (error) {
                    if (!cancelled) {
                        console.error('[Monaco] Failed to load types on-demand:', error);
                    }
                }
            };

            loadTypesOnDemand();

            return () => {
                cancelled = true;
            };
        }

        // If project detection hasn't completed yet (status is 'detecting' or 'idle'),
        // check for TypeScript indicators proactively and load types if found
        let cancelled = false;
        const checkAndLoad = async () => {
            try {
                const hasIndicators = await hasTypeScriptIndicators(projectRoot);
                if (!cancelled && hasIndicators && hydratedProjectRootRef.current !== projectRoot) {
                    await hydrateTypeScriptWorkspace(projectRoot, monaco);
                    if (!cancelled) {
                        hydratedProjectRootRef.current = projectRoot;
                    }
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('[Monaco] Failed to proactively load types:', error);
                }
            }
        };

        checkAndLoad();

        return () => {
            cancelled = true;
        };
    }, [monaco, activeTab?.id, activeTab?.language, currentProject?.rootPath, projectInitStatus, projectProfile]);

    // Initialize language registry and register C# provider
    useEffect(() => {
        if (!monaco) return;

        // Initialize the language registry with Monaco instance
        const registry = getLanguageRegistry();
        registry.initialize(monaco);

        // Register C# provider factory
        registry.registerFactory('csharp', (monacoInstance) => new CSharpProvider(monacoInstance));

        // Start C# provider (this registers language config, LSP features, etc.)
        // We don't pass workspace root here because it will be started by ProjectManager
        void registry.startProvider('csharp').catch((error) => {
            console.error('[CodeEditor] Failed to start C# provider:', error);
        });

        return () => {
            // Cleanup is handled by the registry dispose method
            void registry.stopProvider('csharp').catch((error) => {
                console.error('[CodeEditor] Failed to stop C# provider:', error);
            });
        };
    }, [monaco]);

    // Define custom Fluxel themes and register all C# color themes
    useEffect(() => {
        if (!monaco) return;

        registerCSharpColorThemes(monaco);
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

    const normalizedProjectRoot = currentProject?.rootPath?.replace(/\\/g, '/');
    const lspReady =
        csharpLspStatus === 'ready' &&
        Boolean(normalizedProjectRoot) &&
        lspClientRef.current.getWorkspaceRoot()?.replace(/\\/g, '/') === normalizedProjectRoot;

    // Ensure C# LSP is ready when editing C# files (managed centrally via the project store).
    useEffect(() => {
        if (activeTab?.language !== 'csharp') return;
        if (!currentProject?.rootPath) return;
        if (lspReady || csharpLspStatus === 'starting') return;
        void ensureCSharpLspReady();
    }, [activeTab?.language, currentProject?.rootPath, csharpLspStatus, lspReady, ensureCSharpLspReady]);

    // Clear document version tracking when workspace/LSP is not active.
    useEffect(() => {
        if (!currentProject?.rootPath || csharpLspStatus === 'stopped') {
            docVersionsRef.current = {};
        }
    }, [currentProject?.rootPath, csharpLspStatus]);

    // If the server stops/restarts, forget locally-opened documents so we re-send didOpen.
    useEffect(() => {
        if (!lspReady) {
            openedDocsRef.current.clear();
            currentOpenUriRef.current = null;
        }
    }, [lspReady]);

    // Send textDocument/didOpen when C# file is opened and LSP is ready
    // Only re-run when tab ID, language, or path changes - NOT when content changes
    useEffect(() => {
        const lspClient = lspClientRef.current;

        if (activeTab?.language === 'csharp' && lspReady && activeTab && lspClient.getIsStarted()) {
            // Use standard LSP file URIs for csharp-ls (file:///C:/...), not Monaco's encoded form.
            const uri = fsPathToLspUri(activeTab.path);
            
            // Close previous document if switching to a different one
            const previousUri = currentOpenUriRef.current;
            if (previousUri && previousUri !== uri && openedDocsRef.current.has(previousUri)) {
                lspClient.sendNotification('textDocument/didClose', {
                    textDocument: {
                        uri: previousUri,
                    },
                }).catch((error) => {
                    console.error('[CodeEditor] Failed to send didClose:', error);
                });
                openedDocsRef.current.delete(previousUri);
            }
            
            // Only send didOpen if we haven't already opened this document
            if (!openedDocsRef.current.has(uri)) {
                const currentVersion = docVersionsRef.current[uri] || 1;
                docVersionsRef.current[uri] = currentVersion;

                // Send didOpen and only mark as open after it's sent successfully
                lspClient.sendNotification('textDocument/didOpen', {
                    textDocument: {
                        uri,
                        languageId: 'csharp',
                        version: currentVersion,
                        text: activeTab.content,
                    },
                }).then(() => {
                    // Mark as open only after successful send
                    openedDocsRef.current.add(uri);
                    currentOpenUriRef.current = uri;
                }).catch((error) => {
                    console.error('[CodeEditor] Failed to send didOpen:', error);
                    // Don't mark as open if send failed
                });
            } else {
                // Document already open, just update the ref
                currentOpenUriRef.current = uri;
            }

            // Send didClose when the tab changes or component unmounts
            return () => {
                // Only close if this is still the current URI (not already switched)
                if (currentOpenUriRef.current === uri && openedDocsRef.current.has(uri)) {
                    lspClient.sendNotification('textDocument/didClose', {
                        textDocument: {
                            uri,
                        },
                    }).catch((error) => {
                        console.error('[CodeEditor] Failed to send didClose:', error);
                    });
                    openedDocsRef.current.delete(uri);
                    delete docVersionsRef.current[uri];
                    if (currentOpenUriRef.current === uri) {
                        currentOpenUriRef.current = null;
                    }
                }
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
            const span = startSpan('save_file', 'frontend_interaction');
            setIsSaving(true);
            try {
                trackInteraction('save_file_started', { 
                    fileName: activeTab.path,
                    language: activeTab.language 
                });
                
                await saveFile(activeTab.id);

                // Notify LSP server of save events for C#
                if (activeTab.language === 'csharp' && lspReady && lspClientRef.current.getIsStarted()) {
                    const lspClient = lspClientRef.current;
                    const uri = fsPathToLspUri(activeTab.path);
                    await lspClient.sendNotification('textDocument/didSave', {
                        textDocument: { uri },
                        text: activeTab.content,
                    }).catch((error) => {
                        console.error('[CodeEditor] Failed to send didSave:', error);
                    });
                }
                
                trackInteraction('save_file_completed', { 
                    fileName: activeTab.path,
                    language: activeTab.language 
                });
            } finally {
                setIsSaving(false);
                await span.end({ fileName: activeTab.path });
            }
        }
    }, [activeTab, saveFile, isSaving, lspReady, startSpan, trackInteraction]);

    // Handle content changes
    const handleEditorChange = useCallback((value: string | undefined) => {
        if (activeTab && value !== undefined) {
            updateContent(activeTab.id, value);

            // Send textDocument/didChange for C# files (only if document is open)
            if (activeTab.language === 'csharp' && lspReady && lspClientRef.current.getIsStarted()) {
                const lspClient = lspClientRef.current;
                const uri = fsPathToLspUri(activeTab.path);
                
                // Only send didChange if the document is already open in the LSP
                if (openedDocsRef.current.has(uri)) {
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
                } else {
                    // Document not open yet - didOpen will be sent by the useEffect
                }
            }

            // Lazy load types for TypeScript/JavaScript files when imports change
            if (currentProject && (
                activeTab.language === 'typescript' ||
                activeTab.language === 'javascript' ||
                activeTab.language === 'typescriptreact' ||
                activeTab.language === 'javascriptreact'
            )) {
                const resolver = getLazyTypeResolver(monaco, currentProject.rootPath);
                if (resolver) {
                    // Debounced call to avoid excessive processing
                    resolver.ensureTypesForFile(value).catch(() => {
                        // Ignore errors during lazy loading
                    });
                }
            }
        }
    }, [activeTab, updateContent, lspReady, currentProject, monaco]);

    // Handle editor mount (for future extensions)
    const handleEditorMount = useCallback((editor: Monaco.editor.IStandaloneCodeEditor) => {
        const span = startSpan('editor_mount', 'frontend_render');
        
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
                const navigationSpan = startSpan('go_to_definition', 'frontend_render');
                
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

                await navigationSpan.end({ 
                    targetFile: normalizedPath,
                    line: String(input.options?.selection?.startLineNumber ?? 1)
                });

                // Return the editor for that model (if it exists)
                return originalOpenCodeEditor(input, source, sideBySide);
            };
        }

        // Fix line number click offset issue by listening to mouse events on the gutter
        const mouseDownListener = editor.onMouseDown((e) => {
            // Only handle clicks on line numbers (gutter)
            if (e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS) {
                const lineNumber = e.target.position?.lineNumber;
                if (lineNumber) {
                    // Set selection to the clicked line
                    editor.setSelection(new monaco.Range(lineNumber, 1, lineNumber, 1));
                    editor.revealLineInCenter(lineNumber);
                }
            }
        });
        
        span.end();

        // Clean up listener when editor unmounts
        return () => {
            mouseDownListener.dispose();
        };
    }, [openFile, startSpan, monaco]);

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

    // Manual layout handling with requestAnimationFrame to avoid ResizeObserver loop
    useEffect(() => {
        if (!containerRef.current || !editorInstance) return;

        let animationFrameId: number;

        const observer = new ResizeObserver(() => {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(() => {
                editorInstance.layout();
            });
        });

        observer.observe(containerRef.current);

        return () => {
            observer.disconnect();
            cancelAnimationFrame(animationFrameId);
        };
    }, [editorInstance]);

    // Manual layout handling for DiffEditor with requestAnimationFrame
    useEffect(() => {
        if (!containerRef.current || !diffEditorInstance) return;

        let animationFrameId: number;

        const observer = new ResizeObserver(() => {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(() => {
                diffEditorInstance.layout();
            });
        });

        observer.observe(containerRef.current);

        return () => {
            observer.disconnect();
            cancelAnimationFrame(animationFrameId);
        };
    }, [diffEditorInstance]);


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
                trackInteraction('keyboard_save', { shortcut: 'Ctrl+S' });
                handleSave();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSave, trackInteraction]);

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
        <ProfilerWrapper>
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

            {/* Monaco Editor (Code or Diff) */}
            <div ref={containerRef} className="flex-1 overflow-hidden relative">
                {activeTab.type === 'diff' ? (
                    <>
                        <DiffEditor
                        key="diff-editor"
                        height="100%"
                        original={activeTab.diffBaseContent}
                        modified={activeTab.content}
                        language={activeTab.language}
                        theme={theme === "dark" ? "fluxel-dark" : "fluxel-light"}
                        onMount={(editor) => {
                            setDiffEditorInstance(editor);
                        }}
                        options={{
                            // Minimap
                            minimap: { enabled: showMinimap, side: minimapSide, scale: minimapScale, maxColumn: minimapMaxColumn, showSlider: minimapShowSlider },
                            // Font
                            fontSize: fontSize,
                            fontFamily: `'${fontFamily}', monospace`,
                            lineHeight: lineHeight,
                            fontLigatures: fontLigatures,
                            fontWeight: fontWeight,
                            letterSpacing: letterSpacing,
                            // Scrolling
                            smoothScrolling: smoothScrolling,
                            wordWrap: wordWrap,
                            wordWrapColumn: wordWrapColumn,
                            lineNumbers: showLineNumbers ? lineNumbers : 'off',
                            renderSideBySide: true,
                            readOnly: true, // Diff view is read-only for now
                        }}
                    />
                    </>
                ) : (
                    <>
                        <Editor
                        key={activeTab.id}
                        height="100%"
                        path={toFileUri(activeTab.path)}
                        language={activeTab.language}
                        value={activeTab.content}
                        onChange={handleEditorChange}
                        onMount={handleEditorMount}
                        theme={theme === "dark" ? "fluxel-dark" : "fluxel-light"}
                        options={{
                            // Minimap
                            minimap: { enabled: showMinimap, side: minimapSide, scale: minimapScale, maxColumn: minimapMaxColumn, showSlider: minimapShowSlider },
                            // Font
                            fontSize: fontSize,
                            fontFamily: `'${fontFamily}', monospace`,
                            lineHeight: lineHeight,
                            fontLigatures: fontLigatures,
                            fontWeight: fontWeight,
                            letterSpacing: letterSpacing,
                            // Cursor
                            cursorStyle: cursorStyle,
                            cursorBlinking: cursorBlinking,
                            cursorWidth: cursorWidth,
                            cursorSmoothCaretAnimation: cursorSmoothCaretAnimation,
                            // Layout
                            glyphMargin: glyphMargin,
                            // Line Numbers & Highlight
                            lineNumbers: showLineNumbers ? lineNumbers : 'off',
                            renderLineHighlight: renderLineHighlight,
                            // Whitespace & Indentation
                            tabSize: tabSize,
                            insertSpaces: insertSpaces,
                            renderWhitespace: renderWhitespace,
                            guides: {
                                bracketPairs: bracketPairGuides,
                                indentation: renderIndentGuides,
                                highlightActiveIndentation: highlightActiveIndentGuide,
                            },
                            // Brackets
                            bracketPairColorization: { enabled: bracketPairColorization },
                            // Folding
                            folding: folding,
                            foldingHighlight: foldingHighlight,
                            // Scrolling
                            smoothScrolling: smoothScrolling,
                            scrollBeyondLastLine: scrollBeyondLastLine,
                            stickyScroll: { enabled: stickyScroll },
                            // Word Wrap
                            wordWrap: wordWrap,
                            wordWrapColumn: wordWrapColumn,
                            // Auto Closing
                            autoClosingBrackets: autoClosingBrackets,
                            autoClosingQuotes: autoClosingQuotes,
                            // Formatting
                            formatOnPaste: formatOnPaste,
                            // Autocomplete
                            inlineSuggest: {
                                enabled: autocompleteEnabled,
                            },
                            suggest: {
                                showKeywords: true,
                                showSnippets: true,
                                showClasses: true,
                                showFunctions: true,
                                showVariables: true,
                                showFields: true,
                                showInterfaces: true,
                                showModules: true,
                                showProperties: true,
                                showEvents: true,
                                showOperators: true,
                                showUnits: true,
                                showValues: true,
                                showConstants: true,
                                showEnums: true,
                                showEnumMembers: true,
                                showStructs: true,
                                showTypeParameters: true,
                                showInlineDetails: true,
                            },
                            fixedOverflowWidgets: true,
                        }}
                    />
                    </>
                )}
            </div>
        </div>
        </ProfilerWrapper>
    );
}
