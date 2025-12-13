import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import { readDir, readTextFile } from '@tauri-apps/plugin-fs';
import type { FileEntry } from '@/types/fs';
import { GitignoreManager } from '@/lib/utils/GitIgnore';
import { FrontendProfiler } from '@/lib/services/FrontendProfiler';

type BackendDirEntry = {
    name: string;
    path: string;
    isDirectory: boolean;
    isIgnored?: boolean;
};

interface FileSystemState {
    /** Root file tree entry */
    rootEntry: FileEntry | null;
    /** Set of expanded folder paths */
    expandedPaths: Set<string>;
    /** Loading state */
    isLoading: boolean;
    /** Error message if any */
    error: string | null;

    /** Load directory structure from a path */
    loadDirectory: (path: string) => Promise<void>;
    /** Load children of a specific folder (lazy loading) */
    loadFolderChildren: (path: string) => Promise<FileEntry[]>;
    /** Toggle folder expanded/collapsed state */
    toggleFolder: (path: string) => void;
    /** Refresh the entire tree */
    refreshTree: () => Promise<void>;
    /** Clear the file tree */
    clearTree: () => void;
    /** Root path of current project */
    rootPath: string | null;
    /** Gitignore manager instance */
    gitignoreManager: GitignoreManager | null;
    /** Refresh ignored status for all files in the tree */
    refreshIgnoredStatus: () => Promise<void>;
}

/**
 * Convert Tauri readDir entries to our FileEntry format
 */
async function readDirectoryEntries(
    path: string,
    workspaceRoot: string | null,
    gitignoreManager: GitignoreManager | null,
    parentIsIgnored?: boolean
): Promise<FileEntry[]> {
    return await FrontendProfiler.profileAsync('readDirectoryEntries', 'file_io', async () => {
        try {
            // Prefer the Rust-side implementation to avoid blocking the UI thread on large folders.
            // If parent is ignored, skip expensive gitignore checking (all children are ignored anyway)
            const entries = await invoke<BackendDirEntry[]>('list_directory_entries', {
                path,
                workspaceRoot,
                maxEntries: 10_000,
                parentIsIgnored: parentIsIgnored ?? false,
            });

            return entries.map((entry) => ({
                name: entry.name,
                path: entry.path.replace(/\\/g, '/'),
                isDirectory: entry.isDirectory,
                children: entry.isDirectory ? undefined : undefined,
                isExpanded: false,
                isIgnored: entry.isIgnored ?? false,
            }));
        } catch (error) {
            console.warn('Rust directory listing failed, falling back to plugin-fs readDir', error);
        }

        // Fallback: use plugin-fs directly (slower for very large folders).
        try {
            const entries = await readDir(path);

            // If parent is ignored, all children are ignored - skip expensive gitignore checking
            const fileEntries: FileEntry[] = await Promise.all(
                entries.map(async (entry) => {
                    const entryPath = `${path}/${entry.name}`.replace(/\\/g, '/');
                    const isIgnored = parentIsIgnored
                        ? true
                        : gitignoreManager
                            ? await gitignoreManager.isIgnored(entryPath, !!entry.isDirectory)
                            : false;

                    return {
                        name: entry.name,
                        path: entryPath,
                        isDirectory: entry.isDirectory,
                        children: entry.isDirectory ? undefined : undefined,
                        isExpanded: false,
                        isIgnored,
                    };
                })
            );

            // Sort: directories first, then alphabetically
            return fileEntries.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
            });
        } catch (error) {
            console.error('Failed to read directory:', path, error);
            return [];
        }
    }, { path, entryCount: 'unknown' });
}

