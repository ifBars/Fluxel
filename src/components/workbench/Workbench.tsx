import { useState, useRef, useMemo, useCallback, memo } from "react";
import { Panel, PanelGroup, PanelResizeHandle, ImperativePanelHandle } from "react-resizable-panels";
import { useWorkbenchStore, useEditorStore, useSettingsStore, densityConfigs, useBuildPanelStore, useTypeLoadingStore, useInspectorStore, useCSharpStore } from "@/stores";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useProfiler } from "@/hooks/useProfiler";
import ActivityBar from "./ActivityBar";
import Sidebar from "./SideBar";
import SettingsDialog from "./SettingsDialog";
import BuildPanel from "./BuildPanel";
import EditorGroup from "@/components/editor/EditorGroup";
import { InspectorPanel } from "@/components/inspector";
import { ProfilerPanel } from "./ProfilerPanel";

function Workbench() {
    // Use shallow selectors to prevent unnecessary re-renders
    const setSidebarOpen = useWorkbenchStore((state) => state.setSidebarOpen);
    const sidebarDefaultSize = useWorkbenchStore((state) => state.sidebarDefaultSize);
    const defaultSidebarOpen = useWorkbenchStore((state) => state.defaultSidebarOpen);

    // Select actual data instead of functions to prevent re-renders on every store update
    const tabs = useEditorStore((state) => state.tabs);
    const activeTabId = useEditorStore((state) => state.activeTabId);
    const cursorPosition = useEditorStore((state) => state.cursorPosition);

    const uiDensity = useSettingsStore((state) => state.uiDensity);
    const tabSize = useSettingsStore((state) => state.tabSize);
    const wordWrap = useSettingsStore((state) => state.wordWrap);

    const isBuildPanelOpen = useBuildPanelStore((state) => state.isOpen);
    const isLoading = useTypeLoadingStore((state) => state.isLoading);
    const loadingMessage = useTypeLoadingStore((state) => state.loadingMessage);
    const isInspectorOpen = useInspectorStore((state) => state.isInspectorOpen);
    const isLoadingBuildConfigs = useCSharpStore((state) => state.isLoadingConfigs);

    // Compute activeTab from selected data - only recalculates when tabs or activeTabId changes
    const activeTab = useMemo(() => {
        return tabs.find((t) => t.id === activeTabId) ?? null;
    }, [tabs, activeTabId]);

    // Memoize isDirty check for activeTab to avoid recalculating on every render
    const isActiveTabDirty = useMemo(() => {
        if (!activeTab) return false;
        return activeTab.content !== activeTab.originalContent;
    }, [activeTab]);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const sidebarPanelRef = useRef<ImperativePanelHandle>(null);
    const buildPanelRef = useRef<ImperativePanelHandle>(null);
    const inspectorPanelRef = useRef<ImperativePanelHandle>(null);
    const { ProfilerWrapper } = useProfiler('Workbench');

    // Memoize density config to prevent recalculation
    const densityConfig = useMemo(() => densityConfigs[uiDensity], [uiDensity]);

    // Memoize callbacks to prevent child re-renders
    const handleSettingsClick = useCallback(() => setIsSettingsOpen(true), []);
    const handleSettingsClose = useCallback(() => setIsSettingsOpen(false), []);
    const handleSidebarCollapse = useCallback(() => setSidebarOpen(false), [setSidebarOpen]);
    const handleSidebarExpand = useCallback(() => setSidebarOpen(true), [setSidebarOpen]);

    // Enable keyboard shortcuts
    useKeyboardShortcuts(sidebarPanelRef);

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
                    <PanelGroup direction="horizontal" className="flex-1">
                        {/* Sidebar Panel */}
                        <Panel
                            ref={sidebarPanelRef}
                            defaultSize={defaultSidebarOpen ? sidebarDefaultSize : 0}
                            minSize={densityConfig.sidebarMinSize}
                            maxSize={densityConfig.sidebarMaxSize}
                            collapsible
                            collapsedSize={0}
                            onCollapse={handleSidebarCollapse}
                            onExpand={handleSidebarExpand}
                            className="bg-muted/10 border-r border-border"
                        >
                            <Sidebar />
                        </Panel>
                        <PanelResizeHandle
                            className="panel-resize-handle bg-border hover:bg-primary transition-colors cursor-col-resize active:bg-primary z-20 transition-all opacity-60 hover:opacity-100"
                            style={{
                                width: densityConfig.panelHandleWidth,
                                minWidth: densityConfig.panelHandleWidth,
                            }}
                        />

                        {/* Editor + Build Panel Area (Vertical Split) */}
                        <Panel minSize={30}>
                            <PanelGroup direction="vertical">
                                {/* Editor Area */}
                                <Panel minSize={20}>
                                    <EditorGroup />
                                </Panel>

                                {/* Build Panel (Collapsible) */}
                                {isBuildPanelOpen && (
                                    <>
                                        <PanelResizeHandle
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
                                        </PanelResizeHandle>
                                        <Panel
                                            ref={buildPanelRef}
                                            defaultSize={25}
                                            minSize={10}
                                            maxSize={50}
                                        >
                                            <BuildPanel />
                                        </Panel>
                                    </>
                                )}
                            </PanelGroup>
                        </Panel>

                        {/* Inspector Panel (Right Sidebar) */}
                        {isInspectorOpen && (
                            <>
                                <PanelResizeHandle
                                    className="panel-resize-handle bg-border hover:bg-primary transition-colors cursor-col-resize active:bg-primary z-20 transition-all opacity-60 hover:opacity-100"
                                    style={{
                                        width: densityConfig.panelHandleWidth,
                                        minWidth: densityConfig.panelHandleWidth,
                                    }}
                                />
                                <Panel
                                    ref={inspectorPanelRef}
                                    defaultSize={20}
                                    minSize={15}
                                    maxSize={35}
                                    collapsible
                                    collapsedSize={0}
                                >
                                    <InspectorPanel />
                                </Panel>
                            </>
                        )}
                    </PanelGroup>
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

                {/* Profiler Panel */}
                <ProfilerPanel />
            </div>
        </ProfilerWrapper>
    );
}

export default memo(Workbench);
