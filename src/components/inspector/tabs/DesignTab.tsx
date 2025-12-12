import { useCallback } from 'react';
import { useInspectorStore } from '@/stores';
import { PositionControls, LayoutControls, AppearanceControls, TextControls } from '../controls';
import type { StyleChange, TextChange } from '@/lib/inspector/inspectorMessages';

interface DesignTabProps {
    onStyleChange: (change: StyleChange) => void;
    onTextChange: (change: TextChange) => void;
}

/**
 * Design tab with visual property controls.
 * Organized into collapsible sections: Text Content, Position, Layout, Appearance.
 */
export default function DesignTab({ onStyleChange, onTextChange }: DesignTabProps) {
    const { selectedElement } = useInspectorStore();

    const handleStyleChange = useCallback((property: string, value: string, unit?: string) => {
        if (!selectedElement) return;

        onStyleChange({
            selector: selectedElement.selector,
            property,
            value,
            unit,
        });
    }, [selectedElement, onStyleChange]);

    if (!selectedElement) {
        return (
            <div className="p-4 text-center text-xs text-muted-foreground">
                Select an element to view its properties
            </div>
        );
    }

    const styles = selectedElement.computedStyles;

    return (
        <div className="p-4 space-y-6">
            {/* Text content section - appears first if element has text */}
            {selectedElement.textContent !== null && (
                <>
                    <TextControls
                        textContent={selectedElement.textContent}
                        isEditable={selectedElement.isTextEditable}
                        nonEditableReason={selectedElement.textEditReason}
                        selector={selectedElement.selector}
                        onTextChange={(text) => {
                            onTextChange({
                                selector: selectedElement.selector,
                                text,
                            });
                        }}
                    />
                    <div className="border-t border-border" />
                </>
            )}

            <PositionControls styles={styles} onStyleChange={handleStyleChange} />
            <div className="border-t border-border" />
            <LayoutControls styles={styles} onStyleChange={handleStyleChange} />
            <div className="border-t border-border" />
            <AppearanceControls styles={styles} onStyleChange={handleStyleChange} />
        </div>
    );
}
