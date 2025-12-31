import { useEffect, RefObject } from "react";
import { Files, Search, GitBranch, Settings, Activity, Bot } from "lucide-react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { useWorkbenchStore, type ActivityItem, useProfilerStore, useAgentStore } from "@/stores";

interface ActivityBarProps {
    onSettingsClick: () => void;
    sidebarPanelRef: RefObject<PanelImperativeHandle | null>;
}

export default function ActivityBar({ onSettingsClick, sidebarPanelRef }: ActivityBarProps) {
    const { activeActivity, setActiveActivity, isSidebarOpen } = useWorkbenchStore();
    const { isPanelOpen: isProfilerOpen, togglePanel: toggleProfiler, isAvailable: isProfilerAvailable, initialize } = useProfilerStore();
    const { isOpen: isAgentOpen, togglePanel: toggleAgent } = useAgentStore();

    // Initialize profiler store to check availability
    useEffect(() => {
        initialize();
    }, [initialize]);

    const handleActivityClick = (activity: ActivityItem) => {
        const panel = sidebarPanelRef.current;
        if (!panel) return;

        const isCollapsed = panel.isCollapsed();

        if (activeActivity === activity && !isCollapsed) {
            // Toggle close if clicking the already active item
            panel.collapse();
        } else {
            setActiveActivity(activity);
            if (isCollapsed) {
                panel.expand();
            }
        }
    };

    return (
        <div
            className="flex flex-col items-center bg-muted/40 border-r border-border h-full"
            style={{
                width: 'var(--activity-bar-width, 3rem)',
                paddingTop: 'var(--density-padding-md, 0.75rem)',
                paddingBottom: 'var(--density-padding-md, 0.75rem)',
            }}
        >
            <div
                className="flex-1 flex flex-col"
                style={{ gap: 'var(--density-gap-md, 0.75rem)' }}
            >
                <ActivityButton
                    icon={<Files style={{ width: 'var(--activity-bar-icon-size, 1.25rem)', height: 'var(--activity-bar-icon-size, 1.25rem)' }} />}
                    label="Files"
                    isActive={activeActivity === 'files' && isSidebarOpen}
                    onClick={() => handleActivityClick('files')}
                />
                <ActivityButton
                    icon={<Search style={{ width: 'var(--activity-bar-icon-size, 1.25rem)', height: 'var(--activity-bar-icon-size, 1.25rem)' }} />}
                    label="Search"
                    isActive={activeActivity === 'search' && isSidebarOpen}
                    onClick={() => handleActivityClick('search')}
                />
                <ActivityButton
                    icon={<GitBranch style={{ width: 'var(--activity-bar-icon-size, 1.25rem)', height: 'var(--activity-bar-icon-size, 1.25rem)' }} />}
                    label="Git"
                    isActive={activeActivity === 'git' && isSidebarOpen}
                    onClick={() => handleActivityClick('git')}
                />
            </div>

            <div
                className="flex flex-col"
                style={{
                    gap: 'var(--density-gap-md, 0.75rem)',
                    marginBottom: 'var(--density-padding-md, 0.75rem)',
                }}
            >
                {isProfilerAvailable && (
                    <ActivityButton
                        icon={<Activity style={{ width: 'var(--activity-bar-icon-size, 1.25rem)', height: 'var(--activity-bar-icon-size, 1.25rem)' }} />}
                        label="Profiler"
                        isActive={isProfilerOpen}
                        onClick={() => toggleProfiler()}
                    />
                )}
                <ActivityButton
                    icon={<Bot style={{ width: 'var(--activity-bar-icon-size, 1.25rem)', height: 'var(--activity-bar-icon-size, 1.25rem)' }} />}
                    label="AI Agent"
                    isActive={isAgentOpen}
                    onClick={() => toggleAgent()}
                />
                <ActivityButton
                    icon={<Settings style={{ width: 'var(--activity-bar-icon-size, 1.25rem)', height: 'var(--activity-bar-icon-size, 1.25rem)' }} />}
                    label="Settings"
                    isActive={false}
                    onClick={onSettingsClick}
                />
            </div>
        </div>
    );
}

function ActivityButton({ icon, label, isActive, onClick }: { icon: React.ReactNode; label: string; isActive: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            title={label}
            className={`rounded-md transition-all duration-200 relative group ${isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
            style={{
                padding: 'var(--density-padding-md, 0.75rem)',
            }}
        >
            {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-r-full" />
            )}
            {icon}
        </button>
    );
}
