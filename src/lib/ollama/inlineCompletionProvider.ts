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
    console.log("[Autocomplete] createInlineCompletionProvider called", {
        config,
        defaultConfig: DEFAULT_PROVIDER_CONFIG,
    });

    const finalConfig = resolveInlineCompletionConfig(config);
    console.log("[Autocomplete] Final provider config", finalConfig);

    // Track active requests for cancellation
    let activeAbortController: AbortController | null = null;
    let requestId = 0;

    return {
        provideInlineCompletions: async (
            model: editor.ITextModel,
            position: Position,
            context: languages.InlineCompletionContext,
            token: CancellationToken
        ): Promise<languages.InlineCompletions> => {
            const currentRequestId = ++requestId;
            console.log("[Autocomplete] provider invoked", {
                requestId: currentRequestId,
                uri: model.uri.toString(),
                language: model.getLanguageId(),
                position: { line: position.lineNumber, column: position.column },
                context: {
                    triggerKind: context.triggerKind,
                    selectedSuggestionInfo: context.selectedSuggestionInfo,
                },
                debounceMs: finalConfig.debounceMs,
                maxContextLines: finalConfig.maxContextLines,
                maxContextChars: finalConfig.maxContextChars,
                maxCompletionLength: finalConfig.maxCompletionLength,
                tokenCancellationRequested: token.isCancellationRequested,
            });

            // Cancel any previous in-flight request
            if (activeAbortController) {
                console.log("[Autocomplete] aborting previous request", {
                    requestId: currentRequestId,
                    previousRequestAborted: activeAbortController.signal.aborted,
                });
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

            console.log("[Autocomplete] Created abort controller", {
                requestId: currentRequestId,
                signalAborted: abortSignal.aborted,
                streamingSoftLimit,
                streamingHardLimit,
            });

            try {
                let softLimitHit = false;
                // Debounce to avoid excessive API calls (don't pass abort signal to delay)
                console.log("[Autocomplete] Starting debounce", {
                    requestId: currentRequestId,
                    debounceMs: finalConfig.debounceMs,
                });
                await delay(finalConfig.debounceMs);
                console.log("[Autocomplete] Debounce complete", {
                    requestId: currentRequestId,
                });

                // Check if request was cancelled during debounce
                if (abortSignal.aborted || token.isCancellationRequested) {
                    console.log("[Autocomplete] cancelled during debounce", {
                        requestId: currentRequestId,
                        abortSignalAborted: abortSignal.aborted,
                        tokenCancellationRequested: token.isCancellationRequested,
                    });
                    return { items: [] };
                }

                // Extract context
                console.log("[Autocomplete] Extracting context", {
                    requestId: currentRequestId,
                    position: { line: position.lineNumber, column: position.column },
                    maxContextLines: finalConfig.maxContextLines,
                    maxContextChars: finalConfig.maxContextChars,
                    modelLineCount: model.getLineCount(),
                });
                const { prefix, suffix } = extractContext(
                    model,
                    position,
                    finalConfig.maxContextLines,
                    finalConfig.maxContextChars
                );

                // Drop leading comments/blank lines from suffix so the model anchors
                // to the next real code instead of mirroring nearby comments.
                let sanitizedSuffix = stripLeadingComments(suffix);
                let suffixStartsWithComment = sanitizedSuffix.length === 0 && suffix.length > 0;

                // If suffix is empty after stripping, look ahead for the next code lines
                // to give the model a forward anchor.
                let suffixFilledFromLookahead = false;
                if (!sanitizedSuffix) {
                    const forward = findForwardCodeSuffix(model, position.lineNumber);
                    if (forward) {
                        sanitizedSuffix = forward;
                        suffixFilledFromLookahead = true;
                        suffixStartsWithComment = false;
                    }
                }

                console.log("[Autocomplete] Context extracted", {
                    requestId: currentRequestId,
                    prefixLength: prefix.length,
                    suffixLength: suffix.length,
                    prefixTail: prefix.slice(-80),
                    suffixHead: suffix.slice(0, 80),
                    prefixTrimmedLength: prefix.trim().length,
                    contextCharBudget: finalConfig.maxContextChars,
                    contextCharUsage: prefix.length + suffix.length,
                    suffixStartsWithComment,
                    sanitizedSuffixLength: sanitizedSuffix.length,
                    suffixFilledFromLookahead,
                });

                // Skip if prefix is too short or just whitespace
                if (prefix.trim().length < 3) {
                    console.log("[Autocomplete] prefix too short, skipping", {
                        requestId: currentRequestId,
                        prefixTrimmedLength: prefix.trim().length,
                        prefixPreview: prefix.slice(0, 50),
                    });
                    return { items: [] };
                }

                // Generate completion
                let completionText = "";
                let hasReceivedChunk = false;
                let chunkCount = 0;

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

                console.log("[Autocomplete] calling Ollama generate", {
                    requestId: currentRequestId,
                    endpoint: finalConfig.endpoint,
                    model: finalConfig.model,
                    language: languageId,
                    maxTokens: finalConfig.maxCompletionLength,
                    prefixLength: prefix.length,
                    suffixLength: suffix.length,
                    abortSignalAborted: abortSignal.aborted,
                });

                try {
                    for await (const chunk of generateCompletion(
                        completionRequest,
                        completionConfig,
                        abortSignal
                    )) {
                        chunkCount++;
                        console.log("[Autocomplete] Received chunk", {
                            requestId: currentRequestId,
                            chunkNumber: chunkCount,
                            chunkLength: chunk.length,
                            chunkPreview: chunk.slice(0, 50),
                            totalLength: completionText.length + chunk.length,
                        });

                        // Check cancellation during streaming
                        if (abortSignal.aborted || token.isCancellationRequested) {
                            console.log("[Autocomplete] Cancelled during streaming", {
                                requestId: currentRequestId,
                                chunkCount,
                                abortSignalAborted: abortSignal.aborted,
                                tokenCancellationRequested: token.isCancellationRequested,
                            });
                            break;
                        }

                        hasReceivedChunk = true;
                        completionText += chunk;

                        // Stop early if we have enough text
                        if (completionText.length >= streamingHardLimit) {
                            console.log("[Autocomplete] Stopping early - enough text", {
                                requestId: currentRequestId,
                                completionLength: completionText.length,
                                hardLimit: streamingHardLimit,
                            });
                            break;
                        } else if (completionText.length >= streamingSoftLimit) {
                            if (softLimitHit) {
                                console.log("[Autocomplete] Reached soft streaming limit twice, stopping", {
                                    requestId: currentRequestId,
                                    completionLength: completionText.length,
                                    softLimit: streamingSoftLimit,
                                });
                                break;
                            }
                            softLimitHit = true;
                            console.log("[Autocomplete] Reached soft streaming limit, allowing one more chunk", {
                                requestId: currentRequestId,
                                completionLength: completionText.length,
                                softLimit: streamingSoftLimit,
                            });
                        }
                    }

                    console.log("[Autocomplete] Streaming complete", {
                        requestId: currentRequestId,
                        chunkCount,
                        hasReceivedChunk,
                        completionLength: completionText.length,
                    });
                } catch (genError) {
                    // Silently handle aborts - they're expected when user types quickly
                    if (genError instanceof DOMException && genError.name === "AbortError") {
                        console.log("[Autocomplete] Generation aborted (DOMException)", {
                            requestId: currentRequestId,
                            chunkCount,
                        });
                        return { items: [] };
                    }
                    // Also handle Error objects that might wrap AbortError
                    if (genError instanceof Error && genError.message.includes("aborted")) {
                        console.log("[Autocomplete] Generation aborted (Error)", {
                            requestId: currentRequestId,
                            errorMessage: genError.message,
                            chunkCount,
                        });
                        return { items: [] };
                    }
                    console.error("[Autocomplete] Generation error", {
                        requestId: currentRequestId,
                        error: genError,
                        errorName: genError instanceof Error ? genError.name : undefined,
                        errorMessage: genError instanceof Error ? genError.message : String(genError),
                        chunkCount,
                        hasReceivedChunk,
                    });
                    throw genError;
                }

                console.log("[Autocomplete] Raw output received", {
                    requestId: currentRequestId,
                    rawText: completionText,
                    rawLength: completionText.length,
                    hasReceivedChunk,
                    chunkCount,
                    isEmpty: !completionText.trim(),
                });

                if (!hasReceivedChunk || !completionText.trim()) {
                    console.warn("[Autocomplete] No completion received from Ollama", {
                        requestId: currentRequestId,
                        hasReceivedChunk,
                        completionTextLength: completionText.length,
                        completionTextTrimmed: completionText.trim().length,
                    });
                    return { items: [] };
                }

                if (abortSignal.aborted || token.isCancellationRequested) {
                    console.log("[Autocomplete] Cancelled before cleaning completion", {
                        requestId: currentRequestId,
                        abortSignalAborted: abortSignal.aborted,
                        tokenCancellationRequested: token.isCancellationRequested,
                    });
                    return { items: [] };
                }

                // Clean and validate completion
                console.log("[Autocomplete] Cleaning completion", {
                    requestId: currentRequestId,
                    rawLength: completionText.length,
                });
                const cleanedCompletion = cleanCompletion(completionText);
                console.log("[Autocomplete] Cleaned output", {
                    requestId: currentRequestId,
                    cleanedText: cleanedCompletion,
                    cleanedLength: cleanedCompletion.length,
                    rawLength: completionText.length,
                    wasTruncated: cleanedCompletion.length < completionText.length,
                });

                if (!cleanedCompletion || !cleanedCompletion.trim()) {
                    console.warn("[Autocomplete] Completion was empty after cleaning", {
                        requestId: currentRequestId,
                        rawLength: completionText.length,
                        cleanedLength: cleanedCompletion.length,
                        rawPreview: completionText.slice(0, 100),
                    });
                    return { items: [] };
                }

                if (isEchoingSuffix(cleanedCompletion, sanitizedSuffix)) {
                    console.log("[Autocomplete] Dropping completion that echoes suffix", {
                        requestId: currentRequestId,
                        completionPreview: cleanedCompletion.slice(0, 80),
                        suffixHead: sanitizedSuffix.slice(0, 120),
                    });
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
                    console.log("[Autocomplete] Dropping completion due to cancellation", {
                        requestId: currentRequestId,
                        abortSignalAborted: abortSignal.aborted,
                        tokenCancellationRequested: token.isCancellationRequested,
                    });
                    return { items: [] };
                }

                console.log("[Autocomplete] Returning completion item", {
                    requestId: currentRequestId,
                    insertTextPreview: cleanedCompletion.slice(0, 80),
                    insertTextLength: cleanedCompletion.length,
                    range: item.range,
                    itemKeys: Object.keys(item),
                });
                return { items: [item] };

            } catch (error) {
                // Handle aborts silently
                if (error instanceof DOMException && error.name === "AbortError") {
                    console.log("[Autocomplete] Request aborted (outer catch)", {
                        requestId: currentRequestId,
                    });
                    return { items: [] };
                }

                console.error("[Autocomplete] Error in provideInlineCompletions", {
                    requestId: currentRequestId,
                    error,
                    errorName: error instanceof Error ? error.name : undefined,
                    errorMessage: error instanceof Error ? error.message : String(error),
                    errorStack: error instanceof Error ? error.stack : undefined,
                });
                return { items: [] };

            } finally {
                console.log("[Autocomplete] Cleaning up request", {
                    requestId: currentRequestId,
                    isCurrentController: activeAbortController === currentAbortController,
                });
                if (activeAbortController === currentAbortController) {
                    // Clear controller if this request finished (helps spot leaks)
                    console.log("[Autocomplete] Clearing abort controller", {
                        requestId: currentRequestId,
                    });
                    activeAbortController = null;
                }
            }
        },

        disposeInlineCompletions: () => {
            // Abort any lingering request when Monaco disposes a completion list
            console.log("[Autocomplete] disposeInlineCompletions called", {
                hasActiveController: !!activeAbortController,
                controllerAborted: activeAbortController?.signal.aborted ?? false,
            });
            if (activeAbortController) {
                console.log("[Autocomplete] disposeInlineCompletions aborting inflight request");
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
    console.log("[Autocomplete] registerInlineCompletionProvider called", {
        config,
        monacoAvailable: !!monaco,
        languagesAvailable: !!monaco.languages,
    });

    const resolvedConfig = resolveInlineCompletionConfig(config);
    const provider = createInlineCompletionProvider(monaco, resolvedConfig);
    console.log("[Autocomplete] Provider created", {
        providerAvailable: !!provider,
        hasProvideInlineCompletions: typeof provider.provideInlineCompletions === "function",
        hasDisposeInlineCompletions: typeof provider.disposeInlineCompletions === "function",
        resolvedConfig,
    });

    // Register for all known languages so inline suggestions work everywhere
    const allLanguages = monaco.languages.getLanguages();
    console.log("[Autocomplete] Available languages", {
        languageCount: allLanguages.length,
        languages: allLanguages.map((lang: languages.ILanguageExtensionPoint) => ({
            id: lang.id,
            aliases: lang.aliases,
            extensions: lang.extensions,
        })),
    });

    const languageIds = allLanguages
        .map((lang: languages.ILanguageExtensionPoint) => lang.id)
        .filter(Boolean);
    const selector = languageIds.length ? languageIds : { pattern: "**" };
    
    console.log("[Autocomplete] Registering inline provider", {
        selector,
        selectorType: Array.isArray(selector) ? "array" : typeof selector,
        selectorLength: Array.isArray(selector) ? selector.length : undefined,
    });

    const disposable = monaco.languages.registerInlineCompletionsProvider(selector, provider);
    
    console.log("[Autocomplete] Provider registered successfully", {
        disposableAvailable: !!disposable,
        hasDispose: typeof disposable.dispose === "function",
    });

    return {
        dispose: () => {
            console.log("[Autocomplete] Disposing inline provider");
            disposable.dispose();
        },
    };
}

export { DEFAULT_PROVIDER_CONFIG };
