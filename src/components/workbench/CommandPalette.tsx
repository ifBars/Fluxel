import { useEffect, useRef, useCallback, memo } from 'react';
import { Command as CommandIcon, Search, ChevronRight } from 'lucide-react';
import { useCommandStore, type Command, type CommandCategory } from '@/stores/commands';
import { cn } from '@/lib/utils';

// ============================================================================
// Category Icons & Labels
// ============================================================================

const categoryConfig: Record<CommandCategory, { label: string; color: string }> = {
    file: { label: 'File', color: 'text-blue-400' },
    edit: { label: 'Edit', color: 'text-green-400' },
    view: { label: 'View', color: 'text-purple-400' },
    go: { label: 'Go', color: 'text-yellow-400' },
    refactor: { label: 'Refactor', color: 'text-orange-400' },
    debug: { label: 'Debug', color: 'text-red-400' },
    terminal: { label: 'Terminal', color: 'text-cyan-400' },
    help: { label: 'Help', color: 'text-gray-400' },
};

// ============================================================================
// Shortcut Display
// ============================================================================

function ShortcutDisplay({ shortcut }: { shortcut: string }) {
    const parts = shortcut.split('+').map(part => part.trim());
    
    return (
        <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            {parts.map((part, idx) => (
                <span key={idx} className="flex items-center">
                    {idx > 0 && <span className="mx-0.5">+</span>}
                    <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono min-w-[1.5rem] text-center">
                        {part}
                    </kbd>
                </span>
            ))}
        </div>
    );
}

// ============================================================================
// Command Item
// ============================================================================

interface CommandItemProps {
    command: Command;
    isSelected: boolean;
    onClick: () => void;
    onMouseEnter: () => void;
}

const CommandItem = memo(function CommandItem({ command, isSelected, onClick, onMouseEnter }: CommandItemProps) {
    const config = categoryConfig[command.category];
    
    return (
        <button
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                isSelected ? "bg-primary/10 text-foreground" : "text-foreground/80 hover:bg-muted/50"
            )}
        >
            {/* Category indicator */}
            <span className={cn("text-[10px] font-medium uppercase tracking-wider w-14 shrink-0", config.color)}>
                {config.label}
            </span>
            
            {/* Command info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{command.label}</span>
                </div>
                {command.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {command.description}
                    </p>
                )}
            </div>
            
            {/* Shortcut */}
            {command.shortcut && (
                <ShortcutDisplay shortcut={command.shortcut} />
            )}
            
            {/* Arrow indicator when selected */}
            {isSelected && (
                <ChevronRight className="w-4 h-4 text-primary shrink-0" />
            )}
        </button>
    );
});

// ============================================================================
// Command Palette Component
// ============================================================================

function CommandPalette() {
    const isOpen = useCommandStore(state => state.isOpen);
    const searchQuery = useCommandStore(state => state.searchQuery);
    const selectedIndex = useCommandStore(state => state.selectedIndex);
    const setSearchQuery = useCommandStore(state => state.setSearchQuery);
    const setSelectedIndex = useCommandStore(state => state.setSelectedIndex);
    const closePalette = useCommandStore(state => state.closePalette);
    const executeCommand = useCommandStore(state => state.executeCommand);
    const getFilteredCommands = useCommandStore(state => state.getFilteredCommands);
    
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    
    const filteredCommands = getFilteredCommands();
    
    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            // Small delay to ensure modal is rendered
            requestAnimationFrame(() => {
                inputRef.current?.focus();
            });
        }
    }, [isOpen]);
    
    // Scroll selected item into view
    useEffect(() => {
        if (listRef.current && filteredCommands.length > 0) {
            const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex, filteredCommands.length]);
    
    // Keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(Math.min(selectedIndex + 1, filteredCommands.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(Math.max(selectedIndex - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredCommands[selectedIndex]) {
                    executeCommand(filteredCommands[selectedIndex].id);
                }
                break;
            case 'Escape':
                e.preventDefault();
                closePalette();
                break;
            case 'Home':
                e.preventDefault();
                setSelectedIndex(0);
                break;
            case 'End':
                e.preventDefault();
                setSelectedIndex(filteredCommands.length - 1);
                break;
            case 'PageDown':
                e.preventDefault();
                setSelectedIndex(Math.min(selectedIndex + 10, filteredCommands.length - 1));
                break;
            case 'PageUp':
                e.preventDefault();
                setSelectedIndex(Math.max(selectedIndex - 10, 0));
                break;
        }
    }, [selectedIndex, filteredCommands, setSelectedIndex, executeCommand, closePalette]);
    
    // Handle backdrop click
    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            closePalette();
        }
    }, [closePalette]);
    
    if (!isOpen) return null;
    
    return (
        <div 
            className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
            onClick={handleBackdropClick}
        >
            <div 
                className="w-full max-w-xl bg-card border border-border rounded-lg shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Search Input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
                    <CommandIcon className="w-5 h-5 text-primary shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a command or search..."
                        className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
                        autoComplete="off"
                        spellCheck={false}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <span className="text-xs">Clear</span>
                        </button>
                    )}
                </div>
                
                {/* Command List */}
                <div 
                    ref={listRef}
                    className="max-h-[50vh] overflow-y-auto"
                >
                    {filteredCommands.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                            <Search className="w-8 h-8 mb-2 opacity-50" />
                            <p className="text-sm">No commands found</p>
                            <p className="text-xs mt-1">Try a different search term</p>
                        </div>
                    ) : (
                        filteredCommands.map((command, index) => (
                            <CommandItem
                                key={command.id}
                                command={command}
                                isSelected={index === selectedIndex}
                                onClick={() => executeCommand(command.id)}
                                onMouseEnter={() => setSelectedIndex(index)}
                            />
                        ))
                    )}
                </div>
                
                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/20 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1 py-0.5 bg-muted rounded">↑↓</kbd>
                            Navigate
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1 py-0.5 bg-muted rounded">Enter</kbd>
                            Execute
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1 py-0.5 bg-muted rounded">Esc</kbd>
                            Close
                        </span>
                    </div>
                    <span>{filteredCommands.length} commands</span>
                </div>
            </div>
        </div>
    );
}

export default memo(CommandPalette);

