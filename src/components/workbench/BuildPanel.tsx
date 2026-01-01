import { useEffect, useRef, useState, useMemo } from 'react';
import { X, Loader2, CheckCircle2, XCircle, Terminal, Copy, Check, Hammer, AlertCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { useBuildPanelStore, useTerminalStore, useDiagnosticsStore, useProjectStore } from '@/stores';
import TerminalTabs from './TerminalTabs';
import type { Diagnostic } from '@/stores/diagnostics/useDiagnosticsStore';
import ScrollableArea from '@/components/ui/scrollable-area';
import ProblemsView from './ProblemsView';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useProfiler } from '@/hooks/useProfiler';

type Tab = 'problems' | 'build' | 'terminal';

export default function BuildPanel() {
    const { isOpen, closePanel } = useBuildPanelStore();
    const { projectProfile } = useProjectStore();
    // Select underlying state to avoid infinite re-renders from getCounts() returning new objects
    const diagnosticsByFile = useDiagnosticsStore((state) => state.diagnosticsByFile);
    const buildDiagnostics = useDiagnosticsStore((state) => state.buildDiagnostics);
    
    // Compute counts with useMemo to prevent infinite loops
    const counts = useMemo(() => {
        // Combine all LSP diagnostics from all files
        const allLspDiagnostics: Diagnostic[] = [];
        diagnosticsByFile.forEach((diagnostics) => {
            allLspDiagnostics.push(...diagnostics);
        });

        // Combine with build diagnostics (avoiding duplicates by checking id)
        const lspIds = new Set(allLspDiagnostics.map((d) => d.id));
        const uniqueBuildDiagnostics = buildDiagnostics.filter((d) => !lspIds.has(d.id));
        const allDiagnostics = [...allLspDiagnostics, ...uniqueBuildDiagnostics];

        return allDiagnostics.reduce(
            (acc, diagnostic) => {
                if (diagnostic.severity === 'error') {
                    acc.errors++;
                } else if (diagnostic.severity === 'warning') {
                    acc.warnings++;
                } else if (diagnostic.severity === 'info') {
                    acc.info++;
                }
                return acc;
            },
            { errors: 0, warnings: 0, info: 0 }
        );
    }, [diagnosticsByFile, buildDiagnostics]);
    
    const [activeTab, setActiveTab] = useState<Tab>('problems');
    const { trackInteraction, ProfilerWrapper } = useProfiler('BuildPanel');

    if (!isOpen) return null;

    const handleTabChange = (tab: Tab) => {
        trackInteraction('tab_changed', { tab, previousTab: activeTab });
        setActiveTab(tab);
    };

    return (
        <ProfilerWrapper>
            <div className="flex flex-col h-full bg-card resize-none overflow-hidden">
                {/* Header */}
                <div
                    className="flex items-center justify-between border-b border-border bg-muted/30 shrink-0"
                    style={{
                        height: 'var(--build-panel-header-height, 2.25rem)',
                    }}
                >
                    <div className="flex items-center h-full">
                        <button
                            onClick={() => handleTabChange('problems')}
                            className={`px-3 h-full flex items-center gap-2 text-xs font-medium border-b-2 transition-colors ${activeTab === 'problems'
                                ? 'border-primary text-foreground bg-background/50'
                                : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                                }`}
                        >
                        <AlertCircle className="w-3.5 h-3.5" />
                        Problems
                        {counts.errors > 0 && (
                            <Badge variant="error" className="h-4 px-1.5 text-[10px] min-w-[1.25rem] justify-center">
                                {counts.errors}
                            </Badge>
                        )}
                        {counts.warnings > 0 && (
                            <Badge variant="warning" className="h-4 px-1.5 text-[10px] min-w-[1.25rem] justify-center">
                                {counts.warnings}
                            </Badge>
                        )}
                    </button>
                    <button
                        onClick={() => handleTabChange('build')}
                        className={`px-3 h-full flex items-center gap-2 text-xs font-medium border-b-2 transition-colors ${activeTab === 'build'
                            ? 'border-primary text-foreground bg-background/50'
                            : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                            }`}
                    >
                        <Hammer className="w-3.5 h-3.5" />
                        Build
                    </button>
                    <button
                        onClick={() => handleTabChange('terminal')}
                        className={`px-3 h-full flex items-center gap-2 text-xs font-medium border-b-2 transition-colors ${activeTab === 'terminal'
                            ? 'border-primary text-foreground bg-background/50'
                            : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                            }`}
                    >
                        <Terminal className="w-3.5 h-3.5" />
                        Terminal
                    </button>
                </div>

                <div
                    className="flex items-center px-3"
                    style={{ gap: 'var(--build-panel-header-gap, 0.5rem)' }}
                >
                    <button
                        onClick={() => {
                            trackInteraction('panel_closed');
                            closePanel();
                        }}
                        className="rounded hover:bg-muted transition-colors"
                        style={{ padding: 'var(--build-panel-button-padding, 0.25rem)' }}
                        aria-label="Close panel"
                    >
                        <X style={{
                            width: 'var(--build-panel-header-icon-size, 1rem)',
                            height: 'var(--build-panel-header-icon-size, 1rem)'
                        }} className="text-muted-foreground" />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                    <div className={`absolute inset-0 ${activeTab === 'problems' ? 'z-10' : 'z-0 invisible'}`}>
                        <ProblemsView />
                    </div>
                    <div className={`absolute inset-0 ${activeTab === 'build' ? 'z-10' : 'z-0 invisible'}`}>
                        <BuildView />
                    </div>
                    <div className={`absolute inset-0 ${activeTab === 'terminal' ? 'z-10' : 'z-0 invisible'}`}>
                        <TerminalView projectProfile={projectProfile} />
                    </div>
                </div>
            </div>
        </ProfilerWrapper>
    );
}

