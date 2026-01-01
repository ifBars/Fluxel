/**
 * Base Refactoring Provider
 * 
 * Provides a foundation for refactoring operations across different languages.
 * Supports rename, extract variable, extract method, and other code actions.
 */

import type * as Monaco from 'monaco-editor';

// ============================================================================
// Types
// ============================================================================

export interface TextEdit {
    range: {
        startLine: number;
        startColumn: number;
        endLine: number;
        endColumn: number;
    };
    newText: string;
}

export interface FileEdit {
    uri: string;
    edits: TextEdit[];
}

export interface RefactoringResult {
    success: boolean;
    edits?: FileEdit[];
    error?: string;
}

export interface RefactoringContext {
    filePath: string;
    content: string;
    selection: {
        startLine: number;
        startColumn: number;
        endLine: number;
        endColumn: number;
    };
    language: string;
}

export type RefactoringKind = 
    | 'rename'
    | 'extractVariable'
    | 'extractMethod'
    | 'inlineVariable'
    | 'moveToFile'
    | 'organizeImports';

export interface CodeAction {
    id: string;
    title: string;
    kind: RefactoringKind;
    isPreferred?: boolean;
    diagnostics?: string[];
    execute: () => Promise<RefactoringResult>;
}

// ============================================================================
// Base Provider
// ============================================================================

export abstract class BaseRefactoringProvider {
    protected languageId: string;

    constructor(languageId: string) {
        this.languageId = languageId;
    }

    /**
     * Get available code actions for a given context
     */
    abstract getCodeActions(context: RefactoringContext): Promise<CodeAction[]>;

    /**
     * Execute a rename operation
     */
    abstract rename(
        context: RefactoringContext,
        newName: string
    ): Promise<RefactoringResult>;

    /**
     * Check if extract variable is available
     */
    canExtractVariable(context: RefactoringContext): boolean {
        // Default: only if there's a selection
        const { selection } = context;
        return selection.startLine !== selection.endLine || 
               selection.startColumn !== selection.endColumn;
    }

    /**
     * Check if extract method is available
     */
    canExtractMethod(context: RefactoringContext): boolean {
        // Default: only if there's a multi-line or substantial selection
        const { selection } = context;
        return selection.startLine !== selection.endLine;
    }

    /**
     * Apply edits to Monaco models
     */
    protected async applyEdits(
        monaco: typeof Monaco,
        edits: FileEdit[]
    ): Promise<boolean> {
        try {
            for (const fileEdit of edits) {
                const uri = monaco.Uri.parse(fileEdit.uri);
                const model = monaco.editor.getModel(uri);
                
                if (!model) {
                    console.warn(`[Refactoring] Model not found for ${fileEdit.uri}`);
                    continue;
                }

                // Convert to Monaco edits
                const monacoEdits: Monaco.editor.IIdentifiedSingleEditOperation[] = fileEdit.edits.map(edit => ({
                    range: new monaco.Range(
                        edit.range.startLine,
                        edit.range.startColumn,
                        edit.range.endLine,
                        edit.range.endColumn
                    ),
                    text: edit.newText,
                }));

                // Apply edits
                model.pushEditOperations([], monacoEdits, () => null);
            }
            
            return true;
        } catch (error) {
            console.error('[Refactoring] Error applying edits:', error);
            return false;
        }
    }
}

// ============================================================================
// Refactoring Preview
// ============================================================================

export interface RefactoringPreviewItem {
    filePath: string;
    fileName: string;
    edits: TextEdit[];
    originalContent: string;
    previewContent: string;
}

/**
 * Generate a preview of refactoring changes
 */
export function generateRefactoringPreview(
    edits: FileEdit[],
    getFileContent: (uri: string) => string | null
): RefactoringPreviewItem[] {
    const previews: RefactoringPreviewItem[] = [];

    for (const fileEdit of edits) {
        const originalContent = getFileContent(fileEdit.uri);
        if (!originalContent) continue;

        // Apply edits to generate preview
        const lines = originalContent.split('\n');
        
        // Sort edits by position (reverse order for correct application)
        const sortedEdits = [...fileEdit.edits].sort((a, b) => {
            if (a.range.startLine !== b.range.startLine) {
                return b.range.startLine - a.range.startLine;
            }
            return b.range.startColumn - a.range.startColumn;
        });

        for (const edit of sortedEdits) {
            const { range, newText } = edit;
            
            // Handle single-line edit
            if (range.startLine === range.endLine) {
                const line = lines[range.startLine - 1] || '';
                lines[range.startLine - 1] = 
                    line.slice(0, range.startColumn - 1) +
                    newText +
                    line.slice(range.endColumn - 1);
            } else {
                // Handle multi-line edit
                const startLine = lines[range.startLine - 1] || '';
                const endLine = lines[range.endLine - 1] || '';
                
                const newLines = newText.split('\n');
                const replacementLine = 
                    startLine.slice(0, range.startColumn - 1) +
                    newLines[0];
                
                if (newLines.length > 1) {
                    newLines[newLines.length - 1] += endLine.slice(range.endColumn - 1);
                } else {
                    newLines[0] += endLine.slice(range.endColumn - 1);
                }
                
                lines.splice(
                    range.startLine - 1,
                    range.endLine - range.startLine + 1,
                    ...newLines.map((l, i) => i === 0 ? replacementLine.slice(0, range.startColumn - 1) + l : l)
                );
            }
        }

        const previewContent = lines.join('\n');
        const fileName = fileEdit.uri.split('/').pop() || fileEdit.uri;

        previews.push({
            filePath: fileEdit.uri,
            fileName,
            edits: fileEdit.edits,
            originalContent,
            previewContent,
        });
    }

    return previews;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get selected text from content
 */
export function getSelectedText(content: string, selection: RefactoringContext['selection']): string {
    const lines = content.split('\n');
    
    if (selection.startLine === selection.endLine) {
        const line = lines[selection.startLine - 1] || '';
        return line.slice(selection.startColumn - 1, selection.endColumn - 1);
    }
    
    const result: string[] = [];
    
    for (let i = selection.startLine - 1; i < selection.endLine; i++) {
        const line = lines[i] || '';
        
        if (i === selection.startLine - 1) {
            result.push(line.slice(selection.startColumn - 1));
        } else if (i === selection.endLine - 1) {
            result.push(line.slice(0, selection.endColumn - 1));
        } else {
            result.push(line);
        }
    }
    
    return result.join('\n');
}

/**
 * Suggest a variable name from selected expression
 */
export function suggestVariableName(expression: string): string {
    // Remove common prefixes/suffixes
    let name = expression.trim();
    
    // Handle method calls: extract method name
    const methodMatch = name.match(/\.(\w+)\s*\(/);
    if (methodMatch) {
        name = methodMatch[1];
    }
    
    // Handle property access: extract property name
    const propMatch = name.match(/\.(\w+)$/);
    if (propMatch) {
        name = propMatch[1];
    }
    
    // Remove parentheses
    name = name.replace(/[()]/g, '');
    
    // Convert to camelCase if needed
    if (name.includes('_')) {
        name = name.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    }
    
    // Ensure it starts with lowercase
    if (name.length > 0) {
        name = name[0].toLowerCase() + name.slice(1);
    }
    
    // Fallback to generic name
    if (!name || !/^[a-z]/i.test(name)) {
        name = 'extracted';
    }
    
    return name;
}