export const useFileSystemStore = create<FileSystemState>((set, get) => ({
    rootEntry: null,
    expandedPaths: new Set(),
    isLoading: false,
    error: null,
    rootPath: null,
    gitignoreManager: null,

    loadDirectory: async (path: string) => {
        const normalizedPath = path.replace(/\\/g, '/');
        const { rootPath, isLoading } = get();

        // Guard: Skip if already loading or if this directory is already loaded
        if (isLoading && rootPath === normalizedPath) {
            return; // Already loading this path
        }
        if (rootPath === normalizedPath && get().rootEntry !== null) {
            return; // Already loaded this path
        }

        await FrontendProfiler.profileAsync('loadDirectory', 'file_io', async () => {
            set({ isLoading: true, error: null });

            try {
                const name = normalizedPath.split('/').pop() ?? 'root';

                // Load directory entries first (Rust backend handles gitignore checking efficiently).
                // GitignoreManager will be created lazily only if needed (fallback path).
                const children = await readDirectoryEntries(normalizedPath, normalizedPath, null, false);

                const rootEntry: FileEntry = {
                    name,
                    path: normalizedPath,
                    isDirectory: true,
                    children,
                    isExpanded: true,
                    isIgnored: false,
                };

                // Batch the state update to avoid multiple re-renders
                // Use flushSync is NOT needed here since we want React to batch this naturally
                set({
                    rootEntry,
                    expandedPaths: new Set([normalizedPath]),
                    isLoading: false,
                    rootPath: normalizedPath,
                    // GitignoreManager is only needed for the JS fallback path (which is rarely used).
                    // Defer creation until actually needed to keep initial load fast.
                    gitignoreManager: null,
                });

                // Note: refreshIgnoredStatus is NOT called here because the Rust backend
                // already sets isIgnored flags during list_directory_entries.
            } catch (error) {
                set({
                    error: error instanceof Error ? error.message : 'Failed to load directory',
                    isLoading: false,
                });
            }
        }, { path });
    },

    loadFolderChildren: async (path: string) => {
        const { gitignoreManager, rootPath, rootEntry } = get();

        // Check if the parent folder is ignored to optimize gitignore checking
        let parentIsIgnored = false;
        if (rootEntry) {
            const findEntry = (entry: FileEntry): FileEntry | null => {
                if (entry.path === path) return entry;
                if (entry.children) {
                    for (const child of entry.children) {
                        const found = findEntry(child);
                        if (found) return found;
                    }
                }
                return null;
            };
            const folder = findEntry(rootEntry);
            parentIsIgnored = folder?.isIgnored ?? false;
        }

        const children = await readDirectoryEntries(path, rootPath, gitignoreManager, parentIsIgnored);

        // Update the tree with loaded children
        const { rootEntry: currentRoot } = get();
        if (currentRoot) {
            const updateChildren = (entry: FileEntry): FileEntry => {
                if (entry.path === path) {
                    return { ...entry, children, isExpanded: true };
                }
                if (entry.children) {
                    return {
                        ...entry,
                        children: entry.children.map(updateChildren),
                    };
                }
                return entry;
            };

            set({ rootEntry: updateChildren(currentRoot) });
        }

        return children;
    },

    toggleFolder: (path: string) => {
        const { expandedPaths, rootEntry, loadFolderChildren } = get();
        const newExpanded = new Set(expandedPaths);
        const isExpanding = !newExpanded.has(path);

        if (isExpanding) {
            FrontendProfiler.profileSync('expandNode', 'workspace', () => {
                newExpanded.add(path);
                // Update UI state immediately so expansion isn't delayed by any async work.
                set({ expandedPaths: newExpanded });
            }, { path });

            if (!rootEntry) return;

            // Load children if not already loaded (fire-and-forget).
            const findEntry = (entry: FileEntry): FileEntry | null => {
                if (entry.path === path) return entry;
                if (entry.children) {
                    for (const child of entry.children) {
                        const found = findEntry(child);
                        if (found) return found;
                    }
                }
                return null;
            };

            const folder = findEntry(rootEntry);
            if (folder && folder.isDirectory && !folder.children) {
                void loadFolderChildren(path);
            }
        } else {
            FrontendProfiler.profileSync('collapseNode', 'workspace', () => {
                newExpanded.delete(path);
                set({ expandedPaths: newExpanded });
            }, { path });
        }
    },

    refreshTree: async () => {
        const { rootEntry, loadDirectory } = get();
        if (rootEntry) {
            await loadDirectory(rootEntry.path);
        }
    },

    clearTree: () => {
        set({
            rootEntry: null,
            expandedPaths: new Set(),
            error: null,
            rootPath: null,
            gitignoreManager: null,
        });
    },

    /**
     * Refresh ignored status for all entries in the tree
     */
    refreshIgnoredStatus: async () => {
        const { rootEntry, gitignoreManager } = get();
        if (!rootEntry || !gitignoreManager) return;

        const updateIgnoredStatus = async (entry: FileEntry): Promise<FileEntry> => {
            const isIgnored = await gitignoreManager.isIgnored(entry.path, entry.isDirectory);
            const updatedEntry = { ...entry, isIgnored };

            if (entry.children) {
                const updatedChildren = await Promise.all(
                    entry.children.map(updateIgnoredStatus)
                );
                return { ...updatedEntry, children: updatedChildren };
            }

            return updatedEntry;
        };

        const updatedRoot = await updateIgnoredStatus(rootEntry);
        set({ rootEntry: updatedRoot });
    },
}));

/**
 * Utility to read file content
 */
export async function readFileContent(path: string): Promise<string> {
    return await readTextFile(path);
}
