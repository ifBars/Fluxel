/**
 * Monaco Editor InlineCompletionsProvider for Ollama-powered autocomplete
 * Provides GitHub Copilot-style ghost text suggestions
 */

import type { Monaco } from "@monaco-editor/react";
import type { editor, languages, Position, CancellationToken } from "monaco-editor";
import { generateCompletion, type OllamaConfig } from "./ollamaClient";

export interface InlineCompletionProviderConfig extends Partial<OllamaConfig> {
    debounceMs: number;
    maxContextLines: number;
    maxContextChars: number;
    maxCompletionLength: number;
}

const DEFAULT_PROVIDER_CONFIG: InlineCompletionProviderConfig = {
    debounceMs: 300,
    maxContextLines: 50,
    maxContextChars: 500,
    maxCompletionLength: 512,
};

/**
 * Merge defaults with overrides so tuning stays centralized.
 */
export function resolveInlineCompletionConfig(
    overrides: Partial<InlineCompletionProviderConfig> = {}
): InlineCompletionProviderConfig {
    return { ...DEFAULT_PROVIDER_CONFIG, ...overrides };
}

/**
 * Extract code context around the cursor position
 */
function extractContext(
    model: editor.ITextModel,
    position: Position,
    maxLines: number,
    maxChars: number
): { prefix: string; suffix: string } {
    const lineCount = model.getLineCount();

    // Get prefix (code before cursor)
    const prefixStartLine = Math.max(1, position.lineNumber - maxLines);
    const prefixRange = {
        startLineNumber: prefixStartLine,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
    };
    const prefix = model.getValueInRange(prefixRange);

    // Get suffix (code after cursor)
    const suffixEndLine = Math.min(lineCount, position.lineNumber + maxLines);
    const suffixRange = {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: suffixEndLine,
        endColumn: model.getLineMaxColumn(suffixEndLine),
    };
    const suffix = model.getValueInRange(suffixRange);

    return limitContextByCharacters(prefix, suffix, maxChars);
}

/**
 * Trim and cap context by character budget.
 * Keeps more weight on the prefix (history) while preserving some suffix (future).
 */
function limitContextByCharacters(
    prefix: string,
    suffix: string,
    maxChars: number,
    prefixWeight: number = 0.75
): { prefix: string; suffix: string } {
    const normalizedPrefix = prefix;
    const normalizedSuffix = suffix;
    const totalLength = normalizedPrefix.length + normalizedSuffix.length;

    if (maxChars <= 0 || totalLength <= maxChars) {
        return { prefix: normalizedPrefix, suffix: normalizedSuffix };
    }

    const prefixBudget = Math.max(0, Math.floor(maxChars * prefixWeight));
    const limitedPrefix =
        normalizedPrefix.length > prefixBudget
            ? normalizedPrefix.slice(normalizedPrefix.length - prefixBudget)
            : normalizedPrefix;

    const remainingBudget = Math.max(0, maxChars - limitedPrefix.length);
    const limitedSuffix =
        normalizedSuffix.length > remainingBudget
            ? normalizedSuffix.slice(0, remainingBudget)
            : normalizedSuffix;

    return { prefix: limitedPrefix, suffix: limitedSuffix };
}

/**
 * Drop leading comment/empty lines from the suffix so future code anchors the model.
 */
function stripLeadingComments(suffix: string): string {
    const lines = suffix.split("\n");
    let idx = 0;
    while (idx < lines.length) {
        const line = lines[idx];
        if (/^\s*$/.test(line)) {
            idx++;
            continue;
        }
        if (/^\s*(\/\/|\/\*|\*|\*\/)/.test(line)) {
            idx++;
            continue;
        }
        break;
    }
    return lines.slice(idx).join("\n");
}

/**
 * If the immediate suffix is empty (only comments/whitespace), peek ahead to the next
 * non-comment code lines to provide a forward anchor for FIM models.
 */
