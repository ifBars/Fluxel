import { useState, useCallback, memo } from 'react';
import { X, Check, FileCode, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RefactoringPreviewItem } from '@/lib/languages/base/RefactoringProvider';

// ============================================================================
// Diff View Component
// ============================================================================

interface DiffLineProps {
    type: 'unchanged' | 'added' | 'removed';
    content: string;
    lineNumber: number;
}

function DiffLine({ type, content, lineNumber }: DiffLineProps) {
    return (
        <div className={cn(
            "flex text-xs font-mono",
            type === 'added' && "bg-green-500/10",
            type === 'removed' && "bg-red-500/10"
        )}>
            <span className="w-8 px-2 py-0.5 text-right text-muted-foreground border-r border-border select-none shrink-0">
                {lineNumber}
            </span>
            <span className={cn(
                "w-4 text-center py-0.5 shrink-0",
                type === 'added' && "text-green-500",
                type === 'removed' && "text-red-500"
            )}>
                {type === 'added' ? '+' : type === 'removed' ? '-' : ' '}
            </span>
            <span className={cn(
                "flex-1 px-2 py-0.5 whitespace-pre",
                type === 'added' && "text-green-400",
                type === 'removed' && "text-red-400"
            )}>
                {content || ' '}
            </span>
        </div>
    );
}

// ============================================================================
// Simple Diff Generator
// ============================================================================

interface DiffResult {
    type: 'unchanged' | 'added' | 'removed';
    content: string;
    lineNumber: number;
}

function generateSimpleDiff(original: string, modified: string): DiffResult[] {
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');
    const result: DiffResult[] = [];
    
    // Simple line-by-line diff
    const maxLen = Math.max(originalLines.length, modifiedLines.length);
    let lineNumber = 1;
    
    for (let i = 0; i < maxLen; i++) {
        const origLine = originalLines[i];
        const modLine = modifiedLines[i];
        
        if (origLine === modLine) {
            if (origLine !== undefined) {
                result.push({ type: 'unchanged', content: origLine, lineNumber: lineNumber++ });
            }
        } else {
            if (origLine !== undefined) {
                result.push({ type: 'removed', content: origLine, lineNumber: lineNumber });
            }
            if (modLine !== undefined) {
                result.push({ type: 'added', content: modLine, lineNumber: lineNumber++ });
            }
        }
    }
    
    return result;
}

// ============================================================================
// File Preview Component
// ============================================================================

interface FilePreviewProps {
    preview: RefactoringPreviewItem;
    isExpanded: boolean;
    onToggle: () => void;
    isSelected: boolean;
    onSelect: (selected: boolean) => void;
}

const FilePreview = memo(function FilePreview({ 
    preview, 
    isExpanded, 
    onToggle,
    isSelected,
    onSelect 
}: FilePreviewProps) {
    const diffLines = generateSimpleDiff(preview.originalContent, preview.previewContent);
    const changedLines = diffLines.filter(l => l.type !== 'unchanged').length;
    
    return (
        <div className="border border-border rounded-lg overflow-hidden">
            {/* File Header */}
            <button
                onClick={onToggle}
                className="w-full flex items-center gap-2 px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors"
            >
                {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
                
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                        e.stopPropagation();
                        onSelect(e.target.checked);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border-border"
                />
                
                <FileCode className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium truncate">{preview.fileName}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                    {changedLines} change{changedLines !== 1 ? 's' : ''}
                </span>
            </button>
            
            {/* Diff View */}
            {isExpanded && (
                <div className="max-h-64 overflow-y-auto bg-card">
                    {diffLines.map((line, index) => (
                        <DiffLine
                            key={index}
                            type={line.type}
                            content={line.content}
                            lineNumber={line.lineNumber}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});

// ============================================================================
// Refactoring Preview Dialog
// ============================================================================

interface RefactoringPreviewDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    previews: RefactoringPreviewItem[];
    onApply: (selectedFiles: string[]) => Promise<void>;
}

function RefactoringPreviewDialog({
    isOpen,
    onClose,
    title,
    description,
    previews,
    onApply,
}: RefactoringPreviewDialogProps) {
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(
        new Set(previews.map(p => p.filePath))
    );
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(
        new Set(previews.map(p => p.filePath))
    );
    const [isApplying, setIsApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const toggleFile = useCallback((filePath: string) => {
        setExpandedFiles(prev => {
            const next = new Set(prev);
            if (next.has(filePath)) {
                next.delete(filePath);
            } else {
                next.add(filePath);
            }
            return next;
        });
    }, []);
    
    const selectFile = useCallback((filePath: string, selected: boolean) => {
        setSelectedFiles(prev => {
            const next = new Set(prev);
            if (selected) {
                next.add(filePath);
            } else {
                next.delete(filePath);
            }
            return next;
        });
    }, []);
    
    const handleApply = useCallback(async () => {
        if (selectedFiles.size === 0) return;
        
        setIsApplying(true);
        setError(null);
        
        try {
            await onApply(Array.from(selectedFiles));
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to apply changes');
        } finally {
            setIsApplying(false);
        }
    }, [selectedFiles, onApply, onClose]);
    
    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    }, [onClose]);
    
    if (!isOpen) return null;
    
    const totalChanges = previews.reduce((sum, p) => sum + p.edits.length, 0);
    
    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={handleBackdropClick}
        >
            <div 
                className="w-full max-w-3xl max-h-[80vh] bg-card border border-border rounded-lg shadow-2xl overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                    <div>
                        <h2 className="text-sm font-semibold">{title}</h2>
                        {description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded hover:bg-muted transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                
                {/* Summary */}
                <div className="px-4 py-2 border-b border-border bg-muted/20 text-xs text-muted-foreground">
                    {previews.length} file{previews.length !== 1 ? 's' : ''} affected • {totalChanges} change{totalChanges !== 1 ? 's' : ''}
                </div>
                
                {/* Error Message */}
                {error && (
                    <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span className="text-xs text-red-500">{error}</span>
                    </div>
                )}
                
                {/* File Previews */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {previews.map(preview => (
                        <FilePreview
                            key={preview.filePath}
                            preview={preview}
                            isExpanded={expandedFiles.has(preview.filePath)}
                            onToggle={() => toggleFile(preview.filePath)}
                            isSelected={selectedFiles.has(preview.filePath)}
                            onSelect={(selected) => selectFile(preview.filePath, selected)}
                        />
                    ))}
                </div>
                
                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
                    <div className="text-xs text-muted-foreground">
                        {selectedFiles.size} of {previews.length} file{previews.length !== 1 ? 's' : ''} selected
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-3 py-1.5 text-xs font-medium rounded hover:bg-muted transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApply}
                            disabled={selectedFiles.size === 0 || isApplying}
                            className={cn(
                                "px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5",
                                selectedFiles.size > 0 && !isApplying
                                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                    : "bg-muted text-muted-foreground cursor-not-allowed"
                            )}
                        >
                            {isApplying ? (
                                <>
                                    <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                                    Applying...
                                </>
                            ) : (
                                <>
                                    <Check className="w-3.5 h-3.5" />
                                    Apply Changes
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default memo(RefactoringPreviewDialog);

