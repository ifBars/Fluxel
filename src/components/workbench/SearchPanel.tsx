import { useState, useMemo, memo, useCallback, useDeferredValue } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ChevronDown, File, Loader2, AlertCircle, Search as SearchIcon } from 'lucide-react';
import { useProjectStore, useEditorStore } from '@/stores';

interface SearchMatch {
    file_path: string;
    line_number: number;
    line_content: string;
    match_start: number;
    match_end: number;
}

interface SearchResult {
    matches: SearchMatch[];
    total_files_searched: number;
    total_matches: number;
}

// Memoized result item to prevent unnecessary re-renders
const SearchResultItem = memo(function SearchResultItem({
    group,
    isExpanded,
    onToggle,
    onMatchClick,
}: {
    group: { filePath: string; matches: SearchMatch[] };
    isExpanded: boolean;
    onToggle: (filePath: string) => void;
    onMatchClick: (match: SearchMatch) => void;
}) {
    const fileName = useMemo(() => group.filePath.split(/[\\/]/).pop() || group.filePath, [group.filePath]);
    const fileDir = useMemo(() => {
        const parts = group.filePath.split(/[\\/]/);
        parts.pop();
        return parts.join('/');
    }, [group.filePath]);

    return (
        <div className="select-none">
            <button
                onClick={() => onToggle(group.filePath)}
                className="w-full flex items-center gap-1.5 px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors group"
            >
                <span className="w-4 h-4 flex items-center justify-center shrink-0">
                    {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                </span>
                <File className="w-4 h-4 text-primary/70 shrink-0" />
                <span className="text-left flex-1 min-w-0 overflow-hidden">
                    <span className="block truncate text-foreground/90 group-hover:text-foreground">
                        {fileName}
                    </span>
                    {fileDir && (
                        <span className="block truncate text-muted-foreground text-xs">
                            {fileDir}
                        </span>
                    )}
                </span>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                    {group.matches.length}
                </span>
            </button>

            {isExpanded && (
                <div className="pl-8">
                    {group.matches.map((match, idx) => (
                        <button
                            key={`${match.file_path}-${match.line_number}-${idx}`}
                            onClick={() => onMatchClick(match)}
                            className="w-full text-left px-3 py-1 text-xs hover:bg-muted/30 transition-colors group"
                        >
                            <div className="flex items-start gap-2">
                                <span className="text-muted-foreground shrink-0 min-w-[3ch] text-right">
                                    {match.line_number}
                                </span>
                                <span 
                                    className="flex-1 min-w-0 truncate font-mono text-foreground/80 group-hover:text-foreground" 
                                    title={match.line_content}
                                >
                                    {match.line_content}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
});

export default function SearchPanel() {
    const currentProject = useProjectStore((state) => state.currentProject);
    const openFile = useEditorStore((state) => state.openFile);
    const [query, setQuery] = useState('');
    const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());

    const searchTerm = useDeferredValue(query.trim());
    const hasSearchInput = query.trim().length > 0;
    const canSearch = Boolean(currentProject && searchTerm.length >= 2);

    const searchResultsQuery = useQuery({
        queryKey: ['workspace-search', currentProject?.rootPath ?? '', searchTerm],
        enabled: canSearch,
        staleTime: 10_000,
        queryFn: async () => {
            if (!currentProject) {
                throw new Error('No project open');
            }

            return invoke<SearchResult>('search_files', {
                query: searchTerm,
                rootPath: currentProject.rootPath,
                maxResults: 100,
            });
        },
    });

    const results = canSearch ? searchResultsQuery.data ?? null : null;
    const isLoading = canSearch && searchResultsQuery.isPending;
    const error = canSearch && searchResultsQuery.isError
        ? (searchResultsQuery.error instanceof Error ? searchResultsQuery.error.message : 'Search failed')
        : null;

    // Stable callbacks to prevent re-renders
    const toggleFile = useCallback((filePath: string) => {
        setCollapsedFiles(prev => {
            const next = new Set(prev);
            if (next.has(filePath)) {
                next.delete(filePath);
            } else {
                next.add(filePath);
            }
            return next;
        });
    }, []);

    const handleMatchClick = useCallback(async (match: SearchMatch) => {
        // Use requestAnimationFrame to defer file opening and prevent layout jitter
        requestAnimationFrame(() => {
            openFile(match.file_path, {
                line: match.line_number,
                column: (match.match_start ?? 0) + 1,
            });
        });
    }, [openFile]);

    // Memoize grouped results to prevent re-computation
    const groupedResults = useMemo(() => {
        if (!results || results.matches.length === 0) return [];

        const groups = new Map<string, SearchMatch[]>();

        for (const match of results.matches) {
            const existing = groups.get(match.file_path) || [];
            existing.push(match);
            groups.set(match.file_path, existing);
        }

        return Array.from(groups.entries())
            .map(([filePath, matches]) => ({
                filePath,
                matches: matches.sort((a, b) => a.line_number - b.line_number),
            }))
            .sort((a, b) => a.filePath.localeCompare(b.filePath));
    }, [results]);

    if (!currentProject) {
        return (
            <div className="h-full min-h-0 min-w-0 flex flex-col overflow-hidden">
                <div className="flex-1 flex items-center justify-center p-4 text-sm text-muted-foreground text-center">
                    <div>
                        <p>No project open</p>
                        <p className="text-xs mt-2 opacity-70">
                            Open a folder to search files
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full min-h-0 min-w-0 flex flex-col overflow-hidden">
            {/* Search Input */}
            <div className="p-3 border-b border-border shrink-0">
                <div className="relative">
                    <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setCollapsedFiles(new Set());
                        }}
                        placeholder="Search files..."
                        className="w-full pl-8 pr-3 py-1.5 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        autoFocus
                    />
                </div>
                {hasSearchInput && searchTerm.length < 2 && (
                    <p className="text-xs text-muted-foreground mt-1.5 px-1">
                        Type at least 2 characters to search
                    </p>
                )}
            </div>

            {/* Results */}
            <div className="flex-1 min-h-0 overflow-auto overscroll-contain" style={{ scrollbarGutter: 'stable' }}>
                {isLoading && (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
                    </div>
                )}

                {error && (
                    <div className="flex items-center gap-2 p-4 text-sm text-destructive">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {!isLoading && !error && searchTerm.length >= 2 && results && (
                    <>
                        {results.total_matches === 0 ? (
                            <div className="p-4 text-sm text-muted-foreground text-center">
                                <p>No matches found</p>
                                <p className="text-xs mt-1 opacity-70">
                                    Searched {results.total_files_searched} file{results.total_files_searched !== 1 ? 's' : ''}
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Results Summary */}
                                <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border sticky top-0 bg-background z-10">
                                    {results.total_matches} match{results.total_matches !== 1 ? 'es' : ''} in {groupedResults.length} file{groupedResults.length !== 1 ? 's' : ''}
                                    {results.total_matches >= 100 && (
                                        <span className="ml-1 text-orange-500">(limited to 100)</span>
                                    )}
                                </div>

                                {/* File Groups */}
                                <div className="py-1">
                                    {groupedResults.map((group) => (
                                        <SearchResultItem
                                            key={group.filePath}
                                            group={group}
                                            isExpanded={!collapsedFiles.has(group.filePath)}
                                            onToggle={toggleFile}
                                            onMatchClick={handleMatchClick}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </>
                )}

                {!isLoading && !error && !hasSearchInput && (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                        <SearchIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>Search across all project files</p>
                        <p className="text-xs mt-1 opacity-70">
                            Results respect .gitignore
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
