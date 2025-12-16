import { memo, useCallback, useState, useEffect, useMemo } from 'react';
import { useFileSystemStore, useEditorStore } from '@/stores';
import type { FileEntry } from '@/types/fs';
import { getFileExtension } from '@/types/fs';
import { useFileIcon } from '@/lib/icons';
import { useProfiler } from '@/hooks/useProfiler';
import { FrontendProfiler } from '@/lib/services/FrontendProfiler';

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
    const { startSpan, trackInteraction } = useProfiler('FileTreeNode');
    // Optimize store selectors - only subscribe to what we need
    const isExpanded = useFileSystemStore((state) => state.expandedPaths.has(entry.path));
    const toggleFolder = useFileSystemStore((state) => state.toggleFolder);
    const openFile = useEditorStore((state) => state.openFile);

    const paddingLeft = 8 + depth * 16; // Base padding + indentation
    const isIgnored = entry.isIgnored;

    // Optimize icon resolution - only compute extension once and memoize
    const extension = useMemo(() => entry.isDirectory ? '' : getFileExtension(entry.name), [entry.isDirectory, entry.name]);
    const fileIcon = useFileIcon(entry.name, extension);

    const handleClick = useCallback(async () => {
        if (entry.isDirectory) {
            // Create folder_toggle span as a root span (no parent) since it's a top-level user interaction
            // This prevents orphaned spans if the React Profiler parent span was filtered out
            const toggleSpan = FrontendProfiler.startSpan('FileTreeNode:folder_toggle', 'frontend_interaction', {
                metadata: { path: entry.path, expanded: (!isExpanded).toString() },
                parentId: undefined // Explicitly set to undefined to make it a root span (no parent)
            });
            trackInteraction('folder_toggle', { 
                path: entry.path, 
                expanded: (!isExpanded).toString() 
            });
            
            // toggleFolder already handles loading children if needed, so we don't need to call it again
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
 * Optimized for large folders (>50 items) with smaller initial batches.
 */
function ChunkedFileTree({ children }: { children: FileEntry[] }) {
    const { startSpan, trackInteraction } = useProfiler('ChunkedFileTree');
    
    // Memoize children length to avoid recalculation
    const childrenLength = useMemo(() => children.length, [children.length]);
    const shouldUseSmallBatches = childrenLength > 50;
    
    const [visibleCount, setVisibleCount] = useState(() => {
        // Initial render: show fewer items for large folders to improve responsiveness
        return Math.min(childrenLength, shouldUseSmallBatches ? 50 : 200);
    });

    // Single unified effect that handles both reset and progressive loading
    useEffect(() => {
        const initialVisible = Math.min(childrenLength, shouldUseSmallBatches ? 50 : 200);

        // Reset visible count when children length changes
        if (visibleCount > childrenLength || visibleCount < initialVisible) {
            setVisibleCount(initialVisible);
            trackInteraction('file_tree_reset', { 
                totalCount: childrenLength.toString(),
                initialVisible: initialVisible.toString()
            });
            return; // Don't schedule progressive loading on reset
        }

        // Progressive loading: if we have more items to show
        if (visibleCount < childrenLength) {
            const scheduleNextBatch = () => {
                const span = startSpan('render_file_batch', 'frontend_render');
                // Smaller batches for large folders to keep UI responsive
                const batchSize = shouldUseSmallBatches ? 25 : 100;
                const nextCount = Math.min(visibleCount + batchSize, childrenLength);
                setVisibleCount(nextCount);
                span.end({ 
                    batchSize: (nextCount - visibleCount).toString(),
                    totalVisible: nextCount.toString()
                });
            };

            // Use requestIdleCallback if available for better performance, fallback to setTimeout
            const scheduleFn = typeof requestIdleCallback !== 'undefined' 
                ? requestIdleCallback 
                : (fn: () => void) => setTimeout(fn, 0);
            
            const timeoutId = scheduleFn(scheduleNextBatch);
            return () => {
                if (typeof timeoutId === 'number') {
                    clearTimeout(timeoutId);
                } else {
                    cancelIdleCallback(timeoutId);
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
