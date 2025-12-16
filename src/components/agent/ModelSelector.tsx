import { useState, useRef, useEffect, useMemo } from 'react';
import { Bot, ChevronDown, Search, Sparkles, Zap, Brain, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import ScrollableArea from '@/components/ui/scrollable-area';

interface ModelInfo {
    name: string;
    displayName: string;
    size?: string;
    category: 'fast' | 'balanced' | 'capable';
}

interface ModelSelectorProps {
    value: string;
    options: string[];
    onChange: (value: string) => void;
    disabled?: boolean;
    className?: string;
}

// Categorize models based on name patterns
function categorizeModel(name: string): ModelInfo {
    const displayName = name.split(':')[0];
    const tag = name.split(':')[1] || '';

    // Extract size info
    let size = '';
    const sizeMatch = tag.match(/(\d+\.?\d*)(b|m|k)/i);
    if (sizeMatch) {
        const value = parseFloat(sizeMatch[1]);
        const unit = sizeMatch[2].toLowerCase();
        if (unit === 'b') size = `${value}B`;
        else if (unit === 'm') size = `${value}M`;
        else if (unit === 'k') size = `${value}K`;
    }

    // Determine category based on size
    let category: 'fast' | 'balanced' | 'capable' = 'balanced';
    if (sizeMatch) {
        const value = parseFloat(sizeMatch[1]);
        const unit = sizeMatch[2].toLowerCase();
        if (unit === 'b') {
            if (value <= 3) category = 'fast';
            else if (value >= 8) category = 'capable';
        }
    }

    // Fast models by name
    if (name.includes('phi') || name.includes('tinyllama') || name.includes('1b')) {
        category = 'fast';
    }

    // Capable models by name
    if (name.includes('deepseek') || name.includes('qwen') || name.includes('codellama')) {
        if (!name.includes('1b') && !name.includes('2b')) {
            category = 'capable';
        }
    }

    return {
        name,
        displayName: displayName.charAt(0).toUpperCase() + displayName.slice(1),
        size,
        category,
    };
}

const categoryIcons = {
    fast: <Zap className="w-3.5 h-3.5 text-green-400" />,
    balanced: <Sparkles className="w-3.5 h-3.5 text-blue-400" />,
    capable: <Brain className="w-3.5 h-3.5 text-purple-400" />,
};

const categoryLabels = {
    fast: 'Fast',
    balanced: 'Balanced',
    capable: 'Capable',
};

export function ModelSelector({
    value,
    options,
    onChange,
    disabled = false,
    className,
}: ModelSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Parse and categorize models
    const models = useMemo(() =>
        options.map(categorizeModel),
        [options]
    );

    // Filter by search
    const filteredModels = useMemo(() => {
        if (!search.trim()) return models;
        const query = search.toLowerCase();
        return models.filter(m =>
            m.name.toLowerCase().includes(query) ||
            m.displayName.toLowerCase().includes(query)
        );
    }, [models, search]);

    // Group by category
    const groupedModels = useMemo(() => {
        const groups: Record<string, ModelInfo[]> = {
            fast: [],
            balanced: [],
            capable: [],
        };
        filteredModels.forEach(m => groups[m.category].push(m));
        return groups;
    }, [filteredModels]);

    // Get flat list for keyboard navigation
    const flatModels = useMemo(() => {
        return [...groupedModels.fast, ...groupedModels.balanced, ...groupedModels.capable];
    }, [groupedModels]);

    const selectedModel = models.find(m => m.name === value);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearch('');
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    // Focus search on open
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen]);

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'Escape':
                    setIsOpen(false);
                    setSearch('');
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex(prev =>
                        prev < flatModels.length - 1 ? prev + 1 : 0
                    );
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex(prev =>
                        prev > 0 ? prev - 1 : flatModels.length - 1
                    );
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (selectedIndex >= 0 && selectedIndex < flatModels.length) {
                        onChange(flatModels[selectedIndex].name);
                        setIsOpen(false);
                        setSearch('');
                    }
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, selectedIndex, flatModels, onChange]);

    const handleSelect = (model: ModelInfo) => {
        onChange(model.name);
        setIsOpen(false);
        setSearch('');
    };

    const renderModelItem = (model: ModelInfo, _index: number) => {
        const isSelected = model.name === value;
        const isHighlighted = flatModels[selectedIndex]?.name === model.name;

        return (
            <button
                key={model.name}
                onClick={() => handleSelect(model)}
                onMouseEnter={() => setSelectedIndex(flatModels.indexOf(model))}
                className={cn(
                    'w-full px-3 py-2 flex items-center justify-between gap-2 text-left transition-colors',
                    isHighlighted && 'bg-primary/10',
                    isSelected && 'bg-primary/5'
                )}
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    {categoryIcons[model.category]}
                    <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                            {model.displayName}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                            {model.name}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {model.size && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {model.size}
                        </span>
                    )}
                    {isSelected && <Check className="w-4 h-4 text-primary" />}
                </div>
            </button>
        );
    };

    const renderCategory = (category: 'fast' | 'balanced' | 'capable') => {
        const categoryModels = groupedModels[category];
        if (categoryModels.length === 0) return null;

        return (
            <div key={category}>
                <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider bg-muted/30 border-y border-border/30">
                    {categoryIcons[category]}
                    <span className="ml-2">{categoryLabels[category]}</span>
                </div>
                {categoryModels.map((model, i) => renderModelItem(model, i))}
            </div>
        );
    };

    return (
        <div ref={containerRef} className={cn('relative', className)}>
            {/* Trigger */}
            <button
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={cn(
                    'flex items-center gap-2 px-3 py-1.5 min-w-[160px]',
                    'bg-muted/40 hover:bg-muted/60 border border-border/50 rounded-lg',
                    'text-sm transition-all duration-200',
                    'focus:outline-none focus:ring-2 focus:ring-primary/50',
                    disabled && 'opacity-50 cursor-not-allowed',
                    isOpen && 'ring-2 ring-primary/50 bg-muted/60'
                )}
            >
                <Bot className="w-4 h-4 text-primary" />
                <span className="flex-1 text-left truncate">
                    {selectedModel?.displayName || value || 'Select model'}
                </span>
                {selectedModel?.size && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-background/50 text-muted-foreground">
                        {selectedModel.size}
                    </span>
                )}
                <ChevronDown className={cn(
                    'w-4 h-4 text-muted-foreground transition-transform duration-200',
                    isOpen && 'rotate-180'
                )} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-72 bg-card border border-border rounded-lg shadow-xl overflow-hidden z-50">
                    {/* Search */}
                    <div className="p-2 border-b border-border/50">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search models..."
                                className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted/50 border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/50"
                            />
                        </div>
                    </div>

                    {/* Model List */}
                    <ScrollableArea className="max-h-64">
                        {filteredModels.length === 0 ? (
                            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                                No models found
                            </div>
                        ) : (
                            <>
                                {renderCategory('fast')}
                                {renderCategory('balanced')}
                                {renderCategory('capable')}
                            </>
                        )}
                    </ScrollableArea>

                    {/* Footer hint */}
                    <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t border-border/50 bg-muted/20">
                        <span className="inline-flex items-center gap-1">
                            <Zap className="w-2.5 h-2.5 text-green-400" /> Fast
                        </span>
                        <span className="mx-2">•</span>
                        <span className="inline-flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5 text-blue-400" /> Balanced
                        </span>
                        <span className="mx-2">•</span>
                        <span className="inline-flex items-center gap-1">
                            <Brain className="w-2.5 h-2.5 text-purple-400" /> Capable
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
