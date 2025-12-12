/**
 * Ollama API client for code autocomplete
 * Handles FIM (Fill-in-Middle) completion requests with streaming support
 */

export interface OllamaConfig {
    endpoint: string;
    model: string;
}

export interface FIMRequest {
    prefix: string;
    suffix: string;
    language: string;
    maxTokens?: number;
}

export interface OllamaGenerateRequest {
    model: string;
    prompt: string;
    suffix?: string;
    stream: boolean;
    raw?: boolean;
    options?: {
        num_predict?: number;
        temperature?: number;
        stop?: string[];
    };
}

export interface OllamaGenerateResponse {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
}

const DEFAULT_CONFIG: OllamaConfig = {
    endpoint: "http://localhost:11434",
    model: "qwen2.5-coder:1.5b",
};

type FimTokenSet = {
    prefix: string;
    middle: string;
    suffix: string;
    extraStops?: string[];
};

/**
 * Known FIM token sets per model family.
 * Keeping this small and explicit improves compatibility and avoids empty responses.
 */
const FIM_TOKEN_SETS: Array<{ matcher: RegExp; tokens: FimTokenSet }> = [
    {
        // Qwen / Qwen Coder
        matcher: /qwen/i,
        tokens: {
            prefix: "<|fim_prefix|>",
            middle: "<|fim_middle|>",
            suffix: "<|fim_suffix|>",
            extraStops: ["<|im_start|>", "<|im_end|>", "<|file_sep|>"],
        },
    },
    {
        // Llama 3 / CodeLlama
        // Note: Llama 3 usually supports FIM in base models. 
        // Some fine-tunes might use <PRE> <SUF> <MID> but standard Llama 3 is <|fim_prefix|> etc.
        // We add both sets of stops to be safe.
        matcher: /(llama|codellama)/i,
        tokens: {
            prefix: "<|fim_prefix|>",
            middle: "<|fim_middle|>",
            suffix: "<|fim_suffix|>",
            extraStops: ["<|eot_id|>", "<|end_of_text|>", "<|file_separator|>"],
        },
    },
    {
        // DeepSeek Coder (V1 and V2)
        matcher: /deepseek/i,
        tokens: {
            prefix: "<｜fim▁begin｜>",
            middle: "<｜fim▁hole｜>",
            suffix: "<｜fim▁end｜>",
            extraStops: ["<｜end of sentence｜>", "<|EOT|>", "<|file_sep|>"],
        },
    },
    {
        // StarCoder / StarCoder2 / CodeGeeX
        matcher: /(starcoder|codegeex|phi|gemma)/i,
        tokens: {
            prefix: "<fim_prefix>",
            middle: "<fim_middle>",
            suffix: "<fim_suffix>",
            extraStops: ["<|endoftext|>", "<file_sep>"],
        },
    },
    {
        // Mistral / Codestral / Mixtral
        matcher: /(mistral|codestral|mixtral)/i,
        tokens: {
            prefix: "[PREFIX]",
            // Mistral FIM is [PREFIX]...[SUFFIX]... then generates middle
            // Standard implementation often uses [MIDDLE] as the trigger.
            middle: "[MIDDLE]",
            suffix: "[SUFFIX]",
            extraStops: ["</s>", "[INST]", "[/INST]"],
        },
    },
];

const DEFAULT_FIM_TOKENS: FimTokenSet = {
    prefix: "<fim_prefix>",
    middle: "<fim_middle>",
    suffix: "<fim_suffix>",
    extraStops: ["<|endoftext|>"],
};

function getFimTokens(model: string | undefined): FimTokenSet {
    if (!model) return DEFAULT_FIM_TOKENS;
    const match = FIM_TOKEN_SETS.find((entry) => entry.matcher.test(model));
    return match?.tokens ?? DEFAULT_FIM_TOKENS;
}

function buildFimPrompt(
    model: string | undefined,
    prefix: string,
    suffix: string | undefined
): { prompt: string; stop: string[] } {
    const tokens = getFimTokens(model);
    const stopTokens = new Set<string>([
        tokens.suffix,
        ...[tokens.extraStops ?? []].flat(),
        "<fim_suffix>",
        "<|endoftext|>",
        "<|endoftext|>",
        "```",
    ]);

    // When no suffix is provided, treat this as next-token completion after the prefix.
    if (!suffix) {
        return {
            prompt: `${tokens.prefix}${prefix}`,
            stop: Array.from(stopTokens),
        };
    }

    return {
        // FIM models expect prefix + suffix marker + suffix + middle marker
        prompt: `${tokens.prefix}${prefix}${tokens.suffix}${suffix}${tokens.middle}`,
        stop: Array.from(stopTokens),
    };
}

