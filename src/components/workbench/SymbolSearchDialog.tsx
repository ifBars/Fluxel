import { useEffect, useRef, useCallback, useState, memo } from 'react';
import { Hash, Type, Box, Braces, Variable, Zap, FileCode, ChevronRight, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { searchWorkspaceSymbols, SymbolKind, type SymbolInfo } from '@/lib/languages/csharp/WorkspaceSymbols';
import { useEditorStore, useProjectStore } from '@/stores';
import { fileUriToFsPath } from '@/lib/languages/base/fileUris';

// ============================================================================
// Symbol Kind Icons
// ============================================================================

function getSymbolIcon(kind: SymbolKind) {
    switch (kind) {
        case SymbolKind.Class:
        case SymbolKind.Interface:
        case SymbolKind.Struct:
            return <Box className="w-4 h-4 text-cyan-400" />;
        case SymbolKind.Method:
        case SymbolKind.Function:
        case SymbolKind.Constructor:
            return <Braces className="w-4 h-4 text-purple-400" />;
        case SymbolKind.Property:
        case SymbolKind.Field:
            return <Variable className="w-4 h-4 text-blue-400" />;
        case SymbolKind.Enum:
        case SymbolKind.EnumMember:
            return <Type className="w-4 h-4 text-orange-400" />;
        case SymbolKind.Constant:
            return <Hash className="w-4 h-4 text-yellow-400" />;
        case SymbolKind.Event:
            return <Zap className="w-4 h-4 text-pink-400" />;
        case SymbolKind.Namespace:
        case SymbolKind.Module:
        case SymbolKind.Package:
            return <FileCode className="w-4 h-4 text-green-400" />;
        default:
            return <Hash className="w-4 h-4 text-muted-foreground" />;
    }
}

function getSymbolKindLabel(kind: SymbolKind): string {
    return SymbolKind[kind] || 'Symbol';
}

// ============================================================================
// Symbol Item
// ============================================================================

interface SymbolItemProps {
    symbol: SymbolInfo;
    isSelected: boolean;
    onClick: () => void;
    onMouseEnter: () => void;
    projectRoot: string | null;
}

const SymbolItem = memo(function SymbolItem({ symbol, isSelected, onClick, onMouseEnter, projectRoot }: SymbolItemProps) {
    // Convert URI to relative path for display
    const filePath = fileUriToFsPath(symbol.location.uri);
    const relativePath = projectRoot && filePath.startsWith(projectRoot)
        ? filePath.slice(projectRoot.length + 1)
        : filePath;
    
    return (
        <button
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                isSelected ? "bg-primary/10 text-foreground" : "text-foreground/80 hover:bg-muted/50"
            )}
        >
            {/* Symbol icon */}
            {getSymbolIcon(symbol.kind)}
            
            {/* Symbol info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{symbol.name}</span>
                    {symbol.containerName && (
                        <span className="text-xs text-muted-foreground truncate">
                            in {symbol.containerName}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                    <span className="truncate" title={filePath}>{relativePath}</span>
                    <span className="opacity-50">•</span>
                    <span className="font-mono">Ln {symbol.location.range.startLine}</span>
                </div>
            </div>
            
            {/* Kind badge */}
            <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground shrink-0">
                {getSymbolKindLabel(symbol.kind)}
            </span>
            
            {/* Arrow indicator when selected */}
            {isSelected && (
                <ChevronRight className="w-4 h-4 text-primary shrink-0" />
            )}
        </button>
    );
});

// ============================================================================
// Symbol Search Dialog Component
// ============================================================================

interface SymbolSearchDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

function SymbolSearchDialog({ isOpen, onClose }: SymbolSearchDialogProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [symbols, setSymbols] = useState<SymbolInfo[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    
    const openFile = useEditorStore(state => state.openFile);
    const projectRoot = useProjectStore(state => state.currentProject?.rootPath ?? null);
    
    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            requestAnimationFrame(() => {
                inputRef.current?.focus();
            });
            // Clear state on open
            setSearchQuery('');
            setSymbols([]);
            setSelectedIndex(0);
        }
    }, [isOpen]);
    
    // Debounced search
    useEffect(() => {
        if (!isOpen) return;
        
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        
        if (!searchQuery.trim()) {
            setSymbols([]);
            return;
        }
        
        setIsLoading(true);
        
        searchTimeoutRef.current = setTimeout(async () => {
            try {
                const results = await searchWorkspaceSymbols(searchQuery);
                setSymbols(results);
                setSelectedIndex(0);
            } catch (error) {
                console.error('[SymbolSearch] Error:', error);
                setSymbols([]);
            } finally {
                setIsLoading(false);
            }
        }, 150);
        
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchQuery, isOpen]);
    
    // Scroll selected item into view
    useEffect(() => {
        if (listRef.current && symbols.length > 0) {
            const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex, symbols.length]);
    
    // Navigate to symbol
    const navigateToSymbol = useCallback(async (symbol: SymbolInfo) => {
        onClose();
        
        const filePath = fileUriToFsPath(symbol.location.uri);
        await openFile(filePath, {
            line: symbol.location.range.startLine,
            column: symbol.location.range.startColumn,
        });
    }, [onClose, openFile]);
    
    // Keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, symbols.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (symbols[selectedIndex]) {
                    navigateToSymbol(symbols[selectedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
            case 'PageDown':
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 10, symbols.length - 1));
                break;
            case 'PageUp':
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 10, 0));
                break;
        }
    }, [selectedIndex, symbols, navigateToSymbol, onClose]);
    
    // Handle backdrop click
    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    }, [onClose]);
    
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
                    <Hash className="w-5 h-5 text-primary shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Go to symbol in workspace... (type to search)"
                        className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
                        autoComplete="off"
                        spellCheck={false}
                    />
                    {isLoading && (
                        <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                    )}
                </div>
                
                {/* Symbol List */}
                <div 
                    ref={listRef}
                    className="max-h-[50vh] overflow-y-auto"
                >
                    {!searchQuery.trim() ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                            <Search className="w-8 h-8 mb-2 opacity-50" />
                            <p className="text-sm">Type to search for symbols</p>
                            <p className="text-xs mt-1">Classes, methods, properties, and more</p>
                        </div>
                    ) : symbols.length === 0 && !isLoading ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                            <Search className="w-8 h-8 mb-2 opacity-50" />
                            <p className="text-sm">No symbols found</p>
                            <p className="text-xs mt-1">Try a different search term</p>
                        </div>
                    ) : (
                        symbols.map((symbol, index) => (
                            <SymbolItem
                                key={`${symbol.name}-${symbol.location.uri}-${symbol.location.range.startLine}`}
                                symbol={symbol}
                                isSelected={index === selectedIndex}
                                onClick={() => navigateToSymbol(symbol)}
                                onMouseEnter={() => setSelectedIndex(index)}
                                projectRoot={projectRoot}
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
                            Go to Symbol
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1 py-0.5 bg-muted rounded">Esc</kbd>
                            Close
                        </span>
                    </div>
                    <span>{symbols.length} symbol{symbols.length !== 1 ? 's' : ''}</span>
                </div>
            </div>
        </div>
    );
}

export default memo(SymbolSearchDialog);

