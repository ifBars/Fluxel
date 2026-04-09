import { useState, useRef, useMemo, useCallback, memo, lazy, Suspense } from "react";
import { Panel, Group, Separator, usePanelRef } from "react-resizable-panels";
import { useWorkbenchStore, useEditorStore, useSettingsStore, densityConfigs, useBuildPanelStore, useTypeLoadingStore, useInspectorStore, useCSharpStore, useAgentStore, useNavigationStore, useDebugStore, usePluginStore } from "@/stores";
import { FrontendProfiler } from "@/lib/services";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useDefaultCommands } from "@/hooks/useCommands";
import { useProfiler } from "@/hooks/useProfiler";
import { clearOldPanelLayouts } from "@/lib/utils/clearPanelLayouts";
import { formatScheduleOneProjectTags, isScheduleOneDetectedProject } from "@/plugins/s1api/projectProfile";
import ActivityBar from "./ActivityBar";
import Sidebar from "./SideBar";
import SettingsDialog from "./SettingsDialog";
import CommandPalette from "./CommandPalette";
import SymbolSearchDialog from "./SymbolSearchDialog";
import QuickOutline from "./QuickOutline";
import EditorGroup from "@/components/editor/EditorGroup";
import { useReactiveEffect } from "@/hooks/useReactiveEffect";


