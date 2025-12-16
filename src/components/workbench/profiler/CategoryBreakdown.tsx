import React, { useMemo } from 'react';
import { useProfilerStore } from '@/stores/profiler';
import type { SpanCategory } from '@/types/profiling';
import ScrollableArea from '@/components/ui/scrollable-area';
import { Info } from 'lucide-react';

export const CategoryBreakdown: React.FC = () => {
    const { recentSpans } = useProfilerStore();

    const breakdown = useMemo(() => {
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

        // Build children map for self-time calculation
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

        // Calculate self-time for each span
        const selfTimes = new Map<string, number>();
        for (const span of recentSpans) {
            const normalizedId = normalizeId(span.id);
            if (normalizedId) {
                const children = childrenMap.get(normalizedId) || [];
                const childrenTime = children.reduce((sum, c) => sum + c.durationMs, 0);
                selfTimes.set(normalizedId, Math.max(0, span.durationMs - childrenTime));
            }
        }

        const stats = new Map<SpanCategory, { total: number; selfTime: number; count: number }>();
        let grandTotal = 0;
        let grandSelfTime = 0;

        recentSpans.forEach(span => {
            const selfTime = selfTimes.get(span.id) || 0;
            const current = stats.get(span.category) || { total: 0, selfTime: 0, count: 0 };
            stats.set(span.category, {
                total: current.total + span.durationMs,
                selfTime: current.selfTime + selfTime,
                count: current.count + 1
            });
            grandTotal += span.durationMs;
            grandSelfTime += selfTime;
        });

        return Array.from(stats.entries())
            .map(([category, { total, selfTime, count }]) => ({
                category,
                total,
                selfTime,
                count,
                percentage: grandTotal > 0 ? (total / grandTotal) * 100 : 0,
                selfPercentage: grandSelfTime > 0 ? (selfTime / grandSelfTime) * 100 : 0,
                avgDuration: count > 0 ? total / count : 0,
            }))
            .sort((a, b) => b.selfTime - a.selfTime); // Sort by self-time (where CPU actually spent time)
    }, [recentSpans]);

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'frontend_render': return 'bg-blue-500';
            case 'frontend_interaction': return 'bg-purple-500';
            case 'frontend_network': return 'bg-green-500';
            case 'tauri_command': return 'bg-orange-500';
            case 'backend_operation': return 'bg-cyan-600';
            case 'file_io': return 'bg-yellow-500';
            case 'git_operation': return 'bg-pink-500';
            case 'lsp_request': return 'bg-violet-500';
            default: return 'bg-gray-500';
        }
    };

    const getCategoryLabel = (category: string) => {
        if (category === 'tauri_command') return 'Tauri Command';
        return category.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    if (breakdown.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No category data available
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            <div className="text-sm font-medium p-4 pb-2 border-b border-border bg-card shrink-0">
                <div className="flex items-center gap-2">
                    <span>CPU Time Attribution by Category</span>
                    <span className="text-xs text-muted-foreground font-normal">(Sorted by Self-Time)</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                    <Info size={12} className="mt-0.5 shrink-0" />
                    <span>Self-time shows where the CPU actually executed code, excluding time spent waiting in child calls</span>
                </p>
            </div>
            <ScrollableArea className="flex-1 p-4 pt-2">
                <div className="grid gap-3">
                    {breakdown.map((item) => (
                        <div
                            key={item.category}
                            className="p-3 rounded-lg bg-muted/30 border border-border/50 hover:border-border transition-colors"
                        >
                            {/* Header row */}
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded ${getCategoryColor(item.category)}`} />
                                    <span className="text-sm font-medium text-foreground">
                                        {getCategoryLabel(item.category)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <div className="text-xs text-muted-foreground">Self-Time</div>
                                        <div className="text-sm font-semibold text-foreground tabular-nums">
                                            {item.selfPercentage.toFixed(1)}%
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Dual progress bars */}
                            <div className="space-y-1.5 mb-2">
                                {/* Self-time bar (what matters for CPU) */}
                                <div>
                                    <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                                        <span>Self-time (CPU execution)</span>
                                        <span className="font-mono tabular-nums">{item.selfTime.toFixed(2)}ms</span>
                                    </div>
                                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${getCategoryColor(item.category)} transition-all duration-300`}
                                            style={{ width: `${Math.max(item.selfPercentage, 1)}%` }}
                                        />
                                    </div>
                                </div>
                                
                                {/* Total time bar (includes children) */}
                                <div>
                                    <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                                        <span>Total time (including children)</span>
                                        <span className="font-mono tabular-nums">{item.total.toFixed(2)}ms</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${getCategoryColor(item.category)} opacity-40 transition-all duration-300`}
                                            style={{ width: `${Math.max(item.percentage, 1)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Stats row */}
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{item.count} span{item.count !== 1 ? 's' : ''}</span>
                                <span className="font-mono tabular-nums">Avg: {item.avgDuration.toFixed(2)}ms</span>
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollableArea>
        </div>
    );
};
