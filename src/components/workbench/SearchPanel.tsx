import { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
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

export default function SearchPanel() {
    const { currentProject } = useProjectStore();
    const { openFile } = useEditorStore();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

    // Debounce search
    useEffect(() => {
        if (!query.trim() || !currentProject) {
            setResults(null);
            setIsLoading(false);
            return;
        }

        // Minimum query length
        if (query.length < 2) {
            setResults(null);
            return;
        }

        const timeoutId = setTimeout(async () => {
            setIsLoading(true);
            setError(null);

            try {
                const searchResult = await invoke<SearchResult>('search_files', {
                    query: query.trim(),
                    rootPath: currentProject.rootPath,
                    maxResults: 1000,
                });

                setResults(searchResult);

                // Auto-expand files with matches
                const filePaths = new Set(searchResult.matches.map(m => m.file_path));
                setExpandedFiles(filePaths);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Search failed');
                setResults(null);
            } finally {
                setIsLoading(false);
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(timeoutId);
    }, [query, currentProject]);

    // Group matches by file
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

    const toggleFile = (filePath: string) => {
        const newExpanded = new Set(expandedFiles);
        if (newExpanded.has(filePath)) {
            newExpanded.delete(filePath);
        } else {
            newExpanded.add(filePath);
        }
        setExpandedFiles(newExpanded);
    };

    const handleMatchClick = async (match: SearchMatch) => {
        await openFile(match.file_path, {
            line: match.line_number,
            // match_start is zero-based; Monaco columns are 1-based
            column: (match.match_start ?? 0) + 1,
        });
    };

    const getFileName = (filePath: string) => {
        return filePath.split(/[\\/]/).pop() || filePath;
    };

    const getFileDirectory = (filePath: string) => {
        const parts = filePath.split(/[\\/]/);
        parts.pop();
        return parts.join('/');
    };

    if (!currentProject) {
        return (
            <div className="p-4 text-sm text-muted-foreground text-center">
                <p>No project open</p>
                <p className="text-xs mt-2 opacity-70">
                    Open a folder to search files
                </p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Search Input */}
            <div className="p-3 border-b border-border">
                <div className="relative">
                    <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search files..."
                        className="w-full pl-8 pr-3 py-1.5 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        autoFocus
                    />
                </div>
                {query.length > 0 && query.length < 2 && (
                    <p className="text-xs text-muted-foreground mt-1.5 px-1">
                        Type at least 2 characters to search
                    </p>
                )}
            </div>

            {/* Results */}
            <div className="flex-1 overflow-auto">
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

                {!isLoading && !error && query.length >= 2 && results && (
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
                                <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border">
                                    {results.total_matches} match{results.total_matches !== 1 ? 'es' : ''} in {groupedResults.length} file{groupedResults.length !== 1 ? 's' : ''}
                                    {results.total_matches >= 1000 && (
                                        <span className="ml-1 text-orange-500">(limited to 1000)</span>
                                    )}
                                </div>

                                {/* File Groups */}
                                <div className="py-1">
                                    {groupedResults.map((group) => {
                                        const isExpanded = expandedFiles.has(group.filePath);
                                        const fileName = getFileName(group.filePath);
                                        const fileDir = getFileDirectory(group.filePath);

                                        return (
                                            <div key={group.filePath} className="select-none">
                                                {/* File Header */}
                                                <button
                                                    onClick={() => toggleFile(group.filePath)}
                                                    className="w-full flex items-center gap-1.5 px-4 py-1.5 text-sm hover:bg-muted/50 transition-colors group"
                                                >
                                                    <span className="w-4 h-4 flex items-center justify-center shrink-0">
                                                        {isExpanded ? (
                                                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                                        ) : (
                                                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                                                        )}
                                                    </span>
                                                    <File className="w-4 h-4 text-primary/70 shrink-0" />
                                                    <span className="truncate text-left flex-1">
                                                        <span className="text-foreground/90 group-hover:text-foreground">
                                                            {fileName}
                                                        </span>
                                                        {fileDir && (
                                                            <span className="text-muted-foreground ml-1 text-xs">
                                                                {fileDir}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground shrink-0">
                                                        {group.matches.length}
                                                    </span>
                                                </button>

                                                {/* Match Lines */}
                                                {isExpanded && (
                                                    <div className="pl-4">
                                                        {group.matches.map((match, idx) => (
                                                            <button
                                                                key={`${match.file_path}-${match.line_number}-${idx}`}
                                                                onClick={() => handleMatchClick(match)}
                                                                className="w-full text-left px-4 py-1.5 text-xs hover:bg-muted/30 transition-colors group"
                                                            >
                                                                <div className="flex items-start gap-2">
                                                                    <span className="text-muted-foreground shrink-0 min-w-[3ch] text-right">
                                                                        {match.line_number}
                                                                    </span>
                                                                    <span className="flex-1 font-mono break-all text-foreground/80 group-hover:text-foreground">
                                                                        {match.line_content}
                                                                    </span>
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </>
                )}

                {!isLoading && !error && query.length === 0 && (
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

