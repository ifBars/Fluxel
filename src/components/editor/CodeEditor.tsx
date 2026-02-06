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
import { useEffect, useCallback, useState, useRef, memo } from "react";
import { useSettingsStore, useEditorStore, type EditorTab, useProjectStore } from "@/stores";
import { useProfiler } from "@/hooks/useProfiler";
import { usePluginLanguageActivation } from "@/hooks/usePlugins";
import { toFileUri } from "@/lib/languages/typescript";
import { registerInlineCompletionProvider } from "../../lib/ollama";
import { getCSharpLSPClient, registerCSharpColorThemes } from "@/lib/languages/csharp";
import { configureTypeScriptLanguage, hydrateTypeScriptWorkspace, resetTypeScriptWorkspace } from "@/lib/languages/typescript";
import { hasTypeScriptIndicators } from "@/lib/languages/typescript/TypeLoader";
import { getLazyTypeResolver } from "@/lib/languages/typescript/LazyTypeResolver";
import { shouldHydrateTypeScriptWorkspace } from "@/lib/services";
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

// Memoized editor component to prevent unnecessary re-renders
const CodeEditorComponent = memo(function CodeEditorComponent({ activeTab }: CodeEditorProps) {
    const { ProfilerWrapper, startSpan, trackInteraction } = useProfiler('CodeEditor');

    // Trigger plugin activation for the active file's language
    usePluginLanguageActivation(activeTab?.language ?? null);

    // Settings store - select only what we need to minimize re-renders
    const theme = useSettingsStore((state) => state.theme);
    const fontSize = useSettingsStore((state) => state.fontSize);
    const fontFamily = useSettingsStore((state) => state.fontFamily);
    const lineHeight = useSettingsStore((state) => state.lineHeight);
    const fontLigatures = useSettingsStore((state) => state.fontLigatures);
    const fontWeight = useSettingsStore((state) => state.fontWeight);
    const letterSpacing = useSettingsStore((state) => state.letterSpacing);
    const cursorStyle = useSettingsStore((state) => state.cursorStyle);
    const cursorBlinking = useSettingsStore((state) => state.cursorBlinking);
    const cursorWidth = useSettingsStore((state) => state.cursorWidth);
    const cursorSmoothCaretAnimation = useSettingsStore((state) => state.cursorSmoothCaretAnimation);
    const tabSize = useSettingsStore((state) => state.tabSize);
    const insertSpaces = useSettingsStore((state) => state.insertSpaces);
    const renderWhitespace = useSettingsStore((state) => state.renderWhitespace);
    const renderIndentGuides = useSettingsStore((state) => state.renderIndentGuides);
    const highlightActiveIndentGuide = useSettingsStore((state) => state.highlightActiveIndentGuide);
    const showLineNumbers = useSettingsStore((state) => state.showLineNumbers);
    const lineNumbers = useSettingsStore((state) => state.lineNumbers);
    const renderLineHighlight = useSettingsStore((state) => state.renderLineHighlight);
    const bracketPairColorization = useSettingsStore((state) => state.bracketPairColorization);
    const bracketPairGuides = useSettingsStore((state) => state.bracketPairGuides);
    const folding = useSettingsStore((state) => state.folding);
    const foldingHighlight = useSettingsStore((state) => state.foldingHighlight);
    const glyphMargin = useSettingsStore((state) => state.glyphMargin);
    const wordWrap = useSettingsStore((state) => state.wordWrap);
    const wordWrapColumn = useSettingsStore((state) => state.wordWrapColumn);
    const smoothScrolling = useSettingsStore((state) => state.smoothScrolling);
    const scrollBeyondLastLine = useSettingsStore((state) => state.scrollBeyondLastLine);
    const stickyScroll = useSettingsStore((state) => state.stickyScroll);
    const autoClosingBrackets = useSettingsStore((state) => state.autoClosingBrackets);
    const autoClosingQuotes = useSettingsStore((state) => state.autoClosingQuotes);
    const formatOnPaste = useSettingsStore((state) => state.formatOnPaste);
    const showMinimap = useSettingsStore((state) => state.showMinimap);
    const minimapSide = useSettingsStore((state) => state.minimapSide);
    const minimapScale = useSettingsStore((state) => state.minimapScale);
    const minimapMaxColumn = useSettingsStore((state) => state.minimapMaxColumn);
    const minimapShowSlider = useSettingsStore((state) => state.minimapShowSlider);
    const autocompleteEnabled = useSettingsStore((state) => state.autocompleteEnabled);
    const autocompleteModel = useSettingsStore((state) => state.autocompleteModel);
    const autocompleteEndpoint = useSettingsStore((state) => state.autocompleteEndpoint);
    const autocompleteDebounceMs = useSettingsStore((state) => state.autocompleteDebounceMs);
    
    // Editor store
    const updateContent = useEditorStore((state) => state.updateContent);
    const saveFile = useEditorStore((state) => state.saveFile);
    const isDirty = useEditorStore((state) => state.isDirty);
    const pendingReveal = useEditorStore((state) => state.pendingReveal);
    const clearPendingReveal = useEditorStore((state) => state.clearPendingReveal);
    const setCursorPosition = useEditorStore((state) => state.setCursorPosition);
    const openFile = useEditorStore((state) => state.openFile);
    
    // Project store
    const currentProject = useProjectStore((state) => state.currentProject);
    const projectProfile = useProjectStore((state) => state.projectProfile);
    const projectInitStatus = useProjectStore((state) => state.projectInitStatus);
    const csharpLspStatus = useProjectStore((state) => state.csharpLspStatus);
    const ensureCSharpLspReady = useProjectStore((state) => state.ensureCSharpLspReady);
    
    const monaco = useMonaco() as unknown as typeof Monaco;
    const [isSaving, setIsSaving] = useState(false);
    const [editorInstance, setEditorInstance] = useState<Monaco.editor.IStandaloneCodeEditor | null>(null);
    const diffEditorRef = useRef<Monaco.editor.IStandaloneDiffEditor | null>(null);
    const autocompleteDisposableRef = useRef<{ dispose: () => void } | null>(null);
    const lspClientRef = useRef(getCSharpLSPClient());
    const docVersionsRef = useRef<Record<string, number>>({});
    const hydratedProjectRootRef = useRef<string | null>(null);
    const openedDocsRef = useRef<Set<string>>(new Set());
    const currentOpenUriRef = useRef<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Clear stale diff editor references when leaving diff mode.
    useEffect(() => {
        if (activeTab?.type !== 'diff') {
            diffEditorRef.current = null;
        }
    }, [activeTab?.id, activeTab?.type]);

    // Configure Monaco TypeScript to behave like VSCode (full IntelliSense)
    useEffect(() => {
        if (!monaco) return;

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

        if (!projectRoot) {
            resetTypeScriptWorkspace(monaco);
            hydratedProjectRootRef.current = null;
            return;
        }

        if (hydratedProjectRootRef.current && hydratedProjectRootRef.current !== projectRoot) {
            resetTypeScriptWorkspace(monaco);
            hydratedProjectRootRef.current = null;
        }

        if (projectInitStatus === 'error') {
            hydratedProjectRootRef.current = null;
            resetTypeScriptWorkspace(monaco);
            return;
        }

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
    useEffect(() => {
        if (!monaco || !activeTab) return;
        const projectRoot = currentProject?.rootPath ?? null;
        if (!projectRoot) return;

        const isTypeScriptFile = activeTab.language === 'typescript' || activeTab.language === 'javascript';
        if (!isTypeScriptFile) return;

        if (hydratedProjectRootRef.current === projectRoot) return;

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

        if (projectInitStatus === 'ready') {
            if (shouldHydrateTypeScriptWorkspace(projectProfile)) {
                return;
            }

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

    // Initialize language registry
    useEffect(() => {
        if (!monaco) return;
        const registry = getLanguageRegistry();
        registry.initialize(monaco);
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

        if (autocompleteDisposableRef.current) {
            autocompleteDisposableRef.current.dispose();
            autocompleteDisposableRef.current = null;
        }

        if (!autocompleteEnabled) {
            return;
        }

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

    // Ensure C# LSP is ready when editing C# files
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

    // If the server stops/restarts, forget locally-opened documents
    useEffect(() => {
        if (!lspReady) {
            openedDocsRef.current.clear();
            currentOpenUriRef.current = null;
        }
    }, [lspReady]);

    // Send textDocument/didOpen when C# file is opened and LSP is ready
    useEffect(() => {
        const lspClient = lspClientRef.current;

        if (activeTab?.language === 'csharp' && lspReady && activeTab && lspClient.getIsStarted()) {
            const uri = fsPathToLspUri(activeTab.path);

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

            if (!openedDocsRef.current.has(uri)) {
                const currentVersion = docVersionsRef.current[uri] || 1;
                docVersionsRef.current[uri] = currentVersion;

                lspClient.sendNotification('textDocument/didOpen', {
                    textDocument: {
                        uri,
                        languageId: 'csharp',
                        version: currentVersion,
                        text: activeTab.content,
                    },
                }).then(() => {
                    openedDocsRef.current.add(uri);
                    currentOpenUriRef.current = uri;
                }).catch((error) => {
                    console.error('[CodeEditor] Failed to send didOpen:', error);
                });
            } else {
                currentOpenUriRef.current = uri;
            }

            return () => {
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

            if (activeTab.language === 'csharp' && lspReady && lspClientRef.current.getIsStarted()) {
                const lspClient = lspClientRef.current;
                const uri = fsPathToLspUri(activeTab.path);

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
                }
            }

            if (currentProject && (
                activeTab.language === 'typescript' ||
                activeTab.language === 'javascript' ||
                activeTab.language === 'typescriptreact' ||
                activeTab.language === 'javascriptreact'
            )) {
                const resolver = getLazyTypeResolver(monaco, currentProject.rootPath);
                if (resolver) {
                    resolver.ensureTypesForFile(value).catch(() => {
                        // Ignore errors during lazy loading
                    });
                }
            }
        }
    }, [activeTab, updateContent, lspReady, currentProject, monaco]);

    // Handle editor mount
    const handleEditorMount = useCallback((editor: Monaco.editor.IStandaloneCodeEditor) => {
        const span = startSpan('editor_mount', 'frontend_render');

        setEditorInstance(editor);

        const editorService = (editor as any)._codeEditorService;
        if (editorService) {
            const originalOpenCodeEditor = editorService.openCodeEditor.bind(editorService);
            editorService.openCodeEditor = async (
                input: { resource: Monaco.Uri; options?: { selection?: Monaco.IRange } },
                source: any,
                sideBySide?: boolean
            ) => {
                const navigationSpan = startSpan('go_to_definition', 'frontend_render');

                const targetPath = input.resource.path.startsWith('/')
                    ? input.resource.path.substring(1)
                    : input.resource.path;
                const normalizedPath = targetPath.replace(/\//g, '/');

                await openFile(normalizedPath, {
                    line: input.options?.selection?.startLineNumber ?? 1,
                    column: input.options?.selection?.startColumn ?? 1,
                });

                await navigationSpan.end({
                    targetFile: normalizedPath,
                    line: String(input.options?.selection?.startLineNumber ?? 1)
                });

                return originalOpenCodeEditor(input, source, sideBySide);
            };
        }

        const mouseDownListener = editor.onMouseDown((e) => {
            if (e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS) {
                const lineNumber = e.target.position?.lineNumber;
                if (lineNumber) {
                    editor.setSelection(new monaco.Range(lineNumber, 1, lineNumber, 1));
                    editor.revealLineInCenter(lineNumber);
                }
            }
        });

        span.end();

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

        updateCursorInfo();

        const cursorDisposable = editorInstance.onDidChangeCursorPosition(() => {
            updateCursorInfo();
        });

        const selectionDisposable = editorInstance.onDidChangeCursorSelection(() => {
            updateCursorInfo();
        });

        return () => {
            cursorDisposable.dispose();
            selectionDisposable.dispose();
        };
    }, [editorInstance, activeTab, setCursorPosition]);

    // IMPORTANT: Layout Monaco ONLY when necessary
    // We use a ResizeObserver but with strict throttling and dimension checking
    // to prevent layout fighting with react-resizable-panels
    useEffect(() => {
        if (!containerRef.current) return;

        let frameId = 0;
        let lastWidth = -1;
        let lastHeight = -1;
        let layoutAttempts = 0;
        const MAX_LAYOUT_ATTEMPTS = 3;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;

            const width = Math.floor(entry.contentRect.width);
            const height = Math.floor(entry.contentRect.height);

            if (width <= 0 || height <= 0) return;
            
            // Only layout if dimensions changed significantly (at least 2px)
            // This prevents micro-layouts that cause jitter
            if (Math.abs(width - lastWidth) < 2 && Math.abs(height - lastHeight) < 2) {
                return;
            }

            lastWidth = width;
            lastHeight = height;
            layoutAttempts = 0;

            cancelAnimationFrame(frameId);
            frameId = requestAnimationFrame(() => {
                const targetEditor = activeTab?.type === 'diff' ? diffEditorRef.current : editorInstance;
                if (!targetEditor) return;

                // Prevent layout loops by limiting attempts
                if (layoutAttempts >= MAX_LAYOUT_ATTEMPTS) {
                    return;
                }
                layoutAttempts++;

                try {
                    targetEditor.layout({ width, height });
                } catch {
                    // Ignore layout after unmount/dispose.
                }
            });
        });

        observer.observe(containerRef.current);

        return () => {
            observer.disconnect();
            cancelAnimationFrame(frameId);
        };
    }, [activeTab?.type, editorInstance]);

    // Reveal pending selection/line when requested
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
    const formatPath = useCallback((path: string): string[] => {
        const parts = path.split('/').filter(Boolean);
        return parts.length > 3
            ? ['...', ...parts.slice(-2)]
            : parts;
    }, []);

    // Empty state
    if (!activeTab) {
        return (
            <div className="h-full w-full min-w-0 min-h-0 flex flex-col overflow-hidden bg-background">
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
            <div className="h-full w-full min-w-0 min-h-0 flex flex-col overflow-hidden bg-background" style={{ minHeight: 0 }}>
                {/* VSCode-style Breadcrumb Header */}
                <div className="h-9 border-b border-border bg-muted/30 flex items-center justify-between px-3 shrink-0 select-none">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
                        <File className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0 overflow-hidden">
                            {pathParts.map((part, index) => (
                                <div key={index} className="flex items-center gap-1.5 min-w-0">
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

                    <button
                        onClick={handleSave}
                        disabled={!dirty || isSaving}
                        className={`
                        flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium
                        transition-colors shrink-0
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

                {/* VSCode-style Editor Container */}
                <div ref={containerRef} className="flex-1 relative min-h-0 min-w-0 overflow-hidden">
                    {activeTab.type === 'diff' ? (
                        <DiffEditor
                            key="diff-editor"
                            height="100%"
                            original={activeTab.diffBaseContent}
                            modified={activeTab.content}
                            language={activeTab.language}
                            theme={theme === "dark" ? "fluxel-dark" : "fluxel-light"}
                            onMount={(editor) => {
                                diffEditorRef.current = editor;
                            }}
                            options={{
                                automaticLayout: false,
                                minimap: { enabled: showMinimap, side: minimapSide, scale: minimapScale, maxColumn: minimapMaxColumn, showSlider: minimapShowSlider },
                                fontSize: fontSize,
                                fontFamily: `'${fontFamily}', monospace`,
                                lineHeight: lineHeight,
                                fontLigatures: fontLigatures,
                                fontWeight: fontWeight,
                                letterSpacing: letterSpacing,
                                smoothScrolling: smoothScrolling,
                                wordWrap: wordWrap,
                                wordWrapColumn: wordWrapColumn,
                                lineNumbers: showLineNumbers ? lineNumbers : 'off',
                                renderSideBySide: true,
                                readOnly: true,
                            }}
                        />
                    ) : (
                        <Editor
                            key="code-editor"
                            height="100%"
                            path={toFileUri(activeTab.path)}
                            language={activeTab.language}
                            value={activeTab.content}
                            onChange={handleEditorChange}
                            onMount={handleEditorMount}
                            theme={theme === "dark" ? "fluxel-dark" : "fluxel-light"}
                            options={{
                                automaticLayout: false,
                                minimap: { enabled: showMinimap, side: minimapSide, scale: minimapScale, maxColumn: minimapMaxColumn, showSlider: minimapShowSlider },
                                fontSize: fontSize,
                                fontFamily: `'${fontFamily}', monospace`,
                                lineHeight: lineHeight,
                                fontLigatures: fontLigatures,
                                fontWeight: fontWeight,
                                letterSpacing: letterSpacing,
                                cursorStyle: cursorStyle,
                                cursorBlinking: cursorBlinking,
                                cursorWidth: cursorWidth,
                                cursorSmoothCaretAnimation: cursorSmoothCaretAnimation,
                                glyphMargin: glyphMargin,
                                lineNumbers: showLineNumbers ? lineNumbers : 'off',
                                renderLineHighlight: renderLineHighlight,
                                tabSize: tabSize,
                                insertSpaces: insertSpaces,
                                renderWhitespace: renderWhitespace,
                                guides: {
                                    bracketPairs: bracketPairGuides,
                                    indentation: renderIndentGuides,
                                    highlightActiveIndentation: highlightActiveIndentGuide,
                                },
                                bracketPairColorization: { enabled: bracketPairColorization },
                                folding: folding,
                                foldingHighlight: foldingHighlight,
                                smoothScrolling: smoothScrolling,
                                scrollBeyondLastLine: scrollBeyondLastLine,
                                stickyScroll: { enabled: stickyScroll },
                                wordWrap: wordWrap,
                                wordWrapColumn: wordWrapColumn,
                                autoClosingBrackets: autoClosingBrackets,
                                autoClosingQuotes: autoClosingQuotes,
                                formatOnPaste: formatOnPaste,
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
                    )}
                </div>
            </div>
        </ProfilerWrapper>
    );
});

export default CodeEditorComponent;
