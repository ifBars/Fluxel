import React, { useEffect, useMemo } from 'react';
import { useProfilerStore, useSettingsStore, densityConfigs } from '@/stores';
import { SessionControls } from '@/components/workbench/profiler/SessionControls';
import { SpanTimeline } from '@/components/workbench/profiler/SpanTimeline';
import { ProfilerTabs } from '@/components/workbench/profiler/ProfilerTabs';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel, Group, Separator } from "react-resizable-panels";

export const ProfilerPanel: React.FC = () => {
    const {
        initialize,
        refresh,
        isAvailable,
        isPanelOpen,
        togglePanel,
        isDocked,
        toggleDocked,
        panelPosition,
        panelSize,
        setPanelPosition
    } = useProfilerStore();

    const uiDensity = useSettingsStore((state) => state.uiDensity);
    const densityConfig = useMemo(() => densityConfigs[uiDensity], [uiDensity]);

    // Initial load and polling
    useEffect(() => {
        initialize();
        const interval = setInterval(refresh, 1000); // Poll every second for updates
        return () => clearInterval(interval);
    }, [initialize, refresh]);

    if (!isAvailable) return null; // Don't render in production/if disabled
    if (!isPanelOpen) return null;

    const panelStyle: React.CSSProperties = isDocked ? {
        position: 'fixed',
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        zIndex: 100,
    } : {
        position: 'fixed',
        left: panelPosition.x,
        top: panelPosition.y,
        width: panelSize.width,
        height: panelSize.height,
        zIndex: 50,
    };

    // Simple drag handler for floating mode
    const handleMouseDown = (e: React.MouseEvent) => {
        if (isDocked) return;

        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = panelPosition.x;
        const startTop = panelPosition.y;

        const handleMouseMove = (e: MouseEvent) => {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            setPanelPosition({ x: startLeft + dx, y: startTop + dy });
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div
            style={panelStyle}
            className={`
                flex flex-col bg-background border border-border shadow-2xl rounded-lg overflow-hidden
                ${isDocked ? '' : 'resize'}
            `}
        >
            {/* Header / Drag Handle */}
            <div
                onMouseDown={handleMouseDown}
                className={`
                    flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border min-h-[40px] select-none
                    ${!isDocked && 'cursor-move'}
                `}
            >
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">Performance Profiler</span>
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleDocked}
                        title={isDocked ? "Undock" : "Dock"}
                        className="h-6 w-6"
                    >
                        {isDocked ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={togglePanel}
                        className="h-6 w-6 hover:bg-destructive hover:text-white"
                    >
                        <X size={14} />
                    </Button>
                </div>
            </div>

            {/* Controls */}
            <SessionControls />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-h-0 relative">
                <Group orientation="vertical">
                    {/* Timeline - Top Section */}
                    <Panel defaultSize={60} minSize={20}>
                        <div className="h-full w-full relative">
                            <SpanTimeline />
                        </div>
                    </Panel>

                    <Separator
                        className="group panel-resize-handle bg-transparent cursor-row-resize z-50 flex items-center justify-center outline-none"
                        style={{
                            height: '10px',
                            minHeight: '10px',
                            width: '100%',
                            marginTop: '-5px',
                            marginBottom: '-5px',
                            position: 'relative',
                        }}
                    >
                        <div
                            className="w-full bg-border group-hover:bg-primary group-active:bg-primary transition-colors transition-all opacity-60 group-hover:opacity-100"
                            style={{
                                height: densityConfig.panelHandleWidth,
                            }}
                        />
                    </Separator>

                    {/* Details/Tabs - Bottom Section */}
                    <Panel defaultSize={40} minSize={20}>
                        <div className="h-full w-full relative bg-background">
                            <ProfilerTabs />
                        </div>
                    </Panel>
                </Group>
            </div>

            {/* Status Bar */}
            <div className="h-6 bg-muted/50 border-t border-border flex items-center px-4 text-[10px] text-muted-foreground justify-between shrink-0">
                <div>
                    {isDocked ? 'Docked Mode' : 'Floating Mode (Drag header to move)'}
                </div>
                <div>
                    Polling Active (1s)
                </div>
            </div>
        </div>
    );
};
