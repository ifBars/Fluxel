/**
 * Breakpoint Manager
 * 
 * Manages breakpoint decorations in the Monaco editor and provides
 * utilities for breakpoint operations.
 */

import type * as Monaco from 'monaco-editor';
import { useDebugStore, type Breakpoint } from '@/stores/debug';

// ============================================================================
// Types
// ============================================================================

interface BreakpointDecoration {
    id: string;
    decorationId: string;
    breakpointId: string;
}

// ============================================================================
// Breakpoint Manager
// ============================================================================

export class BreakpointManager {
    private decorations: Map<string, BreakpointDecoration[]> = new Map();
    private editor: Monaco.editor.IStandaloneCodeEditor | null = null;
    private monaco: typeof Monaco | null = null;
    private unsubscribe: (() => void) | null = null;

    /**
     * Initialize the breakpoint manager with a Monaco editor instance
     */
    initialize(monaco: typeof Monaco, editor: Monaco.editor.IStandaloneCodeEditor): void {
        this.monaco = monaco;
        this.editor = editor;

        // Subscribe to breakpoint changes
        this.unsubscribe = useDebugStore.subscribe((state) => {
            this.syncDecorations(state.breakpoints);
        });

        // Initial sync
        this.syncDecorations(useDebugStore.getState().breakpoints);

        // Handle gutter clicks
        this.setupGutterClickHandler();
    }

    /**
     * Dispose the breakpoint manager
     */
    dispose(): void {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this.clearAllDecorations();
        this.editor = null;
        this.monaco = null;
    }

    /**
     * Setup click handler for the editor gutter
     */
    private setupGutterClickHandler(): void {
        if (!this.editor) return;

        this.editor.onMouseDown((e) => {
            if (!e.target.element?.classList.contains('line-numbers')) {
                // Check for glyph margin click
                if (e.target.type !== 2) { // Monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN = 2
                    return;
                }
            }

            const lineNumber = e.target.position?.lineNumber;
            if (!lineNumber) return;

            const model = this.editor?.getModel();
            if (!model) return;

            const filePath = this.getFilePathFromUri(model.uri);
            if (!filePath) return;

            // Toggle breakpoint
            useDebugStore.getState().toggleBreakpoint(filePath, lineNumber);
        });
    }

    /**
     * Sync decorations with the current breakpoints
     */
    private syncDecorations(breakpoints: Breakpoint[]): void {
        if (!this.editor || !this.monaco) return;

        const model = this.editor.getModel();
        if (!model) return;

        const filePath = this.getFilePathFromUri(model.uri);
        if (!filePath) return;

        // Get breakpoints for the current file
        const fileBreakpoints = breakpoints.filter(
            bp => bp.filePath === filePath.replace(/\\/g, '/')
        );

        // Get existing decorations for this file
        const existingDecorations = this.decorations.get(filePath) || [];
        const existingIds = existingDecorations.map(d => d.decorationId);

        // Create new decorations
        const newDecorations: Monaco.editor.IModelDeltaDecoration[] = fileBreakpoints.map(bp => ({
            range: new this.monaco!.Range(bp.line, 1, bp.line, 1),
            options: this.getDecorationOptions(bp),
        }));

        // Apply decorations
        const decorationIds = this.editor.deltaDecorations(existingIds, newDecorations);

        // Update decoration map
        this.decorations.set(filePath, fileBreakpoints.map((bp, i) => ({
            id: crypto.randomUUID(),
            decorationId: decorationIds[i],
            breakpointId: bp.id,
        })));
    }

    /**
     * Get decoration options for a breakpoint
     */
    private getDecorationOptions(bp: Breakpoint): Monaco.editor.IModelDecorationOptions {
        const baseClass = 'breakpoint-decoration';
        let glyphMarginClassName = `${baseClass}-glyph`;
        let lineClassName = `${baseClass}-line`;

        if (!bp.enabled) {
            glyphMarginClassName += ' breakpoint-disabled';
        } else if (bp.condition) {
            glyphMarginClassName += ' breakpoint-conditional';
        } else if (bp.logMessage) {
            glyphMarginClassName += ' breakpoint-logpoint';
        } else if (!bp.verified) {
            glyphMarginClassName += ' breakpoint-unverified';
        }

        return {
            glyphMarginClassName,
            glyphMarginHoverMessage: bp.condition
                ? { value: `Condition: ${bp.condition}` }
                : bp.logMessage
                    ? { value: `Log: ${bp.logMessage}` }
                    : { value: 'Breakpoint' },
            linesDecorationsClassName: lineClassName,
            isWholeLine: false,
            stickiness: 1, // TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
        };
    }

    /**
     * Clear all decorations
     */
    private clearAllDecorations(): void {
        if (!this.editor) return;

        const allDecorationIds: string[] = [];
        this.decorations.forEach(decorations => {
            decorations.forEach(d => allDecorationIds.push(d.decorationId));
        });

        if (allDecorationIds.length > 0) {
            this.editor.deltaDecorations(allDecorationIds, []);
        }

        this.decorations.clear();
    }

    /**
     * Get file path from Monaco URI
     */
    private getFilePathFromUri(uri: Monaco.Uri): string | null {
        // Handle file:// URIs
        let path = uri.path;
        
        // Remove leading slash on Windows paths (e.g., /C:/...)
        if (/^\/[A-Za-z]:/.test(path)) {
            path = path.slice(1);
        }

        return path || null;
    }

    /**
     * Refresh decorations for the current file
     */
    refresh(): void {
        this.syncDecorations(useDebugStore.getState().breakpoints);
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let breakpointManagerInstance: BreakpointManager | null = null;

export function getBreakpointManager(): BreakpointManager {
    if (!breakpointManagerInstance) {
        breakpointManagerInstance = new BreakpointManager();
    }
    return breakpointManagerInstance;
}

export function disposeBreakpointManager(): void {
    if (breakpointManagerInstance) {
        breakpointManagerInstance.dispose();
        breakpointManagerInstance = null;
    }
}

// ============================================================================
// CSS Styles for Breakpoints (add to index.css)
// ============================================================================

/*
.breakpoint-decoration-glyph {
    background-color: #e51400;
    border-radius: 50%;
    width: 10px !important;
    height: 10px !important;
    margin-left: 5px;
    margin-top: 3px;
}

.breakpoint-decoration-glyph.breakpoint-disabled {
    background-color: #848484;
}

.breakpoint-decoration-glyph.breakpoint-conditional {
    background-color: #e51400;
    border: 2px solid #ffffff;
}

.breakpoint-decoration-glyph.breakpoint-logpoint {
    background-color: #e51400;
    border-radius: 2px;
}

.breakpoint-decoration-glyph.breakpoint-unverified {
    background-color: #848484;
    opacity: 0.5;
}

.breakpoint-decoration-line {
    background-color: rgba(229, 20, 0, 0.1);
}
*/

