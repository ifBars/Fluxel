import { create } from 'zustand';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { getFileExtension, getFileName, getLanguageFromExtension } from '@/types/fs';

export interface EditorTab {
    /** Unique identifier for the tab */
    id: string;
    /** Full path to the file */
    path: string;
    /** Display name (filename) */
    filename: string;
    /** Current content in editor */
    content: string;
    /** Original content when opened (for dirty detection) */
    originalContent: string;
    /** Monaco language identifier */
    language: string;
}

export interface EditorPosition {
    line: number;
    column?: number;
}

export interface CursorPosition {
    line: number;
    column: number;
    selectionLength: number;
}

interface EditorState {
    /** List of open tabs */
    tabs: EditorTab[];
    /** ID of the currently active tab */
    activeTabId: string | null;
    /** Pending selection to reveal after opening a file */
    pendingReveal: {
        tabId: string;
        line: number;
        column: number;
    } | null;
    /** Current cursor position for the active tab */
    cursorPosition: CursorPosition | null;

    /** Open a file in a new tab (or focus if already open) */
    openFile: (path: string, position?: EditorPosition) => Promise<void>;
    /** Close a tab by ID */
    closeTab: (id: string) => void;
    /** Close all tabs except the specified one */
    closeOtherTabs: (id: string) => void;
    /** Close all tabs to the right of the specified one */
    closeTabsToRight: (id: string) => void;
    /** Close all tabs */
    closeAllTabs: () => void;
    /** Set the active tab */
    setActiveTab: (id: string) => void;
    /** Update content for a tab */
    updateContent: (id: string, content: string) => void;
    /** Save the file for a tab */
    saveFile: (id: string) => Promise<void>;
    /** Save all dirty tabs */
    saveAllFiles: () => Promise<void>;

    /** Get the currently active tab */
    getActiveTab: () => EditorTab | null;
    /** Check if a tab has unsaved changes */
    isDirty: (id: string) => boolean;
    /** Clear pending reveal state */
    clearPendingReveal: () => void;
    /** Update cursor position */
    setCursorPosition: (position: CursorPosition | null) => void;
}

/**
 * Generate a unique ID for tabs
 */
function generateId(): string {
    return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useEditorStore = create<EditorState>((set, get) => ({
    tabs: [],
    activeTabId: null,
    pendingReveal: null,
    cursorPosition: null,

    openFile: async (path: string, position?: EditorPosition) => {
        const { tabs, setActiveTab } = get();
        const normalizedPath = path.replace(/\\/g, '/');
        const targetLine = position?.line ?? 1;
        const targetColumn = position?.column ?? 1;

        // Check if file is already open
        const existingTab = tabs.find((t) => t.path === normalizedPath);
        if (existingTab) {
            setActiveTab(existingTab.id);
            set({
                pendingReveal: position
                    ? { tabId: existingTab.id, line: targetLine, column: targetColumn }
                    : null,
            });
            return;
        }

        try {
            const content = await readTextFile(normalizedPath);
            const filename = getFileName(normalizedPath);
            const extension = getFileExtension(normalizedPath);
            const language = getLanguageFromExtension(extension);

            const newTab: EditorTab = {
                id: generateId(),
                path: normalizedPath,
                filename,
                content,
                originalContent: content,
                language,
            };

            set((state) => ({
                tabs: [...state.tabs, newTab],
                activeTabId: newTab.id,
                pendingReveal: position
                    ? { tabId: newTab.id, line: targetLine, column: targetColumn }
                    : null,
            }));
        } catch (error) {
            console.error('Failed to open file:', path, error);
        }
    },

    closeTab: (id: string) => {
        const { tabs, activeTabId } = get();
        const tabIndex = tabs.findIndex((t) => t.id === id);

        if (tabIndex === -1) return;

        const newTabs = tabs.filter((t) => t.id !== id);

        // Determine new active tab
        let newActiveId: string | null = null;
        if (activeTabId === id && newTabs.length > 0) {
            // Activate the next tab, or the previous if closing the last
            const newIndex = Math.min(tabIndex, newTabs.length - 1);
            newActiveId = newTabs[newIndex].id;
        } else if (activeTabId !== id) {
            newActiveId = activeTabId;
        }

        set({ tabs: newTabs, activeTabId: newActiveId });
    },

    closeOtherTabs: (id: string) => {
        const { tabs } = get();
        const tabIndex = tabs.findIndex((t) => t.id === id);

        if (tabIndex === -1) return;

        const targetTab = tabs[tabIndex];
        set({ tabs: [targetTab], activeTabId: targetTab.id });
    },

    closeTabsToRight: (id: string) => {
        const { tabs, activeTabId } = get();
        const tabIndex = tabs.findIndex((t) => t.id === id);

        if (tabIndex === -1) return;

        const remainingTabs = tabs.slice(0, tabIndex + 1);
        const activeTabExists = remainingTabs.some((t) => t.id === activeTabId);
        const newActiveTabId = activeTabExists ? activeTabId : id;

        set({ tabs: remainingTabs, activeTabId: newActiveTabId });
    },

    closeAllTabs: () => {
        set({ tabs: [], activeTabId: null });
    },

    setActiveTab: (id: string) => {
        set({ activeTabId: id });
    },

    updateContent: (id: string, content: string) => {
        set((state) => ({
            tabs: state.tabs.map((tab) =>
                tab.id === id ? { ...tab, content } : tab
            ),
        }));
    },

    saveFile: async (id: string) => {
        const { tabs } = get();
        const tab = tabs.find((t) => t.id === id);

        if (!tab) return;

        try {
            await writeTextFile(tab.path, tab.content);

            // Update originalContent to match saved content
            set((state) => ({
                tabs: state.tabs.map((t) =>
                    t.id === id ? { ...t, originalContent: t.content } : t
                ),
            }));
        } catch (error) {
            console.error('Failed to save file:', tab.path, error);
        }
    },

    saveAllFiles: async () => {
        const { tabs, saveFile, isDirty } = get();
        const dirtyTabs = tabs.filter((t) => isDirty(t.id));

        await Promise.all(dirtyTabs.map((t) => saveFile(t.id)));
    },

    getActiveTab: () => {
        const { tabs, activeTabId } = get();
        return tabs.find((t) => t.id === activeTabId) ?? null;
    },

    isDirty: (id: string) => {
        const { tabs } = get();
        const tab = tabs.find((t) => t.id === id);
        return tab ? tab.content !== tab.originalContent : false;
    },

    clearPendingReveal: () => set({ pendingReveal: null }),

    setCursorPosition: (position) => set({ cursorPosition: position }),
}));