function findForwardCodeSuffix(
    model: editor.ITextModel,
    fromLine: number,
    maxLookaheadLines: number = 80,
    maxChars: number = 200
): string {
    const lineCount = model.getLineCount();
    const startLine = Math.min(lineCount, fromLine + 1);
    const endSearchLine = Math.min(lineCount, fromLine + maxLookaheadLines);

    let firstCodeLine = -1;
    for (let line = startLine; line <= endSearchLine; line++) {
        const content = model.getLineContent(line);
        if (/^\s*$/.test(content)) continue;
        if (/^\s*(\/\/|\/\*|\*|\*\/)/.test(content)) continue;
        firstCodeLine = line;
        break;
    }

    if (firstCodeLine === -1) {
        return "";
    }

    const captureEndLine = Math.min(lineCount, firstCodeLine + 5);
    const range = {
        startLineNumber: firstCodeLine,
        startColumn: 1,
        endLineNumber: captureEndLine,
        endColumn: model.getLineMaxColumn(captureEndLine),
    };

    let text = model.getValueInRange(range);
    if (text.length > maxChars) {
        text = text.slice(0, maxChars);
    }
    return text;
}

/**
 * Get file language from Monaco model
 */
function getLanguageId(model: editor.ITextModel): string {
    return model.getLanguageId() || "plaintext";
}

/**
 * Simple delay helper for debouncing
 */
function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}

/**
 * Clean up completion text
 * Removes unwanted artifacts and normalizes the output
 */
function cleanCompletion(text: string): string {
    // Remove trailing whitespace but preserve leading (for indentation)
    let cleaned = text.trimEnd();

    // Remove common completion artifacts
    cleaned = cleaned
        .replace(/^```\w*\n?/, "") // Remove opening code fence
        .replace(/\n```$/, "")     // Remove closing code fence
        .replace(/<\|.*?\|>/g, "") // Remove special tokens
        .replace(/<(?:fim_prefix|fim_middle|fim_suffix)>/g, "")
        .replace(/<｜fim▁(?:begin｜|hole｜|end｜)>/g, "")
        .replace(/\[EOL\]/g, "")   // Remove EOL markers
        .replace(/<file_sep>/g, ""); // Remove file separators some models emit

    // Limit to reasonable length (single logical completion)
    const lines = cleaned.split("\n");
    if (lines.length > 5) {
        // For multi-line completions, try to find a natural break point
        cleaned = lines.slice(0, 5).join("\n");
    }

    return cleaned;
}

function isEchoingSuffix(completion: string, suffix: string): boolean {
    if (!completion.trim() || !suffix.trim()) return false;
    const normalizedCompletion = completion.trim().toLowerCase();
    const normalizedSuffixHead = suffix.trimStart().slice(0, Math.max(normalizedCompletion.length, 64)).toLowerCase();
    return normalizedSuffixHead.startsWith(normalizedCompletion);
}

/**
 * Create a Monaco InlineCompletionsProvider for Ollama
 */
