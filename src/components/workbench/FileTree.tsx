import { memo, useCallback, useState, useEffect, useMemo, useRef, createContext, useContext } from 'react';
import { useFileSystemStore, useEditorStore } from '@/stores';
import type { FileEntry } from '@/types/fs';
import { getFileExtension } from '@/types/fs';
import { useFileIcon } from '@/lib/icons';
import { useProfiler } from '@/hooks/useProfiler';
import { FrontendProfiler } from '@/lib/services';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { confirm } from '@tauri-apps/plugin-dialog';
import FileTreeContextMenu, { type ContextMenuPosition, type ContextMenuTarget } from './FileTreeContextMenu';
import { FilePlus } from 'lucide-react';

// Inline SVG icons to avoid eager loading react-icons during app initialization
const ChevronRight = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
    </svg>
);

const ExpandMore = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
        <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z" />
    </svg>
);

const Folder = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
        <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
    </svg>
);

const FolderOpen = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
        <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" />
    </svg>
);

// Context for file tree operations
interface FileTreeContextType {
    onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
    editingPath: string | null;
    editingType: 'rename' | 'newFile' | 'newFolder' | null;
    editingParentPath: string | null;
    onEditComplete: (newName: string) => void;
    onEditCancel: () => void;
}

const FileTreeContext = createContext<FileTreeContextType | null>(null);

// Inline input for creating/renaming files
interface InlineInputProps {
    defaultValue: string;
    isFolder: boolean;
    onSubmit: (value: string) => void;
    onCancel: () => void;
    depth: number;
}

const InlineInput = memo(function InlineInput({
    defaultValue,
    isFolder,
    onSubmit,
    onCancel,
    depth,
}: InlineInputProps) {
    const [value, setValue] = useState(defaultValue);
    const inputRef = useRef<HTMLInputElement>(null);
    const paddingLeft = 8 + depth * 16 + 20; // Align with file names (after chevron)

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
            // Select filename without extension for files
            if (!isFolder && defaultValue.includes('.')) {
                const dotIndex = defaultValue.lastIndexOf('.');
                inputRef.current.setSelectionRange(0, dotIndex);
            } else {
                inputRef.current.select();
            }
        }
    }, [defaultValue, isFolder]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (value.trim()) {
                onSubmit(value.trim());
            } else {
                onCancel();
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
        }
    };

    const handleBlur = () => {
        if (value.trim()) {
            onSubmit(value.trim());
        } else {
            onCancel();
        }
    };

    return (
        <div
            className="flex items-center gap-1.5"
            style={{
                paddingLeft,
                height: 'var(--file-tree-item-height, 1.75rem)',
                paddingTop: 'var(--density-padding-sm, 0.3rem)',
                paddingBottom: 'var(--density-padding-sm, 0.3rem)',
                paddingRight: 'var(--density-padding-sm, 0.3rem)',
            }}
        >
            <span className="shrink-0">
                {isFolder ? (
                    <Folder style={{ width: 'var(--file-tree-icon-size, 1rem)', height: 'var(--file-tree-icon-size, 1rem)' }} className="text-primary/70" />
                ) : (
                    <FilePlus style={{ width: 'var(--file-tree-icon-size, 1rem)', height: 'var(--file-tree-icon-size, 1rem)' }} className="text-muted-foreground" />
                )}
            </span>
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                className="flex-1 min-w-0 bg-muted/50 border border-primary/50 rounded px-1.5 py-0.5 text-xs outline-none focus:border-primary"
                style={{ fontSize: 'var(--file-tree-font-size, 0.8125rem)' }}
            />
        </div>
    );
});

interface FileTreeNodeProps {
    entry: FileEntry;
    depth: number;
}

