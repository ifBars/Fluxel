import { useState, memo, useCallback } from 'react';
import { 
    Play, 
    Pause, 
    Square, 
    SkipForward, 
    ArrowDown, 
    ArrowUp, 
    X, 
    Plus, 
    Circle, 
    CircleDot, 
    CircleOff, 
    Trash2, 
    Eye, 
    Layers, 
    Bug,
    ChevronDown,
    ChevronRight,
    FileCode
} from 'lucide-react';
import { useDebugStore, type Breakpoint, type StackFrame, type Variable } from '@/stores/debug';
import { useEditorStore } from '@/stores';
import { cn } from '@/lib/utils';
import ScrollableArea from '@/components/ui/scrollable-area';

// ============================================================================
// Debug Toolbar
// ============================================================================

function DebugToolbar() {
    const session = useDebugStore(state => state.session);
    const startSession = useDebugStore(state => state.startSession);
    const stopSession = useDebugStore(state => state.stopSession);
    const pauseSession = useDebugStore(state => state.pauseSession);
    const resumeSession = useDebugStore(state => state.resumeSession);
    const stepOver = useDebugStore(state => state.stepOver);
    const stepInto = useDebugStore(state => state.stepInto);
    const stepOut = useDebugStore(state => state.stepOut);
    
    const isRunning = session?.state === 'running' || session?.state === 'stepping';
    const isPaused = session?.state === 'paused';
    const hasSession = !!session;
    
    return (
        <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-muted/30">
            {/* Start/Continue */}
            <button
                onClick={() => isPaused ? resumeSession() : startSession('coreclr')}
                className={cn(
                    "p-1.5 rounded transition-colors",
                    hasSession && !isPaused
                        ? "text-muted-foreground cursor-not-allowed"
                        : "text-green-500 hover:bg-green-500/10"
                )}
                disabled={isRunning}
                title={isPaused ? "Continue (F5)" : "Start Debugging (F5)"}
            >
                <Play className="w-4 h-4" />
            </button>
            
            {/* Pause */}
            <button
                onClick={pauseSession}
                className={cn(
                    "p-1.5 rounded transition-colors",
                    isRunning
                        ? "text-yellow-500 hover:bg-yellow-500/10"
                        : "text-muted-foreground cursor-not-allowed"
                )}
                disabled={!isRunning}
                title="Pause (F6)"
            >
                <Pause className="w-4 h-4" />
            </button>
            
            {/* Stop */}
            <button
                onClick={stopSession}
                className={cn(
                    "p-1.5 rounded transition-colors",
                    hasSession
                        ? "text-red-500 hover:bg-red-500/10"
                        : "text-muted-foreground cursor-not-allowed"
                )}
                disabled={!hasSession}
                title="Stop Debugging (Shift+F5)"
            >
                <Square className="w-4 h-4" />
            </button>
            
            <div className="w-px h-4 bg-border mx-1" />
            
            {/* Step Over */}
            <button
                onClick={stepOver}
                className={cn(
                    "p-1.5 rounded transition-colors",
                    isPaused
                        ? "text-foreground hover:bg-muted"
                        : "text-muted-foreground cursor-not-allowed"
                )}
                disabled={!isPaused}
                title="Step Over (F10)"
            >
                <SkipForward className="w-4 h-4" />
            </button>
            
            {/* Step Into */}
            <button
                onClick={stepInto}
                className={cn(
                    "p-1.5 rounded transition-colors",
                    isPaused
                        ? "text-foreground hover:bg-muted"
                        : "text-muted-foreground cursor-not-allowed"
                )}
                disabled={!isPaused}
                title="Step Into (F11)"
            >
                <ArrowDown className="w-4 h-4" />
            </button>
            
            {/* Step Out */}
            <button
                onClick={stepOut}
                className={cn(
                    "p-1.5 rounded transition-colors",
                    isPaused
                        ? "text-foreground hover:bg-muted"
                        : "text-muted-foreground cursor-not-allowed"
                )}
                disabled={!isPaused}
                title="Step Out (Shift+F11)"
            >
                <ArrowUp className="w-4 h-4" />
            </button>
            
            {/* Session info */}
            {session && (
                <div className="ml-auto flex items-center gap-2 text-xs">
                    <span className={cn(
                        "px-2 py-0.5 rounded-full font-medium",
                        session.state === 'running' && "bg-green-500/10 text-green-500",
                        session.state === 'paused' && "bg-yellow-500/10 text-yellow-500",
                        session.state === 'stepping' && "bg-blue-500/10 text-blue-500",
                        session.state === 'stopped' && "bg-muted text-muted-foreground"
                    )}>
                        {session.state}
                    </span>
                    <span className="text-muted-foreground">{session.name}</span>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Variables View
// ============================================================================

interface VariableItemProps {
    variable: Variable;
    depth: number;
}

const VariableItem = memo(function VariableItem({ variable, depth }: VariableItemProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasChildren = variable.variablesReference > 0 || (variable.children && variable.children.length > 0);
    
    return (
        <div>
            <button
                onClick={() => hasChildren && setIsExpanded(!isExpanded)}
                className="w-full flex items-center gap-2 px-2 py-1 hover:bg-muted/50 text-left"
                style={{ paddingLeft: `${8 + depth * 16}px` }}
            >
                {hasChildren ? (
                    isExpanded ? (
                        <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    ) : (
                        <ChevronRight className="w-3 h-3 text-muted-foreground" />
                    )
                ) : (
                    <span className="w-3" />
                )}
                <span className="text-xs font-medium text-primary">{variable.name}</span>
                <span className="text-xs text-muted-foreground">:</span>
                <span className="text-xs text-foreground truncate">{variable.value}</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{variable.type}</span>
            </button>
            
            {isExpanded && variable.children && (
                <div>
                    {variable.children.map((child, index) => (
                        <VariableItem key={index} variable={child} depth={depth + 1} />
                    ))}
                </div>
            )}
        </div>
    );
});

function VariablesView() {
    const scopes = useDebugStore(state => state.scopes);
    const session = useDebugStore(state => state.session);
    
    if (!session) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                <Bug className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No debug session</p>
                <p className="text-xs mt-1">Start debugging to see variables</p>
            </div>
        );
    }
    
    if (session.state !== 'paused' || scopes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                <Eye className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">Waiting for breakpoint...</p>
                <p className="text-xs mt-1">Variables appear when paused at a breakpoint</p>
            </div>
        );
    }
    
    return (
        <ScrollableArea className="flex-1">
            {scopes.map((scope, scopeIndex) => (
                <div key={scopeIndex} className="border-b border-border last:border-b-0">
                    <div className="px-3 py-1.5 bg-muted/20 text-xs font-medium text-muted-foreground">
                        {scope.name}
                    </div>
                    {scope.variables.map((variable, varIndex) => (
                        <VariableItem key={varIndex} variable={variable} depth={0} />
                    ))}
                </div>
            ))}
        </ScrollableArea>
    );
}

// ============================================================================
// Watch View
// ============================================================================

function WatchView() {
    const watchExpressions = useDebugStore(state => state.watchExpressions);
    const watchResults = useDebugStore(state => state.watchResults);
    const addWatchExpression = useDebugStore(state => state.addWatchExpression);
    const removeWatchExpression = useDebugStore(state => state.removeWatchExpression);
    const [newExpression, setNewExpression] = useState('');
    
    const handleAdd = () => {
        if (newExpression.trim()) {
            addWatchExpression(newExpression);
            setNewExpression('');
        }
    };
    
    return (
        <div className="flex flex-col h-full">
            {/* Add watch input */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                <input
                    type="text"
                    value={newExpression}
                    onChange={(e) => setNewExpression(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    placeholder="Add expression to watch..."
                    className="flex-1 bg-transparent border-none outline-none text-xs placeholder:text-muted-foreground"
                />
                <button
                    onClick={handleAdd}
                    className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>
            
            {/* Watch list */}
            <ScrollableArea className="flex-1">
                {watchExpressions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                        <Eye className="w-8 h-8 mb-2 opacity-50" />
                        <p className="text-sm">No watch expressions</p>
                        <p className="text-xs mt-1">Add expressions to watch their values</p>
                    </div>
                ) : (
                    watchExpressions.map((expression) => (
                        <div
                            key={expression}
                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 group"
                        >
                            <span className="text-xs font-medium text-primary flex-1 truncate">
                                {expression}
                            </span>
                            <span className="text-xs text-foreground truncate max-w-[50%]">
                                {watchResults.get(expression) || 'Not available'}
                            </span>
                            <button
                                onClick={() => removeWatchExpression(expression)}
                                className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))
                )}
            </ScrollableArea>
        </div>
    );
}

// ============================================================================
// Call Stack View
// ============================================================================

function CallStackView() {
    const callStack = useDebugStore(state => state.callStack);
    const currentFrameId = useDebugStore(state => state.currentFrameId);
    const setCurrentFrame = useDebugStore(state => state.setCurrentFrame);
    const session = useDebugStore(state => state.session);
    const openFile = useEditorStore(state => state.openFile);
    
    const handleFrameClick = useCallback(async (frame: StackFrame) => {
        setCurrentFrame(frame.id);
        
        // Navigate to the file and line
        if (frame.filePath) {
            await openFile(frame.filePath, {
                line: frame.line,
                column: frame.column,
            });
        }
    }, [setCurrentFrame, openFile]);
    
    if (!session || session.state !== 'paused' || callStack.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                <Layers className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No call stack</p>
                <p className="text-xs mt-1">Stack appears when paused at a breakpoint</p>
            </div>
        );
    }
    
    return (
        <ScrollableArea className="flex-1">
            {callStack.map((frame) => (
                <button
                    key={frame.id}
                    onClick={() => handleFrameClick(frame)}
                    className={cn(
                        "w-full flex items-start gap-2 px-3 py-1.5 text-left transition-colors",
                        frame.id === currentFrameId
                            ? "bg-primary/10 border-l-2 border-primary"
                            : "hover:bg-muted/50 border-l-2 border-transparent"
                    )}
                >
                    <FileCode className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{frame.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                            {frame.filePath?.split('/').pop() || 'Unknown'}:{frame.line}
                        </div>
                    </div>
                </button>
            ))}
        </ScrollableArea>
    );
}

// ============================================================================
// Breakpoints View
// ============================================================================

function BreakpointsView() {
    const breakpoints = useDebugStore(state => state.breakpoints);
    const removeBreakpoint = useDebugStore(state => state.removeBreakpoint);
    const enableBreakpoint = useDebugStore(state => state.enableBreakpoint);
    const clearAllBreakpoints = useDebugStore(state => state.clearAllBreakpoints);
    const openFile = useEditorStore(state => state.openFile);
    
    const handleBreakpointClick = useCallback(async (bp: Breakpoint) => {
        await openFile(bp.filePath, {
            line: bp.line,
            column: bp.column || 1,
        });
    }, [openFile]);
    
    return (
        <div className="flex flex-col h-full">
            {/* Header with clear all button */}
            {breakpoints.length > 0 && (
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
                    <span className="text-xs text-muted-foreground">
                        {breakpoints.length} breakpoint{breakpoints.length !== 1 ? 's' : ''}
                    </span>
                    <button
                        onClick={clearAllBreakpoints}
                        className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title="Remove all breakpoints"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}
            
            <ScrollableArea className="flex-1">
                {breakpoints.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                        <CircleDot className="w-8 h-8 mb-2 opacity-50" />
                        <p className="text-sm">No breakpoints</p>
                        <p className="text-xs mt-1">Click in the gutter to add breakpoints</p>
                    </div>
                ) : (
                    breakpoints.map((bp) => {
                        const fileName = bp.filePath.split('/').pop() || bp.filePath;
                        
                        return (
                            <div
                                key={bp.id}
                                className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 group"
                            >
                                <button
                                    onClick={() => enableBreakpoint(bp.id, !bp.enabled)}
                                    className={cn(
                                        "p-0.5 rounded transition-colors",
                                        bp.enabled ? "text-red-500" : "text-muted-foreground"
                                    )}
                                    title={bp.enabled ? "Disable breakpoint" : "Enable breakpoint"}
                                >
                                    {bp.enabled ? (
                                        <Circle className="w-3.5 h-3.5 fill-current" />
                                    ) : (
                                        <CircleOff className="w-3.5 h-3.5" />
                                    )}
                                </button>
                                
                                <button
                                    onClick={() => handleBreakpointClick(bp)}
                                    className="flex-1 flex items-center gap-2 text-left min-w-0"
                                >
                                    <span className="text-xs truncate">{fileName}</span>
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                        :{bp.line}
                                    </span>
                                </button>
                                
                                {bp.condition && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-500 rounded">
                                        cond
                                    </span>
                                )}
                                
                                <button
                                    onClick={() => removeBreakpoint(bp.id)}
                                    className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        );
                    })
                )}
            </ScrollableArea>
        </div>
    );
}

// ============================================================================
// Debug Panel
// ============================================================================

function DebugPanel() {
    const isPanelOpen = useDebugStore(state => state.isPanelOpen);
    const closePanel = useDebugStore(state => state.closePanel);
    const activeTab = useDebugStore(state => state.activeTab);
    const setActiveTab = useDebugStore(state => state.setActiveTab);
    
    if (!isPanelOpen) return null;
    
    return (
        <div className="flex flex-col h-full bg-card border-l border-border">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30 shrink-0">
                <div className="flex items-center gap-2">
                    <Bug className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Debug</span>
                </div>
                <button
                    onClick={closePanel}
                    className="p-1 rounded hover:bg-muted transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
            
            {/* Toolbar */}
            <DebugToolbar />
            
            {/* Tabs */}
            <div className="flex items-center border-b border-border bg-muted/20 shrink-0">
                {(['variables', 'watch', 'callStack', 'breakpoints'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            "px-3 py-1.5 text-xs font-medium transition-colors capitalize border-b-2",
                            activeTab === tab
                                ? "border-primary text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {tab === 'callStack' ? 'Call Stack' : tab}
                    </button>
                ))}
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'variables' && <VariablesView />}
                {activeTab === 'watch' && <WatchView />}
                {activeTab === 'callStack' && <CallStackView />}
                {activeTab === 'breakpoints' && <BreakpointsView />}
            </div>
        </div>
    );
}

export default memo(DebugPanel);

