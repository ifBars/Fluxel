import { useEffect, useRef, useState } from 'react';
import { X, Loader2, CheckCircle2, XCircle, Terminal, Copy, Check, Hammer } from 'lucide-react';
import { useBuildPanelStore, useTerminalStore } from '@/stores';
import ScrollableArea from '@/components/ui/scrollable-area';

type Tab = 'build' | 'terminal';

export default function BuildPanel() {
    const { isOpen, closePanel } = useBuildPanelStore();
    const [activeTab, setActiveTab] = useState<Tab>('build');

    if (!isOpen) return null;

    return (
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
                        onClick={() => setActiveTab('build')}
                        className={`px-3 h-full flex items-center gap-2 text-xs font-medium border-b-2 transition-colors ${activeTab === 'build'
                            ? 'border-primary text-foreground bg-background/50'
                            : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                            }`}
                    >
                        <Hammer className="w-3.5 h-3.5" />
                        Build
                    </button>
                    <button
                        onClick={() => setActiveTab('terminal')}
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
                        onClick={closePanel}
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
                <div className={`absolute inset-0 ${activeTab === 'build' ? 'z-10' : 'z-0 invisible'}`}>
                    <BuildView />
                </div>
                <div className={`absolute inset-0 ${activeTab === 'terminal' ? 'z-10' : 'z-0 invisible'}`}>
                    <TerminalView />
                </div>
            </div>
        </div>
    );
}

function BuildView() {
    const {
        isBuilding,
        buildStatus,
        buildOutput,
        buildStartTime,
        buildEndTime,
    } = useBuildPanelStore();

    const outputRef = useRef<HTMLDivElement>(null);
    const [isCopied, setIsCopied] = useState(false);

    // Auto-scroll to bottom when new output is added
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [buildOutput]);

    const getBuildDuration = () => {
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
        try {
            await navigator.clipboard.writeText(buildOutput.join('\n'));
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar for Build specific actions (optional, can be integrated in tab bar, but keeping separate for now if needed) 
                Currently reused logic from old header into this view or just overlay? 
                The old header had status text and copy button. I'll put them in a sub-bar or float them.
                Actually, simpler to have a small status bar inside.
            */}
            <div className="flex items-center justify-between px-3 py-1 bg-muted/20 border-b border-border text-xs">
                <div className="flex items-center gap-2">
                    {getStatusIcon()}
                    <span className="text-muted-foreground">
                        {buildStatus === 'running' ? 'Building...' :
                            buildStatus === 'success' ? `Build succeeded (${getBuildDuration()}s)` :
                                buildStatus === 'error' ? `Build failed (${getBuildDuration()}s)` : 'Ready'}
                    </span>
                </div>
                <button
                    onClick={handleCopy}
                    className="rounded hover:bg-muted transition-colors p-1"
                    title="Copy output"
                >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
            </div>

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
                            className={`whitespace-pre-wrap ${line.toLowerCase().includes('error')
                                ? 'text-red-400'
                                : line.toLowerCase().includes('warning')
                                    ? 'text-yellow-400'
                                    : 'text-foreground'
                                }`}
                        >
                            {line}
                        </div>
                    ))
                )}
            </ScrollableArea>
        </div>
    );
}

function TerminalView() {
    const {
        entries,
        history,
        historyIndex,
        currentCommand,
        isRunning,
        executeCommand,
        setHistoryIndex,
        clearTerminal,
        killProcess
    } = useTerminalStore();

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState('');

    // Auto-scroll logic
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [entries, inputValue]);

    // Focus input on click
    const handleContainerClick = () => {
        // Only focus if user isn't selecting text
        const selection = window.getSelection();
        if (selection && selection.toString().length === 0) {
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!inputValue.trim()) return;

            executeCommand(inputValue);
            setInputValue('');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (history.length > 0) {
                const newIndex = Math.min(historyIndex + 1, history.length - 1);
                setHistoryIndex(newIndex);
                // history is stored chronological, but usually ArrowUp goes to previous command (last item)
                // Let's assume history[history.length - 1] is the most recent.
                // So index 0 is most recent? or index 0 is oldest?
                // Standard: history stores [cmd1, cmd2, cmd3].
                // ArrowUp 1st time -> cmd3. Index = 0 (offset from end?) or Index = 2?
                // Let's implement simpler: historyIndex points to the index in the array.
                // Initial historyIndex = -1.
                // ArrowUp:
                // if -1, set to length - 1.
                // else set to index - 1.

                // Let's re-logic history navigation
                // We need to track the current visual index.
                // Since I used useTerminalStore state for historyIndex, I should use that or local state if I didn't want it persisted.
                // But store has `historyIndex`. Let's assume it works like this:
                // -1: New command line.
                // 0..N: Index in history array.

                // My logic in store was: setHistoryIndex(index).
                // Let's adjust slightly:
                // Up Arrow: move valid index towards 0?
                // Let's use local logic for now as it's UI state mostly.
                // Actually, store state `historyIndex` is fine if we want persistence across toggles.

                // Standard terminal:
                // History: [a, b, c]
                // Input: "" (Index -1)
                // Up -> "c" (Index 2)
                // Up -> "b" (Index 1)
                // Down -> "c" (Index 2)
                // Down -> "" (Index -1)

                let idx = historyIndex;
                if (idx === -1) {
                    idx = history.length - 1;
                } else {
                    idx = Math.max(0, idx - 1);
                }
                setHistoryIndex(idx);
                setInputValue(history[idx] || '');
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex !== -1) {
                const idx = historyIndex + 1;
                if (idx >= history.length) {
                    setHistoryIndex(-1);
                    setInputValue('');
                } else {
                    setHistoryIndex(idx);
                    setInputValue(history[idx]);
                }
            }
        } else if (e.key === 'c' && e.ctrlKey) {
            // Handle Ctrl+C to cancel? Command is native, we can't easily kill it unless we have the handle.
            // But we can clear the input.
            if (isRunning) {
                e.preventDefault();
                killProcess();
            } else if (inputValue) {
                setInputValue('');
                setHistoryIndex(-1);
            }
        } else if (e.key === 'l' && e.ctrlKey) {
            e.preventDefault();
            clearTerminal();
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
                        placeholder={entries.length === 0 ? "Try 'npm run dev' or 'bun install'..." : ""}
                        disabled={isRunning && !activeCommandCanAcceptInput(currentCommand)}
                        autoFocus
                    />
                    {isRunning && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                </div>
            </div>
        </div>
    );
}

// Helper to decide if we should block input. 
// For now, blocking input while command runs is safer for one-off commands.
// But some commands interact. Since we use `Command` which isn't a PTY, we can't send input easily to stdin unless we implemented write support in store.
// My store `executeCommand` spawns and waits. So we should probably disable input or queue it. 
// Disabling is clearer UI for now.
function activeCommandCanAcceptInput(_cmd: string | null) {
    return false;
}
