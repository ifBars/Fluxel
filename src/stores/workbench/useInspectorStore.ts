import { create } from 'zustand';
import type {
    SelectedElement,
    HoveredElement,
    ElementNode,
    StyleChange,
    TextChange,
    SourceLocation,
} from '@/lib/inspector/inspectorMessages';
import {
    applyStylesToSource,
    hasApplicableChanges as checkApplicableChanges,
    getApplicableChangesCount,
    type ApplyResult,
} from '@/lib/inspector/StyleApplicator';
import {
    applyTextToSource,
    type TextChangeWithLocation,
} from '@/lib/inspector/TextApplicator';

// ============================================================================
// Types
// ============================================================================

export type InspectorTab = 'design' | 'css';

export interface PendingChange {
    id: string;
    type: 'style' | 'text';
    change: (StyleChange | TextChange) & { sourceLocation?: SourceLocation };
    timestamp: number;
}

export interface InspectorState {
    // Panel state
    isInspectorOpen: boolean;
    isInspectorMode: boolean;
    activeTab: InspectorTab;

    // Selection state
    selectedElement: SelectedElement | null;
    hoveredElement: HoveredElement | null;

    // Component tree
    componentTree: ElementNode[];
    expandedNodes: Set<string>;

    // Pending changes (for undo/redo and batch apply)
    pendingChanges: PendingChange[];
    isApplying: boolean;

    // Iframe reference (stored here so InspectorPanel can access it)
    iframeRef: React.RefObject<HTMLIFrameElement> | null;

    // Actions - Panel
    toggleInspector: () => void;
    setInspectorOpen: (open: boolean) => void;
    setInspectorMode: (active: boolean) => void;
    setActiveTab: (tab: InspectorTab) => void;

    // Actions - Iframe
    setIframeRef: (ref: React.RefObject<HTMLIFrameElement> | null) => void;

    // Actions - Selection
    selectElement: (element: SelectedElement | null) => void;
    setHoveredElement: (element: HoveredElement | null) => void;
    updateSelectedElementStyle: (property: string, value: string) => void;

    // Actions - Tree
    setComponentTree: (tree: ElementNode[]) => void;
    toggleNodeExpanded: (nodeId: string) => void;
    expandToNode: (nodeId: string) => void;

    // Actions - Changes
    addPendingChange: (change: PendingChange) => void;
    clearPendingChanges: () => void;
    removePendingChange: (id: string) => void;
    applyPendingChanges: (options?: {
        checkDirty?: (filePath: string) => boolean;
        onFileModified?: (filePath: string, newContent: string) => void;
    }) => Promise<ApplyResult>;
    hasApplicableChanges: () => boolean;
    getApplicableCount: () => number;

