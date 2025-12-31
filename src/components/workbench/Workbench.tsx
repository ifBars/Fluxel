import { useState, useRef, useMemo, useCallback, memo, lazy, Suspense, useEffect } from "react";
import { Panel, Group, Separator, usePanelRef } from "react-resizable-panels";
import { useWorkbenchStore, useEditorStore, useSettingsStore, densityConfigs, useBuildPanelStore, useTypeLoadingStore, useInspectorStore, useCSharpStore, useAgentStore } from "@/stores";
import { FrontendProfiler } from "@/lib/services/FrontendProfiler";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useProfiler } from "@/hooks/useProfiler";
import ActivityBar from "./ActivityBar";
import Sidebar from "./SideBar";
import SettingsDialog from "./SettingsDialog";
import EditorGroup from "@/components/editor/EditorGroup";


// Lazy load conditional panels to reduce initial bundle size
const BuildPanel = lazy(() => import("./BuildPanel"));
const InspectorPanel = lazy(() => import("@/components/inspector").then(mod => ({ default: mod.InspectorPanel })));
const AgentPanel = lazy(() => import("@/components/agent").then(mod => ({ default: mod.AgentPanel })));

function Workbench() {
    // Track time from render start to mount completion (captures store hydration)
    const initSpanRef = useRef<ReturnType<typeof FrontendProfiler.startSpan> | null>(null);
    if (!initSpanRef.current) {
        // Explicitly capture parent ID to ensure correct parent-child relationship
        // This ensures workbench_init is a child of EditorPage:mount if it exists
        const parentId = FrontendProfiler.getCurrentParentId();
        initSpanRef.current = FrontendProfiler.startSpan('workbench_init', 'frontend_render', {
            parentId: parentId
        });
    }

    // Use the profiler hook - ProfilerWrapper is extracted later
    useProfiler('Workbench');

    // Store selectors - no individual profiling to reduce overhead
    // Profiling overhead (~0.05-0.1ms per span) exceeds selector execution time (<0.01ms each)
    // The overall workbench_init span captures the total time
    const sidebarDefaultSize = useWorkbenchStore((state) => state.sidebarDefaultSize);
    const defaultSidebarOpen = useWorkbenchStore((state) => state.defaultSidebarOpen);

    const tabs = useEditorStore((state) => state.tabs);
    const activeTabId = useEditorStore((state) => state.activeTabId);
    const cursorPosition = useEditorStore((state) => state.cursorPosition);

    const uiDensity = useSettingsStore((state) => state.uiDensity);
    const tabSize = useSettingsStore((state) => state.tabSize);
    const wordWrap = useSettingsStore((state) => state.wordWrap);

    // Simple single-value selectors
    const isBuildPanelOpen = useBuildPanelStore((state) => state.isOpen);
    const isLoading = useTypeLoadingStore((state) => state.isLoading);
    const loadingMessage = useTypeLoadingStore((state) => state.loadingMessage);
    const isInspectorOpen = useInspectorStore((state) => state.isInspectorOpen);
    const isLoadingBuildConfigs = useCSharpStore((state) => state.isLoadingConfigs);
    const isAgentOpen = useAgentStore((state) => state.isOpen);

    // UseMemo hooks - React already optimizes these, profiling adds overhead
    // Only profile if computation is expensive (these are simple lookups)
    const activeTab = useMemo(() => {
        return tabs.find((t) => t.id === activeTabId) ?? null;
    }, [tabs, activeTabId]);

    const isActiveTabDirty = useMemo(() => {
        if (!activeTab) return false;
        return activeTab.content !== activeTab.originalContent;
    }, [activeTab]);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const sidebarPanelRef = usePanelRef();
    const buildPanelRef = usePanelRef();
    const inspectorPanelRef = usePanelRef();
    const { ProfilerWrapper } = useProfiler('Workbench');

    // Density config is a simple object lookup - no need to profile
    const densityConfig = useMemo(() => densityConfigs[uiDensity], [uiDensity]);

    // Callbacks - React already optimizes these, profiling adds overhead
    const handleSettingsClick = useCallback(() => setIsSettingsOpen(true), []);
    const handleSettingsClose = useCallback(() => setIsSettingsOpen(false), []);

    // Keyboard shortcuts hook - no need to profile hook initialization
    useKeyboardShortcuts(sidebarPanelRef);

    // Combine component initialization tracking into a single useEffect to reduce hook overhead
    useEffect(() => {
        FrontendProfiler.trackInteraction('ActivityBar:init', { component: 'ActivityBar' });
        FrontendProfiler.trackInteraction('EditorGroup:init', { component: 'EditorGroup' });
        FrontendProfiler.trackInteraction('Group:init:init', { component: 'Group:init' });
    }, []);

    // End init span after mount effects complete
    // Use requestIdleCallback to defer non-critical work and improve initial render
    useEffect(() => {
        if (initSpanRef.current) {
            // Use requestIdleCallback to defer span ending
            // This allows the UI to render first, then finalize profiling in idle time
            const scheduleProfiling = () => {
                initSpanRef.current?.end({
                    storeSelectorsCount: '15',
                    lazyPanelsLoaded: [isBuildPanelOpen, isInspectorOpen, isAgentOpen].filter(Boolean).length.toString()
                });
                initSpanRef.current = null;
            };

            // Defer to next idle period for better initial render performance
            if (typeof requestIdleCallback !== 'undefined') {
                const idleId = requestIdleCallback(scheduleProfiling, { timeout: 100 });
                return () => cancelIdleCallback(idleId);
            } else {
                // Fallback to setTimeout for browsers without requestIdleCallback
                const timeoutId = setTimeout(scheduleProfiling, 0);
                return () => clearTimeout(timeoutId);
            }
        }
    }, [isBuildPanelOpen, isInspectorOpen, isAgentOpen]);

    return (
        <ProfilerWrapper>
            <div className="flex-1 flex flex-col overflow-hidden h-full bg-background text-foreground">
                <div className="flex-1 flex overflow-hidden">
                    {/* Activity Bar Section - Fixed Width */}
                    <ActivityBar
                        onSettingsClick={handleSettingsClick}
                        sidebarPanelRef={sidebarPanelRef}
                    />

                    {/* Main Resizable Area */}
                    <Group orientation="horizontal" className="flex-1">
                        {/* Sidebar Panel */}
                        <Panel
                            panelRef={sidebarPanelRef}
                            defaultSize={defaultSidebarOpen ? sidebarDefaultSize : 0}
                            minSize={densityConfig.sidebarMinSize}
                            maxSize={densityConfig.sidebarMaxSize}
                            collapsible
                            collapsedSize={0}
                            className="bg-muted/10 border-r border-border"
                        >
                            <Sidebar />
                        </Panel>
                        <Separator
                            className="panel-resize-handle bg-border hover:bg-primary transition-colors cursor-col-resize active:bg-primary z-20 transition-all opacity-60 hover:opacity-100"
                            style={{
                                width: densityConfig.panelHandleWidth,
                                minWidth: densityConfig.panelHandleWidth,
                            }}
                        />

                        {/* Editor + Build Panel Area (Vertical Split) */}
                        <Panel minSize={30}>
                            <Group orientation="vertical">
                                {/* Editor Area */}
                                <Panel minSize={20}>
                                    <EditorGroup />
                                </Panel>

                                {/* Build Panel (Collapsible) */}
                                {isBuildPanelOpen && (
                                    <>
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
                                        <Panel
                                            panelRef={buildPanelRef}
                                            defaultSize={25}
                                            minSize={10}
                                            maxSize={50}
                                        >
                                            <Suspense fallback={<div className="flex items-center justify-center h-full">Loading...</div>}>
                                                <BuildPanel />
                                            </Suspense>
                                        </Panel>
                                    </>
                                )}
                            </Group>
                        </Panel>

                        {/* Inspector Panel (Right Sidebar) */}
                        {isInspectorOpen && (
                            <>
                                <Separator
                                    className="panel-resize-handle bg-border hover:bg-primary transition-colors cursor-col-resize active:bg-primary z-20 transition-all opacity-60 hover:opacity-100"
                                    style={{
                                        width: densityConfig.panelHandleWidth,
                                        minWidth: densityConfig.panelHandleWidth,
                                    }}
                                />
                                <Panel
                                    panelRef={inspectorPanelRef}
                                    defaultSize={20}
                                    minSize={15}
                                    maxSize={35}
                                    collapsible
                                    collapsedSize={0}
                                >
                                    <Suspense fallback={<div className="flex items-center justify-center h-full">Loading...</div>}>
                                        <InspectorPanel />
                                    </Suspense>
                                </Panel>
                            </>
                        )}

                        {/* Agent Panel (Right Sidebar) */}
                        {isAgentOpen && (
                            <>
                                <Separator
                                    className="panel-resize-handle bg-border hover:bg-primary transition-colors cursor-col-resize active:bg-primary z-20 transition-all opacity-60 hover:opacity-100"
                                    style={{
                                        width: densityConfig.panelHandleWidth,
                                        minWidth: densityConfig.panelHandleWidth,
                                    }}
                                />
                                <Panel
                                    defaultSize={25}
                                    minSize={20}
                                    maxSize={40}
                                    collapsible
                                    collapsedSize={0}
                                >
                                    <Suspense fallback={<div className="flex items-center justify-center h-full">Loading...</div>}>
                                        <AgentPanel />
                                    </Suspense>
                                </Panel>
                            </>
                        )}
                    </Group>
                </div>

                {/* Status Bar */}
                <div
                    className="bg-primary text-primary-foreground flex items-center justify-between select-none shrink-0"
                    style={{
                        height: densityConfig.statusBarHeight,
                        fontSize: densityConfig.statusBarFontSize,
                        paddingLeft: densityConfig.densityPaddingMd,
                        paddingRight: densityConfig.densityPaddingMd,
                    }}
                >
                    <div
                        className="flex items-center"
                        style={{ gap: 'var(--density-gap-md, 0.75rem)' }}
                    >
                        {activeTab && (
                            <>
                                {isActiveTabDirty && <span>{activeTab.filename}*</span>}
                                {!isActiveTabDirty && <span>{activeTab.filename}</span>}
                            </>
                        )}
                        {!activeTab && <span>Fluxel</span>}

                        {/* Type Loading Indicator */}
                        {isLoading && loadingMessage && (
                            <span className="flex items-center gap-1 opacity-80 text-xs">
                                <svg
                                    className="animate-spin h-3 w-3"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                </svg>
                                {loadingMessage}
                            </span>
                        )}

                        {/* Build Config Loading Indicator */}
                        {isLoadingBuildConfigs && (
                            <span className="flex items-center gap-1 opacity-80 text-xs">
                                <svg
                                    className="animate-spin h-3 w-3"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                </svg>
                                Loading build config...
                            </span>
                        )}
                    </div>
                    <div
                        className="flex items-center"
                        style={{ gap: 'var(--density-gap-md, 0.75rem)' }}
                    >
                        {activeTab && (
                            <>
                                {cursorPosition ? (
                                    <span>
                                        Ln {cursorPosition.line}, Col {cursorPosition.column}
                                        {cursorPosition.selectionLength > 0 && ` Sel: ${cursorPosition.selectionLength}`}
                                    </span>
                                ) : (
                                    <span>Ln 1, Col 1</span>
                                )}
                                <span>UTF-8</span>
                                <span>LF</span>
                                <span>{activeTab.language}</span>
                                <span>TS: {tabSize}</span>
                                <span>Wrap: {wordWrap ? 'on' : 'off'}</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Settings Modal */}
                <SettingsDialog isOpen={isSettingsOpen} onClose={handleSettingsClose} />


            </div>
        </ProfilerWrapper>
    );
}

export default memo(Workbench);
