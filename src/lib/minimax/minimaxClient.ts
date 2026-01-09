/**
 * MiniMax Chat API client using Anthropic SDK
 * Uses Anthropic-compatible API with MiniMax-specific features (thinking blocks)
 */

import Anthropic from '@anthropic-ai/sdk';
import { FrontendProfiler } from '@/lib/services/FrontendProfiler';

const MINIMAX_BASE_URL = 'https://api.minimax.io/anthropic';

// Available MiniMax models
export const MINIMAX_MODELS = [
    'MiniMax-M2.1',
] as const;

export type MinimaxModel = typeof MINIMAX_MODELS[number];

export interface MinimaxStreamChunk {
    type: 'text' | 'thinking' | 'tool_use' | 'done';
    content?: string;
    toolUse?: {
        id: string;
        name: string;
        input: Record<string, unknown>;
    };
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

export interface MinimaxChatRequest {
    model: string;
    messages: Anthropic.MessageCreateParamsStreaming['messages'];
    system?: string;
    maxTokens?: number;
    temperature?: number;
    tools?: MinimaxToolDefinition[];
}

/**
 * Create an Anthropic client configured for MiniMax
 */
function createMinimaxClient(apiKey: string): Anthropic {
    return new Anthropic({
        apiKey,
        baseURL: MINIMAX_BASE_URL,
        dangerouslyAllowBrowser: true, // Required for browser-based usage
    });
}

/**
 * Check if MiniMax API is accessible with the given API key
 */
export async function checkMinimaxHealth(apiKey: string): Promise<boolean> {
    const span = FrontendProfiler.startSpan('check_minimax_health', 'frontend_network');
    try {
        const client = createMinimaxClient(apiKey);
        // Send a minimal request to check connectivity
        const response = await client.messages.create({
            model: 'MiniMax-M2.1',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }],
        });
        await span.end({ status: 'ok', stopReason: response.stop_reason ?? 'none' });
        return true;
    } catch (e) {
        await span.end({ error: e instanceof Error ? e.message : String(e) });
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
 * Stream chat responses from MiniMax using Anthropic SDK
 */
export async function* streamMinimaxChat(
    request: MinimaxChatRequest,
    apiKey: string,
    abortSignal?: AbortSignal
): AsyncGenerator<MinimaxStreamChunk, void, unknown> {
    const client = createMinimaxClient(apiKey);

    const stream = await client.messages.stream({
        model: request.model,
        max_tokens: request.maxTokens ?? 4096,
        system: request.system,
        messages: request.messages,
        temperature: request.temperature,
        tools: request.tools as Anthropic.Tool[] | undefined,
    }, {
        signal: abortSignal,
    });

    for await (const event of stream) {
        if (event.type === 'content_block_delta') {
            const delta = event.delta;

            if (delta.type === 'text_delta') {
                yield {
                    type: 'text',
                    content: delta.text,
                };
            } else if (delta.type === 'thinking_delta') {
                yield {
                    type: 'thinking',
                    content: (delta as { thinking?: string }).thinking ?? '',
                };
            } else if (delta.type === 'input_json_delta') {
                // Tool input streaming - we'll collect and emit on block stop
            }
        } else if (event.type === 'content_block_start') {
            const block = event.content_block;

            if (block.type === 'tool_use') {
                // Tool use block starting
                yield {
                    type: 'tool_use',
                    toolUse: {
                        id: block.id,
                        name: block.name,
                        input: {}, // Will be populated by input_json_delta
                    },
                };
            }
        } else if (event.type === 'message_stop') {
            yield { type: 'done' };
        }
    }
}

/**
 * Non-streaming chat completion with MiniMax
 */
export async function chatMinimax(
    request: MinimaxChatRequest,
    apiKey: string,
    abortSignal?: AbortSignal
): Promise<{
    content: string;
    thinking?: string;
    toolUse?: { id: string; name: string; input: Record<string, unknown> }[];
    stopReason: string;
}> {
    const client = createMinimaxClient(apiKey);

    const response = await client.messages.create({
        model: request.model,
        max_tokens: request.maxTokens ?? 4096,
        system: request.system,
        messages: request.messages,
        temperature: request.temperature,
        tools: request.tools as Anthropic.Tool[] | undefined,
    }, {
        signal: abortSignal,
    });

    let content = '';
    let thinking = '';
    const toolUse: { id: string; name: string; input: Record<string, unknown> }[] = [];

    for (const block of response.content) {
        if (block.type === 'text') {
            content += block.text;
        } else if (block.type === 'thinking') {
            thinking += (block as { thinking?: string }).thinking ?? '';
        } else if (block.type === 'tool_use') {
            toolUse.push({
                id: block.id,
                name: block.name,
                input: block.input as Record<string, unknown>,
            });
        }
    }

    return {
        content,
        thinking: thinking || undefined,
        toolUse: toolUse.length > 0 ? toolUse : undefined,
        stopReason: response.stop_reason ?? 'end_turn',
    };
}

/**
 * Convert Ollama-style tool definitions to Anthropic/MiniMax format
 */
export function convertToolsToMinimaxFormat(ollamaTools: any[]): MinimaxToolDefinition[] {
    return ollamaTools.map(tool => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters,
    }));
}
