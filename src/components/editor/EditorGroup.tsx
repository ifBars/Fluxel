import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useWorkbenchStore, useEditorStore } from "@/stores";
import CodeEditor from "./CodeEditor";
import VisualEditor from "./VisualEditor";
import TabBar from "./TabBar";
import { Code, Monitor, Columns } from "lucide-react";
import appIcon from "../../../src-tauri/icons/icon.png";

export default function EditorGroup() {
    const { editorMode, setEditorMode } = useWorkbenchStore();
    const { tabs, getActiveTab } = useEditorStore();
    const activeTab = getActiveTab();

    return (
        <div className="h-full flex flex-col">
            {/* Editor Header / Tabs */}
            <div 
                className="border-b border-border flex items-center justify-between bg-muted/20"
                style={{
                    height: 'calc(2.5rem + var(--density-padding-sm, 0.5rem))',
                    paddingLeft: 'var(--density-padding-md, 0.75rem)',
                    paddingRight: 'var(--density-padding-md, 0.75rem)',
                }}
            >
                {/* Tab Bar or empty state */}
                <div className="flex-1 overflow-hidden">
                    {editorMode !== 'visual' && (
                        <>
                            {tabs.length > 0 ? (
                                <TabBar />
                            ) : (
                                <span 
                                    className="text-xs text-muted-foreground"
                                    style={{ paddingLeft: 'var(--density-padding-sm, 0.5rem)' }}
                                >
                                    No files open
                                </span>
                            )}
                        </>
                    )}
                </div>

                {/* Mode toggle buttons */}
                <div 
                    className="flex bg-muted/50 rounded-full border border-border/50 shrink-0 overflow-hidden"
                    style={{
                        padding: 'var(--density-gap-sm, 0.125rem)',
                        marginLeft: 'var(--density-gap-md, 0.75rem)',
                    }}
                >
                    <ModeToggle
                        active={editorMode === 'code'}
                        onClick={() => setEditorMode('code')}
                        icon={<Code size={14} />}
                        label="Code"
                    />
                    <ModeToggle
                        active={editorMode === 'split'}
                        onClick={() => setEditorMode('split')}
                        icon={<Columns size={14} />}
                        label="Split"
                    />
                    <ModeToggle
                        active={editorMode === 'visual'}
                        onClick={() => setEditorMode('visual')}
                        icon={<Monitor size={14} />}
                        label="Visual"
                    />
                </div>
            </div>

            {/* Editor Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {tabs.length === 0 && editorMode !== 'visual' ? (
                    <EmptyEditorState />
                ) : (
                    <>
                        {editorMode === 'code' && (
                            tabs.length > 0 ? (
                                <CodeEditor activeTab={activeTab} />
                            ) : (
                                <EmptyEditorState />
                            )
                        )}
                        {editorMode === 'visual' && <VisualEditor />}

                        {editorMode === 'split' && (
                            tabs.length > 0 ? (
                                <PanelGroup direction="horizontal">
                                    <Panel defaultSize={50} minSize={20}>
                                        <CodeEditor activeTab={activeTab} />
                                    </Panel>
                                    <PanelResizeHandle 
                                        className="bg-border hover:bg-primary transition-colors"
                                        style={{
                                            width: 'var(--panel-handle-width, 4px)',
                                            minWidth: 'var(--panel-handle-width, 4px)',
                                        }}
                                    />
                                    <Panel defaultSize={50} minSize={20}>
                                        <VisualEditor />
                                    </Panel>
                                </PanelGroup>
                            ) : (
                                <EmptyEditorState />
                            )
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function ModeToggle({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
    return (
        <button
            onClick={onClick}
            title={label}
            className={`rounded-md flex items-center justify-center transition-all ${
                active
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
            }`}
            style={{
                padding: 'var(--density-padding-sm, 0.5rem)',
            }}
        >
            {icon}
        </button>
    );
}

function EmptyEditorState() {
    return (
        <div className="h-full w-full flex flex-col items-center justify-center bg-background text-muted-foreground">
            <div className="text-center max-w-md px-8">
                <img src={appIcon} alt="Fluxel app icon" className="w-24 h-24 mx-auto" />
                <h2 className="text-xl font-semibold text-foreground mb-2">Welcome to Fluxel</h2>
                <p className="text-sm opacity-80 mb-6">
                    Open a folder to get started, then click on files in the explorer to edit them.
                </p>
                <div className="text-xs space-y-1 opacity-60">
                    <p>File → Open Folder</p>
                    <p className="text-primary/70">or use the file explorer on the left</p>
                </div>
            </div>
        </div>
    );
}
