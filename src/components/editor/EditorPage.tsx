import { memo } from "react";
import Workbench from "../workbench/Workbench";
import { useProfiler } from "@/hooks/useProfiler";

function EditorPage() {
    const { ProfilerWrapper } = useProfiler('EditorPage');
    
    return (
        <ProfilerWrapper>
        <div className="h-full w-full bg-background text-foreground flex flex-col overflow-hidden">
            <Workbench />
        </div>
        </ProfilerWrapper>
    );
}

export default memo(EditorPage);
