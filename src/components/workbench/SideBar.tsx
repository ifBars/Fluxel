import { memo, useMemo, lazy, Suspense } from "react";
import { useWorkbenchStore } from "@/stores";
import { useProfiler } from "@/hooks/useProfiler";
import FileTree from "./FileTree";
import ScrollableArea from "../ui/scrollable-area";

// Lazy-load panels that aren't visible on initial mount
const SearchPanel = lazy(() => import('./SearchPanel'));
const GitPanel = lazy(() => import('./GitPanel'));

function Sidebar() {
    const activeActivity = useWorkbenchStore((state) => state.activeActivity);
    const { ProfilerWrapper } = useProfiler('SideBar');

    const activityLabel = useMemo(() => {
        if (activeActivity === 'files') return 'Explorer';
        if (activeActivity === 'search') return 'Search';
        if (activeActivity === 'git') return 'Source Control';
        return '';
    }, [activeActivity]);

    return (
        <ProfilerWrapper>
            <div className="h-full flex flex-col bg-muted/20">
                <div
                    className="flex items-center border-b border-border"
                    style={{
                        height: 'calc(2.25rem + var(--density-padding-sm, 0.5rem))',
                        paddingLeft: 'var(--density-padding-md, 0.75rem)',
                        paddingRight: 'var(--density-padding-md, 0.75rem)',
                    }}
                >
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {activityLabel}
                    </span>
                </div>

                <div className="flex-1 overflow-hidden">
                    {activeActivity === 'files' && (
                        <ScrollableArea className="h-full">
                            <FileTree />
                        </ScrollableArea>
                    )}
                    {activeActivity === 'search' && (
                        <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading...</div>}>
                            <SearchPanel />
                        </Suspense>
                    )}
                    {activeActivity === 'git' && (
                        <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading...</div>}>
                            <GitPanel />
                        </Suspense>
                    )}
                </div>
            </div>
        </ProfilerWrapper>
    );
}

export default memo(Sidebar);

