import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// ============================================================================
// Types
// ============================================================================

export type TerminalEntryType = 'command' | 'output' | 'error' | 'info';

export interface TerminalEntry {
    id: string;
    type: TerminalEntryType;
    content: string;
    timestamp: number;
}

interface TerminalOutput {
    pid: number;
    data: string;
}

interface TerminalExit {
    pid: number;
    code: number | null;
}

export type TerminalColor = 'default' | 'red' | 'green' | 'blue' | 'yellow' | 'purple' | 'cyan';

export interface TerminalInstance {
    id: string;
    name: string;
    color: TerminalColor;
    entries: TerminalEntry[];
    history: string[];
    historyIndex: number;
    isRunning: boolean;
    currentCommand: string | null;
    activePid: number | null;
    createdAt: number;
}

export type TerminalLayout = 'single' | 'split-horizontal' | 'split-vertical';

export interface TerminalState {
    // Multiple terminal instances
    terminals: TerminalInstance[];
    activeTerminalId: string | null;
    layout: TerminalLayout;
    splitTerminalId: string | null; // Second terminal in split view
    
    // Global state
    listenersInitialized: boolean;
    
    // Terminal management
    createTerminal: (name?: string) => string;
    closeTerminal: (id: string) => void;
    setActiveTerminal: (id: string) => void;
    renameTerminal: (id: string, name: string) => void;
    setTerminalColor: (id: string, color: TerminalColor) => void;
    
    // Layout management
    setLayout: (layout: TerminalLayout) => void;
    setSplitTerminal: (id: string | null) => void;
    
    // Terminal operations (operate on active terminal)
    addEntry: (terminalId: string, type: TerminalEntryType, content: string) => void;
    clearTerminal: (terminalId?: string) => void;
    executeCommand: (terminalId: string, commandString: string) => Promise<void>;
    killProcess: (terminalId?: string) => Promise<void>;
    setHistoryIndex: (terminalId: string, index: number) => void;
    
    // Legacy compatibility
    initListeners: () => Promise<void>;
    
    // Helpers
    getActiveTerminal: () => TerminalInstance | null;
    getTerminal: (id: string) => TerminalInstance | null;
}

// ============================================================================
// Helpers
// ============================================================================

function parseCommand(input: string): string[] {
    const args: string[] = [];
    let current = '';
    let inQuote = false;

    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        if (char === '"' || char === "'") {
            inQuote = !inQuote;
        } else if (char === ' ' && !inQuote) {
            if (current.length > 0) {
                args.push(current);
                current = '';
            }
        } else {
            current += char;
        }
    }
    if (current.length > 0) {
        args.push(current);
    }
    return args;
}

function createTerminalInstance(name?: string): TerminalInstance {
    return {
        id: crypto.randomUUID(),
        name: name || 'Terminal',
        color: 'default',
        entries: [],
        history: [],
        historyIndex: -1,
        isRunning: false,
        currentCommand: null,
        activePid: null,
        createdAt: Date.now(),
    };
}

// ============================================================================
// Store
// ============================================================================

