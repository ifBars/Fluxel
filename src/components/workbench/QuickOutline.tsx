import { useEffect, useRef, useCallback, useState, memo } from 'react';
import { Hash, Type, Box, Braces, Variable, Zap, FileCode, ChevronRight, Search, Loader2, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/stores';

// ============================================================================
// Types
// ============================================================================

interface DocumentSymbol {
    name: string;
    kind: number;
    range: {
        startLine: number;
        startColumn: number;
        endLine: number;
        endColumn: number;
    };
    selectionRange: {
        startLine: number;
        startColumn: number;
        endLine: number;
        endColumn: number;
    };
    detail?: string;
    children?: DocumentSymbol[];
}

// Symbol kinds from Monaco
const SymbolKind = {
    File: 0,
    Module: 1,
    Namespace: 2,
    Package: 3,
    Class: 4,
    Method: 5,
    Property: 6,
    Field: 7,
    Constructor: 8,
    Enum: 9,
    Interface: 10,
    Function: 11,
    Variable: 12,
    Constant: 13,
    String: 14,
    Number: 15,
    Boolean: 16,
    Array: 17,
    Object: 18,
    Key: 19,
    Null: 20,
    EnumMember: 21,
    Struct: 22,
    Event: 23,
    Operator: 24,
    TypeParameter: 25,
} as const;

// ============================================================================
// Symbol Kind Icons
// ============================================================================

function getSymbolIcon(kind: number) {
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

function getSymbolKindLabel(kind: number): string {
    const kindNames = Object.entries(SymbolKind).find(([, v]) => v === kind);
    return kindNames?.[0] || 'Symbol';
}

// ============================================================================
// Flatten symbols
// ============================================================================

interface FlatSymbol extends DocumentSymbol {
    depth: number;
    parent?: string;
}

function flattenSymbols(symbols: DocumentSymbol[], depth = 0, parent?: string): FlatSymbol[] {
    const result: FlatSymbol[] = [];
    
    for (const symbol of symbols) {
        result.push({ ...symbol, depth, parent });
        
        if (symbol.children && symbol.children.length > 0) {
            result.push(...flattenSymbols(symbol.children, depth + 1, symbol.name));
        }
    }
    
    return result;
}

// ============================================================================
// Symbol Item
// ============================================================================

interface SymbolItemProps {
    symbol: FlatSymbol;
    isSelected: boolean;
    onClick: () => void;
    onMouseEnter: () => void;
}

const SymbolItem = memo(function SymbolItem({ symbol, isSelected, onClick, onMouseEnter }: SymbolItemProps) {
    return (
        <button
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                isSelected ? "bg-primary/10 text-foreground" : "text-foreground/80 hover:bg-muted/50"
            )}
            style={{ paddingLeft: `${12 + symbol.depth * 16}px` }}
        >
            {/* Symbol icon */}
            {getSymbolIcon(symbol.kind)}
            
            {/* Symbol info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{symbol.name}</span>
                    {symbol.detail && (
                        <span className="text-xs text-muted-foreground truncate">
                            {symbol.detail}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                    <span className="font-mono">Ln {symbol.range.startLine}</span>
                    {symbol.parent && (
                        <>
                            <span className="opacity-50">•</span>
                            <span className="truncate">in {symbol.parent}</span>
                        </>
                    )}
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
// Quick Outline Component
// ============================================================================

interface QuickOutlineProps {
    isOpen: boolean;
    onClose: () => void;
}

function QuickOutline({ isOpen, onClose }: QuickOutlineProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [symbols, setSymbols] = useState<FlatSymbol[]>([]);
    const [filteredSymbols, setFilteredSymbols] = useState<FlatSymbol[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    
    const activeTabId = useEditorStore(state => state.activeTabId);
    const tabs = useEditorStore(state => state.tabs);
    const activeTab = tabs.find(t => t.id === activeTabId);
    
    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            requestAnimationFrame(() => {
                inputRef.current?.focus();
            });
            // Clear state on open
            setSearchQuery('');
            setSelectedIndex(0);
        }
    }, [isOpen]);
    
    // Load document symbols when opened
    useEffect(() => {
        if (!isOpen || !activeTab) {
            setSymbols([]);
            return;
        }
        
        setIsLoading(true);
        
        // Use Monaco's document symbol provider
        // We'll access it through the global monaco instance
        const loadSymbols = async () => {
            try {
                // Access monaco from window
                const monaco = (window as any).monaco;
                if (!monaco) {
                    console.warn('[QuickOutline] Monaco not available');
                    setSymbols([]);
                    setIsLoading(false);
                    return;
                }
                
                // Get the model for the active file
                const uri = monaco.Uri.parse(`file:///${activeTab.path.replace(/\\/g, '/')}`);
                const model = monaco.editor.getModel(uri);
                
                if (!model) {
                    console.warn('[QuickOutline] Model not found for', activeTab.path);
                    setSymbols([]);
                    setIsLoading(false);
                    return;
                }
                
                // Get document symbols
                const languageId = model.getLanguageId();
                const providers = monaco.languages.DocumentSymbolProviderRegistry?.ordered(model) || [];
                
                if (providers.length === 0) {
                    // Fallback: simple line-based outline for files without symbol provider
                    const lines = activeTab.content.split('\n');
                    const simpleSymbols: FlatSymbol[] = [];
                    
                    // Look for common patterns (functions, classes, etc.)
                    const patterns = [
                        { regex: /^(export\s+)?(async\s+)?function\s+(\w+)/m, kind: SymbolKind.Function, nameGroup: 3 },
                        { regex: /^(export\s+)?class\s+(\w+)/m, kind: SymbolKind.Class, nameGroup: 2 },
                        { regex: /^(export\s+)?interface\s+(\w+)/m, kind: SymbolKind.Interface, nameGroup: 2 },
                        { regex: /^(export\s+)?const\s+(\w+)\s*=/m, kind: SymbolKind.Constant, nameGroup: 2 },
                        { regex: /^\s*(public|private|protected)?\s*(static\s+)?(async\s+)?(\w+)\s*\(/m, kind: SymbolKind.Method, nameGroup: 4 },
                    ];
                    
                    lines.forEach((line, lineIndex) => {
                        for (const pattern of patterns) {
                            const match = line.match(pattern.regex);
                            if (match && match[pattern.nameGroup]) {
                                simpleSymbols.push({
                                    name: match[pattern.nameGroup],
                                    kind: pattern.kind,
                                    range: {
                                        startLine: lineIndex + 1,
                                        startColumn: 1,
                                        endLine: lineIndex + 1,
                                        endColumn: line.length + 1,
                                    },
                                    selectionRange: {
                                        startLine: lineIndex + 1,
                                        startColumn: 1,
                                        endLine: lineIndex + 1,
                                        endColumn: line.length + 1,
                                    },
                                    depth: 0,
                                });
                                break;
                            }
                        }
                    });
                    
                    setSymbols(simpleSymbols);
                    setIsLoading(false);
                    return;
                }
                
                // Get symbols from the first provider
                const provider = providers[0];
                const result = await provider.provideDocumentSymbols(model, {});
                
                if (result && Array.isArray(result)) {
                    // Convert Monaco symbols to our format
                    const convertSymbol = (s: any): DocumentSymbol => ({
                        name: s.name,
                        kind: s.kind,
                        detail: s.detail,
                        range: {
                            startLine: s.range.startLineNumber,
                            startColumn: s.range.startColumn,
                            endLine: s.range.endLineNumber,
                            endColumn: s.range.endColumn,
                        },
                        selectionRange: {
                            startLine: s.selectionRange?.startLineNumber || s.range.startLineNumber,
                            startColumn: s.selectionRange?.startColumn || s.range.startColumn,
                            endLine: s.selectionRange?.endLineNumber || s.range.endLineNumber,
                            endColumn: s.selectionRange?.endColumn || s.range.endColumn,
                        },
                        children: s.children?.map(convertSymbol),
                    });
                    
                    const documentSymbols = result.map(convertSymbol);
                    setSymbols(flattenSymbols(documentSymbols));
                } else {
                    setSymbols([]);
                }
            } catch (error) {
                console.error('[QuickOutline] Error loading symbols:', error);
                setSymbols([]);
            } finally {
                setIsLoading(false);
            }
        };
        
        loadSymbols();
    }, [isOpen, activeTab]);
    
    // Filter symbols based on search query
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredSymbols(symbols);
            return;
        }
        
        const query = searchQuery.toLowerCase();
        const filtered = symbols.filter(s => 
            s.name.toLowerCase().includes(query) ||
            s.detail?.toLowerCase().includes(query)
        );
        
        setFilteredSymbols(filtered);
        setSelectedIndex(0);
    }, [searchQuery, symbols]);
    
    // Scroll selected item into view
    useEffect(() => {
        if (listRef.current && filteredSymbols.length > 0) {
            const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex, filteredSymbols.length]);
    
    // Navigate to symbol
    const navigateToSymbol = useCallback((symbol: FlatSymbol) => {
        onClose();
        
        if (activeTabId) {
            // Set pending reveal to jump to the symbol location
            useEditorStore.setState({
                pendingReveal: {
                    tabId: activeTabId,
                    line: symbol.selectionRange.startLine,
                    column: symbol.selectionRange.startColumn,
                }
            });
        }
    }, [onClose, activeTabId]);
    
    // Keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, filteredSymbols.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredSymbols[selectedIndex]) {
                    navigateToSymbol(filteredSymbols[selectedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
            case 'PageDown':
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 10, filteredSymbols.length - 1));
                break;
            case 'PageUp':
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 10, 0));
                break;
        }
    }, [selectedIndex, filteredSymbols, navigateToSymbol, onClose]);
    
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
                    <List className="w-5 h-5 text-primary shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={`Go to symbol in ${activeTab?.filename || 'file'}...`}
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
                    {!activeTab ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                            <Search className="w-8 h-8 mb-2 opacity-50" />
                            <p className="text-sm">No file open</p>
                            <p className="text-xs mt-1">Open a file to see its outline</p>
                        </div>
                    ) : filteredSymbols.length === 0 && !isLoading ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                            <Search className="w-8 h-8 mb-2 opacity-50" />
                            <p className="text-sm">No symbols found</p>
                            <p className="text-xs mt-1">
                                {searchQuery ? 'Try a different search term' : 'This file has no symbols'}
                            </p>
                        </div>
                    ) : (
                        filteredSymbols.map((symbol, index) => (
                            <SymbolItem
                                key={`${symbol.name}-${symbol.range.startLine}-${index}`}
                                symbol={symbol}
                                isSelected={index === selectedIndex}
                                onClick={() => navigateToSymbol(symbol)}
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
                            Go to Symbol
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1 py-0.5 bg-muted rounded">Esc</kbd>
                            Close
                        </span>
                    </div>
                    <span>{filteredSymbols.length} symbol{filteredSymbols.length !== 1 ? 's' : ''}</span>
                </div>
            </div>
        </div>
    );
}

export default memo(QuickOutline);

