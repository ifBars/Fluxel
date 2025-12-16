import React, { useState } from 'react';
import { 
    AlertCircle, 
    AlertTriangle, 
    Info, 
    Search, 
    FileText, 
    ChevronDown, 
    ChevronRight,
    List,
    LayoutList,
    Ban
} from 'lucide-react';
import { useDiagnosticsStore, Diagnostic } from '@/stores/diagnostics/useDiagnosticsStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import ScrollableArea from '@/components/ui/scrollable-area';
import { useProfiler } from '@/hooks/useProfiler';

export default function ProblemsView() {
    const { 
        getFilteredDiagnostics, 
        getCounts, 
        filter, 
        setFilter,
        navigateToDiagnostic 
    } = useDiagnosticsStore();

    const [groupByFile, setGroupByFile] = useState(true);
    const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());
    const { trackInteraction, ProfilerWrapper } = useProfiler('ProblemsView');

    const diagnostics = getFilteredDiagnostics();
    const counts = getCounts();

    const toggleSeverity = (severity: 'error' | 'warning' | 'info' | 'hint') => {
        const current = filter.severity;
        const next = current.includes(severity)
            ? current.filter(s => s !== severity)
            : [...current, severity];
        setFilter({ severity: next });
        trackInteraction('severity_filter_toggled', { 
            severity, 
            enabled: next.includes(severity) ? 'true' : 'false',
            filterCount: next.length.toString()
        });
    };

    const toggleFileCollapse = (filePath: string) => {
        const next = new Set(collapsedFiles);
        if (next.has(filePath)) {
            next.delete(filePath);
        } else {
            next.add(filePath);
        }
        setCollapsedFiles(next);
        trackInteraction('file_group_toggled', { 
            filePath, 
            collapsed: next.has(filePath) ? 'true' : 'false'
        });
    };

    // Group diagnostics by file
    const groupedDiagnostics = React.useMemo(() => {
        if (!groupByFile) return null;
        
        const groups = new Map<string, Diagnostic[]>();
        diagnostics.forEach(d => {
            const list = groups.get(d.filePath) || [];
            list.push(d);
            groups.set(d.filePath, list);
        });
        return groups;
    }, [diagnostics, groupByFile]);

    return (
        <ProfilerWrapper>
            <div className="flex flex-col h-full bg-card">
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30 shrink-0">
                <div className="flex items-center gap-1 border-r border-border pr-2 mr-1">
                    <FilterButton 
                        icon={AlertCircle} 
                        count={counts.errors} 
                        isActive={filter.severity.includes('error')}
                        onClick={() => toggleSeverity('error')}
                        activeClass="text-red-500 bg-red-500/10 hover:bg-red-500/20"
                        label="Errors"
                    />
                    <FilterButton 
                        icon={AlertTriangle} 
                        count={counts.warnings} 
                        isActive={filter.severity.includes('warning')}
                        onClick={() => toggleSeverity('warning')}
                        activeClass="text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20"
                        label="Warnings"
                    />
                    <FilterButton 
                        icon={Info} 
                        count={counts.info} 
                        isActive={filter.severity.includes('info')}
                        onClick={() => toggleSeverity('info')}
                        activeClass="text-blue-500 bg-blue-500/10 hover:bg-blue-500/20"
                        label="Info"
                    />
                </div>

                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input 
                        value={filter.searchQuery}
                        onChange={(e) => setFilter({ searchQuery: e.target.value })}
                        placeholder="Filter problems..."
                        className="h-7 pl-8 text-xs bg-background/50"
                    />
                </div>

                <div className="flex items-center gap-1 ml-auto">
                    <Button
                        variant={groupByFile ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                            setGroupByFile(!groupByFile);
                            trackInteraction('group_by_file_toggled', { 
                                enabled: (!groupByFile).toString() 
                            });
                        }}
                        title={groupByFile ? "Flatten list" : "Group by file"}
                    >
                        {groupByFile ? <LayoutList className="w-4 h-4" /> : <List className="w-4 h-4" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                            setFilter({ severity: ['error', 'warning', 'info', 'hint'], searchQuery: '' });
                            trackInteraction('filters_cleared');
                        }}
                        title="Clear filters"
                    >
                        <Ban className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* List */}
            <ScrollableArea className="flex-1">
                {diagnostics.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                        <span className="text-sm">No problems found</span>
                    </div>
                ) : (
                    <div className="flex flex-col pb-4">
                        {groupByFile && groupedDiagnostics ? (
                            Array.from(groupedDiagnostics.entries()).map(([path, fileDiagnostics]) => (
                                <div key={path} className="flex flex-col">
                                    <button
                                        onClick={() => toggleFileCollapse(path)}
                                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 text-xs font-medium text-foreground/80 sticky top-0 bg-card z-10 border-b border-border/50"
                                    >
                                        {collapsedFiles.has(path) ? (
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        ) : (
                                            <ChevronDown className="w-3.5 h-3.5" />
                                        )}
                                        <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                                        <span className="truncate" title={path}>
                                            {fileDiagnostics[0]?.fileName || path}
                                        </span>
                                        <Badge variant="secondary" className="ml-auto h-4 px-1.5 text-[10px] min-w-[1.25rem] justify-center">
                                            {fileDiagnostics.length}
                                        </Badge>
                                    </button>
                                    
                                    {!collapsedFiles.has(path) && (
                                        <div className="flex flex-col">
                                            {fileDiagnostics.map(diag => (
                                                <DiagnosticRow 
                                                    key={diag.id} 
                                                    diagnostic={diag} 
                                                    onClick={() => navigateToDiagnostic(diag)}
                                                    showFile={false}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            diagnostics.map(diag => (
                                <DiagnosticRow 
                                    key={diag.id} 
                                    diagnostic={diag} 
                                    onClick={() => navigateToDiagnostic(diag)}
                                    showFile={true}
                                />
                            ))
                        )}
                    </div>
                )}
            </ScrollableArea>
        </div>
        </ProfilerWrapper>
    );
}

function FilterButton({ 
    icon: Icon, 
    count, 
    isActive, 
    onClick, 
    activeClass,
    label
}: { 
    icon: React.ElementType, 
    count: number, 
    isActive: boolean, 
    onClick: () => void,
    activeClass: string,
    label: string
}) {
    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={onClick}
            className={cn(
                "h-7 px-2 gap-1.5 text-xs transition-colors",
                isActive ? activeClass : "text-muted-foreground hover:text-foreground hover:bg-muted",
                !isActive && count > 0 && "text-foreground"
            )}
            title={`Toggle ${label}`}
        >
            <Icon className="w-3.5 h-3.5" />
            <span>{count}</span>
        </Button>
    );
}

function DiagnosticRow({ 
    diagnostic, 
    onClick, 
    showFile 
}: { 
    diagnostic: Diagnostic, 
    onClick: () => void, 
    showFile: boolean 
}) {
    const { trackInteraction } = useProfiler('DiagnosticRow');
    const Icon = diagnostic.severity === 'error' ? AlertCircle :
                 diagnostic.severity === 'warning' ? AlertTriangle :
                 diagnostic.severity === 'info' ? Info : Info;
    
    const iconColor = diagnostic.severity === 'error' ? 'text-red-500' :
                      diagnostic.severity === 'warning' ? 'text-yellow-500' :
                      diagnostic.severity === 'info' ? 'text-blue-500' : 'text-muted-foreground';

    const handleClick = () => {
        trackInteraction('diagnostic_clicked', {
            severity: diagnostic.severity,
            source: diagnostic.source,
            code: diagnostic.code?.toString() || 'none'
        });
        onClick();
    };

    return (
        <button
            onClick={handleClick}
            className="flex items-start gap-2 px-3 py-1.5 hover:bg-muted/40 text-left w-full group transition-colors border-l-[3px] border-transparent hover:border-primary/20"
        >
            <Icon className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", iconColor)} />
            <div className="flex flex-col gap-0.5 overflow-hidden w-full">
                <div className="flex items-center gap-2 text-xs">
                    <span className="text-foreground truncate font-medium">
                        {diagnostic.message}
                    </span>
                    {diagnostic.code && (
                        <span className="text-muted-foreground/60 shrink-0 text-[10px]">
                            {diagnostic.code}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground truncate">
                    {showFile && (
                        <>
                            <span className="truncate hover:text-foreground transition-colors" title={diagnostic.filePath}>
                                {diagnostic.fileName}
                            </span>
                            <span className="opacity-50">•</span>
                        </>
                    )}
                    <span className="font-mono opacity-70">
                        Ln {diagnostic.range.startLine + 1}, Col {diagnostic.range.startColumn + 1}
                    </span>
                    <span className="opacity-50">•</span>
                    <span className="opacity-70 capitalize">{diagnostic.source}</span>
                </div>
            </div>
        </button>
    );
}
