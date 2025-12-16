import React, { useState, useMemo, useCallback } from 'react';
import { useProfilerStore } from '@/stores/profiler';
import { ChevronRight, ChevronDown, Clock, Flame, ArrowRight, SortAsc, SortDesc, Search, X } from 'lucide-react';
import type { SpanSummary } from '@/types/profiling';
import ScrollableArea from '@/components/ui/scrollable-area';
import { Input } from '@/components/ui/input';

interface TreeNode {
    span: SpanSummary;
    children: TreeNode[];
    selfTimeMs: number;
    totalTimeMs: number; // Calculated total time (accounts for overlapping children)
    depth: number;
    callCount: number;
    totalCallCount: number; // Total calls including children
    path: SpanSummary[]; // Full path from root to this node
}

interface CallTreeRowProps {
    node: TreeNode;
    isExpanded: boolean;
    onToggle: (id: string) => void;
    onSelect: (span: SpanSummary) => void;
    selectedId: string | null;
    maxDuration: number;
    showPath: boolean;
}

const CallTreeRow: React.FC<CallTreeRowProps> = ({
    node,
    isExpanded,
    onToggle,
    onSelect,
    selectedId,
    maxDuration,
    showPath,
}) => {
    const { span, children, selfTimeMs, totalTimeMs, depth, callCount, path } = node;
    const hasChildren = children.length > 0;
    const isSelected = selectedId === span.id;
    const isOrphaned = span.parentId !== null && path.length === 1; // Has parentId but no parent in path
    
    // Calculate bar widths using calculated totalTimeMs
    const totalPercent = maxDuration > 0 ? (totalTimeMs / maxDuration) * 100 : 0;
    const selfPercent = maxDuration > 0 ? (selfTimeMs / maxDuration) * 100 : 0;
    
    // Color based on self-time proportion
    const selfRatio = totalTimeMs > 0 ? selfTimeMs / totalTimeMs : 0;
    const isHotspot = selfRatio > 0.5 && selfTimeMs > 10; // >50% self-time and >10ms
    
    // Calculate percentage of total time
    const totalPercentOfRoot = maxDuration > 0 ? (totalTimeMs / maxDuration) * 100 : 0;
    const selfPercentOfRoot = maxDuration > 0 ? (selfTimeMs / maxDuration) * 100 : 0;

    // Build call path display
    const pathDisplay = showPath && path.length > 1 
        ? path.slice(0, -1).map(p => p.name).join(' → ') + ' → '
        : '';

    return (
        <div
            className={`
                group flex items-center min-h-[32px] text-xs font-mono cursor-pointer
                border-b border-border/30 hover:bg-muted/50 transition-colors
                ${isSelected ? 'bg-primary/15 border-primary/30' : ''}
                ${isOrphaned ? 'opacity-75' : ''}
            `}
            onClick={() => onSelect(span)}
        >
            {/* Indent + Expand Toggle */}
            <div
                className="flex items-center shrink-0"
                style={{ width: `${24 + depth * 20}px` }}
            >
                <div style={{ width: `${depth * 20}px` }} />
                {hasChildren ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggle(span.id);
                        }}
                        className="w-6 h-6 flex items-center justify-center hover:bg-muted/80 rounded transition-colors"
                        title={isExpanded ? 'Collapse' : 'Expand'}
                    >
                        {isExpanded ? (
                            <ChevronDown size={14} className="text-foreground" />
                        ) : (
                            <ChevronRight size={14} className="text-foreground" />
                        )}
                    </button>
                ) : (
                    <div className="w-6 flex items-center justify-center">
                        <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                    </div>
                )}
            </div>

            {/* Call Path (if enabled) */}
            {showPath && path.length > 1 && (
                <div className="w-64 shrink-0 px-2 text-[10px] text-muted-foreground truncate">
                    {pathDisplay}
                </div>
            )}

            {/* Name with Target */}
            <div className="flex-1 min-w-0 px-2 flex items-center gap-2">
                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-foreground" title={span.name}>
                            {span.name}
                        </span>
                        {isHotspot && (
                            <span title="Hotspot: High self-time">
                                <Flame size={12} className="text-orange-500 shrink-0" />
                            </span>
                        )}
                        {isOrphaned && (
                            <span className="text-[10px] px-1 py-0.5 rounded bg-yellow-500/20 text-yellow-600 dark:text-yellow-400" title="Orphaned span: parent not found">
                                Orphaned
                            </span>
                        )}
                        {callCount > 1 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground" title={`Called ${callCount} times`}>
                                ×{callCount}
                            </span>
                        )}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate" title={span.target}>
                        {span.target}
                    </div>
                </div>
            </div>

            {/* Self Time */}
            <div className="w-28 shrink-0 px-2 text-right">
                <div className="text-foreground font-medium tabular-nums">
                    {selfTimeMs.toFixed(2)}ms
                </div>
                <div className="text-[10px] text-muted-foreground tabular-nums">
                    {selfPercentOfRoot.toFixed(1)}%
                </div>
            </div>

            {/* Total Time */}
            <div className="w-28 shrink-0 px-2 text-right">
                <div className="text-foreground font-medium tabular-nums">
                    {totalTimeMs.toFixed(2)}ms
                </div>
                <div className="text-[10px] text-muted-foreground tabular-nums">
                    {totalPercentOfRoot.toFixed(1)}%
                </div>
            </div>

            {/* Visual Bar */}
            <div className="w-48 shrink-0 px-2 flex items-center gap-1">
                <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden relative">
                    {/* Total time bar */}
                    <div
                        className="absolute inset-y-0 left-0 bg-primary/20 rounded-sm"
                        style={{ width: `${totalPercent}%` }}
                    />
                    {/* Self time bar (darker) */}
                    <div
                        className={`absolute inset-y-0 left-0 rounded-sm transition-all ${isHotspot ? 'bg-orange-500' : 'bg-primary'}`}
                        style={{ width: `${selfPercent}%` }}
                    />
                </div>
            </div>

            {/* Category Badge */}
            <div className="w-32 shrink-0 px-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground truncate block text-center">
                    {span.category.replace(/_/g, ' ')}
                </span>
            </div>

            {/* Start Time */}
            <div className="w-24 shrink-0 px-2 text-right text-[10px] text-muted-foreground tabular-nums">
                +{span.startTimeMs.toFixed(1)}ms
            </div>
        </div>
    );
};

