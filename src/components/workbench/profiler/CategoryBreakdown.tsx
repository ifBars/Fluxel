import React, { useMemo } from 'react';
import { useProfilerStore } from '@/stores/profiler';
import type { SpanCategory } from '@/types/profiling';

export const CategoryBreakdown: React.FC = () => {
    const { recentSpans } = useProfilerStore();

    const breakdown = useMemo(() => {
        const stats = new Map<SpanCategory, { total: number; count: number }>();
        let grandTotal = 0;

        recentSpans.forEach(span => {
            const current = stats.get(span.category) || { total: 0, count: 0 };
            stats.set(span.category, {
                total: current.total + span.durationMs,
                count: current.count + 1
            });
            grandTotal += span.durationMs;
        });

        return Array.from(stats.entries())
            .map(([category, { total, count }]) => ({
                category,
                total,
                count,
                percentage: grandTotal > 0 ? (total / grandTotal) * 100 : 0
            }))
            .sort((a, b) => b.total - a.total);
    }, [recentSpans]);

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'frontend_render': return 'bg-blue-500';
            case 'frontend_interaction': return 'bg-purple-500';
            case 'frontend_network': return 'bg-green-500';
            case 'tauri_command': return 'bg-orange-500';
            case 'file_io': return 'bg-yellow-500';
            default: return 'bg-gray-500';
        }
    };

    const getCategoryLabel = (category: string) => {
        return category.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    if (breakdown.length === 0) return null;

    return (
        <div className="p-4 border-r border-border w-80 bg-card overflow-y-auto">
            <h3 className="text-sm font-medium mb-4">Category Breakdown</h3>
            <div className="space-y-4">
                {breakdown.map((item) => (
                    <div key={item.category} className="space-y-1">
                        <div className="flex justify-between text-xs">
                            <span className="font-medium text-foreground">{getCategoryLabel(item.category)}</span>
                            <span className="text-muted-foreground">{item.percentage.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div
                                className={`h-full ${getCategoryColor(item.category)}`}
                                style={{ width: `${item.percentage}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{item.count} spans</span>
                            <span>{item.total.toFixed(1)}ms</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
