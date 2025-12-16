import React, { useMemo } from 'react';
import { useProfilerStore } from '@/stores/profiler';
import ScrollableArea from '@/components/ui/scrollable-area';
import { Badge } from '@/components/ui/badge';
import { Flame } from 'lucide-react';

export const HotspotList: React.FC = () => {
    const { recentSpans, selectSpan, selectedSpan } = useProfilerStore();

    // Calculate self-time hotspots
    const hotspots = useMemo(() => {
        // Normalize IDs: ensure all IDs are strings and trimmed
        const normalizeId = (id: string | null | undefined): string | null => {
            if (!id) return null;
            return String(id).trim();
        };

        // Create span map for parent lookup (normalize IDs)
        const spanMap = new Map<string, typeof recentSpans[0]>();
        for (const span of recentSpans) {
            const normalizedId = normalizeId(span.id);
            if (normalizedId) {
                spanMap.set(normalizedId, span);
            }
        }

        // Build children map
        const childrenMap = new Map<string, typeof recentSpans>();
        for (const span of recentSpans) {
            const normalizedParentId = normalizeId(span.parentId);
            
            // Only add to children map if parent exists
            if (normalizedParentId && spanMap.has(normalizedParentId)) {
                const siblings = childrenMap.get(normalizedParentId) || [];
                siblings.push(span);
                childrenMap.set(normalizedParentId, siblings);
            }
        }

        // Calculate self-time
        const spansWithSelfTime = recentSpans.map(span => {
            const normalizedId = normalizeId(span.id);
            const children = (normalizedId ? childrenMap.get(normalizedId) || [] : []);
            const childrenTime = children.reduce((sum, c) => sum + c.durationMs, 0);
            const selfTime = Math.max(0, span.durationMs - childrenTime);
            
            return {
                span,
                selfTimeMs: selfTime,
                totalTimeMs: span.durationMs,
                selfRatio: span.durationMs > 0 ? selfTime / span.durationMs : 0,
                childCount: children.length,
            };
        });

        // Sort by self-time and filter out trivial spans
        return spansWithSelfTime
            .filter(h => h.selfTimeMs > 0.1) // Only show spans with >0.1ms self-time
            .sort((a, b) => b.selfTimeMs - a.selfTimeMs)
            .slice(0, 20); // Show top 20
    }, [recentSpans]);

    const getRankColor = (index: number) => {
        if (index === 0) return 'bg-red-500 text-white';
        if (index === 1) return 'bg-orange-500 text-white';
        if (index === 2) return 'bg-yellow-500 text-black';
        return 'bg-muted text-muted-foreground';
    };

    if (hotspots.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No hotspot data available
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            <div className="text-sm font-medium p-4 pb-2 border-b border-border bg-card shrink-0">
                <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <span>CPU Hotspots by Self-Time (Top 20)</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                    Functions spending the most time executing their own code (excluding children)
                </p>
            </div>
            <ScrollableArea className="flex-1 p-4 pt-2">
                <div className="grid gap-2">
                    {hotspots.map((hotspot, index) => {
                        const { span, selfTimeMs, totalTimeMs, selfRatio, childCount } = hotspot;
                        const isHighSelfTime = selfRatio > 0.7; // >70% self-time
                        
                        return (
                            <div
                                key={span.id}
                                onClick={() => selectSpan(span)}
                                className={`
                                    group flex items-center gap-3 p-3 rounded-lg cursor-pointer 
                                    border border-border/50 bg-muted/20
                                    hover:border-border hover:bg-muted/50 transition-all
                                    ${selectedSpan?.id === span.id ? 'bg-muted border-primary/50 ring-1 ring-primary/30' : ''}
                                `}
                            >
                                {/* Rank badge */}
                                <div className={`w-7 h-7 rounded flex items-center justify-center text-xs font-bold shrink-0 ${getRankColor(index)}`}>
                                    {index + 1}
                                </div>

                                {/* Main content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <span
                                                className="font-mono text-xs truncate font-medium text-foreground group-hover:text-foreground"
                                                title={span.name}
                                            >
                                                {span.name}
                                            </span>
                                            {isHighSelfTime && (
                                                <span title="High self-time ratio">
                                                    <Flame size={12} className="text-orange-500 shrink-0" />
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-xs text-muted-foreground font-mono tabular-nums">
                                                {selfTimeMs.toFixed(2)}ms
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                ({(selfRatio * 100).toFixed(0)}%)
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                        <span className="truncate" title={span.target}>
                                            {span.target || 'unknown'}
                                        </span>
                                        <span className="shrink-0">•</span>
                                        <span className="shrink-0 font-mono tabular-nums" title="Total time including children">
                                            Total: {totalTimeMs.toFixed(2)}ms
                                        </span>
                                        {childCount > 0 && (
                                            <>
                                                <span className="shrink-0">•</span>
                                                <span className="shrink-0" title="Number of direct child spans">
                                                    {childCount} {childCount === 1 ? 'child' : 'children'}
                                                </span>
                                            </>
                                        )}
                                        {index === 0 && (
                                            <Badge variant="destructive" className="h-4 px-1 text-[9px] uppercase tracking-wider ml-auto">
                                                Top Hotspot
                                            </Badge>
                                        )}
                                    </div>
                                    
                                    {/* Visual bar showing self-time vs total time */}
                                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div className="relative h-full">
                                            {/* Total time background */}
                                            <div
                                                className="absolute inset-y-0 left-0 bg-primary/30 rounded-full"
                                                style={{ width: '100%' }}
                                            />
                                            {/* Self time foreground */}
                                            <div
                                                className={`absolute inset-y-0 left-0 rounded-full ${isHighSelfTime ? 'bg-orange-500' : 'bg-primary'}`}
                                                style={{ width: `${selfRatio * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollableArea>
            
            {/* Legend */}
            <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-[10px] text-muted-foreground bg-muted/30 shrink-0">
                <div className="flex items-center gap-1">
                    <div className="w-3 h-1.5 bg-primary rounded-sm" />
                    Self time
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-1.5 bg-primary/30 rounded-sm" />
                    Children time
                </div>
                <div className="flex items-center gap-1">
                    <Flame size={10} className="text-orange-500" />
                    High self-time ratio (\u003e70%)
                </div>
            </div>
        </div>
    );
};
