import React, { useState, useEffect } from 'react';
import { CategoryBreakdown } from './CategoryBreakdown';
import { HotspotList } from './HotspotList';
import { SpanDetails } from './SpanDetails';
import { CallTreeView } from './CallTreeView';
import { FlameGraphView } from './FlameGraphView';
import { useProfilerStore } from '@/stores/profiler';
import { PieChart, List, Activity, GitBranch, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Tab = 'calltree' | 'flamegraph' | 'summary' | 'hotspots' | 'details';

export const ProfilerTabs: React.FC = () => {
    const { selectedSpan } = useProfilerStore();
    const [activeTab, setActiveTab] = useState<Tab>('calltree');

    // Auto-switch to details when a span is selected
    useEffect(() => {
        if (selectedSpan) {
            setActiveTab('details');
        }
    }, [selectedSpan]);

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'calltree', label: 'Call Tree', icon: <GitBranch size={14} /> },
        { id: 'flamegraph', label: 'Flame Graph', icon: <Flame size={14} /> },
        { id: 'summary', label: 'Summary', icon: <PieChart size={14} /> },
        { id: 'details', label: 'Span Details', icon: <Activity size={14} /> },
        { id: 'hotspots', label: 'Global Hotspots', icon: <List size={14} /> },
    ];

    return (
        <div className="flex flex-col h-full bg-card border-t border-border">
            {/* Tab Header */}
            <div className="flex items-center gap-1 p-1 border-b border-border bg-muted/30">
                {tabs.map((tab) => (
                    <Button
                        key={tab.id}
                        variant={activeTab === tab.id ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                            h-7 px-3 text-xs gap-2
                            ${activeTab === tab.id ? 'font-medium' : 'text-muted-foreground font-normal'}
                        `}
                    >
                        {tab.icon}
                        {tab.label}
                    </Button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'calltree' && (
                    <div className="absolute inset-0">
                        <CallTreeView />
                    </div>
                )}
                {activeTab === 'flamegraph' && (
                    <div className="absolute inset-0">
                        <FlameGraphView />
                    </div>
                )}
                {activeTab === 'summary' && (
                    <div className="absolute inset-0">
                        <CategoryBreakdown />
                    </div>
                )}
                {activeTab === 'details' && (
                    <div className="absolute inset-0">
                        <SpanDetails />
                    </div>
                )}
                {activeTab === 'hotspots' && (
                    <div className="absolute inset-0">
                        <HotspotList />
                    </div>
                )}
            </div>
        </div>
    );
};