const FileTreeNode = memo(function FileTreeNode({ entry, depth }: FileTreeNodeProps) {
    const { startSpan, trackInteraction } = useProfiler('FileTreeNode');
    const context = useContext(FileTreeContext);
    
    // Optimize store selectors - only subscribe to what we need
    const isExpanded = useFileSystemStore((state) => state.expandedPaths.has(entry.path));
    const toggleFolder = useFileSystemStore((state) => state.toggleFolder);
    const openFile = useEditorStore((state) => state.openFile);

    const paddingLeft = 8 + depth * 16; // Base padding + indentation
    const isIgnored = entry.isIgnored;

    // Check if this entry is being edited
    const isEditing = context?.editingPath === entry.path && context?.editingType === 'rename';

    // Optimize icon resolution - only compute extension once and memoize
    const extension = useMemo(() => entry.isDirectory ? '' : getFileExtension(entry.name), [entry.isDirectory, entry.name]);
    const fileIcon = useFileIcon(entry.name, extension);

    const handleClick = useCallback(async () => {
        if (entry.isDirectory) {
            const toggleSpan = FrontendProfiler.startSpan('FileTreeNode:folder_toggle', 'frontend_interaction', {
                metadata: { path: entry.path, expanded: (!isExpanded).toString() },
                parentId: undefined
            });
            trackInteraction('folder_toggle', {
                path: entry.path,
                expanded: (!isExpanded).toString()
            });

            await toggleFolder(entry.path, toggleSpan.id);

            await toggleSpan.end({
                path: entry.path,
                expanded: (!isExpanded).toString()
            });
        } else {
            const span = startSpan('open_file_from_tree', 'frontend_interaction');
            try {
                await openFile(entry.path);
                trackInteraction('file_opened', {
                    fileName: entry.name,
                    extension: getFileExtension(entry.name)
                });
                await span.end({ filePath: entry.path });
            } catch (error) {
                await span.end({
                    filePath: entry.path,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
    }, [entry.isDirectory, entry.path, isExpanded, toggleFolder, openFile, startSpan, trackInteraction]);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        context?.onContextMenu(e, entry);
    }, [context, entry]);

    // Show inline input when renaming
    if (isEditing) {
        return (
            <InlineInput
                defaultValue={entry.name}
                isFolder={entry.isDirectory}
                onSubmit={context!.onEditComplete}
                onCancel={context!.onEditCancel}
                depth={depth}
            />
        );
    }

    // Check if we should show new file/folder input as first child of this directory
    const showNewInput = entry.isDirectory && 
        isExpanded && 
        context?.editingParentPath === entry.path && 
        (context?.editingType === 'newFile' || context?.editingType === 'newFolder');

    return (
        <div>
            <button
                onClick={handleClick}
                onContextMenu={handleContextMenu}
                className={`w-full flex items-center gap-1.5 text-left hover:bg-muted/50 rounded-sm transition-colors group ${isIgnored ? 'opacity-60' : ''}`}
                style={{
                    paddingLeft,
                    height: 'var(--file-tree-item-height, 1.75rem)',
                    fontSize: 'var(--file-tree-font-size, 0.8125rem)',
                    paddingTop: 'var(--density-padding-sm, 0.3rem)',
                    paddingBottom: 'var(--density-padding-sm, 0.3rem)',
                    paddingRight: 'var(--density-padding-sm, 0.3rem)',
                }}
            >
                {/* Chevron for directories */}
                {entry.isDirectory ? (
                    <span className="w-4 h-4 flex items-center justify-center shrink-0">
                        {isExpanded ? (
                            <ExpandMore style={{ width: 'var(--file-tree-icon-size, 1rem)', height: 'var(--file-tree-icon-size, 1rem)' }} className="text-muted-foreground" />
                        ) : (
                            <ChevronRight style={{ width: 'var(--file-tree-icon-size, 1rem)', height: 'var(--file-tree-icon-size, 1rem)' }} className="text-muted-foreground" />
                        )}
                    </span>
                ) : (
                    <span className="w-4 h-4" /> // Spacer for alignment
                )}

                {/* Icon */}
                <span className="shrink-0">
                    {entry.isDirectory ? (
                        isExpanded ? (
                            <FolderOpen style={{ width: 'var(--file-tree-icon-size, 1rem)', height: 'var(--file-tree-icon-size, 1rem)' }} className="text-primary" />
                        ) : (
                            <Folder style={{ width: 'var(--file-tree-icon-size, 1rem)', height: 'var(--file-tree-icon-size, 1rem)' }} className="text-primary/70" />
                        )
                    ) : (
                        fileIcon
                    )}
                </span>

                {/* Name */}
                <span
                    className={`flex-1 min-w-0 truncate group-hover:text-foreground ${isIgnored ? 'text-muted-foreground/80' : 'text-foreground/90'}`}
                >
                    {entry.name}
                </span>
            </button>

            {/* New file/folder input */}
            {showNewInput && (
                <InlineInput
                    defaultValue={context?.editingType === 'newFolder' ? 'New Folder' : 'newfile.txt'}
                    isFolder={context?.editingType === 'newFolder'}
                    onSubmit={context!.onEditComplete}
                    onCancel={context!.onEditCancel}
                    depth={depth + 1}
                />
            )}

            {/* Children */}
            {entry.isDirectory && isExpanded && entry.children && (
                <div>
                    {entry.children.map((child) => (
                        <FileTreeNode key={child.path} entry={child} depth={depth + 1} />
                    ))}
                </div>
            )}
        </div>
    );
});

/**
 * Chunked file tree renderer that progressively renders items
 * to avoid blocking the UI thread with thousands of files.
 */
function ChunkedFileTree({ children }: { children: FileEntry[] }) {
    const { startSpan, trackInteraction } = useProfiler('ChunkedFileTree');

    const childrenLength = useMemo(() => children.length, [children.length]);
    const shouldUseSmallBatches = childrenLength > 50;

    const [visibleCount, setVisibleCount] = useState(() => {
        return Math.min(childrenLength, shouldUseSmallBatches ? 50 : 200);
    });

    useEffect(() => {
        const initialVisible = Math.min(childrenLength, shouldUseSmallBatches ? 50 : 200);

        if (visibleCount > childrenLength || visibleCount < initialVisible) {
            setVisibleCount(initialVisible);
            trackInteraction('file_tree_reset', {
                totalCount: childrenLength.toString(),
                initialVisible: initialVisible.toString()
            });
            return;
        }

        if (visibleCount < childrenLength) {
            const scheduleNextBatch = () => {
                const span = startSpan('render_file_batch', 'frontend_render');
                const batchSize = shouldUseSmallBatches ? 25 : 100;
                const nextCount = Math.min(visibleCount + batchSize, childrenLength);
                setVisibleCount(nextCount);
                span.end({
                    batchSize: (nextCount - visibleCount).toString(),
                    totalVisible: nextCount.toString()
                });
            };

            const scheduleFn = typeof requestIdleCallback !== 'undefined'
                ? requestIdleCallback
                : (fn: () => void) => window.setTimeout(fn, 0) as number;

            const timeoutId = scheduleFn(scheduleNextBatch);
            return () => {
                if (typeof timeoutId === 'number') {
                    clearTimeout(timeoutId);
                } else {
                    cancelIdleCallback(timeoutId as number);
                }
            };
        }
    }, [visibleCount, childrenLength, shouldUseSmallBatches, startSpan, trackInteraction]);

    const visibleChildren = useMemo(() => children.slice(0, visibleCount), [children, visibleCount]);
    const remainingCount = childrenLength - visibleCount;

    return (
        <>
            {visibleChildren.map((entry) => (
                <FileTreeNode key={entry.path} entry={entry} depth={0} />
            ))}
            {remainingCount > 0 && (
                <div className="px-4 py-2 text-xs text-muted-foreground">
                    Loading {remainingCount} more items...
                </div>
            )}
        </>
    );
}

function FileTree() {
    const rootEntry = useFileSystemStore((state) => state.rootEntry);
    const isLoading = useFileSystemStore((state) => state.isLoading);
    const error = useFileSystemStore((state) => state.error);
    const clipboardPath = useFileSystemStore((state) => state.clipboardPath);
    const setClipboardPath = useFileSystemStore((state) => state.setClipboardPath);
    const createFile = useFileSystemStore((state) => state.createFile);
    const createFolder = useFileSystemStore((state) => state.createFolder);
    const deleteEntry = useFileSystemStore((state) => state.deleteEntry);
    const renameEntry = useFileSystemStore((state) => state.renameEntry);
    const pasteEntry = useFileSystemStore((state) => state.pasteEntry);
    const refreshTree = useFileSystemStore((state) => state.refreshTree);
    const toggleFolder = useFileSystemStore((state) => state.toggleFolder);
    const expandedPaths = useFileSystemStore((state) => state.expandedPaths);
    const openFile = useEditorStore((state) => state.openFile);
    const { ProfilerWrapper } = useProfiler('FileTree');

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
        position: ContextMenuPosition;
        target: ContextMenuTarget;
    } | null>(null);

    // Inline editing state
    const [editingPath, setEditingPath] = useState<string | null>(null);
    const [editingType, setEditingType] = useState<'rename' | 'newFile' | 'newFolder' | null>(null);
    const [editingParentPath, setEditingParentPath] = useState<string | null>(null);

    const handleContextMenu = useCallback((e: React.MouseEvent, entry: FileEntry) => {
        setContextMenu({
            position: { x: e.clientX, y: e.clientY },
            target: {
                path: entry.path,
                name: entry.name,
                isDirectory: entry.isDirectory,
                isRoot: entry.path === rootEntry?.path,
            },
        });
    }, [rootEntry?.path]);

    const handleCloseContextMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    const handleNewFile = useCallback(async (parentPath: string) => {
        // Ensure folder is expanded first
        if (!expandedPaths.has(parentPath)) {
            await toggleFolder(parentPath);
        }
        setEditingParentPath(parentPath);
        setEditingType('newFile');
        setEditingPath(null);
    }, [expandedPaths, toggleFolder]);

    const handleNewFolder = useCallback(async (parentPath: string) => {
        // Ensure folder is expanded first
        if (!expandedPaths.has(parentPath)) {
            await toggleFolder(parentPath);
        }
        setEditingParentPath(parentPath);
        setEditingType('newFolder');
        setEditingPath(null);
    }, [expandedPaths, toggleFolder]);

    const handleRename = useCallback((path: string) => {
        setEditingPath(path);
        setEditingType('rename');
        setEditingParentPath(null);
    }, []);

    const handleDelete = useCallback(async (path: string, isDirectory: boolean) => {
        const fileName = path.substring(path.lastIndexOf('/') + 1);
        const confirmed = await confirm(
            `Are you sure you want to delete "${fileName}"?${isDirectory ? ' This will delete all contents.' : ''}`,
            { title: 'Confirm Delete', kind: 'warning' }
        );
        
        if (confirmed) {
            await deleteEntry(path, isDirectory);
        }
    }, [deleteEntry]);

    const handleCopy = useCallback((path: string) => {
        setClipboardPath(path);
    }, [setClipboardPath]);

    const handlePaste = useCallback(async (targetPath: string) => {
        const newPath = await pasteEntry(targetPath);
        if (newPath) {
            // Optionally open the pasted file
            const isFile = !newPath.endsWith('/');
            if (isFile) {
                await openFile(newPath);
            }
        }
    }, [pasteEntry, openFile]);

    const handleOpenInExplorer = useCallback(async (path: string) => {
        try {
            // Convert forward slashes to backslashes for Windows
            const windowsPath = path.replace(/\//g, '\\');
            await shellOpen(windowsPath);
        } catch (error) {
            console.error('Failed to open in explorer:', error);
        }
    }, []);

    const handleCopyPath = useCallback((path: string) => {
        navigator.clipboard.writeText(path);
    }, []);

    const handleRefresh = useCallback(() => {
        refreshTree();
    }, [refreshTree]);

    const handleEditComplete = useCallback(async (newName: string) => {
        if (editingType === 'rename' && editingPath) {
            await renameEntry(editingPath, newName);
        } else if (editingType === 'newFile' && editingParentPath) {
            const newPath = await createFile(editingParentPath, newName);
            if (newPath) {
                // Open the new file
                await openFile(newPath);
            }
        } else if (editingType === 'newFolder' && editingParentPath) {
            await createFolder(editingParentPath, newName);
        }
        
        // Clear editing state
        setEditingPath(null);
        setEditingType(null);
        setEditingParentPath(null);
    }, [editingType, editingPath, editingParentPath, renameEntry, createFile, createFolder, openFile]);

    const handleEditCancel = useCallback(() => {
        setEditingPath(null);
        setEditingType(null);
        setEditingParentPath(null);
    }, []);

    // Handle right-click on empty area (root context menu)
    const handleRootContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        if (rootEntry) {
            setContextMenu({
                position: { x: e.clientX, y: e.clientY },
                target: {
                    path: rootEntry.path,
                    name: rootEntry.name,
                    isDirectory: true,
                    isRoot: true,
                },
            });
        }
    }, [rootEntry]);

    const contextValue = useMemo(() => ({
        onContextMenu: handleContextMenu,
        editingPath,
        editingType,
        editingParentPath,
        onEditComplete: handleEditComplete,
        onEditCancel: handleEditCancel,
    }), [handleContextMenu, editingPath, editingType, editingParentPath, handleEditComplete, handleEditCancel]);

    if (isLoading) {
        return (
            <ProfilerWrapper>
                <div className="h-full min-h-0 min-w-0 flex flex-col items-center justify-center p-4 text-sm text-muted-foreground overflow-hidden">
                    <span>Loading...</span>
                </div>
            </ProfilerWrapper>
        );
    }

    if (error) {
        return (
            <ProfilerWrapper>
                <div className="h-full min-h-0 min-w-0 flex flex-col items-center justify-center p-4 text-sm text-destructive overflow-hidden">
                    <span>Error: {error}</span>
                </div>
            </ProfilerWrapper>
        );
    }

    if (!rootEntry) {
        return (
            <ProfilerWrapper>
                <div className="h-full min-h-0 min-w-0 flex flex-col items-center justify-center p-4 text-sm text-muted-foreground text-center overflow-hidden">
                    <p>No folder open</p>
                    <p className="text-xs mt-2 opacity-70">
                        Use File → Open Folder to get started
                    </p>
                </div>
            </ProfilerWrapper>
        );
    }

    // Check if we should show new input at root level
    const showRootNewInput = editingParentPath === rootEntry.path && 
        (editingType === 'newFile' || editingType === 'newFolder');

    return (
        <ProfilerWrapper>
            <FileTreeContext.Provider value={contextValue}>
                <div className="h-full min-h-0 min-w-0 overflow-hidden py-1" onContextMenu={handleRootContextMenu}>
                    {/* New file/folder input at root */}
                    {showRootNewInput && (
                        <InlineInput
                            defaultValue={editingType === 'newFolder' ? 'New Folder' : 'newfile.txt'}
                            isFolder={editingType === 'newFolder'}
                            onSubmit={handleEditComplete}
                            onCancel={handleEditCancel}
                            depth={0}
                        />
                    )}

                    {rootEntry.children && rootEntry.children.length > 0 ? (
                        <ChunkedFileTree children={rootEntry.children} />
                    ) : (
                        <div className="flex flex-col items-center justify-center p-4 text-sm text-muted-foreground text-center min-h-0 min-w-0 overflow-hidden">
                            <p>Empty directory</p>
                        </div>
                    )}
                </div>

                {/* Context Menu */}
                <FileTreeContextMenu
                    position={contextMenu?.position ?? null}
                    target={contextMenu?.target ?? null}
                    onClose={handleCloseContextMenu}
                    onNewFile={handleNewFile}
                    onNewFolder={handleNewFolder}
                    onRename={handleRename}
                    onDelete={handleDelete}
                    onCopy={handleCopy}
                    onPaste={handlePaste}
                    onOpenInExplorer={handleOpenInExplorer}
                    onCopyPath={handleCopyPath}
                    onRefresh={handleRefresh}
                    clipboardPath={clipboardPath}
                />
            </FileTreeContext.Provider>
        </ProfilerWrapper>
    );
}

export default memo(FileTree);