// Lazy load conditional panels to reduce initial bundle size
const BuildPanel = lazy(() => import("./BuildPanel"));
const InspectorPanel = lazy(() => import("@/components/inspector").then(mod => ({ default: mod.InspectorPanel })));
const AgentPanel = lazy(() => import("@/components/agent").then(mod => ({ default: mod.AgentPanel })));
const DebugPanel = lazy(() => import("./DebugPanel"));

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

    // Store selectors - optimized to prevent unnecessary re-renders
    const defaultSidebarOpen = useWorkbenchStore((state) => state.defaultSidebarOpen);

    // Use individual selectors for editor store to prevent re-renders when other fields change
    const tabs = useEditorStore((state) => state.tabs);
    const activeTabId = useEditorStore((state) => state.activeTabId);
    const cursorPosition = useEditorStore((state) => state.cursorPosition);

    // Settings store selectors
    const uiDensity = useSettingsStore((state) => state.uiDensity);
    const tabSize = useSettingsStore((state) => state.tabSize);
    const wordWrap = useSettingsStore((state) => state.wordWrap);

    // Other store selectors
    const isBuildPanelOpen = useBuildPanelStore((state) => state.isOpen);
    const isLoading = useTypeLoadingStore((state) => state.isLoading);
    const loadingMessage = useTypeLoadingStore((state) => state.loadingMessage);
    const isInspectorOpen = useInspectorStore((state) => state.isInspectorOpen);
    const isLoadingBuildConfigs = useCSharpStore((state) => state.isLoadingConfigs);
    const isAgentOpen = useAgentStore((state) => state.isOpen);
    const isDebugOpen = useDebugStore((state) => state.isPanelOpen);
    const detectedProjects = usePluginStore((state) => state.detectedProjects);

    // Navigation dialogs
    const isSymbolSearchOpen = useNavigationStore((state) => state.isSymbolSearchOpen);
    const closeSymbolSearch = useNavigationStore((state) => state.closeSymbolSearch);
    const isQuickOutlineOpen = useNavigationStore((state) => state.isQuickOutlineOpen);
    const closeQuickOutline = useNavigationStore((state) => state.closeQuickOutline);

    // Memoized computations
    const activeTab = useMemo(() => {
        return tabs.find((t) => t.id === activeTabId) ?? null;
    }, [tabs, activeTabId]);

    const isActiveTabDirty = useMemo(() => {
        if (!activeTab) return false;
        return activeTab.content !== activeTab.originalContent;
    }, [activeTab]);

    const scheduleOneProjectTags = useMemo(() => {
        const detectedProject = detectedProjects.find((project) => isScheduleOneDetectedProject(project));
        return formatScheduleOneProjectTags(detectedProject);
    }, [detectedProjects]);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settingsSection, setSettingsSection] = useState<string | undefined>();

    // Subscribe to agent settings trigger
    const agentSettingsOpen = useAgentStore((state) => state.settingsOpen);
    const agentSettingsSection = useAgentStore((state) => state.settingsSection);
    const agentToggleSettings = useAgentStore((state) => state.toggleSettings);
    const sidebarPanelRef = usePanelRef();
    const buildPanelRef = usePanelRef();
    const inspectorPanelRef = usePanelRef();
    const { ProfilerWrapper } = useProfiler('Workbench');

    // Density config is a simple object lookup - no need to profile
    const densityConfig = useMemo(() => densityConfigs[uiDensity], [uiDensity]);

    // Stable callbacks
    const handleSettingsClick = useCallback(() => {
        setSettingsSection(undefined);
        setIsSettingsOpen(true);
    }, []);
    
    const handleSettingsClose = useCallback(() => {
        setIsSettingsOpen(false);
        setSettingsSection(undefined);
        if (agentSettingsOpen) {
            agentToggleSettings();
        }
    }, [agentSettingsOpen, agentToggleSettings]);

    const handleWorkbenchLayoutChange = useCallback(() => {
        window.dispatchEvent(new Event("fluxel:workbench-layout"));
    }, []);

    const renderVerticalSeparator = useCallback(() => (
        <Separator
            className="group panel-resize-handle bg-transparent cursor-col-resize z-20 flex items-center justify-center outline-none shrink-0"
            style={{
                width: "10px",
                minWidth: "10px",
                marginLeft: "-5px",
                marginRight: "-5px",
                position: "relative",
            }}
        >
            <div
                className="h-full bg-border group-hover:bg-primary group-active:bg-primary transition-colors opacity-60 group-hover:opacity-100"
                style={{
                    width: densityConfig.panelHandleWidth,
                }}
            />
        </Separator>
    ), [densityConfig.panelHandleWidth]);

    // Sync AgentStore settings trigger to local state
    useReactiveEffect(() => {
        if (agentSettingsOpen) {
            setSettingsSection(agentSettingsSection);
            setIsSettingsOpen(true);
        }
    }, [agentSettingsOpen, agentSettingsSection]);

    // Keyboard shortcuts hook
    useKeyboardShortcuts(sidebarPanelRef);

    // Register default commands for command palette
    useDefaultCommands();

    // Combine component initialization tracking into a single useReactiveEffect
    useReactiveEffect(() => {
        clearOldPanelLayouts();

        FrontendProfiler.trackInteraction('ActivityBar:init', { component: 'ActivityBar' });
        FrontendProfiler.trackInteraction('EditorGroup:init', { component: 'EditorGroup' });
        FrontendProfiler.trackInteraction('Group:init:init', { component: 'Group:init' });
    }, []);

    // End init span after mount effects complete
    useReactiveEffect(() => {
        if (initSpanRef.current) {
            const scheduleProfiling = () => {
                initSpanRef.current?.end({
                    storeSelectorsCount: '15',
                    lazyPanelsLoaded: [isBuildPanelOpen, isInspectorOpen, isAgentOpen].filter(Boolean).length.toString()
                });
                initSpanRef.current = null;
            };

            if (typeof requestIdleCallback !== 'undefined') {
                const idleId = requestIdleCallback(scheduleProfiling, { timeout: 100 });
                return () => cancelIdleCallback(idleId);
            } else {
                const timeoutId = setTimeout(scheduleProfiling, 0);
                return () => clearTimeout(timeoutId);
            }
        }
    }, [isBuildPanelOpen, isInspectorOpen, isAgentOpen]);

    return (
        <ProfilerWrapper>
            <div className="flex-1 flex flex-col overflow-hidden h-full min-h-0 min-w-0 bg-background text-foreground">
                <div className="flex-1 flex overflow-hidden min-h-0 min-w-0">
                    {/* Activity Bar Section - Fixed Width */}
                    <ActivityBar
                        onSettingsClick={handleSettingsClick}
                        sidebarPanelRef={sidebarPanelRef}
                    />

                    {/* Main Resizable Area */}
                    <Group
                        id="workbench-main"
                        orientation="horizontal"
                        onLayoutChange={handleWorkbenchLayoutChange}
                        className="flex-1 min-h-0 min-w-0"
                    >
                        {/* Sidebar Panel */}
                        <Panel
                            id="sidebar"
                            panelRef={sidebarPanelRef}
                            defaultSize={defaultSidebarOpen ? densityConfig.sidebarDefaultSize : 0}
                            minSize={densityConfig.sidebarMinSize}
                            maxSize={densityConfig.sidebarMaxSize}
                            collapsible
                            collapsedSize={0}
                            className="bg-muted/10 border-r border-border min-h-0 min-w-0 overflow-hidden"
                        >
                            <Sidebar />
                        </Panel>
                        {renderVerticalSeparator()}

                        {/* Editor + Build Panel Area (Vertical Split) */}
                        <Panel id="main-content" minSize="30%" className="flex flex-col min-h-0 min-w-0 overflow-hidden">
                            <Group
                                id="editor-build-group"
                                orientation="vertical"
                                onLayoutChange={handleWorkbenchLayoutChange}
                                className="flex-1 h-full min-h-0 min-w-0"
                            >
                                {/* Editor Area */}
                                <Panel id="editor" minSize={densityConfig.editorMinSize} className="h-full min-h-0 min-w-0 overflow-hidden">
                                    <EditorGroup />
                                </Panel>

                                {/* Build Panel (Collapsible) */}
                                {isBuildPanelOpen && (
                                    <>
                                        <Separator
                                            className="group panel-resize-handle bg-transparent cursor-row-resize z-10 flex items-center justify-center outline-none shrink-0"
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
                                            id="build-panel"
                                            panelRef={buildPanelRef}
                                            defaultSize={densityConfig.buildPanelDefaultSize}
                                            minSize={densityConfig.buildPanelMinSize}
                                            maxSize={densityConfig.buildPanelMaxSize}
                                            className="h-full min-h-0 min-w-0 overflow-hidden"
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
                                {renderVerticalSeparator()}
                                <Panel
                                    id="inspector"
                                    panelRef={inspectorPanelRef}
                                    minSize="250px"
                                    maxSize="600px"
                                    defaultSize="350px"
                                    collapsible
                                    collapsedSize={0}
                                    className="min-h-0 min-w-0 overflow-hidden"
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
                                {renderVerticalSeparator()}
                                <Panel
                                    id="agent"
                                    minSize={densityConfig.agentPanelMinSize}
                                    maxSize={densityConfig.agentPanelMaxSize}
                                    defaultSize={densityConfig.agentPanelDefaultSize}
                                    collapsible
                                    collapsedSize={0}
                                    className="min-h-0 min-w-0 overflow-hidden"
                                >
                                    <Suspense fallback={<div className="flex items-center justify-center h-full">Loading...</div>}>
                                        <AgentPanel />
                                    </Suspense>
                                </Panel>
                            </>
                        )}

                        {/* Debug Panel (Right Sidebar) */}
                        {isDebugOpen && (
                            <>
                                {renderVerticalSeparator()}
                                <Panel
                                    id="debug"
                                    minSize={densityConfig.debugPanelMinSize}
                                    maxSize={densityConfig.debugPanelMaxSize}
                                    defaultSize={densityConfig.debugPanelDefaultSize}
                                    collapsible
                                    collapsedSize={0}
                                    className="min-h-0 min-w-0 overflow-hidden"
                                >
                                    <Suspense fallback={<div className="flex items-center justify-center h-full">Loading...</div>}>
                                        <DebugPanel />
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

                        {scheduleOneProjectTags.length > 0 && (
                            <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.14em]">
                                {scheduleOneProjectTags.map((tag) => (
                                    <span
                                        key={tag}
                                        className="rounded-sm bg-primary-foreground/14 px-2 py-0.5 text-primary-foreground/90"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
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
                <SettingsDialog isOpen={isSettingsOpen} onClose={handleSettingsClose} initialSection={settingsSection} />

                {/* Command Palette */}
                <CommandPalette />

                {/* Navigation Dialogs */}
                <SymbolSearchDialog isOpen={isSymbolSearchOpen} onClose={closeSymbolSearch} />
                <QuickOutline isOpen={isQuickOutlineOpen} onClose={closeQuickOutline} />
            </div>
        </ProfilerWrapper>
    );
}

export default memo(Workbench);
