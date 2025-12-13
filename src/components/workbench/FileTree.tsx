import { memo, useCallback, useState, useEffect } from 'react';
import { useFileSystemStore, useEditorStore } from '@/stores';
import type { FileEntry } from '@/types/fs';
import { getFileExtension } from '@/types/fs';
import { useFileIcon } from '@/lib/icons';
import { useProfiler } from '@/hooks/useProfiler';

// Inline SVG icons to avoid eager loading react-icons during app initialization
const ChevronRight = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
    </svg>
);

const ExpandMore = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
        <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/>
    </svg>
);

const Folder = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
        <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
    </svg>
);

const FolderOpen = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
        <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
    </svg>
);

interface FileTreeNodeProps {
    entry: FileEntry;
    depth: number;
}

const FileTreeNode = memo(function FileTreeNode({ entry, depth }: FileTreeNodeProps) {
    // Optimize store selectors - only subscribe to what we need
    const isExpanded = useFileSystemStore((state) => state.expandedPaths.has(entry.path));
    const toggleFolder = useFileSystemStore((state) => state.toggleFolder);
    const loadFolderChildren = useFileSystemStore((state) => state.loadFolderChildren);
    const openFile = useEditorStore((state) => state.openFile);

    const paddingLeft = 8 + depth * 16; // Base padding + indentation
    const isIgnored = entry.isIgnored;

    // Optimize icon resolution - only compute extension once and memoize
    const extension = entry.isDirectory ? '' : getFileExtension(entry.name);
    const fileIcon = useFileIcon(entry.name, extension);

    const handleClick = useCallback(() => {
        if (entry.isDirectory) {
            toggleFolder(entry.path);
            // Load children if expanding and not already loaded
            if (!entry.children) {
                void loadFolderChildren(entry.path);
            }
        } else {
            void openFile(entry.path);
        }
    }, [entry.isDirectory, entry.path, entry.children, toggleFolder, loadFolderChildren, openFile]);

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
    const [visibleCount, setVisibleCount] = useState(() => {
        // Initial render: show a reasonable number of items
        // More items for better UX, but not so many that it blocks the UI
        return Math.min(children.length, 200);
    });

    useEffect(() => {
        // Reset visible count when children change
        setVisibleCount(Math.min(children.length, 200));
    }, [children]);

    useEffect(() => {
        if (visibleCount < children.length) {
            // Schedule the next batch of items to render
            // Use requestIdleCallback for better performance, with fallback to setTimeout
            const scheduleNextBatch = () => {
                const nextCount = Math.min(visibleCount + 100, children.length);
                setVisibleCount(nextCount);
            };

            const timeoutId = setTimeout(scheduleNextBatch, 0);
            return () => clearTimeout(timeoutId);
        }
    }, [visibleCount, children.length]);

    const visibleChildren = children.slice(0, visibleCount);
    const remainingCount = children.length - visibleCount;

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
    const { ProfilerWrapper } = useProfiler('FileTree');

    if (isLoading) {
        return (
            <ProfilerWrapper>
                <div className="p-4 text-sm text-muted-foreground">
                    Loading...
                </div>
            </ProfilerWrapper>
        );
    }

    if (error) {
        return (
            <ProfilerWrapper>
                <div className="p-4 text-sm text-destructive">
                    Error: {error}
                </div>
            </ProfilerWrapper>
        );
    }

    if (!rootEntry) {
        return (
            <ProfilerWrapper>
                <div className="p-4 text-sm text-muted-foreground text-center">
                    <p>No folder open</p>
                    <p className="text-xs mt-2 opacity-70">
                        Use File → Open Folder to get started
                    </p>
                </div>
            </ProfilerWrapper>
        );
    }

    return (
        <ProfilerWrapper>
            <div className="py-1">
                {rootEntry.children && rootEntry.children.length > 0 ? (
                    <ChunkedFileTree children={rootEntry.children} />
                ) : (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                        <p>Empty directory</p>
                    </div>
                )}
            </div>
        </ProfilerWrapper>
    );
}

export default memo(FileTree);
