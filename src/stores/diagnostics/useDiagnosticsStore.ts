import { create } from 'zustand';
import { FrontendProfiler } from '@/lib/services/FrontendProfiler';

// ============================================================================
// Types
// ============================================================================

export interface Diagnostic {
    id: string;
    uri: string;
    filePath: string;
    fileName: string;
    severity: 'error' | 'warning' | 'info' | 'hint';
    message: string;
    code?: string | number;
    source: 'csharp-ls' | 'typescript' | 'build' | string;
    range: {
        startLine: number;
        startColumn: number;
        endLine: number;
        endColumn: number;
    };
}

export interface DiagnosticsFilter {
    severity: ('error' | 'warning' | 'info' | 'hint')[];
    source: string | null;
    searchQuery: string;
}

export interface DiagnosticsState {
    // All diagnostics indexed by file path
    diagnosticsByFile: Map<string, Diagnostic[]>;
    
    // Aggregated build diagnostics (from dotnet build output)
    buildDiagnostics: Diagnostic[];
    
    // Filtering state
    filter: DiagnosticsFilter;
    
    // Navigation state
    currentDiagnosticIndex: number;
    
    // Computed getters
    getAllDiagnostics: () => Diagnostic[];
    getFilteredDiagnostics: () => Diagnostic[];
    getCounts: () => { errors: number; warnings: number; info: number };
    
