import { ChevronRight, ChevronDown } from 'lucide-react';
import { useInspectorStore } from '@/stores';
import type { ElementNode } from '@/lib/inspector/inspectorMessages';
import ScrollableArea from "../ui/scrollable-area";

interface ComponentTreeProps {
    className?: string;
}

export default function ComponentTree({ className = '' }: ComponentTreeProps) {
    const {
        componentTree,
        expandedNodes,
        selectedElement,
        toggleNodeExpanded,
        iframeRef,
    } = useInspectorStore();

    const handleNodeSelect = (selector: string) => {
        console.log('[ComponentTree] Selecting element from tree:', selector);

        // Send message to iframe to highlight and select this element
        if (iframeRef?.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
                {
                    type: 'element:highlight',
                    payload: { selector },
                    __source: 'fluxel-inspector:',
                },
                '*'
            );
        } else {
            console.error('[ComponentTree] Cannot select - iframe not ready');
        }
    };

    if (componentTree.length === 0) {
        return (
            <div className={`text-xs text-muted-foreground p-4 ${className}`}>
                No components detected. Enable inspector mode to view the component tree.
            </div>
        );
    }

    return (
        <ScrollableArea className={className}>
            {componentTree.map((node) => (
                <TreeNode
                    key={node.id}
                    node={node}
                    expandedNodes={expandedNodes}
                    selectedSelector={selectedElement?.selector}
                    onToggle={toggleNodeExpanded}
                    onSelect={handleNodeSelect}
                />
            ))}
        </ScrollableArea>
    );
}

interface TreeNodeProps {
    node: ElementNode;
    expandedNodes: Set<string>;
    selectedSelector?: string;
    onToggle: (nodeId: string) => void;
    onSelect: (selector: string) => void;
    depth?: number;
}

function TreeNode({
    node,
    expandedNodes,
    selectedSelector,
    onToggle,
    onSelect,
    depth = 0,
}: TreeNodeProps) {
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedSelector === node.selector;
    const hasChildren = node.children.length > 0;

    // Build display label: tagName.class1.class2
    const classString = node.classList.slice(0, 2).join('.');
    const label = `${node.tagName}${classString ? '.' + classString : ''}`;

    return (
        <div>
            <div
                className={`
                    flex items-center gap-1 cursor-pointer select-none
                    text-xs font-mono transition-colors
                    hover:bg-muted/50
                    ${isSelected ? 'bg-primary/10 text-primary' : 'text-foreground'}
                `}
                style={{
                    paddingLeft: `${depth * 12 + 8}px`,
                    paddingRight: '8px',
                    paddingTop: '4px',
                    paddingBottom: '4px',
                }}
                onClick={() => onSelect(node.selector)}
            >
                {/* Expand/collapse toggle */}
                <button
                    className={`
                        shrink-0 w-4 h-4 flex items-center justify-center
                        rounded hover:bg-muted transition-colors
                        ${!hasChildren ? 'invisible' : ''}
                    `}
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggle(node.id);
                    }}
                >
                    {hasChildren && (
                        isExpanded
                            ? <ChevronDown className="w-3 h-3" />
                            : <ChevronRight className="w-3 h-3" />
                    )}
                </button>

                {/* Element label */}
                <span className="truncate" title={node.selector}>
                    {label}
                </span>

                {/* ID badge */}
                {node.elementId && (
                    <span className="text-muted-foreground opacity-60">
                        #{node.elementId}
                    </span>
                )}
            </div>

            {/* Children */}
            {hasChildren && isExpanded && (
                <div>
                    {node.children.map((child) => (
                        <TreeNode
                            key={child.id}
                            node={child}
                            expandedNodes={expandedNodes}
                            selectedSelector={selectedSelector}
                            onToggle={onToggle}
                            onSelect={onSelect}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
