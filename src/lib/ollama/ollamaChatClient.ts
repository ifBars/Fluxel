/**
 * Ollama Chat API client
 * Handles conversational chat with streaming support
 */

export interface OllamaChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_calls?: OllamaToolCall[];
}

export interface OllamaToolCall {
    function: {
        name: string;
        arguments: Record<string, unknown>;
    };
}

export interface OllamaChatRequest {
    model: string;
    messages: OllamaChatMessage[];
    stream?: boolean;
    format?: string | object;
    options?: {
        temperature?: number;
        num_predict?: number;
        stop?: string[];
    };
    tools?: any[]; // Array of tool definitions
}

export interface OllamaChatResponse {
    model: string;
    created_at: string;
    message: {
        role: string;
        content: string;
        tool_calls?: OllamaToolCall[];
    };
    done: boolean;
}

const DEFAULT_ENDPOINT = 'http://localhost:11434';

/**
 * Check if Ollama server is accessible
 */
export async function checkOllamaHealth(endpoint: string = DEFAULT_ENDPOINT): Promise<boolean> {
    try {
        const response = await fetch(`${endpoint}/api/tags`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000),
        });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Get list of available models
 */
export async function getAvailableModels(endpoint: string = DEFAULT_ENDPOINT): Promise<string[]> {
    try {
        const response = await fetch(`${endpoint}/api/tags`);
        if (!response.ok) return [];

        const data = await response.json();
        return data.models?.map((m: { name: string }) => m.name) ?? [];
    } catch {
        return [];
    }
}

/**
 * Stream chat responses from Ollama
 */
export async function* streamChat(
    request: OllamaChatRequest,
    endpoint: string = DEFAULT_ENDPOINT,
    abortSignal?: AbortSignal
): AsyncGenerator<Partial<OllamaChatResponse>, void, unknown> {
    const response = await fetch(`${endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, stream: true }),
        signal: abortSignal,
    });

    if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('No response body available');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');

            // Keep the last incomplete line in the buffer
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.trim()) continue;

                try {
                    const data: OllamaChatResponse = JSON.parse(line);
                    yield data;
                } catch (e) {
                    console.warn('Failed to parse chat response line:', line, e);
                }
            }
        }

        // Process any remaining buffer
        if (buffer.trim()) {
            try {
                const data: OllamaChatResponse = JSON.parse(buffer);
                yield data;
            } catch (e) {
                console.warn('Failed to parse final buffer:', buffer, e);
            }
        }
    } finally {
        reader.releaseLock();
    }
}

/**
 * Non-streaming chat completion
 */
export async function chat(
    request: OllamaChatRequest,
    endpoint: string = DEFAULT_ENDPOINT,
    abortSignal?: AbortSignal
): Promise<OllamaChatResponse> {
    const response = await fetch(`${endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, stream: false }),
        signal: abortSignal,
    });

    if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const data: OllamaChatResponse = await response.json();
    return data;
}

export { DEFAULT_ENDPOINT };