    // Actions
    setDiagnostics: (filePath: string, diagnostics: Diagnostic[]) => void;
    clearDiagnostics: (filePath: string) => void;
    setBuildDiagnostics: (diagnostics: Diagnostic[]) => void;
    clearBuildDiagnostics: () => void;
    setFilter: (filter: Partial<DiagnosticsFilter>) => void;
    navigateToDiagnostic: (diagnostic: Diagnostic) => Promise<void>;
    goToNextDiagnostic: () => void;
    goToPreviousDiagnostic: () => void;
    reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialFilter: DiagnosticsFilter = {
    severity: ['error', 'warning', 'info', 'hint'],
    source: null,
    searchQuery: '',
};

// ============================================================================
// Store
// ============================================================================

export const useDiagnosticsStore = create<DiagnosticsState>((set, get) => ({
    // State
    diagnosticsByFile: new Map(),
    buildDiagnostics: [],
    filter: initialFilter,
    currentDiagnosticIndex: -1,

    // Computed getters
    getAllDiagnostics: () => {
        const { diagnosticsByFile, buildDiagnostics } = get();
        
        // Combine all LSP diagnostics from all files
        const allLspDiagnostics: Diagnostic[] = [];
        diagnosticsByFile.forEach((diagnostics) => {
            allLspDiagnostics.push(...diagnostics);
        });

        // Combine with build diagnostics (avoiding duplicates by checking id)
        const lspIds = new Set(allLspDiagnostics.map(d => d.id));
        const uniqueBuildDiagnostics = buildDiagnostics.filter(d => !lspIds.has(d.id));

        return [...allLspDiagnostics, ...uniqueBuildDiagnostics];
    },

    getFilteredDiagnostics: () => {
        const { getAllDiagnostics, filter } = get();
        const allDiagnostics = getAllDiagnostics();

        return allDiagnostics.filter((diagnostic) => {
            // Filter by severity
            if (!filter.severity.includes(diagnostic.severity)) {
                return false;
            }

            // Filter by source
            if (filter.source && diagnostic.source !== filter.source) {
                return false;
            }

            // Filter by search query
            if (filter.searchQuery) {
                const query = filter.searchQuery.toLowerCase();
                const matchesMessage = diagnostic.message.toLowerCase().includes(query);
                const matchesFile = diagnostic.fileName.toLowerCase().includes(query);
                const matchesPath = diagnostic.filePath.toLowerCase().includes(query);
                const matchesCode = diagnostic.code?.toString().toLowerCase().includes(query);
                
                if (!matchesMessage && !matchesFile && !matchesPath && !matchesCode) {
                    return false;
                }
            }

            return true;
        });
    },

    getCounts: () => {
        const { getAllDiagnostics } = get();
        const allDiagnostics = getAllDiagnostics();

        return allDiagnostics.reduce(
            (counts, diagnostic) => {
                if (diagnostic.severity === 'error') {
                    counts.errors++;
                } else if (diagnostic.severity === 'warning') {
                    counts.warnings++;
                } else if (diagnostic.severity === 'info') {
                    counts.info++;
                }
                return counts;
            },
            { errors: 0, warnings: 0, info: 0 }
        );
    },

    // Actions
    setDiagnostics: (filePath: string, diagnostics: Diagnostic[]) => {
        set((state) => {
            const newMap = new Map(state.diagnosticsByFile);
            
            if (diagnostics.length === 0) {
                // Remove entry if no diagnostics
                newMap.delete(filePath);
            } else {
                newMap.set(filePath, diagnostics);
            }

            return { diagnosticsByFile: newMap };
        });
    },

    clearDiagnostics: (filePath: string) => {
        set((state) => {
            const newMap = new Map(state.diagnosticsByFile);
            newMap.delete(filePath);
            return { diagnosticsByFile: newMap };
        });
    },

    setBuildDiagnostics: (diagnostics: Diagnostic[]) => {
        set({ buildDiagnostics: diagnostics });
    },

    clearBuildDiagnostics: () => {
        set({ buildDiagnostics: [] });
    },

    setFilter: (filterUpdate: Partial<DiagnosticsFilter>) => {
        set((state) => ({
            filter: { ...state.filter, ...filterUpdate },
            // Reset navigation index when filter changes
            currentDiagnosticIndex: -1,
        }));
    },

    navigateToDiagnostic: async (diagnostic: Diagnostic) => {
        const span = FrontendProfiler.startSpan('navigate_to_diagnostic', 'frontend_interaction');
        try {
            // Import dynamically to avoid circular dependency
            const { useEditorStore } = await import('../editor/useEditorStore');
            
            await useEditorStore.getState().openFile(diagnostic.filePath, {
                line: diagnostic.range.startLine,
                column: diagnostic.range.startColumn,
            });

            // Update current index
            const { getFilteredDiagnostics } = get();
            const filteredDiagnostics = getFilteredDiagnostics();
            const index = filteredDiagnostics.findIndex(d => d.id === diagnostic.id);
            
            if (index !== -1) {
                set({ currentDiagnosticIndex: index });
            }

            await span.end({
                severity: diagnostic.severity,
                source: diagnostic.source,
                filePath: diagnostic.filePath,
                line: diagnostic.range.startLine.toString(),
                foundIndex: (index !== -1).toString()
            });
        } catch (error) {
            await span.end({ 
                error: error instanceof Error ? error.message : 'Unknown error' 
            });
            throw error;
        }
    },

    goToNextDiagnostic: () => {
        const { getFilteredDiagnostics, navigateToDiagnostic, currentDiagnosticIndex } = get();
        const filteredDiagnostics = getFilteredDiagnostics();

        if (filteredDiagnostics.length === 0) return;

        // Calculate next index (wrap around)
        const nextIndex = (currentDiagnosticIndex + 1) % filteredDiagnostics.length;
        const nextDiagnostic = filteredDiagnostics[nextIndex];

        if (nextDiagnostic) {
            navigateToDiagnostic(nextDiagnostic);
        }
    },

    goToPreviousDiagnostic: () => {
        const { getFilteredDiagnostics, navigateToDiagnostic, currentDiagnosticIndex } = get();
        const filteredDiagnostics = getFilteredDiagnostics();

        if (filteredDiagnostics.length === 0) return;

        // Calculate previous index (wrap around)
        const prevIndex = currentDiagnosticIndex <= 0 
            ? filteredDiagnostics.length - 1 
            : currentDiagnosticIndex - 1;
        const prevDiagnostic = filteredDiagnostics[prevIndex];

        if (prevDiagnostic) {
            navigateToDiagnostic(prevDiagnostic);
        }
    },

    reset: () => {
        set({
            diagnosticsByFile: new Map(),
            buildDiagnostics: [],
            filter: initialFilter,
            currentDiagnosticIndex: -1,
        });
    },
}));
