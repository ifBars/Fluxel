/**
 * MiniMax Chat API client using Tauri backend proxy.
 * Proxies through Rust backend to avoid CORS issues.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// Available MiniMax models
export const MINIMAX_MODELS = [
    'MiniMax-M2.7',
    'MiniMax-M2.5',
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
    message?: string;
}

export interface MinimaxToolDefinition {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: {
            type: 'object';
            properties: Record<string, unknown>;
            required?: string[];
        };
    };
}

export interface MinimaxToolCall {
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
    id?: string;
}

export interface MinimaxMessage {
    role: string;
    content?: string;
    tool_calls?: MinimaxToolCall[];
    tool_call_id?: string;
    name?: string;
}

export interface MinimaxChatRequest {
    model: string;
    messages: MinimaxMessage[];
    maxTokens?: number;
    temperature?: number;
    tools?: MinimaxToolDefinition[];
}

/**
 * Check if MiniMax API is accessible with the given API key.
 */
export async function checkMinimaxHealth(apiKey: string, apiBase?: string): Promise<boolean> {
    console.log('[MiniMax] Checking health via Tauri...');
    try {
        const result = await invoke<boolean>('minimax_health_check', { apiKey, apiBase });
        console.log('[MiniMax] Health check result:', result);
        return result;
    } catch (e) {
        console.error('[MiniMax] Health check failed:', e);
        return false;
    }
}

/**
 * Get list of available MiniMax models.
 */
export async function getAvailableMinimaxModels(): Promise<string[]> {
    return [...MINIMAX_MODELS];
}

/**
 * Stream chat responses from MiniMax using Tauri backend proxy.
 */
export async function* streamMinimaxChat(
    request: MinimaxChatRequest,
    apiKey: string,
    apiBase?: string,
    abortSignal?: AbortSignal
): AsyncGenerator<MinimaxStreamChunk, void, unknown> {
    console.log('[MiniMax] Starting streaming chat via Tauri...');
    console.log('[MiniMax] Request model:', request.model);
    console.log('[MiniMax] Request messages count:', request.messages.length);

    const requestId = crypto.randomUUID();
    const eventName = `minimax_stream_${requestId}`;

    const chunkQueue: MinimaxStreamChunk[] = [];
    let resolveWait: (() => void) | null = null;
    let isDone = false;
    let unlisten: UnlistenFn | null = null;

    if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
            isDone = true;
            if (resolveWait) resolveWait();
        });
    }

    try {
        console.log('[MiniMax] Setting up event listener:', eventName);
        unlisten = await listen<MinimaxStreamChunk>(eventName, (event) => {
            const chunk = event.payload;

            if (chunk.type === 'done' || chunk.type === 'error') {
                isDone = true;
            }

            chunkQueue.push(chunk);
            if (resolveWait) {
                resolveWait();
                resolveWait = null;
            }
        });

        const backendRequest = {
            model: request.model,
            messages: request.messages,
            max_tokens: request.maxTokens,
            temperature: request.temperature,
            tools: request.tools,
        };

        console.log('[MiniMax] Invoking minimax_chat_stream command...');
        invoke('minimax_chat_stream', {
            apiKey,
            apiBase,
            request: backendRequest,
            requestId,
        }).catch(e => {
            console.error('[MiniMax] Stream command error:', e);
            chunkQueue.push({ type: 'error', message: String(e) });
            isDone = true;
            if (resolveWait) resolveWait();
        });

        while (!isDone || chunkQueue.length > 0) {
            if (chunkQueue.length > 0) {
                const chunk = chunkQueue.shift()!;

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
                await new Promise<void>(resolve => {
                    resolveWait = resolve;
                });
            }
        }
    } finally {
        if (unlisten) {
            unlisten();
        }
    }
}

/**
 * Non-streaming chat completion with MiniMax.
 */
export async function chatMinimax(
    request: MinimaxChatRequest,
    apiKey: string,
    apiBase?: string,
): Promise<{
    content: string;
    thinking?: string;
    toolUse?: { id: string; name: string; input: Record<string, unknown> }[];
    stopReason: string;
}> {
    const backendRequest = {
        model: request.model,
        messages: request.messages,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        tools: request.tools,
    };

    const response = await invoke<any>('minimax_chat', {
        apiKey,
        apiBase,
        request: backendRequest,
    });

    const content = typeof response?.content === 'string' ? response.content : '';
    const thinking = typeof response?.reasoning_content === 'string' && response.reasoning_content.length > 0
        ? response.reasoning_content
        : undefined;

    const toolCalls = Array.isArray(response?.tool_calls) ? response.tool_calls : [];
    const toolUse: { id: string; name: string; input: Record<string, unknown> }[] = [];

    for (let i = 0; i < toolCalls.length; i++) {
        const call = toolCalls[i];
        if (call?.type !== 'function' || !call?.function?.name) {
            continue;
        }

        let parsedArgs: Record<string, unknown> = {};
        const rawArgs = call?.function?.arguments;
        if (typeof rawArgs === 'string' && rawArgs.trim().length > 0) {
            try {
                const parsed = JSON.parse(rawArgs);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    parsedArgs = parsed as Record<string, unknown>;
                }
            } catch {
                // Leave empty object fallback
            }
        }

        toolUse.push({
            id: call.id || `minimax_${Date.now()}_${i}`,
            name: call.function.name,
            input: parsedArgs,
        });
    }

    return {
        content,
        thinking,
        toolUse: toolUse.length > 0 ? toolUse : undefined,
        stopReason: response?.finish_reason || 'end_turn',
    };
}

/**
 * Convert unified tool definitions to MiniMax native format.
 */
export function convertToolsToMinimaxFormat(ollamaTools: any[]): MinimaxToolDefinition[] {
    console.log('[MiniMax] Converting %d tools to MiniMax format', ollamaTools.length);
    return ollamaTools.map(tool => ({
        type: 'function',
        function: {
            name: tool.function.name,
            description: tool.function.description,
            parameters: tool.function.parameters,
        },
    }));
}