/**
 * Check if Ollama is running and accessible
 */
export async function checkOllamaHealth(endpoint: string): Promise<boolean> {
    try {
        const response = await fetch(`${endpoint}/api/tags`, {
            method: "GET",
            signal: AbortSignal.timeout(2000),
        });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Get list of available models from Ollama
 */
export async function getAvailableModels(endpoint: string): Promise<string[]> {
    try {
        const response = await fetch(`${endpoint}/api/tags`, {
            method: "GET",
            signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
            return [];
        }

        const data = await response.json();
        return data.models?.map((m: { name: string }) => m.name) ?? [];
    } catch {
        return [];
    }
}

/**
 * Some environments (or proxy setups) don't expose a streaming reader.
 * This fallback parses the full response body if streaming isn't available.
 */
async function readNonStreamingBody(response: Response): Promise<string> {
    const text = await response.text();
    let combined = "";

    // Ollama returns NDJSON even when not streaming; parse line-by-line safely
    for (const line of text.split("\n")) {
        if (!line.trim()) continue;
        try {
            const parsed: OllamaGenerateResponse = JSON.parse(line);
            if (parsed.response) {
                combined += parsed.response;
            }
        } catch {
            // Ignore malformed lines; best-effort fallback
        }
    }

    return combined.trimEnd();
}

/**
 * Generate code completion using Ollama's generate API with FIM support
 * Returns an async generator for streaming responses
 */
export async function* generateCompletion(
    request: FIMRequest,
    config: Partial<OllamaConfig> = {},
    abortSignal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
    console.log("[Ollama] generateCompletion called", {
        prefixLength: request.prefix.length,
        suffixLength: request.suffix?.length ?? 0,
        language: request.language,
        maxTokens: request.maxTokens,
        configEndpoint: config.endpoint,
        configModel: config.model,
        abortSignalAborted: abortSignal?.aborted ?? false,
    });

    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    console.log("[Ollama] Final config resolved", {
        endpoint: finalConfig.endpoint,
        model: finalConfig.model,
    });

    // Build a model-aware Fill-In-Middle prompt
    const { prompt: fimPrompt, stop: fimStops } = buildFimPrompt(
        finalConfig.model,
        request.prefix,
        request.suffix
    );

    const generateRequest: OllamaGenerateRequest = {
        model: finalConfig.model,
        prompt: fimPrompt,
        stream: true,
        raw: true, // keep raw so we fully control the FIM tokens
        options: {
            num_predict: request.maxTokens ?? 128,
            temperature: 0.2, // Lower temperature for more deterministic completions
            stop: fimStops, // Stop at FIM suffix token or common boundaries
        },
    };

    console.log("[Ollama] Request prepared:", {
        model: finalConfig.model,
        promptLength: fimPrompt.length,
        prefixLength: request.prefix.length,
        suffixLength: request.suffix?.length ?? 0,
        hasSuffix: !!request.suffix,
        fimPromptPreview: fimPrompt.slice(0, 100) + (fimPrompt.length > 100 ? "..." : ""),
        requestBody: JSON.stringify(generateRequest),
    });

    // Check if already aborted before making the request
    if (abortSignal?.aborted) {
        console.warn("[Ollama] Request aborted before fetch");
        throw new DOMException("Aborted", "AbortError");
    }

    const url = `${finalConfig.endpoint}/api/generate`;
    console.log("[Ollama] Making fetch request", {
        url,
        method: "POST",
        hasAbortSignal: !!abortSignal,
    });

    let response: Response;
    try {
        response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(generateRequest),
            signal: abortSignal,
        });
        console.log("[Ollama] Fetch completed", {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: Object.fromEntries(response.headers.entries()),
        });
    } catch (fetchError) {
        console.error("[Ollama] Fetch error:", fetchError);
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
            console.log("[Ollama] Fetch aborted");
        }
        throw fetchError;
    }

    if (!response.ok) {
        const errorText = await response.text();
        console.error("[Ollama] API error response", {
            status: response.status,
            statusText: response.statusText,
            errorText,
        });
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
    }

    // If the environment cannot stream, fall back to reading the whole body
    if (!response.body || typeof response.body.getReader !== "function") {
        console.warn("[Ollama] Streaming not available, using fallback");
        const fallback = await readNonStreamingBody(response);
        console.log("[Ollama] Fallback result", {
            length: fallback.length,
            preview: fallback.slice(0, 100),
        });
        if (fallback) {
            yield fallback;
        }
        return;
    }

    console.log("[Ollama] Starting stream processing");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let hasYielded = false;
    let chunkCount = 0;
    let totalBytesReceived = 0;

    try {
        while (true) {
            // Check abort signal before reading
            if (abortSignal?.aborted) {
                console.log("[Ollama] Stream aborted during read loop");
                break;
            }

            const readResult = await reader.read();
            const { done, value } = readResult;

            if (done) {
                console.log("[Ollama] Stream ended", {
                    bufferLength: buffer.length,
                    hasYielded,
                    chunkCount,
                    totalBytesReceived,
                });
                break;
            }

            chunkCount++;
            totalBytesReceived += value.length;
            const decoded = decoder.decode(value, { stream: true });
            buffer += decoded;

            console.log("[Ollama] Chunk received", {
                chunkNumber: chunkCount,
                chunkSize: value.length,
                decodedLength: decoded.length,
                bufferLength: buffer.length,
                decodedPreview: decoded.slice(0, 100),
            });

            // Process complete JSON lines
            const lines = buffer.split("\n");
            buffer = lines.pop() || ""; // Keep incomplete line in buffer

            console.log("[Ollama] Processing lines", {
                completeLines: lines.length,
                bufferRemainder: buffer.length,
            });

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (!line.trim()) {
                    console.log("[Ollama] Skipping empty line", { lineNumber: i + 1 });
                    continue;
                }

                try {
                    const parsed: OllamaGenerateResponse = JSON.parse(line);
                    console.log("[Ollama] Parsed response chunk", {
                        lineNumber: i + 1,
                        hasResponse: !!parsed.response,
                        responseLength: parsed.response?.length ?? 0,
                        responsePreview: parsed.response?.slice(0, 50),
                        done: parsed.done,
                        model: parsed.model,
                    });

                    if (parsed.response) {
                        hasYielded = true;
                        console.log("[Ollama] Yielding chunk", {
                            chunkLength: parsed.response.length,
                            preview: parsed.response.slice(0, 50),
                        });
                        yield parsed.response;
                    }

                    if (parsed.done) {
                        console.log("[Ollama] Generation done flag received");
                        return;
                    }
                } catch (parseError) {
                    // Skip malformed JSON lines but log them
                    console.warn("[Ollama] Failed to parse response line", {
                        lineNumber: i + 1,
                        line: line.slice(0, 200),
                        error: parseError,
                    });
                }
            }
        }

        // Process any remaining buffer
        if (buffer.trim()) {
            console.log("[Ollama] Processing final buffer", {
                bufferLength: buffer.length,
                bufferPreview: buffer.slice(0, 200),
            });
            try {
                const parsed: OllamaGenerateResponse = JSON.parse(buffer);
                console.log("[Ollama] Parsed final buffer", {
                    hasResponse: !!parsed.response,
                    responseLength: parsed.response?.length ?? 0,
                    done: parsed.done,
                });
                if (parsed.response) {
                    hasYielded = true;
                    console.log("[Ollama] Yielding final chunk", {
                        chunkLength: parsed.response.length,
                        preview: parsed.response.slice(0, 50),
                    });
                    yield parsed.response;
                }
            } catch (parseError) {
                console.warn("[Ollama] Failed to parse final buffer", {
                    buffer: buffer.slice(0, 200),
                    error: parseError,
                });
            }
        }

        if (!hasYielded) {
            console.warn("[Ollama] No chunks yielded from stream", {
                chunkCount,
                totalBytesReceived,
                bufferLength: buffer.length,
            });
        } else {
            console.log("[Ollama] Stream processing complete", {
                chunksYielded: chunkCount,
                totalBytesReceived,
            });
        }
    } catch (streamError) {
        console.error("[Ollama] Stream processing error", {
            error: streamError,
            chunkCount,
            totalBytesReceived,
            bufferLength: buffer.length,
        });
        throw streamError;
    } finally {
        console.log("[Ollama] Releasing reader lock");
        reader.releaseLock();
    }
}

/**
 * Generate a single completion (non-streaming) for simpler use cases
 */
export async function generateCompletionSync(
    request: FIMRequest,
    config: Partial<OllamaConfig> = {},
    abortSignal?: AbortSignal
): Promise<string> {
    let result = "";

    for await (const chunk of generateCompletion(request, config, abortSignal)) {
        result += chunk;
    }

    return result;
}

export { DEFAULT_CONFIG };
