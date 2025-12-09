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
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useEditorStore, EditorTab } from "../../stores/useEditorStore";
import { useProjectStore } from "../../stores/useProjectStore";
import { loadProjectTypes, clearProjectTypes } from "../../lib/monacoTypeLoader";
import { registerInlineCompletionProvider } from "../../lib/ollama";
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
    const { updateContent, saveFile, isDirty, pendingReveal, clearPendingReveal, setCursorPosition } = useEditorStore();
    const { currentProject } = useProjectStore();
    const monaco = useMonaco() as unknown as typeof Monaco;
    const [isSaving, setIsSaving] = useState(false);
    const [editorInstance, setEditorInstance] = useState<Monaco.editor.IStandaloneCodeEditor | null>(null);
    const autocompleteDisposableRef = useRef<{ dispose: () => void } | null>(null);

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
            loadProjectTypes(currentProject.rootPath, monaco).catch((error) => {
                console.error("Failed to load project types:", error);
            });
        } else {
            // Clear types if no project is open
            clearProjectTypes(monaco);
        }

        // Cleanup on unmount or project change
        return () => {
            if (monaco && !currentProject?.rootPath) {
                clearProjectTypes(monaco);
            }
        };
    }, [monaco, currentProject?.rootPath]);

    // Define custom Fluxel themes
    useEffect(() => {
        if (!monaco) return;

        // Define custom themes and force apply whenever Monaco loads or theme changes.
        monaco.editor.defineTheme("fluxel-dark", {
            base: "vs-dark",
            inherit: true,
            rules: [],
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
            rules: [],
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
        console.log("[CodeEditor] Inline completion provider effect", {
            monacoAvailable: !!monaco,
            autocompleteEnabled,
            autocompleteEndpoint,
            autocompleteModel,
            autocompleteDebounceMs,
            hasExistingDisposable: !!autocompleteDisposableRef.current,
        });

        if (!monaco) {
            console.log("[CodeEditor] Monaco not available, skipping provider registration");
            return;
        }

        // Dispose previous provider if exists
        if (autocompleteDisposableRef.current) {
            console.log("[CodeEditor] Disposing previous inline completion provider");
            autocompleteDisposableRef.current.dispose();
            autocompleteDisposableRef.current = null;
        }

        // Only register if autocomplete is enabled
        if (!autocompleteEnabled) {
            console.log("[CodeEditor] Autocomplete disabled, not registering provider");
            return;
        }

        // Register the inline completion provider
        console.log("[CodeEditor] Registering inline completion provider", {
            endpoint: autocompleteEndpoint,
            model: autocompleteModel,
            debounceMs: autocompleteDebounceMs,
        });
        autocompleteDisposableRef.current = registerInlineCompletionProvider(monaco, {
            endpoint: autocompleteEndpoint,
            model: autocompleteModel,
            debounceMs: autocompleteDebounceMs,
        });
        console.log("[CodeEditor] Provider registered", {
            disposableAvailable: !!autocompleteDisposableRef.current,
        });

        return () => {
            console.log("[CodeEditor] Cleaning up inline completion provider");
            if (autocompleteDisposableRef.current) {
                autocompleteDisposableRef.current.dispose();
                autocompleteDisposableRef.current = null;
            }
        };
    }, [monaco, autocompleteEnabled, autocompleteEndpoint, autocompleteModel, autocompleteDebounceMs]);

    // Handle save keyboard shortcut
    const handleSave = useCallback(async () => {
        if (activeTab && !isSaving) {
            setIsSaving(true);
            try {
                await saveFile(activeTab.id);
            } finally {
                setIsSaving(false);
            }
        }
    }, [activeTab, saveFile, isSaving]);

    // Handle content changes
    const handleEditorChange = useCallback((value: string | undefined) => {
        if (activeTab && value !== undefined) {
            updateContent(activeTab.id, value);
        }
    }, [activeTab, updateContent]);

    // Handle editor mount (for future extensions)
    const handleEditorMount = useCallback((editor: Monaco.editor.IStandaloneCodeEditor) => {
        setEditorInstance(editor);
    }, []);

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
