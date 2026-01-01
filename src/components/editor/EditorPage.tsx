import { memo, useEffect, useRef } from "react";
import Workbench from "../workbench/Workbench";
import { useProfiler } from "@/hooks/useProfiler";
import { usePlugins } from "@/hooks/usePlugins";
import { FrontendProfiler } from "@/lib/services/FrontendProfiler";
import { LanguageController } from "./LanguageController";

function EditorPage() {
    const { ProfilerWrapper } = useProfiler('EditorPage');
    const mountSpanRef = useRef<ReturnType<typeof FrontendProfiler.startSpan> | null>(null);
    const moduleLoadedTime = useRef<number>(performance.now());

    // Initialize plugin system when editor loads
    usePlugins({ autoInit: true, loadCommunity: true });

    // Track component initialization (module just loaded and function called)
    if (!mountSpanRef.current) {
        const initTime = performance.now();
        const initSpan = FrontendProfiler.startSpan('EditorPage:init', 'frontend_render');
        initSpan.end({
            timeSinceModuleLoad: String((initTime - moduleLoadedTime.current).toFixed(2))
        });

        mountSpanRef.current = FrontendProfiler.startSpan('EditorPage:mount', 'frontend_render');
    }

    // End mount span after effects run and first paint completes
    useEffect(() => {
        if (mountSpanRef.current) {
            // Use requestAnimationFrame to capture after first paint
            requestAnimationFrame(() => {
                if (mountSpanRef.current) {
                    const mountTime = performance.now();
                    mountSpanRef.current.end({
                        totalMountTime: String((mountTime - moduleLoadedTime.current).toFixed(2))
                    });
                    mountSpanRef.current = null;
                }
            });
        }
    }, []);

    return (
        <ProfilerWrapper>
            <LanguageController />
            <div className="h-full w-full bg-background text-foreground flex flex-col overflow-hidden" data-component="editor">
                <Workbench />
            </div>
        </ProfilerWrapper>
    );
}

export default memo(EditorPage);
