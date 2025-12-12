/**
 * Style Applicator Service
 * 
 * Applies pending style changes from the Inspector to source files.
 * Transforms style changes into inline style attribute updates in JSX/TSX.
 */

import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import type { PendingChange } from '@/stores/workbench/useInspectorStore';
import type { StyleChange, SourceLocation } from './inspectorMessages';

// ============================================================================
// Types
// ============================================================================

export interface ApplyResult {
    success: boolean;
    filesModified: string[];
    errors: ApplyError[];
    changesApplied: number;
}

export interface ApplyError {
    file: string;
    line?: number;
    error: string;
}

export interface ApplyOptions {
    /** Check if file has unsaved changes in editor */
    checkDirty?: (filePath: string) => boolean;
    /** Callback when a file is about to be modified */
    onFileModifying?: (filePath: string) => void;
    /** Callback when a file has been modified */
    onFileModified?: (filePath: string, newContent: string) => void;
}

// ============================================================================
// Main Apply Function
// ============================================================================

/**
 * Apply pending style changes to source files.
 * Groups changes by file and applies them in batch.
 */
export async function applyStylesToSource(
    changes: PendingChange[],
    options: ApplyOptions = {}
): Promise<ApplyResult> {
    const result: ApplyResult = {
        success: true,
        filesModified: [],
        errors: [],
        changesApplied: 0,
    };

    // Filter to only style changes with source location
    const applicableChanges = changes.filter(
        (c): c is PendingChange & { change: StyleChange & { sourceLocation: SourceLocation } } =>
            c.type === 'style' && hasSourceLocation(c)
    );

    if (applicableChanges.length === 0) {
        return result;
    }

    // Group changes by file
    const changesByFile = groupChangesByFile(applicableChanges);

    // Process each file
    for (const [filePath, fileChanges] of Object.entries(changesByFile)) {
        try {
            // Check for unsaved changes
            if (options.checkDirty?.(filePath)) {
                result.errors.push({
                    file: filePath,
                    error: 'File has unsaved changes. Please save or discard changes first.',
                });
                result.success = false;
                continue;
            }

            options.onFileModifying?.(filePath);

            // Read current file content
            const content = await readTextFile(filePath);

            // Apply all changes for this file
            const { newContent, appliedCount, errors } = applyChangesToContent(
                content,
                fileChanges,
                filePath
            );

            if (errors.length > 0) {
                result.errors.push(...errors);
            }

            if (appliedCount > 0) {
                // Write updated content
                await writeTextFile(filePath, newContent);
                result.filesModified.push(filePath);
                result.changesApplied += appliedCount;

                options.onFileModified?.(filePath, newContent);
            }
        } catch (error) {
            result.errors.push({
                file: filePath,
                error: error instanceof Error ? error.message : String(error),
            });
            result.success = false;
        }
    }

    return result;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a pending change has source location data
 */
function hasSourceLocation(change: PendingChange): boolean {
    if (change.type !== 'style') return false;
    const styleChange = change.change as StyleChange & { sourceLocation?: SourceLocation };
    return !!(styleChange.sourceLocation?.file && styleChange.sourceLocation?.line);
}

/**
 * Group changes by their source file
 */
function groupChangesByFile(
    changes: PendingChange[]
): Record<string, Array<{ line: number; property: string; value: string; unit?: string }>> {
    const grouped: Record<string, Array<{ line: number; property: string; value: string; unit?: string }>> = {};

    for (const change of changes) {
        const styleChange = change.change as StyleChange & { sourceLocation: SourceLocation };
        const file = styleChange.sourceLocation.file;
        const line = styleChange.sourceLocation.line;

        if (!grouped[file]) {
            grouped[file] = [];
        }

        grouped[file].push({
            line,
            property: styleChange.property,
            value: styleChange.value,
            unit: styleChange.unit,
        });
    }

    return grouped;
}

/**
 * Apply changes to file content
 */
function applyChangesToContent(
    content: string,
    changes: Array<{ line: number; property: string; value: string; unit?: string }>,
    filePath: string
): { newContent: string; appliedCount: number; errors: ApplyError[] } {
    const lines = content.split('\n');
    const errors: ApplyError[] = [];
    let appliedCount = 0;

    // Group changes by line number for batch application
    const changesByLine: Record<number, Array<{ property: string; value: string; unit?: string }>> = {};
    for (const change of changes) {
        if (!changesByLine[change.line]) {
            changesByLine[change.line] = [];
        }
        changesByLine[change.line].push({
            property: change.property,
            value: change.value,
            unit: change.unit,
        });
    }

    // Apply changes to each line
    for (const [lineNumStr, lineChanges] of Object.entries(changesByLine)) {
        const lineNum = parseInt(lineNumStr, 10);
        const lineIndex = lineNum - 1; // Convert to 0-indexed

        if (lineIndex < 0 || lineIndex >= lines.length) {
            errors.push({
                file: filePath,
                line: lineNum,
                error: `Line ${lineNum} is out of bounds`,
            });
            continue;
        }

        const line = lines[lineIndex];
        const result = applyStylesToLine(line, lineChanges);

        if (result.success) {
            lines[lineIndex] = result.newLine;
            appliedCount += lineChanges.length;
        } else {
            errors.push({
                file: filePath,
                line: lineNum,
                error: result.error || 'Failed to apply styles to line',
            });
        }
    }

    return {
        newContent: lines.join('\n'),
        appliedCount,
        errors,
    };
}

/**
 * Apply style changes to a single line of JSX
 */
function applyStylesToLine(
    line: string,
    changes: Array<{ property: string; value: string; unit?: string }>
): { success: boolean; newLine: string; error?: string } {
    // Build the styles object to add/update
    const stylesToApply: Record<string, string> = {};
    for (const change of changes) {
        const camelProperty = kebabToCamelCase(change.property);
        const value = change.unit ? `${change.value}${change.unit}` : change.value;
        stylesToApply[camelProperty] = value;
    }

    // Check if line already has a style attribute
    const styleAttrMatch = line.match(/style=\{(\{[^}]*\})\}/);

    if (styleAttrMatch) {
        // Update existing style attribute
        try {
            const existingStyleStr = styleAttrMatch[1];
            const newStyleStr = mergeStyleObjects(existingStyleStr, stylesToApply);
            const newLine = line.replace(styleAttrMatch[0], `style={${newStyleStr}}`);
            return { success: true, newLine };
        } catch {
            return { success: false, newLine: line, error: 'Failed to parse existing style attribute' };
        }
    }

    // Check if line has a JSX element we can add style to
    const jsxTagMatch = line.match(/(<\w+)(\s|>)/);
    if (jsxTagMatch) {
        // Add new style attribute after the tag name
        const styleStr = formatStyleObject(stylesToApply);
        const insertPos = jsxTagMatch.index! + jsxTagMatch[1].length;
        const newLine = line.slice(0, insertPos) + ` style={${styleStr}}` + line.slice(insertPos);
        return { success: true, newLine };
    }

    return { success: false, newLine: line, error: 'Could not find JSX element on this line' };
}

