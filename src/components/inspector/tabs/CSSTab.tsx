import { useState, useCallback, useMemo } from 'react';
import { Copy, Check } from 'lucide-react';
import { useInspectorStore } from '@/stores';

/**
 * CSS tab with raw CSS display and editing.
 * Shows computed styles as CSS properties with copy functionality.
 */
export default function CSSTab() {
    const { selectedElement } = useInspectorStore();
    const [copied, setCopied] = useState(false);

    // Generate CSS string from computed styles
    const cssString = useMemo(() => {
        if (!selectedElement) return '';

        const styles = selectedElement.computedStyles;
        const relevantProps = [
            // Only include non-default values
            'position', 'left', 'top', 'right', 'bottom', 'z-index',
            'display', 'flex-direction', 'justify-content', 'align-items', 'gap',
            'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
            'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
            'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
            'opacity', 'border-radius', 'background-color',
            'border-width', 'border-color', 'border-style',
            'box-shadow',
            'font-size', 'font-weight', 'line-height', 'color', 'text-align',
        ];

        const lines: string[] = [];
        for (const prop of relevantProps) {
            const value = styles[prop];
            // Skip default/empty values
            if (!value || value === 'auto' || value === 'none' || value === '0px' || value === 'normal' || value === 'start') {
                continue;
            }
            lines.push(`  ${prop}: ${value};`);
        }

        const selector = selectedElement.classList.length > 0
            ? `.${selectedElement.classList[0]}`
            : selectedElement.tagName;

        return `${selector} {\n${lines.join('\n')}\n}`;
    }, [selectedElement]);

    const handleCopy = useCallback(async () => {
        if (!cssString) return;

        try {
            await navigator.clipboard.writeText(cssString);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy CSS:', error);
        }
    }, [cssString]);

    if (!selectedElement) {
        return (
            <div className="p-4 text-center text-xs text-muted-foreground">
                Select an element to view its CSS
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                <span className="text-xs text-muted-foreground">Computed Styles</span>
                <button
                    onClick={handleCopy}
                    className="
                        flex items-center gap-1 px-2 py-1 rounded-sm
                        text-xs text-muted-foreground
                        hover:bg-muted hover:text-foreground
                        transition-colors
                    "
                    title="Copy CSS"
                >
                    {copied ? (
                        <>
                            <Check className="w-3 h-3 text-green-500" />
                            <span>Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                        </>
                    )}
                </button>
            </div>

            {/* CSS Code Display */}
            <div className="flex-1 overflow-auto p-4">
                <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">
                    <code>{cssString}</code>
                </pre>
            </div>

            {/* Source info if available */}
            {selectedElement.sourceLocation && (
                <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
                    <span>Source: </span>
                    <span className="font-mono">
                        {selectedElement.sourceLocation.file}:{selectedElement.sourceLocation.line}
                    </span>
                </div>
            )}
        </div>
    );
}
