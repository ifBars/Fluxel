import { useCallback } from 'react';
import { X, MousePointer2, Check, Loader2 } from 'lucide-react';
import { useInspectorStore, useEditorStore } from '@/stores';
import ComponentTree from './ComponentTree';
import { DesignTab, CSSTab } from './tabs';
import type { StyleChange, TextChange, ParentToIframeMessage } from '@/lib/inspector/inspectorMessages';
import ScrollableArea from "../ui/scrollable-area";

/**
 * Main Inspector Panel component.
 * Contains component tree, design/CSS tabs, and property controls.
 * Follows Fluxel design system with 8pt grid spacing.
 */
export default function InspectorPanel() {
    const {
        isInspectorMode,
        activeTab,
        selectedElement,
        iframeRef,
        pendingChanges,
        isApplying,
        setInspectorMode,
        setActiveTab,
        setInspectorOpen,
        updateSelectedElementStyle,
        addPendingChange,
        applyPendingChanges,
        getApplicableCount,
    } = useInspectorStore();

    const { isDirty, updateContent } = useEditorStore();

    // Send message to iframe
    const sendToIframe = useCallback((message: ParentToIframeMessage) => {
        console.log('[InspectorPanel] Sending to iframe:', message.type, message);

        if (!iframeRef?.current?.contentWindow) {
            console.error('[InspectorPanel] Cannot send message - iframe not ready');
            return;
        }

        iframeRef.current.contentWindow.postMessage(
            { ...message, __source: 'fluxel-inspector:' },
            '*'
        );
    }, [iframeRef]);

    // Handle style changes
    const handleStyleChange = useCallback((change: StyleChange) => {
        // Optimistically update local state for immediate UI feedback
        const fullValue = change.unit ? `${change.value}${change.unit}` : change.value;
        updateSelectedElementStyle(change.property, fullValue);

        // Track as pending change
        addPendingChange({
            id: `${Date.now()}-${change.property}`,
            type: 'style',
            change: {
                ...change,
                sourceLocation: selectedElement?.sourceLocation,
            },
            timestamp: Date.now(),
        });

        // Send to iframe to actually apply the change visually
        sendToIframe({ type: 'style:apply', payload: change });
    }, [sendToIframe, updateSelectedElementStyle, selectedElement, addPendingChange]);

    // Handle text changes
    const handleTextChange = useCallback((change: TextChange) => {
        // Track as pending change
        if (selectedElement?.sourceLocation) {
            addPendingChange({
                id: `${Date.now()}-text`,
                type: 'text',
                change: {
                    ...change,
                    sourceLocation: selectedElement.sourceLocation,
                },
                timestamp: Date.now(),
            });
        }

        // Send to iframe to apply change visually
        sendToIframe({ type: 'text:apply', payload: change });
    }, [sendToIframe, selectedElement, addPendingChange]);

    // Handle apply button click
    const handleApplyChanges = useCallback(async () => {
        const result = await applyPendingChanges({
            checkDirty: isDirty,
            onFileModified: (filePath, newContent) => {
                // Find any open tab with this file and update its content
                const tabs = useEditorStore.getState().tabs;
                const tab = tabs.find(t => t.path === filePath);
                if (tab) {
                    updateContent(tab.id, newContent);
                }
            },
        });

        // Log results for debugging
        if (result.errors.length > 0) {
            console.error('[InspectorPanel] Apply errors:', result.errors);
        }
        if (result.filesModified.length > 0) {
            console.log('[InspectorPanel] Files modified:', result.filesModified);
        }
    }, [applyPendingChanges, isDirty, updateContent]);

    // Toggle inspector mode
    const toggleInspectorMode = useCallback(() => {
        const newMode = !isInspectorMode;
        setInspectorMode(newMode);
        sendToIframe({ type: newMode ? 'inspector:enable' : 'inspector:disable' });
    }, [isInspectorMode, setInspectorMode, sendToIframe]);

    // Close panel
    const handleClose = useCallback(() => {
        setInspectorOpen(false);
        setInspectorMode(false);
        sendToIframe({ type: 'inspector:disable' });
    }, [setInspectorOpen, setInspectorMode, sendToIframe]);

    const applicableCount = getApplicableCount();
    const hasPendingChanges = pendingChanges.length > 0;

    return (
        <div className="h-full flex flex-col bg-card border-l border-border">
            {/* Header */}
            <div
                className="flex items-center justify-between border-b border-border shrink-0"
                style={{ padding: '8px 12px' }} // 8pt grid
            >
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-foreground">Inspector</h2>
                    <button
                        onClick={toggleInspectorMode}
                        className={`
                            p-1.5 rounded-md transition-colors
                            ${isInspectorMode
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }
                        `}
                        title={isInspectorMode ? 'Disable Inspector Mode' : 'Enable Inspector Mode'}
                    >
                        <MousePointer2 className="w-4 h-4" />
                    </button>
                    {/* Apply Button */}
                    <button
                        onClick={handleApplyChanges}
                        disabled={isApplying || applicableCount === 0}
                        className={`
                            flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors
                            ${applicableCount > 0
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                            }
                            ${isApplying ? 'opacity-70 cursor-wait' : ''}
                        `}
                        title={
                            applicableCount > 0
                                ? `Apply ${applicableCount} change${applicableCount > 1 ? 's' : ''} to source`
                                : hasPendingChanges
                                    ? 'No applicable changes (missing source location data)'
                                    : 'No pending changes'
                        }
                    >
                        {isApplying ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                            <Check className="w-3 h-3" />
                        )}
                        Apply
                        {hasPendingChanges && (
                            <span className="bg-white/20 px-1 rounded text-[10px] min-w-[12px] text-center">
                                {applicableCount}
                            </span>
                        )}
                    </button>
                </div>
                <button
                    onClick={handleClose}
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Close Inspector"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Component Tree */}
            <div className="border-b border-border shrink-0" style={{ maxHeight: '200px' }}>
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/30">
                    Components
                </div>
                <ComponentTree className="max-h-40" />
            </div>

            {/* Tab Bar */}
            <div
                className="flex gap-1 border-b border-border shrink-0 bg-muted/20"
                style={{ padding: '4px 12px' }}
            >
                <button
                    onClick={() => setActiveTab('design')}
                    className={`
                        px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                        ${activeTab === 'design'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }
                    `}
                >
                    Design
                </button>
                <button
                    onClick={() => setActiveTab('css')}
                    className={`
                        px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                        ${activeTab === 'css'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }
                    `}
                >
                    CSS
                </button>
            </div>

            {/* Tab Content */}
            <ScrollableArea className="flex-1">
                {activeTab === 'design' ? (
                    <DesignTab
                        onStyleChange={handleStyleChange}
                        onTextChange={handleTextChange}
                    />
                ) : (
                    <CSSTab />
                )}
            </ScrollableArea>

            {/* Selected Element Footer */}
            {selectedElement && (
                <div
                    className="border-t border-border bg-muted/30 shrink-0"
                    style={{ padding: '8px 12px' }}
                >
                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Selected:</span>
                        <code className="font-mono text-foreground bg-muted px-1.5 py-0.5 rounded">
                            {selectedElement.tagName}
                            {selectedElement.classList.length > 0 && (
                                <span className="text-primary">
                                    .{selectedElement.classList.slice(0, 2).join('.')}
                                </span>
                            )}
                        </code>
                        {selectedElement.sourceLocation && (
                            <span className="text-muted-foreground text-[10px]">
                                @ {selectedElement.sourceLocation.file.split('/').pop()}:{selectedElement.sourceLocation.line}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

