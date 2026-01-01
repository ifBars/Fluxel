import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

export interface Breakpoint {
    id: string;
    filePath: string;
    line: number;
    column?: number;
    condition?: string;
    hitCount?: number;
    logMessage?: string;
    enabled: boolean;
    verified: boolean; // Whether the debugger has confirmed this breakpoint
}

export type DebugState = 'stopped' | 'running' | 'paused' | 'stepping';

export interface StackFrame {
    id: number;
    name: string;
    filePath: string;
    line: number;
    column: number;
    source?: string;
}

export interface Variable {
    name: string;
    value: string;
    type: string;
    variablesReference: number; // For nested variables
    children?: Variable[];
}

export interface DebugScope {
    name: string;
    variablesReference: number;
    variables: Variable[];
}

export interface DebugSession {
    id: string;
    name: string;
    type: string; // e.g., 'coreclr', 'node', 'python'
    state: DebugState;
    threadId?: number;
}

export interface DebugStoreState {
    // Session state
    session: DebugSession | null;
    
    // Breakpoints (persisted)
    breakpoints: Breakpoint[];
    
    // Runtime state
    callStack: StackFrame[];
    currentFrameId: number | null;
    scopes: DebugScope[];
    
    // Watch expressions
    watchExpressions: string[];
    watchResults: Map<string, string>;
    
    // UI state
    isPanelOpen: boolean;
    activeTab: 'variables' | 'watch' | 'callStack' | 'breakpoints';
    
    // Actions - Session
    startSession: (type: string, name?: string) => void;
    stopSession: () => void;
    pauseSession: () => void;
    resumeSession: () => void;
    stepOver: () => void;
    stepInto: () => void;
    stepOut: () => void;
    
    // Actions - Breakpoints
    addBreakpoint: (filePath: string, line: number, options?: Partial<Breakpoint>) => Breakpoint;
    removeBreakpoint: (id: string) => void;
    toggleBreakpoint: (filePath: string, line: number) => void;
    updateBreakpoint: (id: string, updates: Partial<Breakpoint>) => void;
    enableBreakpoint: (id: string, enabled: boolean) => void;
    clearAllBreakpoints: () => void;
    getBreakpointsForFile: (filePath: string) => Breakpoint[];
    
    // Actions - Watch
    addWatchExpression: (expression: string) => void;
    removeWatchExpression: (expression: string) => void;
    updateWatchResult: (expression: string, result: string) => void;
    
    // Actions - UI
    togglePanel: () => void;
    openPanel: () => void;
    closePanel: () => void;
    setActiveTab: (tab: DebugStoreState['activeTab']) => void;
    
    // Actions - State updates (from debugger)
    setCallStack: (frames: StackFrame[]) => void;
    setCurrentFrame: (frameId: number | null) => void;
    setScopes: (scopes: DebugScope[]) => void;
    setSessionState: (state: DebugState) => void;
}

// ============================================================================
// Store
// ============================================================================

