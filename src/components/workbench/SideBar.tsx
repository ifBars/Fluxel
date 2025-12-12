import { useWorkbenchStore } from "@/stores";
import FileTree from "./FileTree";
import SearchPanel from "./SearchPanel";
import GitPanel from "./GitPanel";
import ScrollableArea from "../ui/scrollable-area";

export default function Sidebar() {
    const { activeActivity } = useWorkbenchStore();

    return (
        <div className="h-full flex flex-col bg-muted/20 min-w-[14rem]">
            <div
                className="flex items-center border-b border-border"
                style={{
                    height: 'calc(2.25rem + var(--density-padding-sm, 0.5rem))',
                    paddingLeft: 'var(--density-padding-md, 0.75rem)',
                    paddingRight: 'var(--density-padding-md, 0.75rem)',
                }}
            >
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {activeActivity === 'files' && 'Explorer'}
                    {activeActivity === 'search' && 'Search'}
                    {activeActivity === 'git' && 'Source Control'}
                </span>
            </div>

            <div className="flex-1 overflow-hidden">
                {activeActivity === 'files' && (
                    <ScrollableArea className="h-full">
                        <FileTree />
                    </ScrollableArea>
                )}
                {activeActivity === 'search' && <SearchPanel />}
                {activeActivity === 'git' && <GitPanel />}
            </div>
        </div>
    );
}

