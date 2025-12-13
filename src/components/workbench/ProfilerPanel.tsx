import React, { useEffect } from 'react';
import { useProfilerStore } from '@/stores/profiler';
import { SessionControls } from './profiler/SessionControls';
import { SpanTimeline } from './profiler/SpanTimeline';
import { CategoryBreakdown } from './profiler/CategoryBreakdown';
import { HotspotList } from './profiler/HotspotList';
import { X, Maximize2, Minimize2 } from 'lucide-react';

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
                ${isDocked ? '' : 'resize overflow-auto'}
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
                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleDocked}
                        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                        title={isDocked ? "Undock" : "Dock"}
                    >
                        {isDocked ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                    <button
                        onClick={togglePanel}
                        className="p-1 hover:bg-destructive hover:text-white rounded text-muted-foreground transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Controls */}
            <SessionControls />

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden min-h-0">
                <CategoryBreakdown />
                <SpanTimeline />
                <HotspotList />
            </div>

            {/* Status Bar */}
            <div className="h-6 bg-muted/50 border-t border-border flex items-center px-4 text-[10px] text-muted-foreground justify-between">
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
