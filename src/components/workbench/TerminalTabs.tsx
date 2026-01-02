import { memo, useState, useRef, useEffect } from 'react';
import { Plus, X, Terminal, SplitSquareHorizontal, SplitSquareVertical, Square, MoreHorizontal, Trash2, Edit2, Palette } from 'lucide-react';
import { useTerminalStore, type TerminalInstance, type TerminalColor } from '@/stores/terminal/useTerminalStore';
import { cn } from '@/lib/utils';

// ============================================================================
// Color Configuration
// ============================================================================

const colorConfig: Record<TerminalColor, { bg: string; border: string; dot: string }> = {
    default: { bg: 'bg-muted', border: 'border-muted', dot: 'bg-muted-foreground' },
    red: { bg: 'bg-red-500/10', border: 'border-red-500/30', dot: 'bg-red-500' },
    green: { bg: 'bg-green-500/10', border: 'border-green-500/30', dot: 'bg-green-500' },
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', dot: 'bg-blue-500' },
    yellow: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', dot: 'bg-yellow-500' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', dot: 'bg-purple-500' },
    cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', dot: 'bg-cyan-500' },
};

// ============================================================================
// Terminal Tab
// ============================================================================

interface TerminalTabProps {
    terminal: TerminalInstance;
    isActive: boolean;
    onClick: () => void;
    onClose: () => void;
    onRename: (name: string) => void;
    onColorChange: (color: TerminalColor) => void;
}

const TerminalTab = memo(function TerminalTab({
    terminal,
    isActive,
    onClick,
    onClose,
    onRename,
    onColorChange
}: TerminalTabProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(terminal.name);
    const [showMenu, setShowMenu] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const color = colorConfig[terminal.color];

    // Focus input when editing starts
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    // Close menu when clicking outside
    useEffect(() => {
        if (!showMenu) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showMenu]);

    const handleSubmitRename = () => {
        if (editName.trim()) {
            onRename(editName.trim());
        } else {
            setEditName(terminal.name);
        }
        setIsEditing(false);
    };

    return (
        <div className="relative">
            <button
                onClick={onClick}
                onDoubleClick={() => setIsEditing(true)}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-colors rounded-t border-t border-l border-r",
                    isActive
                        ? `${color.bg} ${color.border} text-foreground`
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent"
                )}
            >
                {/* Color indicator dot */}
                {terminal.color !== 'default' && (
                    <span className={cn("w-2 h-2 rounded-full", color.dot)} />
                )}

                {/* Running indicator */}
                {terminal.isRunning && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                )}

                <Terminal className="w-3.5 h-3.5" />

                {isEditing ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={handleSubmitRename}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSubmitRename();
                            if (e.key === 'Escape') {
                                setEditName(terminal.name);
                                setIsEditing(false);
                            }
                        }}
                        className="w-20 bg-transparent border-none outline-none text-xs"
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span className="truncate max-w-[100px]">{terminal.name}</span>
                )}

                {/* Context menu button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(!showMenu);
                    }}
                    className="p-0.5 rounded hover:bg-muted/80 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <MoreHorizontal className="w-3 h-3" />
                </button>

                {/* Close button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                    className="p-0.5 rounded hover:bg-muted/80 opacity-60 hover:opacity-100"
                >
                    <X className="w-3 h-3" />
                </button>
            </button>

            {/* Context Menu */}
            {showMenu && (
                <div
                    ref={menuRef}
                    className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg py-1 z-50 min-w-[150px]"
                >
                    <button
                        onClick={() => {
                            setShowMenu(false);
                            setIsEditing(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                    >
                        <Edit2 className="w-3 h-3" />
                        Rename
                    </button>

                    {/* Color submenu */}
                    <div className="px-3 py-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1 mb-1">
                            <Palette className="w-3 h-3" />
                            Color
                        </div>
                        <div className="flex gap-1 ml-4">
                            {(Object.keys(colorConfig) as TerminalColor[]).map((c) => (
                                <button
                                    key={c}
                                    onClick={() => {
                                        onColorChange(c);
                                        setShowMenu(false);
                                    }}
                                    className={cn(
                                        "w-4 h-4 rounded-full border border-border transition-transform hover:scale-110",
                                        colorConfig[c].dot,
                                        terminal.color === c && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                                    )}
                                    title={c}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="h-px bg-border my-1" />

                    <button
                        onClick={() => {
                            setShowMenu(false);
                            onClose();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-muted transition-colors"
                    >
                        <Trash2 className="w-3 h-3" />
                        Kill Terminal
                    </button>
                </div>
            )}
        </div>
    );
});

// ============================================================================
// Terminal Tabs Bar
// ============================================================================

function TerminalTabs() {
    const terminals = useTerminalStore(state => state.terminals);
    const activeTerminalId = useTerminalStore(state => state.activeTerminalId);
    const layout = useTerminalStore(state => state.layout);
    const createTerminal = useTerminalStore(state => state.createTerminal);
    const closeTerminal = useTerminalStore(state => state.closeTerminal);
    const setActiveTerminal = useTerminalStore(state => state.setActiveTerminal);
    const renameTerminal = useTerminalStore(state => state.renameTerminal);
    const setTerminalColor = useTerminalStore(state => state.setTerminalColor);
    const setLayout = useTerminalStore(state => state.setLayout);

    return (
        <div className="flex items-center justify-between px-2 py-1 bg-muted/30 border-b border-border">
            {/* Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto flex-1 group">
                {terminals.map((terminal) => (
                    <TerminalTab
                        key={terminal.id}
                        terminal={terminal}
                        isActive={terminal.id === activeTerminalId}
                        onClick={() => setActiveTerminal(terminal.id)}
                        onClose={() => closeTerminal(terminal.id)}
                        onRename={(name) => renameTerminal(terminal.id, name)}
                        onColorChange={(color) => setTerminalColor(terminal.id, color)}
                    />
                ))}

                {/* New Terminal Button */}
                <button
                    onClick={() => createTerminal()}
                    className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    title="New Terminal"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            {/* Layout Controls */}
            <div className="flex items-center gap-1 ml-2 shrink-0">
                <button
                    onClick={() => setLayout('single')}
                    className={cn(
                        "p-1.5 rounded transition-colors",
                        layout === 'single' ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                    title="Single View"
                >
                    <Square className="w-4 h-4" />
                </button>
                <button
                    onClick={() => setLayout('split-horizontal')}
                    className={cn(
                        "p-1.5 rounded transition-colors",
                        layout === 'split-horizontal' ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                    title="Split Horizontal"
                    disabled={terminals.length < 2}
                >
                    <SplitSquareHorizontal className="w-4 h-4" />
                </button>
                <button
                    onClick={() => setLayout('split-vertical')}
                    className={cn(
                        "p-1.5 rounded transition-colors",
                        layout === 'split-vertical' ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                    title="Split Vertical"
                    disabled={terminals.length < 2}
                >
                    <SplitSquareVertical className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

export default memo(TerminalTabs);