/**
 * Convert kebab-case CSS property to camelCase
 */
function kebabToCamelCase(str: string): string {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Format a styles object as a JSX style string
 */
function formatStyleObject(styles: Record<string, string>): string {
    const entries = Object.entries(styles)
        .map(([key, value]) => {
            // Quote string values, keep numbers as-is
            const formattedValue = /^\d+(\.\d+)?(px|em|rem|%|vh|vw)?$/.test(value)
                ? `"${value}"`
                : `"${value}"`;
            return `${key}: ${formattedValue}`;
        })
        .join(', ');
    return `{ ${entries} }`;
}

/**
 * Merge new styles into existing style object string
 */
function mergeStyleObjects(existingStr: string, newStyles: Record<string, string>): string {
    // Simple approach: parse existing, merge, re-format
    // This handles basic cases like { padding: "10px", margin: "5px" }
    const existing: Record<string, string> = {};

    // Extract key-value pairs from the existing style string
    const pairRegex = /(\w+):\s*["']?([^,"'}]+)["']?/g;
    let match;
    while ((match = pairRegex.exec(existingStr)) !== null) {
        existing[match[1]] = match[2].trim();
    }

    // Merge new styles (overwriting existing)
    const merged = { ...existing, ...newStyles };

    return formatStyleObject(merged);
}

/**
 * Get applicable changes count (changes that have source location)
 */
export function getApplicableChangesCount(changes: PendingChange[]): number {
    return changes.filter(c => c.type === 'style' && hasSourceLocation(c)).length;
}

/**
 * Check if any changes have source location data
 */
export function hasApplicableChanges(changes: PendingChange[]): boolean {
    return getApplicableChangesCount(changes) > 0;
}