function BuildView() {
    const {
        isBuilding,
        buildStatus,
        buildOutput,
        buildStartTime,
        buildEndTime,
        buildDiagnostics,
        buildDurationMs,
    } = useBuildPanelStore();

    const { navigateToDiagnostic } = useDiagnosticsStore();
    const outputRef = useRef<HTMLDivElement>(null);
    const [isCopied, setIsCopied] = useState(false);
    const { trackInteraction, startSpan } = useProfiler('BuildView');

    // Auto-scroll to bottom when new output is added
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [buildOutput]);

    const getBuildDuration = () => {
        // Prefer duration from BuildResult if available
        if (buildDurationMs !== null) {
            return (buildDurationMs / 1000).toFixed(2);
        }
        if (!buildStartTime) return null;
        const endTime = buildEndTime || Date.now();
        const duration = (endTime - buildStartTime) / 1000;
        return duration.toFixed(2);
    };

    const getStatusIcon = () => {
        const iconSize = '1rem';
        switch (buildStatus) {
            case 'running':
                return <Loader2 style={{ width: iconSize, height: iconSize }} className="animate-spin text-primary" />;
            case 'success':
                return <CheckCircle2 style={{ width: iconSize, height: iconSize }} className="text-green-500" />;
            case 'error':
                return <XCircle style={{ width: iconSize, height: iconSize }} className="text-red-500" />;
            default:
                return null;
        }
    };

    const handleCopy = async () => {
        const span = startSpan('copy_build_output', 'frontend_interaction');
        try {
            await navigator.clipboard.writeText(buildOutput.join('\n'));
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
            await span.end({ 
                outputLines: buildOutput.length.toString(),
                success: 'true'
            });
            trackInteraction('build_output_copied', { 
                lineCount: buildOutput.length.toString() 
            });
        } catch (err) {
            console.error('Failed to copy text: ', err);
            await span.end({ 
                error: err instanceof Error ? err.message : 'Unknown error' 
            });
        }
    };

    // Calculate diagnostic counts from BuildResult
    const errorCount = buildDiagnostics.filter(d => d.severity === 'error').length;
    const warningCount = buildDiagnostics.filter(d => d.severity === 'warning').length;

    // Convert BuildDiagnostic to Diagnostic format for navigation
    const handleDiagnosticClick = async (diagnostic: typeof buildDiagnostics[0]) => {
        const span = startSpan('navigate_to_build_diagnostic', 'frontend_interaction');
        trackInteraction('build_diagnostic_clicked', {
            severity: diagnostic.severity,
            code: diagnostic.code,
            filePath: diagnostic.file_path
        });

        try {
            // Find the diagnostic in the store's format (it should already be there from BuildManager)
            // Both BuildDiagnostic and Diagnostic store use 1-based line/column
            const storeDiagnostics = useDiagnosticsStore.getState().getAllDiagnostics();
            const matchingDiagnostic = storeDiagnostics.find(d => 
                d.filePath === diagnostic.file_path &&
                d.range.startLine === diagnostic.line &&
                d.range.startColumn === diagnostic.column &&
                d.code === diagnostic.code &&
                d.source === 'build'
            );
            
            if (matchingDiagnostic) {
                await navigateToDiagnostic(matchingDiagnostic);
                await span.end({ matched: 'true', filePath: diagnostic.file_path });
            } else {
                // Fallback: create a temporary diagnostic for navigation
                // Both BuildDiagnostic and Diagnostic store use 1-based line/column
                const fileName = diagnostic.file_path.split(/[/\\]/).pop() || diagnostic.file_path;
                const tempDiagnostic = {
                    id: `build-${diagnostic.code}-${diagnostic.file_path}-${diagnostic.line}-${diagnostic.column}`,
                    uri: `file://${diagnostic.file_path}`,
                    filePath: diagnostic.file_path,
                    fileName,
                    severity: diagnostic.severity === 'error' ? 'error' as const : 'warning' as const,
                    message: diagnostic.message,
                    code: diagnostic.code,
                    source: 'build',
                    range: {
                        startLine: diagnostic.line, // Both use 1-based
                        startColumn: diagnostic.column,
                        endLine: diagnostic.line,
                        endColumn: diagnostic.column,
                    },
                };
                await navigateToDiagnostic(tempDiagnostic);
                await span.end({ matched: 'false', filePath: diagnostic.file_path });
            }
        } catch (error) {
            await span.end({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Status Bar */}
            <div className="flex items-center justify-between px-3 py-1 bg-muted/20 border-b border-border text-xs">
                <div className="flex items-center gap-2">
                    {getStatusIcon()}
                    <span className="text-muted-foreground">
                        {buildStatus === 'running' ? 'Building...' :
                            buildStatus === 'success' ? `Build succeeded (${getBuildDuration()}s)` :
                                buildStatus === 'error' ? `Build failed (${getBuildDuration()}s)` : 'Ready'}
                    </span>
                    {buildDiagnostics.length > 0 && (
                        <>
                            <span className="text-muted-foreground/50">•</span>
                            {errorCount > 0 && (
                                <Badge variant="error" className="h-4 px-1.5 text-[10px]">
                                    {errorCount} error{errorCount !== 1 ? 's' : ''}
                                </Badge>
                            )}
                            {warningCount > 0 && (
                                <Badge variant="warning" className="h-4 px-1.5 text-[10px]">
                                    {warningCount} warning{warningCount !== 1 ? 's' : ''}
                                </Badge>
                            )}
                        </>
                    )}
                </div>
                <button
                    onClick={handleCopy}
                    className="rounded hover:bg-muted transition-colors p-1"
                    title="Copy output"
                >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
            </div>

            {/* Diagnostics Summary (if available) */}
            {buildDiagnostics.length > 0 && buildStatus !== 'running' && (
                <div className="px-3 py-2 bg-muted/10 border-b border-border">
                    <div className="flex flex-col gap-1.5">
                        {buildDiagnostics.slice(0, 5).map((diagnostic, index) => {
                            const Icon = diagnostic.severity === 'error' ? AlertCircle : AlertTriangle;
                            const iconColor = diagnostic.severity === 'error' ? 'text-red-500' : 'text-yellow-500';
                            const fileName = diagnostic.file_path.split(/[/\\]/).pop() || diagnostic.file_path;
                            
                            return (
                                <button
                                    key={index}
                                    onClick={() => handleDiagnosticClick(diagnostic)}
                                    className="flex items-start gap-2 px-2 py-1 rounded hover:bg-muted/50 text-left group transition-colors"
                                >
                                    <Icon className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", iconColor)} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="text-foreground font-medium truncate">
                                                {diagnostic.message}
                                            </span>
                                            <span className="text-muted-foreground/60 shrink-0 text-[10px]">
                                                {diagnostic.code}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                            <span className="truncate" title={diagnostic.file_path}>
                                                {fileName}
                                            </span>
                                            <span className="opacity-50">•</span>
                                            <span className="font-mono opacity-70">
                                                Ln {diagnostic.line}, Col {diagnostic.column}
                                            </span>
                                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0 ml-auto" />
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                        {buildDiagnostics.length > 5 && (
                            <div className="text-xs text-muted-foreground px-2 py-1">
                                + {buildDiagnostics.length - 5} more diagnostic{buildDiagnostics.length - 5 !== 1 ? 's' : ''}. See Problems tab for full list.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Build Output */}
            <ScrollableArea
                ref={outputRef}
                className="flex-1 font-mono select-text"
                style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    padding: '0.75rem',
                    fontSize: '0.75rem',
                    lineHeight: '1.625',
                }}
            >
                {buildOutput.length === 0 ? (
                    <div className="text-muted-foreground italic">
                        {isBuilding ? 'Waiting for build output...' : 'No build output yet.'}
                    </div>
                ) : (
                    buildOutput.map((line, index) => (
                        <div
                            key={index}
                            className={cn(
                                "whitespace-pre-wrap",
                                line.toLowerCase().includes('error') || line.toLowerCase().includes('error cs')
                                    ? 'text-red-400'
                                    : line.toLowerCase().includes('warning') || line.toLowerCase().includes('warning cs')
                                        ? 'text-yellow-400'
                                        : 'text-foreground'
                            )}
                        >
                            {line}
                        </div>
                    ))
                )}
            </ScrollableArea>
        </div>
    );
}

function TerminalView({ projectProfile }: { projectProfile: any }) {
    // Multi-terminal support
    const terminals = useTerminalStore(state => state.terminals);
    const activeTerminalId = useTerminalStore(state => state.activeTerminalId);
    const layout = useTerminalStore(state => state.layout);
    const splitTerminalId = useTerminalStore(state => state.splitTerminalId);
    const createTerminal = useTerminalStore(state => state.createTerminal);
    const executeCommand = useTerminalStore(state => state.executeCommand);
    const setHistoryIndex = useTerminalStore(state => state.setHistoryIndex);
    const clearTerminal = useTerminalStore(state => state.clearTerminal);
    const killProcess = useTerminalStore(state => state.killProcess);
    const initListeners = useTerminalStore(state => state.initListeners);
    
    // Initialize listeners and create first terminal if needed
    useEffect(() => {
        initListeners();
        if (terminals.length === 0) {
            createTerminal();
        }
    }, [initListeners, terminals.length, createTerminal]);
    
    const activeTerminal = terminals.find(t => t.id === activeTerminalId);
    const splitTerminal = splitTerminalId ? terminals.find(t => t.id === splitTerminalId) : null;
    
    // Render single or split terminal view
    if (layout !== 'single' && splitTerminal) {
        const isHorizontal = layout === 'split-horizontal';
        return (
            <div className={cn(
                "flex h-full",
                isHorizontal ? "flex-row" : "flex-col"
            )}>
                <TerminalTabs />
                <div className="flex-1 flex" style={{ flexDirection: isHorizontal ? 'row' : 'column' }}>
                    <div className="flex-1 min-w-0 min-h-0">
                        {activeTerminal && (
                            <SingleTerminalView
                                terminal={activeTerminal}
                                projectProfile={projectProfile}
                                executeCommand={executeCommand}
                                setHistoryIndex={setHistoryIndex}
                                clearTerminal={clearTerminal}
                                killProcess={killProcess}
                            />
                        )}
                    </div>
                    <div className={cn(
                        "shrink-0",
                        isHorizontal ? "w-px bg-border" : "h-px bg-border"
                    )} />
                    <div className="flex-1 min-w-0 min-h-0">
                        <SingleTerminalView
                            terminal={splitTerminal}
                            projectProfile={projectProfile}
                            executeCommand={executeCommand}
                            setHistoryIndex={setHistoryIndex}
                            clearTerminal={clearTerminal}
                            killProcess={killProcess}
                        />
                    </div>
                </div>
            </div>
        );
    }
    
    return (
        <div className="flex flex-col h-full">
            <TerminalTabs />
            <div className="flex-1 min-h-0">
                {activeTerminal ? (
                    <SingleTerminalView
                        terminal={activeTerminal}
                        projectProfile={projectProfile}
                        executeCommand={executeCommand}
                        setHistoryIndex={setHistoryIndex}
                        clearTerminal={clearTerminal}
                        killProcess={killProcess}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        No terminal. Click + to create one.
                    </div>
                )}
            </div>
        </div>
    );
}

// Single terminal instance view
interface SingleTerminalViewProps {
    terminal: import('@/stores/terminal/useTerminalStore').TerminalInstance;
    projectProfile: any;
    executeCommand: (terminalId: string, command: string) => Promise<void>;
    setHistoryIndex: (terminalId: string, index: number) => void;
    clearTerminal: (terminalId?: string) => void;
    killProcess: (terminalId?: string) => Promise<void>;
}

function SingleTerminalView({ 
    terminal, 
    projectProfile, 
    executeCommand, 
    setHistoryIndex, 
    clearTerminal, 
    killProcess 
}: SingleTerminalViewProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState('');
    
    const { entries, history, historyIndex, isRunning, currentCommand } = terminal;

    // Auto-scroll logic
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [entries, inputValue]);

    // Focus input on click
    const handleContainerClick = () => {
        const selection = window.getSelection();
        if (selection && selection.toString().length === 0) {
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!inputValue.trim()) return;

            executeCommand(terminal.id, inputValue);
            setInputValue('');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (history.length > 0) {
                let idx = historyIndex;
                if (idx === -1) {
                    idx = history.length - 1;
                } else {
                    idx = Math.max(0, idx - 1);
                }
                setHistoryIndex(terminal.id, idx);
                setInputValue(history[idx] || '');
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex !== -1) {
                const idx = historyIndex + 1;
                if (idx >= history.length) {
                    setHistoryIndex(terminal.id, -1);
                    setInputValue('');
                } else {
                    setHistoryIndex(terminal.id, idx);
                    setInputValue(history[idx]);
                }
            }
        } else if (e.key === 'c' && e.ctrlKey) {
            if (isRunning) {
                e.preventDefault();
                killProcess(terminal.id);
            } else if (inputValue) {
                setInputValue('');
                setHistoryIndex(terminal.id, -1);
            }
        } else if (e.key === 'l' && e.ctrlKey) {
            e.preventDefault();
            clearTerminal(terminal.id);
        }
    };

    return (
        <div
            className="flex flex-col h-full font-mono text-xs bg-black/50 p-3 overflow-hidden select-text"
            onClick={handleContainerClick}
        >
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar"
            >
                {entries.map((entry) => (
                    <div key={entry.id} className="mb-1 break-words whitespace-pre-wrap">
                        {entry.type === 'command' && (
                            <div className="flex text-muted-foreground mt-2">
                                <span className="mr-2">$</span>
                                <span className="text-foreground font-bold">{entry.content}</span>
                            </div>
                        )}
                        {entry.type === 'output' && (
                            <div className="text-foreground/90 pl-4">{entry.content}</div>
                        )}
                        {entry.type === 'error' && (
                            <div className="text-red-400 pl-4">{entry.content}</div>
                        )}
                        {entry.type === 'info' && (
                            <div className="text-blue-400 pl-4 italic">{entry.content}</div>
                        )}
                    </div>
                ))}

                <div className="flex items-center mt-2 group">
                    <span className="text-muted-foreground mr-2 font-bold select-none">$</span>
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/30 h-6"
                        placeholder={entries.length === 0 ? getPlaceholderText(projectProfile?.kind) : ""}
                        disabled={isRunning && !activeCommandCanAcceptInput(currentCommand)}
                        autoFocus
                    />
                    {isRunning && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                </div>
            </div>
        </div>
    );
}

// Helper to get project-specific placeholder text
function getPlaceholderText(projectKind?: string): string {
    switch (projectKind) {
        case 'dotnet':
            return "Try 'dotnet build' or 'dotnet run'...";
        case 'javascript':
            return "Try 'npm run dev' or 'bun install'...";
        case 'mixed':
            return "Try 'dotnet build', 'npm run dev', or other commands...";
        default:
            return "Try build commands for your project type...";
    }
}

// Helper to decide if we should block input. 
// For now, blocking input while command runs is safer for one-off commands.
// But some commands interact. Since we use `Command` which isn't a PTY, we can't send input easily to stdin unless we implemented write support in store.
// My store `executeCommand` spawns and waits. So we should probably disable input or queue it. 
// Disabling is clearer UI for now.
function activeCommandCanAcceptInput(_cmd: string | null) {
    return false;
}
