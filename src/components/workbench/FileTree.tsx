import {
    MdChevronRight,
    MdExpandMore,
    MdFolder,
    MdFolderOpen
} from 'react-icons/md';

import { useFileSystemStore, useEditorStore } from '@/stores';
import type { FileEntry } from '@/types/fs';
import { getFileExtension } from '@/types/fs';
import { useFileIcon } from '@/lib/icons';

interface FileTreeNodeProps {
    entry: FileEntry;
    depth: number;
}


function FileTreeNode({ entry, depth }: FileTreeNodeProps) {
    const { expandedPaths, toggleFolder, loadFolderChildren } = useFileSystemStore();
    const { openFile } = useEditorStore();

    // Use the hook for dynamic icon resolution
    const fileIcon = useFileIcon(entry.name, getFileExtension(entry.name));

    const isExpanded = expandedPaths.has(entry.path);
    const paddingLeft = 8 + depth * 16; // Base padding + indentation
    const isIgnored = entry.isIgnored;

    const handleClick = () => {
        if (entry.isDirectory) {
            const willExpand = !isExpanded;
            // Expand/collapse immediately; load children lazily without blocking UI.
            toggleFolder(entry.path);
            if (willExpand && !entry.children) {
                void loadFolderChildren(entry.path);
            }
        } else {
            // Open file in editor
            void openFile(entry.path);
        }
    };

    return (
        <div>
            <button
                onClick={handleClick}
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
                            <MdExpandMore style={{ width: 'var(--file-tree-icon-size, 1rem)', height: 'var(--file-tree-icon-size, 1rem)' }} className="text-muted-foreground" />
                        ) : (
                            <MdChevronRight style={{ width: 'var(--file-tree-icon-size, 1rem)', height: 'var(--file-tree-icon-size, 1rem)' }} className="text-muted-foreground" />
                        )}
                    </span>
                ) : (
                    <span className="w-4 h-4" /> // Spacer for alignment
                )}

                {/* Icon */}
                <span className="shrink-0">
                    {entry.isDirectory ? (
                        isExpanded ? (
                            <MdFolderOpen style={{ width: 'var(--file-tree-icon-size, 1rem)', height: 'var(--file-tree-icon-size, 1rem)' }} className="text-primary" />
                        ) : (
                            <MdFolder style={{ width: 'var(--file-tree-icon-size, 1rem)', height: 'var(--file-tree-icon-size, 1rem)' }} className="text-primary/70" />
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
}

export default function FileTree() {
    const { rootEntry, isLoading, error } = useFileSystemStore();

    if (isLoading) {
        return (
            <div className="p-4 text-sm text-muted-foreground">
                Loading...
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-sm text-destructive">
                Error: {error}
            </div>
        );
    }

    if (!rootEntry) {
        return (
            <div className="p-4 text-sm text-muted-foreground text-center">
                <p>No folder open</p>
                <p className="text-xs mt-2 opacity-70">
                    Use File → Open Folder to get started
                </p>
            </div>
        );
    }

    return (
        <div className="py-1">
            {rootEntry.children?.map((entry) => (
                <FileTreeNode key={entry.path} entry={entry} depth={0} />
            ))}
        </div>
    );
}
