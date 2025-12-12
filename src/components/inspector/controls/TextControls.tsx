import { useState, useCallback, useEffect } from 'react';
import { AlertCircle, Type } from 'lucide-react';

interface TextControlsProps {
    textContent: string | null;
    isEditable: boolean;
    nonEditableReason?: 'binding-attribute' | 'dynamic-mutation' | 'binding-context' | 'not-text-element';
    selector: string;
    onTextChange: (text: string) => void;
}

/**
 * Text content controls for editing element text.
 * Follows 8pt grid spacing from design system.
 * Shows warnings for non-editable text with explanations.
 */
export default function TextControls({
    textContent,
    isEditable,
    nonEditableReason,
    onTextChange
}: TextControlsProps) {
    const [localText, setLocalText] = useState(textContent || '');
    const [isExpanded, setIsExpanded] = useState(true);

    // Sync with prop changes
    useEffect(() => {
        setLocalText(textContent || '');
    }, [textContent]);

    const handleChange = useCallback((newText: string) => {
        setLocalText(newText);
    }, []);

    const handleBlur = useCallback(() => {
        if (isEditable && localText !== textContent) {
            onTextChange(localText);
        }
    }, [isEditable, localText, textContent, onTextChange]);

    const charCount = localText.length;
    const hasContent = textContent !== null;

    if (!hasContent) {
        return null; // Don't show section for non-text elements
    }

    const getReasonMessage = (reason?: string): string => {
        switch (reason) {
            case 'binding-attribute':
                return 'This text is controlled by a data-binding attribute (v-text, ng-bind, etc.)';
            case 'dynamic-mutation':
                return 'This text changes dynamically via JavaScript (detected via DOM mutations)';
            case 'binding-context':
                return 'This element is within a data-binding context (Vue/Angular/React component)';
            case 'not-text-element':
                return 'This element contains child elements, not just text';
            default:
                return 'This text cannot be edited directly';
        }
    };

    return (
        <div className="space-y-4">
            {/* Section header - collapsible */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between hover:bg-muted/50 p-1 rounded transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Type className="w-3 h-3 text-muted-foreground" />
                    <h3 className="text-xs font-semibold text-foreground">Text Content</h3>
                </div>
                <span className="text-xs text-muted-foreground">
                    {isExpanded ? '−' : '+'}
                </span>
            </button>

            {isExpanded && (
                <>
                    {/* Warning banner for non-editable text */}
                    {!isEditable && (
                        <div className="flex items-start gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-sm">
                            <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-xs text-yellow-700 dark:text-yellow-400 font-medium mb-1">
                                    Read-only text
                                </p>
                                <p className="text-xs text-yellow-600 dark:text-yellow-300">
                                    {getReasonMessage(nonEditableReason)}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Text editor */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs text-muted-foreground font-medium">
                                Content
                            </label>
                            <span className="text-xs text-muted-foreground">
                                {charCount} chars
                            </span>
                        </div>

                        <textarea
                            value={localText}
                            onChange={(e) => handleChange(e.target.value)}
                            onBlur={handleBlur}
                            disabled={!isEditable}
                            placeholder="Enter text content..."
                            rows={4}
                            className={`
                                w-full min-h-[80px] resize-y
                                bg-muted border border-border rounded-sm
                                text-xs text-foreground font-mono
                                px-2 py-2
                                focus:outline-none focus:ring-1 focus:ring-primary
                                ${!isEditable ? 'opacity-60 cursor-not-allowed' : ''}
                            `}
                        />

                        {/* Helper text */}
                        {isEditable && (
                            <p className="text-xs text-muted-foreground">
                                Changes will update the source file when you click Apply
                            </p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