export function createInlineCompletionProvider(
    _monaco: Monaco,
    config: Partial<InlineCompletionProviderConfig> = {}
): languages.InlineCompletionsProvider {
    const finalConfig = resolveInlineCompletionConfig(config);

    // Track active requests for cancellation
    let activeAbortController: AbortController | null = null;

    return {
        provideInlineCompletions: async (
            model: editor.ITextModel,
            position: Position,
            _context: languages.InlineCompletionContext,
            token: CancellationToken
        ): Promise<languages.InlineCompletions> => {
            // Cancel any previous in-flight request
            if (activeAbortController) {
                activeAbortController.abort();
            }
            activeAbortController = new AbortController();
            const currentAbortController = activeAbortController;
            const abortSignal = activeAbortController.signal;

            const tokenToCharFactor = 4;
            const streamingSoftLimit = Math.max(
                finalConfig.maxCompletionLength * tokenToCharFactor,
                finalConfig.maxCompletionLength + 725
            );
            const streamingHardLimit = Math.max(
                finalConfig.maxCompletionLength * tokenToCharFactor * 2,
                streamingSoftLimit + finalConfig.maxCompletionLength
            );

            try {
                let softLimitHit = false;
                // Debounce to avoid excessive API calls
                await delay(finalConfig.debounceMs);

                // Check if request was cancelled during debounce
                if (abortSignal.aborted || token.isCancellationRequested) {
                    return { items: [] };
                }

                // Extract context
                const { prefix, suffix } = extractContext(
                    model,
                    position,
                    finalConfig.maxContextLines,
                    finalConfig.maxContextChars
                );

                // Drop leading comments/blank lines from suffix so the model anchors
                // to the next real code instead of mirroring nearby comments.
                let sanitizedSuffix = stripLeadingComments(suffix);

                // If suffix is empty after stripping, look ahead for the next code lines
                // to give the model a forward anchor.
                if (!sanitizedSuffix) {
                    const forward = findForwardCodeSuffix(model, position.lineNumber);
                    if (forward) {
                        sanitizedSuffix = forward;
                    }
                }

                // Skip if prefix is too short or just whitespace
                if (prefix.trim().length < 3) {
                    return { items: [] };
                }

                // Generate completion
                let completionText = "";
                let hasReceivedChunk = false;

                const languageId = getLanguageId(model);
                const completionRequest = {
                    prefix,
                    suffix: sanitizedSuffix,
                    language: languageId,
                    maxTokens: finalConfig.maxCompletionLength,
                };
                const completionConfig = {
                    endpoint: finalConfig.endpoint,
                    model: finalConfig.model,
                };

                try {
                    for await (const chunk of generateCompletion(
                        completionRequest,
                        completionConfig,
                        abortSignal
                    )) {
                        // Check cancellation during streaming
                        if (abortSignal.aborted || token.isCancellationRequested) {
                            break;
                        }

                        hasReceivedChunk = true;
                        completionText += chunk;

                        // Stop early if we have enough text
                        if (completionText.length >= streamingHardLimit) {
                            break;
                        } else if (completionText.length >= streamingSoftLimit) {
                            if (softLimitHit) {
                                break;
                            }
                            softLimitHit = true;
                        }
                    }
                } catch (genError) {
                    // Silently handle aborts - they're expected when user types quickly
                    if (genError instanceof DOMException && genError.name === "AbortError") {
                        return { items: [] };
                    }
                    // Also handle Error objects that might wrap AbortError
                    if (genError instanceof Error && genError.message.includes("aborted")) {
                        return { items: [] };
                    }
                    console.error("[Autocomplete] Generation error:", genError);
                    throw genError;
                }

                if (!hasReceivedChunk || !completionText.trim()) {
                    return { items: [] };
                }

                if (abortSignal.aborted || token.isCancellationRequested) {
                    return { items: [] };
                }

                // Clean and validate completion
                const cleanedCompletion = cleanCompletion(completionText);

                if (!cleanedCompletion || !cleanedCompletion.trim()) {
                    return { items: [] };
                }

                if (isEchoingSuffix(cleanedCompletion, sanitizedSuffix)) {
                    return { items: [] };
                }

                // Create inline completion item
                const item: languages.InlineCompletion = {
                    insertText: cleanedCompletion,
                    range: {
                        startLineNumber: position.lineNumber,
                        startColumn: position.column,
                        endLineNumber: position.lineNumber,
                        endColumn: position.column,
                    },
                };

                // If Monaco already cancelled this request, silently drop the result
                if (token.isCancellationRequested || abortSignal.aborted) {
                    return { items: [] };
                }

                return { items: [item] };

            } catch (error) {
                // Handle aborts silently
                if (error instanceof DOMException && error.name === "AbortError") {
                    return { items: [] };
                }

                console.error("[Autocomplete] Error:", error);
                return { items: [] };

            } finally {
                if (activeAbortController === currentAbortController) {
                    activeAbortController = null;
                }
            }
        },

        disposeInlineCompletions: () => {
            if (activeAbortController) {
                activeAbortController.abort();
                activeAbortController = null;
            }
        },
    };
}

/**
 * Register the inline completion provider for all languages
 */
export function registerInlineCompletionProvider(
    monaco: Monaco,
    config: Partial<InlineCompletionProviderConfig> = {}
): { dispose: () => void } {
    const resolvedConfig = resolveInlineCompletionConfig(config);
    const provider = createInlineCompletionProvider(monaco, resolvedConfig);

    // Register for all known languages so inline suggestions work everywhere
    const allLanguages = monaco.languages.getLanguages();
    const languageIds = allLanguages
        .map((lang: languages.ILanguageExtensionPoint) => lang.id)
        .filter(Boolean);
    const selector = languageIds.length ? languageIds : { pattern: "**" };

    const disposable = monaco.languages.registerInlineCompletionsProvider(selector, provider);

    return {
        dispose: () => {
            disposable.dispose();
        },
    };
}

export { DEFAULT_PROVIDER_CONFIG };
