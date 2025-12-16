import React, { useMemo, useState } from 'react';
import { useProfilerStore } from '@/stores/profiler';
import ScrollableArea from '@/components/ui/scrollable-area';
import { ArrowDown, ArrowUp } from 'lucide-react';

type SortKey = 'startTime' | 'duration' | 'name';
type SortOrder = 'asc' | 'desc';

export const SpanTimeline: React.FC = () => {
    const { recentSpans, selectedSpan, selectSpan } = useProfilerStore();
    const [sortKey, setSortKey] = useState<SortKey>('startTime');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

    // Calculate timeline bounds
    const { minTime, duration } = useMemo(() => {
        if (recentSpans.length === 0) return { minTime: 0, maxTime: 1000, duration: 1000 };

        let min = Infinity;
        let max = -Infinity;

        recentSpans.forEach(span => {
            min = Math.min(min, span.startTimeMs);
            max = Math.max(max, span.startTimeMs + span.durationMs);
        });

        // Add some padding
        const range = max - min;
        return {
            minTime: min,
            duration: range || 100 // Avoid divide by zero
        };
    }, [recentSpans]);

    // Derived sorted spans
    const sortedSpans = useMemo(() => {
        return [...recentSpans].sort((a, b) => {
            let valA: string | number = a.name;
            let valB: string | number = b.name;

            if (sortKey === 'startTime') {
                valA = a.startTimeMs;
                valB = b.startTimeMs;
            } else if (sortKey === 'duration') {
                valA = a.durationMs;
                valB = b.durationMs;
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }, [recentSpans, sortKey, sortOrder]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortOrder('asc');
        }
    };

    // Helper to get category color
    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'frontend_render': return 'bg-blue-500';
            case 'frontend_interaction': return 'bg-purple-500';
            case 'frontend_network': return 'bg-green-500';
            case 'tauri_command': return 'bg-orange-500';
            case 'backend_operation': return 'bg-cyan-600';
            case 'file_io': return 'bg-yellow-500';
            default: return 'bg-gray-500';
        }
    };

    if (recentSpans.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center text-muted-foreground p-8">
                No spans recorded. Start a session or interact with the app.
            </div>
        );
    }

    return (
        <ScrollableArea className="flex-1 h-full p-4 relative">
            <div className="min-w-[700px]">
                {/* Time Axis Header & Filtering */}
                <div className="flex items-center mb-3 pb-2 border-b border-border sticky top-0 bg-card z-20 gap-4">
                    {/* Sortable Headers */}
                    <div className="w-[200px] flex items-center gap-1 shrink-0 px-2 cursor-pointer hover:bg-muted/50 rounded py-1" onClick={() => handleSort('name')}>
                        <span className="text-xs font-medium text-foreground">Span Name</span>
                        {sortKey === 'name' && (sortOrder === 'asc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                    </div>

                    <div className="flex-1 relative h-6">
                        {/* Timeline Axis Labels */}
                        <div className="absolute inset-0 flex justify-between text-[10px] text-muted-foreground items-center px-1">
                            <span className="cursor-pointer hover:text-foreground" onClick={() => handleSort('startTime')}>
                                0ms {sortKey === 'startTime' && (sortOrder === 'asc' ? '→' : '←')}
                            </span>
                            <span>{(duration / 2).toFixed(1)}ms</span>
                            <span>{duration.toFixed(1)}ms</span>
                        </div>
                    </div>

                    <div className="w-24 flex justify-end items-center gap-1 shrink-0 px-2 cursor-pointer hover:bg-muted/50 rounded py-1" onClick={() => handleSort('duration')}>
                        <span className="text-xs font-medium text-foreground">Duration</span>
                        {sortKey === 'duration' && (sortOrder === 'asc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                    </div>
                </div>

                {/* Spans Container with Grid */}
                <div className="relative space-y-1">
                    {/* Background Grid Lines */}
                    <div className="absolute inset-0 pointer-events-none flex justify-between px-[200px] pl-[208px] pr-[104px] z-0 opacity-10">
                        <div className="h-full border-l border-foreground"></div>
                        <div className="h-full border-l border-foreground"></div>
                        <div className="h-full border-l border-foreground"></div>
                        <div className="h-full border-l border-foreground"></div>
                        <div className="h-full border-l border-foreground"></div>
                    </div>

                    {sortedSpans.map((span) => {
                        const startPercent = ((span.startTimeMs - minTime) / duration) * 100;
                        const widthPercent = Math.max((span.durationMs / duration) * 100, 0.2); // Min valid width for visibility

                        return (
                            <div
                                key={span.id}
                                className={`
                                    group flex items-center h-8 hover:bg-muted/40 rounded-sm cursor-pointer transition-colors relative z-10
                                    ${selectedSpan?.id === span.id ? 'bg-muted/60 ring-1 ring-primary/40' : ''}
                                `}
                                onClick={() => selectSpan(span)}
                            >
                                {/* Label Column */}
                                <div className="w-[200px] shrink-0 px-2 truncate">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getCategoryColor(span.category)}`} />
                                        <span className="text-xs font-mono text-muted-foreground group-hover:text-foreground truncate" title={span.name}>
                                            {span.name}
                                        </span>
                                    </div>
                                </div>

                                {/* Bar Container Column */}
                                <div className="flex-1 relative h-6 mx-2">
                                    <div
                                        className={`absolute h-4 top-1 rounded-[2px] ${getCategoryColor(span.category)} opacity-70 group-hover:opacity-100 transition-all hover:h-5 hover:-top-0.5`}
                                        title={`${span.name} (${span.durationMs.toFixed(2)}ms)`}
                                        style={{
                                            left: `${startPercent}%`,
                                            width: `${widthPercent}%`,
                                            maxWidth: '100%'
                                        }}
                                    />
                                </div>

                                {/* Duration Column */}
                                <div className="w-24 shrink-0 text-right px-2">
                                    <span className="text-xs font-mono tabular-nums text-muted-foreground group-hover:text-foreground">
                                        {span.durationMs.toFixed(2)}ms
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </ScrollableArea>
    );
};
