/**
 * Text Applicator Service
 *
 * Applies pending text changes from the Inspector to source files.
 * Handles both HTML and JSX/TSX text content updates.
 */

import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import type { TextChange, SourceLocation } from './inspectorMessages';

export interface TextApplyResult {
    success: boolean;
    filesModified: string[];
    errors: TextApplyError[];
    changesApplied: number;
}

export interface TextApplyError {
    file: string;
    line?: number;
    error: string;
}

export interface TextChangeWithLocation extends TextChange {
    sourceLocation: SourceLocation;
}

/**
 * Apply text change to source file.
 * Handles HTML, JSX, and TSX files.
 */
export async function applyTextToSource(
    change: TextChangeWithLocation,
    options: {
        checkDirty?: (filePath: string) => boolean;
        onFileModified?: (filePath: string, newContent: string) => void;
    } = {}
): Promise<TextApplyResult> {
    const result: TextApplyResult = {
        success: true,
        filesModified: [],
        errors: [],
        changesApplied: 0,
    };

    const { file, line } = change.sourceLocation;

    try {
        // Check for unsaved changes
        if (options.checkDirty?.(file)) {
            result.errors.push({
                file,
                error: 'File has unsaved changes. Please save or discard changes first.',
            });
            result.success = false;
            return result;
        }

        // Read file content
        const content = await readTextFile(file);
        const lines = content.split('\n');

        if (line < 1 || line > lines.length) {
            result.errors.push({
                file,
                line,
                error: `Line ${line} is out of bounds`,
            });
            result.success = false;
            return result;
        }

        // Determine file type
        const ext = file.split('.').pop()?.toLowerCase();
        const isJSX = ext === 'jsx' || ext === 'tsx';

        // Apply text change based on file type
        const lineIndex = line - 1;
        const updatedLine = isJSX
            ? updateJSXTextContent(lines[lineIndex], change.text)
            : updateHTMLTextContent(lines[lineIndex], change.text);

        if (updatedLine.success) {
            lines[lineIndex] = updatedLine.newLine;
            const newContent = lines.join('\n');

            await writeTextFile(file, newContent);
            result.filesModified.push(file);
            result.changesApplied = 1;

            options.onFileModified?.(file, newContent);
        } else {
            result.errors.push({
                file,
                line,
                error: updatedLine.error || 'Failed to update text content',
            });
            result.success = false;
        }

    } catch (error) {
        result.errors.push({
            file,
            error: error instanceof Error ? error.message : String(error),
        });
        result.success = false;
    }

    return result;
}

/**
 * Update text content in JSX/TSX line.
 * Handles: <div>text</div>, <div>{variable}</div>, <div>{'text'}</div>
 */
function updateJSXTextContent(
    line: string,
    newText: string
): { success: boolean; newLine: string; error?: string } {

    // Pattern 1: Simple text between tags: <tag>text content</tag>
    const simpleTextMatch = line.match(/^(\s*<\w+[^>]*>)([^<{]+)(<\/\w+>.*)/);
    if (simpleTextMatch) {
        const [, opening, , closing] = simpleTextMatch;
        return {
            success: true,
            newLine: `${opening}${newText}${closing}`,
        };
    }

    // Pattern 2: JSX expression with string literal: <tag>{'text'}</tag> or <tag>{"text"}</tag>
    const jsxStringMatch = line.match(/^(\s*<\w+[^>]*>)\{(['"`])([^'"]*)\2\}(<\/\w+>.*)/);
    if (jsxStringMatch) {
        const [, opening, quote, , closing] = jsxStringMatch;
        // Preserve the quote style
        return {
            success: true,
            newLine: `${opening}{${quote}${escapeForJSX(newText)}${quote}}${closing}`,
        };
    }

    // Pattern 3: Template literal: <tag>{`text`}</tag>
    const templateMatch = line.match(/^(\s*<\w+[^>]*>)\{`([^`]*)`\}(<\/\w+>.*)/);
    if (templateMatch) {
        const [, opening, , closing] = templateMatch;
        return {
            success: true,
            newLine: `${opening}{\`${escapeForJSX(newText)}\`}${closing}`,
        };
    }

    // Pattern 4: Self-closing or multiline - more complex
    // For now, return error for these cases

    return {
        success: false,
        newLine: line,
        error: 'Could not find simple text content pattern in JSX. This element may use expressions or span multiple lines.',
    };
}

/**
 * Update text content in HTML line.
 * Handles: <tag>text content</tag>
 */
function updateHTMLTextContent(
    line: string,
    newText: string
): { success: boolean; newLine: string; error?: string } {

    // Match opening tag, text content, closing tag
    const match = line.match(/^(\s*<\w+[^>]*>)([^<]+)(<\/\w+>.*)/);

    if (match) {
        const [, opening, , closing] = match;
        return {
            success: true,
            newLine: `${opening}${escapeHTML(newText)}${closing}`,
        };
    }

    return {
        success: false,
        newLine: line,
        error: 'Could not find text content pattern in HTML. Element may span multiple lines.',
    };
}

/**
 * Escape text for JSX string literals
 */
function escapeForJSX(text: string): string {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/`/g, '\\`');
}

/**
 * Escape text for HTML
 */
function escapeHTML(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
