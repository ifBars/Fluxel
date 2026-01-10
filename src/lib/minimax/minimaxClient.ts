/**
 * MiniMax Chat API client using Tauri backend proxy
 * Proxies through Rust backend to avoid CORS issues
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// Available MiniMax models
export const MINIMAX_MODELS = [
    'MiniMax-M2.1',
] as const;

export type MinimaxModel = typeof MINIMAX_MODELS[number];

export interface MinimaxStreamChunk {
    type: 'text' | 'thinking' | 'tool_use' | 'done' | 'error';
    content?: string;
    toolUse?: {
        id: string;
        name: string;
        input: Record<string, unknown>;
    };
    message?: string; // for error type
}

export interface MinimaxToolDefinition {
    name: string;
    description: string;
    input_schema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
}

export interface MinimaxMessage {
    role: string;
    content: string;
}

export interface MinimaxChatRequest {
    model: string;
    messages: MinimaxMessage[];
    system?: string;
    maxTokens?: number;
    temperature?: number;
    tools?: MinimaxToolDefinition[];
}

/**
 * Check if MiniMax API is accessible with the given API key
 */
export async function checkMinimaxHealth(apiKey: string): Promise<boolean> {
    console.log('[MiniMax] Checking health via Tauri...');
    try {
        const result = await invoke<boolean>('minimax_health_check', { apiKey });
        console.log('[MiniMax] Health check result:', result);
        return result;
    } catch (e) {
        console.error('[MiniMax] Health check failed:', e);
        return false;
    }
}

/**
 * Get list of available MiniMax models
 * Note: MiniMax doesn't have a models endpoint, so we return static list
 */
export async function getAvailableMinimaxModels(): Promise<string[]> {
    return [...MINIMAX_MODELS];
}

/**
 * Stream chat responses from MiniMax using Tauri backend proxy
 */
export async function* streamMinimaxChat(
    request: MinimaxChatRequest,
    apiKey: string,
    abortSignal?: AbortSignal
): AsyncGenerator<MinimaxStreamChunk, void, unknown> {
    console.log('[MiniMax] Starting streaming chat via Tauri...');
    console.log('[MiniMax] Request model:', request.model);
    console.log('[MiniMax] Request messages count:', request.messages.length);

    const requestId = crypto.randomUUID();
    const eventName = `minimax_stream_${requestId}`;

    // Create a queue to buffer incoming events
    const chunkQueue: MinimaxStreamChunk[] = [];
    let resolveWait: (() => void) | null = null;
    let isDone = false;
    let unlisten: UnlistenFn | null = null;

    // Handle abort
    if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
            isDone = true;
            if (resolveWait) resolveWait();
        });
    }

    try {
        // Set up event listener
        console.log('[MiniMax] Setting up event listener:', eventName);
        unlisten = await listen<MinimaxStreamChunk>(eventName, (event) => {
            console.log('[MiniMax] Received event:', event.payload.type);

            // Map backend format to frontend format
            const chunk = event.payload;

            if (chunk.type === 'done' || chunk.type === 'error') {
                isDone = true;
            }

            chunkQueue.push(chunk);

            // Wake up the generator if it's waiting
            if (resolveWait) {
                resolveWait();
                resolveWait = null;
            }
        });

        // Convert request format for backend
        const backendRequest = {
            model: request.model,
            messages: request.messages.map(m => ({
                role: m.role,
                content: m.content,
            })),
            system: request.system,
            max_tokens: request.maxTokens,
            temperature: request.temperature,
            tools: request.tools,
        };

        // Start streaming via Tauri command (don't await - it streams)
        console.log('[MiniMax] Invoking minimax_chat_stream command...');
        invoke('minimax_chat_stream', {
            apiKey,
            request: backendRequest,
            requestId,
        }).catch(e => {
            console.error('[MiniMax] Stream command error:', e);
            chunkQueue.push({ type: 'error', message: String(e) });
            isDone = true;
            if (resolveWait) resolveWait();
        });

        // Yield chunks as they arrive
        while (!isDone || chunkQueue.length > 0) {
            if (chunkQueue.length > 0) {
                const chunk = chunkQueue.shift()!;

                // Convert tool_use from backend format
                if (chunk.type === 'tool_use' && (chunk as any).id && (chunk as any).name) {
                    yield {
                        type: 'tool_use',
                        toolUse: {
                            id: (chunk as any).id,
                            name: (chunk as any).name,
                            input: (chunk as any).input || {},
                        },
                    };
                } else {
                    yield chunk;
                }

                if (chunk.type === 'done' || chunk.type === 'error') {
                    break;
                }
            } else if (!isDone) {
                // Wait for more chunks
                await new Promise<void>(resolve => {
                    resolveWait = resolve;
                });
            }
        }

        console.log('[MiniMax] Stream finished');
    } finally {
        // Clean up listener
        if (unlisten) {
            unlisten();
        }
    }
}

/**
 * Non-streaming chat completion with MiniMax
 */
export async function chatMinimax(
    request: MinimaxChatRequest,
    apiKey: string,
): Promise<{
    content: string;
    thinking?: string;
    toolUse?: { id: string; name: string; input: Record<string, unknown> }[];
    stopReason: string;
}> {
    console.log('[MiniMax] Starting non-streaming chat via Tauri...');

    const backendRequest = {
        model: request.model,
        messages: request.messages.map(m => ({
            role: m.role,
            content: m.content,
        })),
        system: request.system,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
    };

    try {
        const response = await invoke<any>('minimax_chat', {
            apiKey,
            request: backendRequest,
        });

        console.log('[MiniMax] Response received');

        // Parse Anthropic-style response
        let content = '';
        let thinking = '';
        const toolUse: { id: string; name: string; input: Record<string, unknown> }[] = [];

        if (response.content && Array.isArray(response.content)) {
            for (const block of response.content) {
                if (block.type === 'text') {
                    content += block.text || '';
                } else if (block.type === 'thinking') {
                    thinking += block.thinking || '';
                } else if (block.type === 'tool_use') {
                    toolUse.push({
                        id: block.id,
                        name: block.name,
                        input: block.input || {},
                    });
                }
            }
        }

        return {
            content,
            thinking: thinking || undefined,
            toolUse: toolUse.length > 0 ? toolUse : undefined,
            stopReason: response.stop_reason || 'end_turn',
        };
    } catch (e) {
        console.error('[MiniMax] Non-streaming error:', e);
        throw e;
    }
}

/**
 * Convert Ollama-style tool definitions to Anthropic/MiniMax format
 */
export function convertToolsToMinimaxFormat(ollamaTools: any[]): MinimaxToolDefinition[] {
    console.log('[MiniMax] Converting %d tools to MiniMax format', ollamaTools.length);
    return ollamaTools.map(tool => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters,
    }));
}
