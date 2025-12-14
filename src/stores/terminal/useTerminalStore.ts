import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

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

export interface TerminalState {
    history: string[];
    historyIndex: number;
    entries: TerminalEntry[];
    isRunning: boolean;
    currentCommand: string | null;
    activePid: number | null;
    listenersInitialized: boolean;

    addEntry: (type: TerminalEntryType, content: string) => void;
    clearTerminal: () => void;
    executeCommand: (commandString: string) => Promise<void>;
    killProcess: () => Promise<void>;
    setHistoryIndex: (index: number) => void;
    initListeners: () => Promise<void>;
}

// Simple command parser handling quotes
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

export const useTerminalStore = create<TerminalState>((set, get) => ({
    history: [],
    historyIndex: -1,
    entries: [],
    isRunning: false,
    currentCommand: null,
    activePid: null,
    listenersInitialized: false,

    addEntry: (type, content) => {
        set((state) => ({
            entries: [
                ...state.entries,
                {
                    id: crypto.randomUUID(),
                    type,
                    content,
                    timestamp: Date.now(),
                },
            ],
        }));
    },

    clearTerminal: () => set({ entries: [] }),

    setHistoryIndex: (index) => set({ historyIndex: index }),

    initListeners: async () => {
        if (get().listenersInitialized) return;

        await listen<TerminalOutput>('terminal://output', (event) => {
            const { pid, data } = event.payload;
            const state = get();
            if (state.activePid === pid) {
                state.addEntry('output', data);
            }
        });

        await listen<TerminalOutput>('terminal://stderr', (event) => {
            const { pid, data } = event.payload;
            const state = get();
            if (state.activePid === pid) {
                state.addEntry('error', data);
            }
        });

        await listen<TerminalExit>('terminal://exit', (event) => {
            const { pid, code } = event.payload;
            const state = get();
            if (state.activePid === pid) {
                set({ isRunning: false, currentCommand: null, activePid: null });
                if (code !== 0 && code !== null) {
                    state.addEntry('error', `Process exited with code ${code}`);
                }
            }
        });

        set({ listenersInitialized: true });
    },

    killProcess: async () => {
        const { activePid, addEntry } = get();
        if (activePid) {
            try {
                await invoke('kill_shell_process', { pid: activePid });
                addEntry('info', '^C');
                // State cleanup happens in 'exit' listener
            } catch (err) {
                addEntry('error', `Failed to kill process: ${err}`);
            }
        }
    },

    executeCommand: async (commandString) => {
        const trimmed = commandString.trim();
        if (!trimmed) return;

        const { addEntry, initListeners } = get();

        // Ensure listeners are active
        await initListeners();

        // Add command to history and entries
        set((state) => ({
            history: [...state.history, trimmed],
            historyIndex: -1,
            entries: [
                ...state.entries,
                {
                    id: crypto.randomUUID(),
                    type: 'command',
                    content: trimmed,
                    timestamp: Date.now(),
                },
            ],
            isRunning: true,
            currentCommand: trimmed
        }));

        const args = parseCommand(trimmed);
        const commandName = args[0];
        const commandArgs = args.slice(1);

        try {
            // Check for specific internal commands
            if (commandName === 'clear' || commandName === 'cls') {
                set({ entries: [], isRunning: false, currentCommand: null, activePid: null });
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

            set({ activePid: pid });

        } catch (error) {
            set({ isRunning: false, currentCommand: null, activePid: null });
            addEntry('error', `Failed to execute: ${error instanceof Error ? error.message : String(error)}`);
        }
    },
}));