type SortOption = 'duration' | 'selfTime' | 'name' | 'startTime';

export const CallTreeView: React.FC = () => {
    const { selectedSpan, recentSpans, selectSpan } = useProfilerStore();
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [rootSpanId, setRootSpanId] = useState<string | null>(null);
    const [showPath, setShowPath] = useState(false);
    const [sortBy, setSortBy] = useState<SortOption>('duration');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [searchQuery, setSearchQuery] = useState('');
    const [showOrphaned, setShowOrphaned] = useState(true);

    // Normalize IDs helper
    const normalizeId = useCallback((id: string | null | undefined): string | null => {
        if (!id) return null;
        return String(id).trim();
    }, []);

    // Build the tree from spans with enhanced metadata
    const { tree, maxDuration, rootSpans, orphanedSpans, totalSpans, totalTimes } = useMemo(() => {
        if (recentSpans.length === 0) {
            return { tree: [], maxDuration: 0, rootSpans: [], orphanedSpans: [], totalSpans: 0, totalTimes: new Map<string, number>() };
        }

        // Create a map for quick lookup (normalize IDs)
        const spanMap = new Map<string, SpanSummary>();
        for (const span of recentSpans) {
            const normalizedId = normalizeId(span.id);
            if (normalizedId) {
                spanMap.set(normalizedId, span);
            }
        }

        // Build children map and track call counts
        const childrenMap = new Map<string, SpanSummary[]>();
        const callCountMap = new Map<string, number>();
        const roots: SpanSummary[] = [];
        const orphaned: SpanSummary[] = [];

        for (const span of recentSpans) {
            const normalizedParentId = normalizeId(span.parentId);
            
            // Track call count (same method name)
            const callKey = `${span.name}::${span.target}`;
            callCountMap.set(callKey, (callCountMap.get(callKey) || 0) + 1);
            
            // Check if parent exists in the map (using normalized ID)
            if (normalizedParentId && spanMap.has(normalizedParentId)) {
                const siblings = childrenMap.get(normalizedParentId) || [];
                siblings.push(span);
                childrenMap.set(normalizedParentId, siblings);
            } else {
                // No parent or parent not found
                if (normalizedParentId && !spanMap.has(normalizedParentId)) {
                    // Parent ID exists but parent not found - orphaned
                    orphaned.push(span);
                }
                roots.push(span);
            }
        }

        // Calculate self-time and total time for each span
        const selfTimes = new Map<string, number>();
        const totalTimes = new Map<string, number>();
        
        // Build a depth map to process spans bottom-up (children before parents)
        const depthMap = new Map<string, number>();
        const calculateDepth = (spanId: string): number => {
            const normalizedId = normalizeId(spanId);
            if (!normalizedId) return 0;
            
            if (depthMap.has(normalizedId)) {
                return depthMap.get(normalizedId)!;
            }
            
            const span = spanMap.get(normalizedId);
            if (!span) return 0;
            
            const normalizedParentId = normalizeId(span.parentId);
            if (!normalizedParentId || !spanMap.has(normalizedParentId)) {
                depthMap.set(normalizedId, 0);
                return 0;
            }
            
            const depth = calculateDepth(normalizedParentId) + 1;
            depthMap.set(normalizedId, depth);
            return depth;
        };
        
        // Calculate depths for all spans
        for (const span of recentSpans) {
            const normalizedId = normalizeId(span.id);
            if (normalizedId) {
                calculateDepth(span.id);
            }
        }
        
        // Sort spans by depth (deepest first) to process bottom-up
        const sortedSpans = [...recentSpans].sort((a, b) => {
            const aDepth = depthMap.get(normalizeId(a.id) || '') || 0;
            const bDepth = depthMap.get(normalizeId(b.id) || '') || 0;
            return bDepth - aDepth; // Deepest first
        });
        
        // Calculate total time bottom-up (children first, then parents)
        for (const span of sortedSpans) {
            const normalizedId = normalizeId(span.id);
            if (!normalizedId) continue;
            
            const children = childrenMap.get(normalizedId) || [];
            const spanStart = span.startTimeMs;
            const spanEnd = span.startTimeMs + span.durationMs;
            
            if (children.length > 0) {
                // Calculate the time span covered by children (using their total times)
                const earliestStart = Math.min(
                    spanStart,
                    ...children.map(c => c.startTimeMs)
                );
                const latestEnd = Math.max(
                    spanEnd,
                    ...children.map(c => {
                        const childId = normalizeId(c.id);
                        const childTotal = childId ? (totalTimes.get(childId) || c.durationMs) : c.durationMs;
                        return c.startTimeMs + childTotal;
                    })
                );
                
                // Total time is the span from earliest start to latest end
                const totalTime = latestEnd - earliestStart;
                totalTimes.set(normalizedId, totalTime);
                
                // Self time is total time minus the time span covered by children
                // But we need to subtract the actual children time span (not including parent's own time)
                const childrenOnlyStart = Math.min(...children.map(c => c.startTimeMs));
                const childrenOnlyEnd = Math.max(...children.map(c => {
                    const childId = normalizeId(c.id);
                    const childTotal = childId ? (totalTimes.get(childId) || c.durationMs) : c.durationMs;
                    return c.startTimeMs + childTotal;
                }));
                const childrenOnlySpan = childrenOnlyEnd - childrenOnlyStart;
                
                // Self time = total time - children time span
                selfTimes.set(normalizedId, Math.max(0, totalTime - childrenOnlySpan));
            } else {
                // No children, total time equals duration, self time equals total time
                totalTimes.set(normalizedId, span.durationMs);
                selfTimes.set(normalizedId, span.durationMs);
            }
        }

        // Calculate total call counts recursively
        const totalCallCounts = new Map<string, number>();
        const calculateTotalCallCount = (spanId: string): number => {
            const normalizedId = normalizeId(spanId);
            if (!normalizedId) return 0;
            
            if (totalCallCounts.has(normalizedId)) {
                return totalCallCounts.get(normalizedId)!;
            }
            
            const span = spanMap.get(normalizedId);
            if (!span) return 0;
            
            const callKey = `${span.name}::${span.target}`;
            const directCount = callCountMap.get(callKey) || 1;
            const children = childrenMap.get(normalizedId) || [];
            const childrenCount = children.reduce((sum, c) => sum + calculateTotalCallCount(c.id), 0);
            
            const total = directCount + childrenCount;
            totalCallCounts.set(normalizedId, total);
            return total;
        };

        // Build tree nodes recursively with path tracking
        const buildNode = (span: SpanSummary, depth: number, path: SpanSummary[] = []): TreeNode => {
            const normalizedId = normalizeId(span.id);
            const currentPath = [...path, span];
            
            let children = normalizedId ? childrenMap.get(normalizedId) || [] : [];
            
            // Apply sorting
            children = [...children].sort((a, b) => {
                let comparison = 0;
                switch (sortBy) {
                    case 'duration':
                        const aTotal = totalTimes.get(normalizeId(a.id) || '') || a.durationMs;
                        const bTotal = totalTimes.get(normalizeId(b.id) || '') || b.durationMs;
                        comparison = aTotal - bTotal;
                        break;
                    case 'selfTime':
                        const aSelf = selfTimes.get(normalizeId(a.id) || '') || 0;
                        const bSelf = selfTimes.get(normalizeId(b.id) || '') || 0;
                        comparison = aSelf - bSelf;
                        break;
                    case 'name':
                        comparison = a.name.localeCompare(b.name);
                        break;
                    case 'startTime':
                        comparison = a.startTimeMs - b.startTimeMs;
                        break;
                }
                return sortOrder === 'asc' ? comparison : -comparison;
            });
            
            const callKey = `${span.name}::${span.target}`;
            const callCount = callCountMap.get(callKey) || 1;
            
            return {
                span,
                children: children.map(c => buildNode(c, depth + 1, currentPath)),
                selfTimeMs: (normalizedId ? selfTimes.get(normalizedId) : undefined) || 0,
                totalTimeMs: (normalizedId ? totalTimes.get(normalizedId) : undefined) || span.durationMs,
                depth,
                callCount,
                totalCallCount: calculateTotalCallCount(span.id),
                path: currentPath,
            };
        };

        // Filter spans by search query
        const filteredSpans = searchQuery
            ? recentSpans.filter(span => 
                span.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                span.target.toLowerCase().includes(searchQuery.toLowerCase()) ||
                span.category.toLowerCase().includes(searchQuery.toLowerCase())
            )
            : recentSpans;

        // If a specific root is selected, use that; otherwise use all roots
        const selectedRoot = rootSpanId ? spanMap.get(rootSpanId) : null;
        let rootsToUse = selectedRoot ? [selectedRoot] : roots;
        
        // Filter roots if search is active
        if (searchQuery) {
            rootsToUse = rootsToUse.filter(r => filteredSpans.includes(r));
        }
        
        const tree = rootsToUse
            .sort((a, b) => {
                const aTotal = totalTimes.get(normalizeId(a.id) || '') || a.durationMs;
                const bTotal = totalTimes.get(normalizeId(b.id) || '') || b.durationMs;
                return bTotal - aTotal;
            })
            .map(r => buildNode(r, 0));

        // Calculate maxDuration from totalTimes, not raw durationMs
        const maxDuration = Math.max(
            ...recentSpans.map(s => {
                const normalizedId = normalizeId(s.id);
                return normalizedId ? (totalTimes.get(normalizedId) || s.durationMs) : s.durationMs;
            }),
            0
        );

        return { 
            tree, 
            maxDuration, 
            rootSpans: roots,
            orphanedSpans: orphaned,
            totalSpans: recentSpans.length,
            totalTimes
        };
    }, [recentSpans, rootSpanId, sortBy, sortOrder, searchQuery, normalizeId]);

    // Filter tree by search and orphaned visibility
    const filteredTree = useMemo(() => {
        if (!searchQuery && showOrphaned) {
            return tree;
        }

        const filterNode = (node: TreeNode): TreeNode | null => {
            const matchesSearch = !searchQuery || 
                node.span.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                node.span.target.toLowerCase().includes(searchQuery.toLowerCase()) ||
                node.span.category.toLowerCase().includes(searchQuery.toLowerCase());
            
            const isOrphaned = node.span.parentId !== null && node.path.length === 1;
            const showThis = matchesSearch && (showOrphaned || !isOrphaned);
            
            const filteredChildren = node.children
                .map(c => filterNode(c))
                .filter((c): c is TreeNode => c !== null);
            
            if (showThis || filteredChildren.length > 0) {
                return {
                    ...node,
                    children: filteredChildren,
                };
            }
            
            return null;
        };

        return tree.map(n => filterNode(n)).filter((n): n is TreeNode => n !== null);
    }, [tree, searchQuery, showOrphaned]);

    // Toggle expand/collapse
    const handleToggle = useCallback((id: string) => {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    // Expand all nodes along the path to a span
    const expandToSpan = useCallback((spanId: string) => {
        const spanMap = new Map<string, SpanSummary>();
        for (const span of recentSpans) {
            const normalizedId = normalizeId(span.id);
            if (normalizedId) {
                spanMap.set(normalizedId, span);
            }
        }

        const toExpand = new Set<string>();
        const normalizedSpanId = normalizeId(spanId);
        if (normalizedSpanId) {
            let current = spanMap.get(normalizedSpanId);
            while (current) {
                const normalizedParentId = normalizeId(current.parentId);
                if (normalizedParentId && spanMap.has(normalizedParentId)) {
                    toExpand.add(normalizedParentId);
                    current = spanMap.get(normalizedParentId);
                } else {
                    break;
                }
            }
        }

        setExpandedNodes(prev => new Set([...prev, ...toExpand]));
    }, [recentSpans, normalizeId]);

    // Flatten visible tree for rendering
    const flattenedNodes = useMemo(() => {
        const result: TreeNode[] = [];

        const traverse = (nodes: TreeNode[]) => {
            for (const node of nodes) {
                result.push(node);
                if (expandedNodes.has(node.span.id)) {
                    traverse(node.children);
                }
            }
        };

        traverse(filteredTree);
        return result;
    }, [filteredTree, expandedNodes]);

    // Expand all / collapse all
    const expandAll = useCallback(() => {
        const allIds = new Set<string>();
        const traverse = (nodes: TreeNode[]) => {
            for (const node of nodes) {
                if (node.children.length > 0) {
                    allIds.add(node.span.id);
                }
                traverse(node.children);
            }
        };
        traverse(filteredTree);
        setExpandedNodes(allIds);
    }, [filteredTree]);

    const collapseAll = useCallback(() => {
        setExpandedNodes(new Set());
    }, []);

    if (recentSpans.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                <Clock className="w-8 h-8 mb-2 opacity-50" />
                <p>No spans recorded yet.</p>
                <p className="text-xs mt-1">Open a project or perform actions to see the call tree.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30 flex-wrap">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Root:</span>
                    <select
                        className="text-xs bg-background border border-border rounded px-2 py-1 max-w-[200px]"
                        value={rootSpanId || ''}
                        onChange={(e) => setRootSpanId(e.target.value || null)}
                    >
                        <option value="">All roots ({rootSpans.length})</option>
                        {rootSpans
                            .sort((a, b) => {
                                const aTotal = totalTimes.get(normalizeId(a.id) || '') || a.durationMs;
                                const bTotal = totalTimes.get(normalizeId(b.id) || '') || b.durationMs;
                                return bTotal - aTotal;
                            })
                            .slice(0, 20)
                            .map((span) => {
                                const normalizedId = normalizeId(span.id);
                                const totalTime = normalizedId ? (totalTimes.get(normalizedId) || span.durationMs) : span.durationMs;
                                return (
                                    <option key={span.id} value={span.id}>
                                        {span.name} ({totalTime.toFixed(1)}ms)
                                    </option>
                                );
                            })}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <Search size={14} className="text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-7 w-32 text-xs"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Sort:</span>
                    <select
                        className="text-xs bg-background border border-border rounded px-2 py-1"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                    >
                        <option value="duration">Duration</option>
                        <option value="selfTime">Self Time</option>
                        <option value="name">Name</option>
                        <option value="startTime">Start Time</option>
                    </select>
                    <button
                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                        className="p-1 hover:bg-muted rounded"
                        title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                    >
                        {sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />}
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showPath}
                            onChange={(e) => setShowPath(e.target.checked)}
                            className="rounded"
                        />
                        <span>Show Path</span>
                    </label>
                    <label className="flex items-center gap-1 text-xs cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showOrphaned}
                            onChange={(e) => setShowOrphaned(e.target.checked)}
                            className="rounded"
                        />
                        <span>Show Orphaned</span>
                    </label>
                </div>

                <div className="flex-1" />

                <div className="flex items-center gap-1">
                    <button
                        onClick={expandAll}
                        className="text-xs px-2 py-1 rounded hover:bg-muted"
                    >
                        Expand All
                    </button>
                    <button
                        onClick={collapseAll}
                        className="text-xs px-2 py-1 rounded hover:bg-muted"
                    >
                        Collapse All
                    </button>
                </div>

                <div className="text-xs text-muted-foreground">
                    {totalSpans} spans • {orphanedSpans.length} orphaned
                </div>
            </div>

            {/* Header */}
            <div className="flex items-center h-9 text-xs font-medium border-b border-border bg-muted/50 text-muted-foreground pr-4 sticky top-0 z-10">
                <div className="shrink-0" style={{ width: '24px' }} />
                {showPath && <div className="w-64 shrink-0 px-2">Call Path</div>}
                <div className="flex-1 px-2">Function</div>
                <div className="w-28 shrink-0 px-2 text-right flex items-center justify-end gap-1">
                    Self Time
                    <Flame size={10} className="text-orange-500" />
                </div>
                <div className="w-28 shrink-0 px-2 text-right flex items-center justify-end gap-1">
                    Total Time
                    <Clock size={10} />
                </div>
                <div className="w-48 shrink-0 px-2 flex items-center gap-1">
                    <ArrowRight size={10} />
                    Time Bar
                </div>
                <div className="w-32 shrink-0 px-2">Category</div>
                <div className="w-24 shrink-0 px-2 text-right">Start</div>
            </div>

            {/* Tree Content - Using ScrollableArea */}
            <ScrollableArea className="flex-1">
                <div className="min-w-[800px] pb-2">
                    {flattenedNodes.length === 0 ? (
                        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                            {searchQuery ? 'No spans match your search' : 'No spans to display'}
                        </div>
                    ) : (
                        flattenedNodes.map((node) => (
                            <CallTreeRow
                                key={node.span.id}
                                node={node}
                                isExpanded={expandedNodes.has(node.span.id)}
                                onToggle={handleToggle}
                                onSelect={(span) => {
                                    selectSpan(span);
                                    expandToSpan(span.id);
                                }}
                                selectedId={selectedSpan?.id || null}
                                maxDuration={maxDuration}
                                showPath={showPath}
                            />
                        ))
                    )}
                </div>
            </ScrollableArea>

            {/* Legend */}
            <div className="flex items-center gap-4 px-3 py-1.5 border-t border-border text-[10px] text-muted-foreground bg-muted/30 flex-wrap">
                <div className="flex items-center gap-1">
                    <div className="w-3 h-2 bg-primary rounded-sm" />
                    Self time
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-2 bg-primary/20 rounded-sm" />
                    Children time
                </div>
                <div className="flex items-center gap-1">
                    <Flame size={10} className="text-orange-500" />
                    Hotspot (&gt;50% self-time, &gt;10ms)
                </div>
                <div className="flex items-center gap-1">
                    <span className="text-[10px] px-1 py-0.5 rounded bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">
                        Orphaned
                    </span>
                    Parent not found
                </div>
                <div className="flex items-center gap-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        ×N
                    </span>
                    Call count
                </div>
            </div>
        </div>
    );
};
