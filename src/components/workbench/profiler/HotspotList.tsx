import React, { useMemo } from 'react';
import { useProfilerStore } from '@/stores/profiler';

export const HotspotList: React.FC = () => {
    const { recentSpans, selectSpan, selectedSpan } = useProfilerStore();

    const hotspots = useMemo(() => {
        return [...recentSpans]
            .sort((a, b) => b.durationMs - a.durationMs)
            .slice(0, 10);
    }, [recentSpans]);

    if (hotspots.length === 0) return null;

    return (
        <div className="p-4 border-l border-border w-64 bg-card overflow-y-auto hidden xl:block">
            <h3 className="text-sm font-medium mb-4">Hotspots (Top 10)</h3>
            <div className="space-y-2">
                {hotspots.map((span, index) => (
                    <div
                        key={span.id}
                        onClick={() => selectSpan(span)}
                        className={`
                            p-2 rounded text-xs cursor-pointer border border-transparent hover:border-border hover:bg-muted/50 transition-colors
                            ${selectedSpan?.id === span.id ? 'bg-muted border-border' : ''}
                        `}
                    >
                        <div className="flex justify-between items-start mb-1 gap-2">
                            <span className="font-mono truncate font-medium flex-1" title={span.name}>
                                {span.name}
                            </span>
                            <span className="text-muted-foreground whitespace-nowrap">
                                {span.durationMs.toFixed(1)}ms
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                            <span className="truncate max-w-[120px]" title={span.target}>
                                {span.target || 'unknown'}
                            </span>
                            {index === 0 && <span className="text-red-500 font-bold">SLOWEST</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