export const useDebugStore = create<DebugStoreState>()(
    persist(
        (set, get) => ({
            // Initial state
            session: null,
            breakpoints: [],
            callStack: [],
            currentFrameId: null,
            scopes: [],
            watchExpressions: [],
            watchResults: new Map(),
            isPanelOpen: false,
            activeTab: 'variables',
            
            // ================================================================
            // Session Actions
            // ================================================================
            
            startSession: (type: string, name?: string) => {
                const session: DebugSession = {
                    id: crypto.randomUUID(),
                    name: name || `Debug Session`,
                    type,
                    state: 'running',
                };
                set({ 
                    session,
                    isPanelOpen: true,
                    callStack: [],
                    currentFrameId: null,
                    scopes: [],
                });
                console.log('[Debug] Session started:', session);
            },
            
            stopSession: () => {
                set({ 
                    session: null,
                    callStack: [],
                    currentFrameId: null,
                    scopes: [],
                });
                console.log('[Debug] Session stopped');
            },
            
            pauseSession: () => {
                set(state => ({
                    session: state.session 
                        ? { ...state.session, state: 'paused' }
                        : null,
                }));
            },
            
            resumeSession: () => {
                set(state => ({
                    session: state.session 
                        ? { ...state.session, state: 'running' }
                        : null,
                    callStack: [],
                    currentFrameId: null,
                    scopes: [],
                }));
            },
            
            stepOver: () => {
                set(state => ({
                    session: state.session 
                        ? { ...state.session, state: 'stepping' }
                        : null,
                }));
                console.log('[Debug] Step over');
            },
            
            stepInto: () => {
                set(state => ({
                    session: state.session 
                        ? { ...state.session, state: 'stepping' }
                        : null,
                }));
                console.log('[Debug] Step into');
            },
            
            stepOut: () => {
                set(state => ({
                    session: state.session 
                        ? { ...state.session, state: 'stepping' }
                        : null,
                }));
                console.log('[Debug] Step out');
            },
            
            // ================================================================
            // Breakpoint Actions
            // ================================================================
            
            addBreakpoint: (filePath: string, line: number, options?: Partial<Breakpoint>) => {
                const breakpoint: Breakpoint = {
                    id: crypto.randomUUID(),
                    filePath: filePath.replace(/\\/g, '/'),
                    line,
                    enabled: true,
                    verified: false,
                    ...options,
                };
                
                set(state => ({
                    breakpoints: [...state.breakpoints, breakpoint],
                }));
                
                console.log('[Debug] Breakpoint added:', breakpoint);
                return breakpoint;
            },
            
            removeBreakpoint: (id: string) => {
                set(state => ({
                    breakpoints: state.breakpoints.filter(bp => bp.id !== id),
                }));
                console.log('[Debug] Breakpoint removed:', id);
            },
            
            toggleBreakpoint: (filePath: string, line: number) => {
                const normalizedPath = filePath.replace(/\\/g, '/');
                const { breakpoints, addBreakpoint, removeBreakpoint } = get();
                
                const existing = breakpoints.find(
                    bp => bp.filePath === normalizedPath && bp.line === line
                );
                
                if (existing) {
                    removeBreakpoint(existing.id);
                } else {
                    addBreakpoint(filePath, line);
                }
            },
            
            updateBreakpoint: (id: string, updates: Partial<Breakpoint>) => {
                set(state => ({
                    breakpoints: state.breakpoints.map(bp =>
                        bp.id === id ? { ...bp, ...updates } : bp
                    ),
                }));
            },
            
            enableBreakpoint: (id: string, enabled: boolean) => {
                set(state => ({
                    breakpoints: state.breakpoints.map(bp =>
                        bp.id === id ? { ...bp, enabled } : bp
                    ),
                }));
            },
            
            clearAllBreakpoints: () => {
                set({ breakpoints: [] });
                console.log('[Debug] All breakpoints cleared');
            },
            
            getBreakpointsForFile: (filePath: string) => {
                const normalizedPath = filePath.replace(/\\/g, '/');
                return get().breakpoints.filter(bp => bp.filePath === normalizedPath);
            },
            
            // ================================================================
            // Watch Actions
            // ================================================================
            
            addWatchExpression: (expression: string) => {
                if (!expression.trim()) return;
                set(state => ({
                    watchExpressions: [...state.watchExpressions, expression.trim()],
                }));
            },
            
            removeWatchExpression: (expression: string) => {
                set(state => ({
                    watchExpressions: state.watchExpressions.filter(e => e !== expression),
                    watchResults: (() => {
                        const newMap = new Map(state.watchResults);
                        newMap.delete(expression);
                        return newMap;
                    })(),
                }));
            },
            
            updateWatchResult: (expression: string, result: string) => {
                set(state => {
                    const newMap = new Map(state.watchResults);
                    newMap.set(expression, result);
                    return { watchResults: newMap };
                });
            },
            
            // ================================================================
            // UI Actions
            // ================================================================
            
            togglePanel: () => set(state => ({ isPanelOpen: !state.isPanelOpen })),
            openPanel: () => set({ isPanelOpen: true }),
            closePanel: () => set({ isPanelOpen: false }),
            setActiveTab: (tab) => set({ activeTab: tab }),
            
            // ================================================================
            // State Update Actions (from debugger)
            // ================================================================
            
            setCallStack: (frames: StackFrame[]) => {
                set({ 
                    callStack: frames,
                    currentFrameId: frames.length > 0 ? frames[0].id : null,
                });
            },
            
            setCurrentFrame: (frameId: number | null) => {
                set({ currentFrameId: frameId });
            },
            
            setScopes: (scopes: DebugScope[]) => {
                set({ scopes });
            },
            
            setSessionState: (state: DebugState) => {
                set(prev => ({
                    session: prev.session 
                        ? { ...prev.session, state }
                        : null,
                }));
            },
        }),
        {
            name: 'fluxel-debug',
            partialize: (state) => ({
                breakpoints: state.breakpoints,
                watchExpressions: state.watchExpressions,
            }),
        }
    )
);

