import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

export type CommandCategory = 
    | 'file' 
    | 'edit' 
    | 'view' 
    | 'go' 
    | 'refactor' 
    | 'debug' 
    | 'terminal' 
    | 'help';

export interface Command {
    id: string;
    label: string;
    category: CommandCategory;
    shortcut?: string;
    icon?: string;
    description?: string;
    when?: () => boolean; // Condition for when command is available
    execute: () => void | Promise<void>;
}

export interface CommandState {
    // State
    commands: Map<string, Command>;
    recentCommands: string[]; // Command IDs
    isOpen: boolean;
    searchQuery: string;
    selectedIndex: number;

    // Actions
    registerCommand: (command: Command) => void;
    unregisterCommand: (id: string) => void;
    executeCommand: (id: string) => Promise<void>;
    openPalette: () => void;
    closePalette: () => void;
    togglePalette: () => void;
    setSearchQuery: (query: string) => void;
    setSelectedIndex: (index: number) => void;
    getFilteredCommands: () => Command[];
    getCommandsByCategory: (category: CommandCategory) => Command[];
}

// ============================================================================
// Fuzzy Search
// ============================================================================

function fuzzyMatch(pattern: string, text: string): { matches: boolean; score: number } {
    if (!pattern) return { matches: true, score: 0 };
    
    const patternLower = pattern.toLowerCase();
    const textLower = text.toLowerCase();
    
    // Exact match gets highest score
    if (textLower === patternLower) {
        return { matches: true, score: 1000 };
    }
    
    // Starts with pattern
    if (textLower.startsWith(patternLower)) {
        return { matches: true, score: 500 + (pattern.length / text.length) * 100 };
    }
    
    // Contains pattern
    if (textLower.includes(patternLower)) {
        return { matches: true, score: 200 + (pattern.length / text.length) * 100 };
    }
    
    // Fuzzy character matching
    let patternIdx = 0;
    let score = 0;
    let consecutiveBonus = 0;
    
    for (let i = 0; i < textLower.length && patternIdx < patternLower.length; i++) {
        if (textLower[i] === patternLower[patternIdx]) {
            score += 10 + consecutiveBonus;
            consecutiveBonus += 5; // Bonus for consecutive matches
            patternIdx++;
        } else {
            consecutiveBonus = 0;
        }
    }
    
    if (patternIdx === patternLower.length) {
        return { matches: true, score };
    }
    
    return { matches: false, score: 0 };
}

// ============================================================================
// Store
// ============================================================================

const MAX_RECENT_COMMANDS = 10;

export const useCommandStore = create<CommandState>()(
    persist(
        (set, get) => ({
            // State
            commands: new Map(),
            recentCommands: [],
            isOpen: false,
            searchQuery: '',
            selectedIndex: 0,

            // Actions
            registerCommand: (command: Command) => {
                set((state) => {
                    const newCommands = new Map(state.commands);
                    newCommands.set(command.id, command);
                    return { commands: newCommands };
                });
            },

            unregisterCommand: (id: string) => {
                set((state) => {
                    const newCommands = new Map(state.commands);
                    newCommands.delete(id);
                    return { commands: newCommands };
                });
            },

            executeCommand: async (id: string) => {
                const { commands, recentCommands } = get();
                const command = commands.get(id);
                
                if (!command) {
                    console.warn(`[CommandStore] Command not found: ${id}`);
                    return;
                }

                // Check if command is available
                if (command.when && !command.when()) {
                    console.warn(`[CommandStore] Command not available: ${id}`);
                    return;
                }

                // Close palette before executing
                set({ isOpen: false, searchQuery: '', selectedIndex: 0 });

                // Update recent commands
                const newRecent = [id, ...recentCommands.filter(c => c !== id)].slice(0, MAX_RECENT_COMMANDS);
                set({ recentCommands: newRecent });

                // Execute the command
                try {
                    await command.execute();
                } catch (error) {
                    console.error(`[CommandStore] Error executing command ${id}:`, error);
                }
            },

            openPalette: () => {
                set({ isOpen: true, searchQuery: '', selectedIndex: 0 });
            },

            closePalette: () => {
                set({ isOpen: false, searchQuery: '', selectedIndex: 0 });
            },

            togglePalette: () => {
                const { isOpen } = get();
                if (isOpen) {
                    set({ isOpen: false, searchQuery: '', selectedIndex: 0 });
                } else {
                    set({ isOpen: true, searchQuery: '', selectedIndex: 0 });
                }
            },

            setSearchQuery: (query: string) => {
                set({ searchQuery: query, selectedIndex: 0 });
            },

            setSelectedIndex: (index: number) => {
                set({ selectedIndex: index });
            },

            getFilteredCommands: () => {
                const { commands, searchQuery, recentCommands } = get();
                const allCommands = Array.from(commands.values());
                
                // Filter available commands
                const availableCommands = allCommands.filter(cmd => !cmd.when || cmd.when());
                
                if (!searchQuery) {
                    // Show recent commands first, then all others
                    const recentSet = new Set(recentCommands);
                    const recent = recentCommands
                        .map(id => commands.get(id))
                        .filter((cmd): cmd is Command => cmd !== undefined && (!cmd.when || cmd.when()));
                    
                    const others = availableCommands
                        .filter(cmd => !recentSet.has(cmd.id))
                        .sort((a, b) => a.label.localeCompare(b.label));
                    
                    return [...recent, ...others];
                }
                
                // Fuzzy search and sort by score
                const results = availableCommands
                    .map(cmd => {
                        const labelMatch = fuzzyMatch(searchQuery, cmd.label);
                        const categoryMatch = fuzzyMatch(searchQuery, cmd.category);
                        const descMatch = cmd.description ? fuzzyMatch(searchQuery, cmd.description) : { matches: false, score: 0 };
                        
                        const bestScore = Math.max(labelMatch.score, categoryMatch.score * 0.5, descMatch.score * 0.3);
                        const matches = labelMatch.matches || categoryMatch.matches || descMatch.matches;
                        
                        return { command: cmd, score: bestScore, matches };
                    })
                    .filter(r => r.matches)
                    .sort((a, b) => b.score - a.score)
                    .map(r => r.command);
                
                return results;
            },

            getCommandsByCategory: (category: CommandCategory) => {
                const { commands } = get();
                return Array.from(commands.values())
                    .filter(cmd => cmd.category === category && (!cmd.when || cmd.when()))
                    .sort((a, b) => a.label.localeCompare(b.label));
            },
        }),
        {
            name: 'fluxel-commands',
            partialize: (state) => ({
                recentCommands: state.recentCommands,
            }),
        }
    )
);

// ============================================================================
// Export index
// ============================================================================

export * from './useCommandStore';