export const useTerminalStore = create<TerminalState>((set, get) => ({
    terminals: [],
    activeTerminalId: null,
    layout: 'single',
    splitTerminalId: null,
    listenersInitialized: false,

    // ========================================================================
    // Terminal Management
    // ========================================================================
    
    createTerminal: (name?: string) => {
        const terminal = createTerminalInstance(name);
        const { terminals } = get();
        
        // Auto-name with number if not provided
        if (!name) {
            const count = terminals.length + 1;
            terminal.name = `Terminal ${count}`;
        }
        
        set((state) => ({
            terminals: [...state.terminals, terminal],
            activeTerminalId: terminal.id,
        }));
        
        return terminal.id;
    },

    closeTerminal: (id: string) => {
        const { terminals, activeTerminalId, splitTerminalId, killProcess } = get();
        
        // Kill any running process first
        const terminal = terminals.find(t => t.id === id);
        if (terminal?.activePid) {
            killProcess(id);
        }
        
        const newTerminals = terminals.filter(t => t.id !== id);
        
        // Handle active terminal change
        let newActiveId = activeTerminalId;
        let newSplitId = splitTerminalId;
        
        if (activeTerminalId === id) {
            newActiveId = newTerminals.length > 0 ? newTerminals[0].id : null;
        }
        
        if (splitTerminalId === id) {
            newSplitId = null;
        }
        
        set({
            terminals: newTerminals,
            activeTerminalId: newActiveId,
            splitTerminalId: newSplitId,
            layout: newSplitId ? get().layout : 'single',
        });
    },

    setActiveTerminal: (id: string) => {
        set({ activeTerminalId: id });
    },

    renameTerminal: (id: string, name: string) => {
        set((state) => ({
            terminals: state.terminals.map(t =>
                t.id === id ? { ...t, name } : t
            ),
        }));
    },

    setTerminalColor: (id: string, color: TerminalColor) => {
        set((state) => ({
            terminals: state.terminals.map(t =>
                t.id === id ? { ...t, color } : t
            ),
        }));
    },

    // ========================================================================
    // Layout Management
    // ========================================================================

    setLayout: (layout: TerminalLayout) => {
        const { terminals, activeTerminalId, splitTerminalId } = get();
        
        if (layout === 'single') {
            set({ layout, splitTerminalId: null });
        } else {
            // Find a second terminal for split view
            let secondId = splitTerminalId;
            if (!secondId || secondId === activeTerminalId) {
                const otherTerminal = terminals.find(t => t.id !== activeTerminalId);
                if (otherTerminal) {
                    secondId = otherTerminal.id;
                } else {
                    // Create a new terminal for split
                    const newId = get().createTerminal();
                    secondId = newId;
                }
            }
            set({ layout, splitTerminalId: secondId });
        }
    },

    setSplitTerminal: (id: string | null) => {
        set({ splitTerminalId: id });
    },

    // ========================================================================
    // Terminal Operations
    // ========================================================================

    addEntry: (terminalId: string, type: TerminalEntryType, content: string) => {
        set((state) => ({
            terminals: state.terminals.map(t =>
                t.id === terminalId
                    ? {
                        ...t,
                        entries: [
                            ...t.entries,
                            {
                                id: crypto.randomUUID(),
                                type,
                                content,
                                timestamp: Date.now(),
                            },
                        ],
                    }
                    : t
            ),
        }));
    },

    clearTerminal: (terminalId?: string) => {
        const id = terminalId || get().activeTerminalId;
        if (!id) return;
        
        set((state) => ({
            terminals: state.terminals.map(t =>
                t.id === id ? { ...t, entries: [] } : t
            ),
        }));
    },

    setHistoryIndex: (terminalId: string, index: number) => {
        set((state) => ({
            terminals: state.terminals.map(t =>
                t.id === terminalId ? { ...t, historyIndex: index } : t
            ),
        }));
    },

    killProcess: async (terminalId?: string) => {
        const id = terminalId || get().activeTerminalId;
        if (!id) return;
        
        const terminal = get().terminals.find(t => t.id === id);
        if (!terminal?.activePid) return;
        
        try {
            await invoke('kill_shell_process', { pid: terminal.activePid });
            get().addEntry(id, 'info', '^C');
        } catch (err) {
            get().addEntry(id, 'error', `Failed to kill process: ${err}`);
        }
    },

    executeCommand: async (terminalId: string, commandString: string) => {
        const trimmed = commandString.trim();
        if (!trimmed) return;

        const { addEntry, initListeners, terminals } = get();
        const terminal = terminals.find(t => t.id === terminalId);
        if (!terminal) return;

        // Ensure listeners are active
        await initListeners();

        // Add command to history and entries
        set((state) => ({
            terminals: state.terminals.map(t =>
                t.id === terminalId
                    ? {
                        ...t,
                        history: [...t.history, trimmed],
                        historyIndex: -1,
                        entries: [
                            ...t.entries,
                            {
                                id: crypto.randomUUID(),
                                type: 'command' as const,
                                content: trimmed,
                                timestamp: Date.now(),
                            },
                        ],
                        isRunning: true,
                        currentCommand: trimmed,
                    }
                    : t
            ),
        }));

        const args = parseCommand(trimmed);
        const commandName = args[0];
        const commandArgs = args.slice(1);

        try {
            // Check for specific internal commands
            if (commandName === 'clear' || commandName === 'cls') {
                set((state) => ({
                    terminals: state.terminals.map(t =>
                        t.id === terminalId
                            ? { ...t, entries: [], isRunning: false, currentCommand: null, activePid: null }
                            : t
                    ),
                }));
                return;
            }

            // Get CWD from file system store (the opened project's root path)
            const { useFileSystemStore } = await import('../editor/useFileSystemStore');
            const projectRoot = useFileSystemStore.getState().rootPath;

            const pid = await invoke<number>('execute_shell_command', {
                command: commandName,
                args: commandArgs,
                cwd: projectRoot,
            });

            set((state) => ({
                terminals: state.terminals.map(t =>
                    t.id === terminalId ? { ...t, activePid: pid } : t
                ),
            }));
        } catch (error) {
            set((state) => ({
                terminals: state.terminals.map(t =>
                    t.id === terminalId
                        ? { ...t, isRunning: false, currentCommand: null, activePid: null }
                        : t
                ),
            }));
            addEntry(terminalId, 'error', `Failed to execute: ${error instanceof Error ? error.message : String(error)}`);
        }
    },

    // ========================================================================
    // Listeners
    // ========================================================================

    initListeners: async () => {
        if (get().listenersInitialized) return;

        await listen<TerminalOutput>('terminal://output', (event) => {
            const { pid, data } = event.payload;
            const { terminals, addEntry } = get();
            const terminal = terminals.find(t => t.activePid === pid);
            if (terminal) {
                addEntry(terminal.id, 'output', data);
            }
        });

        await listen<TerminalOutput>('terminal://stderr', (event) => {
            const { pid, data } = event.payload;
            const { terminals, addEntry } = get();
            const terminal = terminals.find(t => t.activePid === pid);
            if (terminal) {
                addEntry(terminal.id, 'error', data);
            }
        });

        await listen<TerminalExit>('terminal://exit', (event) => {
            const { pid, code } = event.payload;
            const { terminals, addEntry } = get();
            const terminal = terminals.find(t => t.activePid === pid);
            if (terminal) {
                set((state) => ({
                    terminals: state.terminals.map(t =>
                        t.id === terminal.id
                            ? { ...t, isRunning: false, currentCommand: null, activePid: null }
                            : t
                    ),
                }));
                if (code !== 0 && code !== null) {
                    addEntry(terminal.id, 'error', `Process exited with code ${code}`);
                }
            }
        });

        set({ listenersInitialized: true });
    },

    // ========================================================================
    // Helpers
    // ========================================================================

    getActiveTerminal: () => {
        const { terminals, activeTerminalId } = get();
        return terminals.find(t => t.id === activeTerminalId) || null;
    },

    getTerminal: (id: string) => {
        return get().terminals.find(t => t.id === id) || null;
    },
}));

// ============================================================================
// Legacy exports for backward compatibility
// ============================================================================

// Create a default terminal if none exists when the store is first accessed
useTerminalStore.subscribe((state, prevState) => {
    if (prevState.terminals.length === 0 && state.terminals.length === 0 && state.listenersInitialized) {
        // This will be triggered manually when terminal is first opened
    }
});
