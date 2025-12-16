import { memo, useEffect, useRef } from "react";
import Workbench from "../workbench/Workbench";
import { useProfiler } from "@/hooks/useProfiler";
import { FrontendProfiler } from "@/lib/services/FrontendProfiler";

function EditorPage() {
    const { ProfilerWrapper } = useProfiler('EditorPage');
    const mountSpanRef = useRef<ReturnType<typeof FrontendProfiler.startSpan> | null>(null);
    
    // Track component mount phase
    if (!mountSpanRef.current) {
        mountSpanRef.current = FrontendProfiler.startSpan('EditorPage:mount', 'frontend_render');
    }
    
    // End mount span after effects run
    useEffect(() => {
        if (mountSpanRef.current) {
            // Use requestAnimationFrame to capture after first paint
            requestAnimationFrame(() => {
                if (mountSpanRef.current) {
                    mountSpanRef.current.end();
                    mountSpanRef.current = null;
                }
            });
        }
    }, []);
    
    return (
        <ProfilerWrapper>
        <div className="h-full w-full bg-background text-foreground flex flex-col overflow-hidden" data-component="editor">
            <Workbench />
        </div>
        </ProfilerWrapper>
    );
}

export default memo(EditorPage);
