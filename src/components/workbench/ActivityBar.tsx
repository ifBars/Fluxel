import { RefObject } from "react";
import { Files, Search, GitBranch, Settings } from "lucide-react";
import { ImperativePanelHandle } from "react-resizable-panels";
import { useWorkbenchStore, ActivityItem } from "../../stores/useWorkbenchStore";

interface ActivityBarProps {
    onSettingsClick: () => void;
    sidebarPanelRef: RefObject<ImperativePanelHandle | null>;
}

export default function ActivityBar({ onSettingsClick, sidebarPanelRef }: ActivityBarProps) {
    const { activeActivity, setActiveActivity, isSidebarOpen } = useWorkbenchStore();

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
            className="w-12 flex flex-col items-center bg-muted/40 border-r border-border h-full"
            style={{
                paddingTop: 'var(--density-padding-md, 0.75rem)',
                paddingBottom: 'var(--density-padding-md, 0.75rem)',
            }}
        >
            <div 
                className="flex-1 flex flex-col"
                style={{ gap: 'var(--density-gap-md, 0.75rem)' }}
            >
                <ActivityButton
                    icon={<Files size={20} />}
                    label="Files"
                    isActive={activeActivity === 'files' && isSidebarOpen}
                    onClick={() => handleActivityClick('files')}
                />
                <ActivityButton
                    icon={<Search size={20} />}
                    label="Search"
                    isActive={activeActivity === 'search' && isSidebarOpen}
                    onClick={() => handleActivityClick('search')}
                />
                <ActivityButton
                    icon={<GitBranch size={20} />}
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
                <ActivityButton
                    icon={<Settings size={20} />}
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
