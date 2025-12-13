import React, { useMemo } from 'react';
import { useProfilerStore } from '@/stores/profiler';

export const SpanTimeline: React.FC = () => {
    const { recentSpans, selectedSpan, selectSpan } = useProfilerStore();

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

    // Helper to get category color
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

    if (recentSpans.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center text-muted-foreground p-8">
                No spans recorded. Start a session or interact with the app.
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto p-4 relative">
            <div className="min-w-[800px]">
                {/* Time Axis */}
                <div className="flex justify-between text-xs text-muted-foreground mb-2 border-b border-border pb-1">
                    <span>0ms</span>
                    <span>{(duration / 2).toFixed(1)}ms</span>
                    <span>{duration.toFixed(1)}ms</span>
                </div>

                {/* Spans */}
                <div className="space-y-1">
                    {recentSpans.map((span) => {
                        const startPercent = ((span.startTimeMs - minTime) / duration) * 100;
                        const widthPercent = Math.max((span.durationMs / duration) * 100, 0.5); // Min valid width

                        return (
                            <div
                                key={span.id}
                                className={`
                                    group flex items-center h-6 hover:bg-muted/50 rounded cursor-pointer transition-colors
                                    ${selectedSpan?.id === span.id ? 'bg-muted ring-1 ring-ring' : ''}
                                `}
                                onClick={() => selectSpan(span)}
                            >
                                {/* Label (Fixed Width) */}
                                <div className="w-48 shrink-0 truncate text-xs px-2 font-mono text-muted-foreground group-hover:text-foreground">
                                    {span.name}
                                </div>

                                {/* Bar Container */}
                                <div className="flex-1 relative h-full mx-2">
                                    <div
                                        className={`absolute h-4 top-1 rounded-sm ${getCategoryColor(span.category)} opacity-80 group-hover:opacity-100 transition-opacity`}
                                        style={{
                                            left: `${startPercent}%`,
                                            width: `${widthPercent}%`,
                                        }}
                                    />
                                </div>

                                {/* Duration Label */}
                                <div className="w-16 shrink-0 text-right text-xs px-2 text-muted-foreground">
                                    {span.durationMs.toFixed(2)}ms
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