    // Actions - Reset
    reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
    isInspectorOpen: false,
    isInspectorMode: false,
    activeTab: 'design' as InspectorTab,
    selectedElement: null,
    hoveredElement: null,
    componentTree: [],
    expandedNodes: new Set<string>(),
    pendingChanges: [],
    isApplying: false,
    iframeRef: null,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a pending change has a text source location
 */
function hasTextSourceLocation(change: PendingChange): boolean {
    if (change.type !== 'text') return false;
    const textChange = change.change as TextChange & { sourceLocation?: SourceLocation };
    return !!(textChange.sourceLocation?.file && textChange.sourceLocation?.line);
}

// ============================================================================
// Store
// ============================================================================

export const useInspectorStore = create<InspectorState>((set, get) => ({
    ...initialState,

    // Panel actions
    toggleInspector: () =>
        set((state) => ({
            isInspectorOpen: !state.isInspectorOpen,
            // If closing, also disable inspector mode
            isInspectorMode: !state.isInspectorOpen ? state.isInspectorMode : false,
        })),

    setInspectorOpen: (open) =>
        set({
            isInspectorOpen: open,
            // If closing, also disable inspector mode
            isInspectorMode: open ? get().isInspectorMode : false,
        }),

    setInspectorMode: (active) =>
        set({
            isInspectorMode: active,
            // Clear hover state when disabling
            hoveredElement: active ? get().hoveredElement : null,
        }),

    setActiveTab: (tab) => set({ activeTab: tab }),

    // Iframe action
    setIframeRef: (ref) => set({ iframeRef: ref }),

    // Selection actions
    selectElement: (element) =>
        set({
            selectedElement: element,
            // Clear hover when selecting
            hoveredElement: null,
        }),

    setHoveredElement: (element) => set({ hoveredElement: element }),

    updateSelectedElementStyle: (property, value) =>
        set((state) => {
            if (!state.selectedElement) return state;
            return {
                selectedElement: {
                    ...state.selectedElement,
                    computedStyles: {
                        ...state.selectedElement.computedStyles,
                        [property]: value,
                    },
                },
            };
        }),

    // Tree actions
    setComponentTree: (tree) => set({ componentTree: tree }),

    toggleNodeExpanded: (nodeId) =>
        set((state) => {
            const newExpanded = new Set(state.expandedNodes);
            if (newExpanded.has(nodeId)) {
                newExpanded.delete(nodeId);
            } else {
                newExpanded.add(nodeId);
            }
            return { expandedNodes: newExpanded };
        }),

    expandToNode: (nodeId) =>
        set((state) => {
            const newExpanded = new Set(state.expandedNodes);
            // Find all parent nodes and expand them
            const findAndExpandParents = (
                nodes: ElementNode[],
                targetId: string,
                parents: string[] = []
            ): string[] | null => {
                for (const node of nodes) {
                    if (node.id === targetId) {
                        return parents;
                    }
                    if (node.children.length > 0) {
                        const result = findAndExpandParents(node.children, targetId, [
                            ...parents,
                            node.id,
                        ]);
                        if (result) return result;
                    }
                }
                return null;
            };

            const parents = findAndExpandParents(state.componentTree, nodeId);
            if (parents) {
                parents.forEach((id) => newExpanded.add(id));
            }
            newExpanded.add(nodeId);
            return { expandedNodes: newExpanded };
        }),

    // Change tracking actions
    addPendingChange: (change) =>
        set((state) => ({
            pendingChanges: [...state.pendingChanges, change],
        })),

    clearPendingChanges: () => set({ pendingChanges: [] }),

    removePendingChange: (id) =>
        set((state) => ({
            pendingChanges: state.pendingChanges.filter((c) => c.id !== id),
        })),

    applyPendingChanges: async (options) => {
        const { pendingChanges } = get();
        set({ isApplying: true });

        try {
            // Separate style and text changes
            const styleChanges = pendingChanges.filter(c => c.type === 'style');
            const textChanges = pendingChanges.filter(c => c.type === 'text');

            let totalApplied = 0;
            const allErrors: any[] = [];
            const allFilesModified: string[] = [];

            // Apply style changes
            if (styleChanges.length > 0) {
                const styleResult = await applyStylesToSource(styleChanges, {
                    checkDirty: options?.checkDirty,
                    onFileModified: options?.onFileModified,
                });
                totalApplied += styleResult.changesApplied;
                allErrors.push(...styleResult.errors);
                allFilesModified.push(...styleResult.filesModified);
            }

            // Apply text changes
            for (const textChange of textChanges) {
                if (textChange.type === 'text' && hasTextSourceLocation(textChange)) {
                    const textResult = await applyTextToSource(
                        textChange.change as TextChangeWithLocation,
                        {
                            checkDirty: options?.checkDirty,
                            onFileModified: options?.onFileModified,
                        }
                    );
                    totalApplied += textResult.changesApplied;
                    allErrors.push(...textResult.errors);
                    allFilesModified.push(...textResult.filesModified);
                }
            }

            // Clear successfully applied changes
            if (totalApplied > 0) {
                set({ pendingChanges: [] });
            }

            return {
                success: allErrors.length === 0,
                filesModified: [...new Set(allFilesModified)],
                errors: allErrors,
                changesApplied: totalApplied,
            };
        } finally {
            set({ isApplying: false });
        }
    },

    hasApplicableChanges: () => {
        const { pendingChanges } = get();
        return checkApplicableChanges(pendingChanges);
    },

    getApplicableCount: () => {
        const { pendingChanges } = get();
        return getApplicableChangesCount(pendingChanges);
    },

    // Reset
    reset: () => set(initialState),
}));
