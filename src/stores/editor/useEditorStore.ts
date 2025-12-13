import { create } from 'zustand';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { getFileExtension, getFileName, getLanguageFromExtension } from '@/types/fs';
import { FrontendProfiler } from '@/lib/services/FrontendProfiler';

export interface EditorTab {
    /** Unique identifier for the tab */
    id: string;
    /** Full path to the file */
    path: string;
    /** Display name (filename) */
    filename: string;
    /** Current content in editor */
    content: string;
    /** Original content of the file on disk (for dirty detection) */
    originalContent: string;
    /** Content for the 'original' side of the diff editor (HEAD version) */
    diffBaseContent?: string;
    /** Monaco language identifier */
    language: string;
    /** Editor mode */
    type: 'code' | 'diff';
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

export type EditorAction =
    | 'undo'
    | 'redo'
    | 'cut'
    | 'copy'
    | 'paste'
    | 'selectAll'
    | 'find'
    | 'replace'
    | 'gotoLine'
    | 'formatDocument'
    | 'fold'
    | 'unfold';

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

    /** Pending editor action to be executed by CodeEditor */
    pendingAction: EditorAction | null;

    /** Open a file in a new tab (or focus if already open) */
    openFile: (path: string, position?: EditorPosition) => Promise<void>;
    /** Open a diff viewer for a file */
    openDiff: (path: string, originalContent?: string, modifiedContent?: string) => Promise<void>;
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

    /** Trigger an editor action */
    triggerAction: (action: EditorAction) => void;
    /** Clear pending action */
    clearPendingAction: () => void;
}

/**
 * Generate a unique ID for tabs
 */
function generateId(): string {
    return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Check if a file path is a .gitignore file
 */
function isGitignoreFile(path: string): boolean {
    const normalized = path.replace(/\\/g, '/');
    return normalized.endsWith('/.gitignore') || normalized === '.gitignore';
}

export const useEditorStore = create<EditorState>((set, get) => ({
    tabs: [],
    activeTabId: null,
    pendingReveal: null,
    cursorPosition: null,
    pendingAction: null,

    openFile: async (path: string, position?: EditorPosition) => {
        await FrontendProfiler.profileAsync('openFile', 'file_io', async () => {
        const { tabs, setActiveTab } = get();
        const normalizedPath = path.replace(/\\/g, '/');
        const targetLine = position?.line ?? 1;
        const targetColumn = position?.column ?? 1;

        // Check if file is already open
        const existingTab = tabs.find((t) => t.path === normalizedPath && t.type === 'code');
        if (existingTab) {
                FrontendProfiler.profileSync('setActiveTab', 'frontend_render', () => {
            setActiveTab(existingTab.id);
                });
            set({
                pendingReveal: position
                    ? { tabId: existingTab.id, line: targetLine, column: targetColumn }
                    : null,
            });
            return;
        }

        try {
                const content = await FrontendProfiler.profileAsync('readTextFile', 'file_io', async () => {
                    return await readTextFile(normalizedPath);
                }, { path: normalizedPath });

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
                type: 'code',
            };

                FrontendProfiler.profileSync('addTab', 'frontend_render', () => {
            set((state) => ({
                tabs: [...state.tabs, newTab],
                activeTabId: newTab.id,
                pendingReveal: position
                    ? { tabId: newTab.id, line: targetLine, column: targetColumn }
                    : null,
            }));
                });

                FrontendProfiler.trackInteraction('file_opened', {
                    path: normalizedPath,
                    size: content.length.toString(),
                    language,
                });
        } catch (error) {
            console.error('Failed to open file:', path, error);
        }
        }, { path });
    },

    openDiff: async (path: string, originalContent?: string, modifiedContent?: string) => {
        await FrontendProfiler.profileAsync('openDiff', 'file_io', async () => {
        const { tabs, setActiveTab } = get();
        const normalizedPath = path.replace(/\\/g, '/');

        // Check if diff is already open for this file
        // Note: We intentionally separate code tabs and diff tabs.
        // A user might want both the code editor and the diff view open.
        const existingTab = tabs.find((t) => t.path === normalizedPath && t.type === 'diff');
        if (existingTab) {
                FrontendProfiler.profileSync('setActiveTab', 'frontend_render', () => {
            setActiveTab(existingTab.id);
                });
            // Verify if content needs update?
            // For now, assume if it's open, it's fine.
            return;
        }

        const filename = getFileName(normalizedPath);
        const extension = getFileExtension(normalizedPath);
        const language = getLanguageFromExtension(extension);

        // If modifiedContent is not provided, try to read from disk
        let currentContent = modifiedContent;
        if (currentContent === undefined) {
            try {
                    currentContent = await FrontendProfiler.profileAsync('readTextFile', 'file_io', async () => {
                        return await readTextFile(normalizedPath);
                    }, { path: normalizedPath });
            } catch (e) {
                console.error('Failed to read file for diff:', e);
                throw new Error(`Failed to read file ${normalizedPath}: ${e}`);
            }
        }

        const newTab: EditorTab = {
            id: generateId(),
            path: normalizedPath,
            filename: `${filename} (Diff)`,
            content: currentContent,
            originalContent: currentContent, // Not really used for dirty check in diff mode usually, but consistency
            diffBaseContent: originalContent || '',
            language,
            type: 'diff',
        };

            FrontendProfiler.profileSync('addTab', 'frontend_render', () => {
        set((state) => ({
            tabs: [...state.tabs, newTab],
            activeTabId: newTab.id,
        }));
            });
        }, { path });
    },

    closeTab: (id: string) => {
        FrontendProfiler.profileSync('closeTab', 'frontend_render', () => {
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
        }, { tabId: id });
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
        FrontendProfiler.profileSync('setActiveTab', 'frontend_render', () => {
        set({ activeTabId: id });
        }, { tabId: id });
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
        const tabPath = tab?.path;

        await FrontendProfiler.profileAsync('saveFile', 'file_io', async () => {
        if (!tab) return;

        try {
                await FrontendProfiler.profileAsync('writeTextFile', 'file_io', async () => {
            await writeTextFile(tab.path, tab.content);
                }, { path: tab.path, size: tab.content.length.toString() });

            // Update originalContent to match saved content
            set((state) => ({
                tabs: state.tabs.map((t) =>
                    t.id === id ? { ...t, originalContent: t.content } : t
                ),
            }));

            // If this is a .gitignore file, refresh the file tree
            if (isGitignoreFile(tab.path)) {
                // Import dynamically to avoid circular dependency
                import('./useFileSystemStore').then(({ useFileSystemStore }) => {
                    const { gitignoreManager, refreshIgnoredStatus } = useFileSystemStore.getState();
                    if (gitignoreManager) {
                        gitignoreManager.reset();
                        refreshIgnoredStatus();
                    }
                });
            }
        } catch (error) {
            console.error('Failed to save file:', tab.path, error);
        }
        }, { tabId: id, ...(tabPath && { path: tabPath }) });
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

    triggerAction: (action) => set({ pendingAction: action }),

    clearPendingAction: () => set({ pendingAction: null }),
}));
