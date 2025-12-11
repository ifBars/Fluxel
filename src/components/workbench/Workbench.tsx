import { useState, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle, ImperativePanelHandle } from "react-resizable-panels";
import { useWorkbenchStore, useEditorStore, useSettingsStore, densityConfigs, useBuildPanelStore } from "@/stores";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import ActivityBar from "./ActivityBar";
import Sidebar from "./SideBar";
import SettingsDialog from "./SettingsDialog";
import BuildPanel from "./BuildPanel";
import EditorGroup from "@/components/editor/EditorGroup";

export default function Workbench() {
    const { setSidebarOpen, sidebarDefaultSize, defaultSidebarOpen } = useWorkbenchStore();
    const { getActiveTab, cursorPosition, isDirty } = useEditorStore();
    const { uiDensity, tabSize, wordWrap } = useSettingsStore();
    const { isOpen: isBuildPanelOpen } = useBuildPanelStore();
    const activeTab = getActiveTab();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const sidebarPanelRef = useRef<ImperativePanelHandle>(null);
    const buildPanelRef = useRef<ImperativePanelHandle>(null);

    // Get density-specific configuration
    const densityConfig = densityConfigs[uiDensity];

    // Enable keyboard shortcuts
    useKeyboardShortcuts(sidebarPanelRef);

    return (
        <div className="flex-1 flex flex-col overflow-hidden h-full bg-background text-foreground">
            <div className="flex-1 flex overflow-hidden">
                {/* Activity Bar Section - Fixed Width */}
                <ActivityBar
                    onSettingsClick={() => setIsSettingsOpen(true)}
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
                        onCollapse={() => setSidebarOpen(false)}
                        onExpand={() => setSidebarOpen(true)}
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
                            {isDirty(activeTab.id) && <span>{activeTab.filename}*</span>}
                            {!isDirty(activeTab.id) && <span>{activeTab.filename}</span>}
                        </>
                    )}
                    {!activeTab && <span>Fluxel</span>}
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
            <SettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </div>
    );
}
