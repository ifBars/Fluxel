import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import { readDir, readTextFile } from '@tauri-apps/plugin-fs';
import type { FileEntry } from '@/types/fs';
import { GitignoreManager } from '@/lib/utils/GitIgnore';
import { FrontendProfiler } from '@/lib/services/FrontendProfiler';

type BackendDirEntry = {
    name: string;
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
    loadDirectory: (path: string, traceParent?: string) => Promise<void>;
    /** Load children of a specific folder (lazy loading) */
    loadFolderChildren: (path: string, traceParent?: string) => Promise<FileEntry[]>;
    /** Toggle folder expanded/collapsed state */
    toggleFolder: (path: string, traceParent?: string) => Promise<void>;
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
    /** Internal: Map of path to entry for O(1) lookups */
    _pathToEntryMap: Map<string, FileEntry> | null;
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
    const span = FrontendProfiler.startSpan('readDirectoryEntries', 'file_io');

    try {
        let results: FileEntry[] = [];
        let usedBackend = 'fallback';
        let dirCount = 0;
        let fileCount = 0;
        let ignoredCount = 0;

        try {
            // Prefer the Rust-side implementation to avoid blocking the UI thread on large folders.
            const invokeSpan = FrontendProfiler.startSpan('invoke:list_directory_entries', 'file_io');

            // Prepare invoke args (minimal overhead, no separate span needed)
            const invokeArgs = {
                path,
                workspaceRoot,
                maxEntries: 10_000,
                parentIsIgnored: parentIsIgnored ?? false,
                traceParent: invokeSpan.id,
            };

            // Profile the actual IPC call (includes Tauri's internal serialization/deserialization)
            // This measures the full round-trip time including:
            // - Tauri's argument serialization
            // - IPC message passing
            // - Rust command execution
            // - Response serialization
            // - IPC response passing
            // - Tauri's response deserialization
            const ipcSpan = FrontendProfiler.startSpan('ipc:list_directory_entries', 'file_io');
            const entries = await invoke<BackendDirEntry[]>('list_directory_entries', invokeArgs);

            // Calculate metrics without separate span (minimal overhead)
            const entryCount = entries.length;
            const avgPathLength = entryCount > 0
                ? Math.round(entries.reduce((sum, e) => sum + (path.length + 1 + e.name.length), 0) / entryCount)
                : 0;

            await ipcSpan.end({
                entryCount: String(entryCount),
                avgPathLength: String(avgPathLength)
            });

            await invokeSpan.end({ rawEntryCount: String(entryCount) });

            // Optimize mapping: combine normalization, counting, and object creation in a single pass
            // Pre-allocate array for better performance
            results = new Array(entries.length);

            // Single pass: normalize paths, count types, and create objects
            for (let i = 0; i < entries.length; i++) {
                const entry = entries[i];
                // Reconstruct the path since backend no longer sends it to save bandwidth
                // path arg is already normalized with forward slashes
                const normalizedPath = `${path}/${entry.name}`;

                // Count types
                if (entry.isDirectory) dirCount++;
                else fileCount++;
                if (entry.isIgnored) ignoredCount++;

                // Create object
                results[i] = {
                    name: entry.name,
                    path: normalizedPath,
                    isDirectory: entry.isDirectory,
                    children: undefined,
                    isExpanded: false,
                    isIgnored: entry.isIgnored ?? false,
                };
            }

            usedBackend = 'rust';
        } catch (error) {
            console.warn('Rust directory listing failed, falling back to plugin-fs readDir', error);

            // Fallback: use plugin-fs directly (slower for very large folders).
            const fallbackReadSpan = FrontendProfiler.startSpan('fallback:readDir', 'file_io');
            const entries = await readDir(path);
            await fallbackReadSpan.end({ rawEntryCount: String(entries.length) });

            // If parent is ignored, all children are ignored - skip expensive gitignore checking
            const fallbackMapSpan = FrontendProfiler.startSpan('fallback:mapAndCheckGitignore', 'file_io');
            results = await Promise.all(
                entries.map(async (entry) => {
                    const entryPath = `${path}/${entry.name}`.replace(/\\/g, '/');
                    const isIgnored = parentIsIgnored
                        ? true
                        : gitignoreManager
                            ? await gitignoreManager.isIgnored(entryPath, !!entry.isDirectory)
                            : false;

                    if (entry.isDirectory) dirCount++;
                    else fileCount++;
                    if (isIgnored) ignoredCount++;

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
            await fallbackMapSpan.end({ mappedCount: String(results.length) });

            // Sort: directories first, then alphabetically
            const sortSpan = FrontendProfiler.startSpan('fallback:sortEntries', 'file_io');
            results.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
            });
            await sortSpan.end();
        }

        await span.end({
            path,
            entryCount: String(results.length),
            backend: usedBackend,
            directories: String(dirCount),
            files: String(fileCount),
            ignored: String(ignoredCount)
        });

        return results;
    } catch (error) {
        console.error('Failed to read directory:', path, error);
        span.cancel();
        return [];
    }
}

/**
 * Build a path-to-entry map for O(1) lookups instead of O(n) tree traversal
 */
function buildPathMap(entry: FileEntry | null, map: Map<string, FileEntry> = new Map()): Map<string, FileEntry> {
    if (!entry) return map;
    
    map.set(entry.path, entry);
    if (entry.children) {
        for (const child of entry.children) {
            buildPathMap(child, map);
        }
    }
    return map;
}

export const useFileSystemStore = create<FileSystemState>((set, get) => ({
    rootEntry: null,
    expandedPaths: new Set(),
    isLoading: false,
    error: null,
    rootPath: null,
    gitignoreManager: null,
    _pathToEntryMap: null,

    loadDirectory: async (path: string, traceParent?: string) => {
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
                // Note: readDirectoryEntries already has its own span, creating a child hierarchy
                const children = await readDirectoryEntries(normalizedPath, normalizedPath, null, false);

                // Profile the tree construction and state update
                const buildSpan = FrontendProfiler.startSpan('buildRootEntry', 'file_io');

                // Create root entry object (minimal overhead, no separate span)
                const rootEntry: FileEntry = {
                    name,
                    path: normalizedPath,
                    isDirectory: true,
                    children,
                    isExpanded: true,
                    isIgnored: false,
                };

                // Batch the state update to avoid multiple re-renders
                // Single Zustand update with all state changes - React 18+ automatically batches
                const stateUpdateSpan = FrontendProfiler.startSpan('update:fileSystemState', 'file_io');
                // Build path map for O(1) lookups
                const pathMap = buildPathMap(rootEntry);
                // Use functional update to ensure atomic state change
                set((state) => ({
                    ...state,
                    rootEntry,
                    expandedPaths: new Set([normalizedPath]),
                    isLoading: false,
                    rootPath: normalizedPath,
                    // GitignoreManager is only needed for the JS fallback path (which is rarely used).
                    // Defer creation until actually needed to keep initial load fast.
                    gitignoreManager: null,
                    _pathToEntryMap: pathMap,
                }));
                await stateUpdateSpan.end();

                await buildSpan.end({
                    childCount: String(children.length),
                    rootName: name
                });

                // Note: refreshIgnoredStatus is NOT called here because the Rust backend
                // already sets isIgnored flags during list_directory_entries.
            } catch (error) {
                set({
                    error: error instanceof Error ? error.message : 'Failed to load directory',
                    isLoading: false,
                });
            }
        }, { metadata: { path }, parentId: traceParent });
    },

    loadFolderChildren: async (path: string, traceParent?: string) => {
        return await FrontendProfiler.profileAsync('loadFolderChildren', 'file_io', async () => {
            const { gitignoreManager, rootPath, rootEntry } = get();

            // Check if the parent folder is ignored to optimize gitignore checking
            // This span is automatically a child of loadFolderChildren via call stack
            let parentIsIgnored = false;
            const findParentSpan = FrontendProfiler.startSpan('findParentEntry', 'file_io');
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
            await findParentSpan.end({ parentIsIgnored: String(parentIsIgnored) });

            // Read directory entries - this span is automatically a child of loadFolderChildren via call stack
            const children = await readDirectoryEntries(path, rootPath, gitignoreManager, parentIsIgnored);

            // Update the tree with loaded children
            // This span is automatically a child of loadFolderChildren via call stack
            const updateTreeSpan = FrontendProfiler.startSpan('updateTreeWithChildren', 'file_io');

            // Profile tree traversal - this span is automatically a child of updateTreeWithChildren via call stack
            const traverseSpan = FrontendProfiler.startSpan('traverse:fileTree', 'file_io');
            const { rootEntry: currentRoot } = get();
            let updatedRoot: FileEntry | null = null;
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

                updatedRoot = updateChildren(currentRoot);
            }
            await traverseSpan.end({
                childCount: String(children.length),
                treeUpdated: String(updatedRoot !== null)
            });

            // Profile state update - this span is automatically a child of updateTreeWithChildren via call stack
            // Batch state update to avoid multiple re-renders
            const treeStateUpdateSpan = FrontendProfiler.startSpan('zustand:updateTreeState', 'file_io');
            if (updatedRoot) {
                // Rebuild path map for O(1) lookups
                const pathMap = buildPathMap(updatedRoot);
                // Single batched update - React 18+ automatically batches synchronous updates
                // This ensures only one re-render happens
                set({ rootEntry: updatedRoot, _pathToEntryMap: pathMap });
            }
            await treeStateUpdateSpan.end();

            await updateTreeSpan.end({ childCount: String(children.length) });

            return children;
        }, { metadata: { path }, parentId: traceParent });
    },

    toggleFolder: async (path: string, traceParent?: string) => {
        const { expandedPaths, rootEntry, loadFolderChildren, _pathToEntryMap } = get();
        const newExpanded = new Set(expandedPaths);
        const isExpanding = !newExpanded.has(path);

        if (isExpanding) {
            // Create a span for the expand operation that will be parent to loadFolderChildren
            const expandSpan = FrontendProfiler.startSpan('expandNode', 'workspace', { 
                metadata: { path },
                parentId: traceParent 
            });
            
            // Update UI state immediately so expansion isn't delayed by any async work.
            // Use functional update for atomic state change
            newExpanded.add(path);
            set((state) => ({ ...state, expandedPaths: newExpanded }));
            
            // Capture the span ID before ending
            const expandSpanId = expandSpan.id;
            
            // End and await the expandNode span to ensure it's recorded before loadFolderChildren
            // This prevents race conditions where loadFolderChildren records before its parent
            await expandSpan.end();

            if (!rootEntry) return;

            // Use O(1) map lookup instead of O(n) tree traversal for better performance
            // Defer the lookup to avoid blocking the UI update
            const folder = _pathToEntryMap?.get(path) ?? null;
            
            // If map lookup failed, fall back to tree traversal (shouldn't happen, but safety check)
            if (!folder && rootEntry) {
                // Defer tree traversal to next tick to avoid blocking UI
                await new Promise(resolve => setTimeout(resolve, 0));
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
                const foundFolder = findEntry(rootEntry);
                if (foundFolder && foundFolder.isDirectory && !foundFolder.children) {
                    await loadFolderChildren(path, expandSpanId);
                }
            } else if (folder && folder.isDirectory && !folder.children) {
                await loadFolderChildren(path, expandSpanId);
            }
        } else {
            FrontendProfiler.profileSync('collapseNode', 'workspace', () => {
                newExpanded.delete(path);
                // Use functional update for atomic state change
                set((state) => ({ ...state, expandedPaths: newExpanded }));
            }, { metadata: { path }, parentId: traceParent });
        }
    },

    refreshTree: async () => {
        await FrontendProfiler.profileAsync('refreshTree', 'file_io', async () => {
            const { rootEntry, loadDirectory } = get();
            if (rootEntry) {
                await loadDirectory(rootEntry.path);
            }
        });
    },

    clearTree: () => {
        set({
            rootEntry: null,
            expandedPaths: new Set(),
            error: null,
            rootPath: null,
            gitignoreManager: null,
            _pathToEntryMap: null,
        });
    },

    /**
     * Refresh ignored status for all entries in the tree
     */
    refreshIgnoredStatus: async () => {
        await FrontendProfiler.profileAsync('refreshIgnoredStatus', 'file_io', async () => {
            const { rootEntry, gitignoreManager } = get();
            if (!rootEntry || !gitignoreManager) return;

            let entriesProcessed = 0;
            const updateIgnoredStatus = async (entry: FileEntry): Promise<FileEntry> => {
                entriesProcessed++;
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
        });
    },
}));

/**
 * Utility to read file content
 */
export async function readFileContent(path: string): Promise<string> {
    return await readTextFile(path);
}
