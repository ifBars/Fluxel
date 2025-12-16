import React, { useEffect } from 'react';
import { useProfilerStore } from '@/stores/profiler';
import { Clock, AlertTriangle, List, Activity } from 'lucide-react';

export const SpanDetails: React.FC = () => {
    const { selectedSpan, attribution, analyzeSpan, isLoading } = useProfilerStore();

    useEffect(() => {
        if (selectedSpan && !attribution) {
            analyzeSpan(selectedSpan.id);
        }
    }, [selectedSpan, attribution, analyzeSpan]);

    if (!selectedSpan) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                <Activity className="w-8 h-8 mb-2 opacity-50" />
                <p>Select a span from the timeline to view details.</p>
            </div>
        );
    }

    if (isLoading && !attribution) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                Loading analysis...
            </div>
        );
    }

    if (!attribution) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                No analysis available.
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-4 space-y-6">
            {/* Header */}
            <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    {selectedSpan.name}
                    <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {selectedSpan.category}
                    </span>
                </h3>
                <div className="text-sm text-muted-foreground mt-1 font-mono">
                    {selectedSpan.target}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-card border border-border rounded-lg">
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                        <Clock size={12} />
                        Total Duration
                    </div>
                    <div className="text-lg font-mono font-medium">
                        {attribution.totalTimeMs.toFixed(2)}ms
                    </div>
                </div>
                <div className="p-3 bg-card border border-border rounded-lg">
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                        <List size={12} />
                        Critical Path
                    </div>
                    <div className="text-lg font-mono font-medium">
                        {attribution.criticalPath.length} nodes
                    </div>
                </div>
                <div className="p-3 bg-card border border-border rounded-lg">
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                        <AlertTriangle size={12} />
                        Hotspots
                    </div>
                    <div className="text-lg font-mono font-medium">
                        {attribution.hotspots.length}
                    </div>
                </div>
            </div>

            {/* Critical Path */}
            <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    Critical Path
                    <span className="text-xs text-muted-foreground font-normal">
                        (Sequence contributing to total time)
                    </span>
                </h4>
                <div className="space-y-2 border-l-2 border-primary/20 ml-1 pl-4">
                    {attribution.criticalPath.map((node) => (
                        <div key={node.id} className="relative">
                            <div className="absolute -left-[21px] top-2 w-2 h-2 rounded-full bg-primary/20 ring-4 ring-background" />
                            <div className="p-2 rounded bg-muted/30 text-sm">
                                <div className="flex justify-between">
                                    <span className="font-medium">{node.name}</span>
                                    <span className="font-mono text-muted-foreground">{node.durationMs.toFixed(2)}ms</span>
                                </div>
                                <div className="text-xs text-muted-foreground truncate">{node.target}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

             {/* Fields/Metadata */}
             {selectedSpan.fields && selectedSpan.fields.length > 0 && (
                <div>
                    <h4 className="text-sm font-medium mb-2">Metadata</h4>
                    <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                        {selectedSpan.fields.map(([key, value], i) => (
                            <div key={i} className="flex text-xs font-mono">
                                <span className="text-muted-foreground w-24 shrink-0">{key}:</span>
                                <span className="text-foreground break-all">{value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
