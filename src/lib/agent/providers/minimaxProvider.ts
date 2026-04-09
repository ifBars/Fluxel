/**
 * MiniMax Provider Implementation
 * Handles communication with MiniMax native chat API format.
 */

import { streamMinimaxChat, convertToolsToMinimaxFormat, type MinimaxMessage } from '@/lib/minimax';
import type {
    AgentProvider,
    ProviderMessage,
    ProviderConfig,
    StreamOptions,
    StreamCallbacks,
    StreamResult,
    ToolCall,
    ToolResult,
    ToolDefinition,
} from './types';

/**
 * Convert unified messages to MiniMax native message format.
 */
function toMinimaxMessages(messages: ProviderMessage[]): MinimaxMessage[] {
    const toolNamesById = new Map<string, string>();

    return messages
        .filter(msg => msg.role !== 'system')
        .map(msg => {
            if (msg.role === 'assistant') {
                const toolCalls = msg.toolCalls?.map(tc => ({
                    type: 'function' as const,
                    id: tc.id,
                    function: {
                        name: tc.name,
                        arguments: JSON.stringify(tc.arguments ?? {}),
                    },
                }));

                for (const tc of msg.toolCalls ?? []) {
                    toolNamesById.set(tc.id, tc.name);
                }

                return {
                    role: 'assistant',
                    content: msg.content || undefined,
                    tool_calls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
                };
            }

            if (msg.role === 'tool') {
                return {
                    role: 'tool',
                    content: msg.content,
                    tool_call_id: msg.toolCallId,
                    name: msg.toolCallId ? toolNamesById.get(msg.toolCallId) : undefined,
                };
            }

            return {
                role: msg.role,
                content: msg.content,
            };
        });
}

export const minimaxProvider: AgentProvider = {
    name: 'minimax',

    async stream(
        messages: ProviderMessage[],
        systemPrompt: string,
        tools: ToolDefinition[],
        options: StreamOptions,
        callbacks: StreamCallbacks,
        config: ProviderConfig
    ): Promise<StreamResult> {
        if (!config.apiKey) {
            throw new Error('MiniMax API key not configured');
        }

        let accumulatedContent = '';
        let accumulatedThinking = '';
        const collectedToolCalls: ToolCall[] = [];

        const minimaxMessages: MinimaxMessage[] = [
            { role: 'system', content: systemPrompt },
            ...toMinimaxMessages(messages),
        ];

        const minimaxTools = convertToolsToMinimaxFormat(
            tools.map(t => ({ type: 'function', function: t.function }))
        );

        const response = streamMinimaxChat(
            {
                model: options.model,
                messages: minimaxMessages,
                maxTokens: options.maxTokens || 4096,
                temperature: options.temperature,
                tools: minimaxTools,
            },
            config.apiKey,
            config.apiBase,
            options.abortSignal
        );

        for await (const chunk of response) {
            if (chunk.type === 'text' && chunk.content) {
                accumulatedContent += chunk.content;
                callbacks.onContent(chunk.content);
            } else if (chunk.type === 'thinking' && chunk.content) {
                accumulatedThinking += chunk.content;
                callbacks.onThinking?.(chunk.content);
            } else if (chunk.type === 'tool_use' && chunk.toolUse) {
                collectedToolCalls.push({
                    id: chunk.toolUse.id,
                    name: chunk.toolUse.name,
                    arguments: chunk.toolUse.input,
                });
            } else if (chunk.type === 'error') {
                throw new Error(chunk.message || 'MiniMax streaming error');
            }
        }

        return {
            content: accumulatedContent,
            thinking: accumulatedThinking || undefined,
            toolCalls: collectedToolCalls,
        };
    },

    formatToolResult(result: ToolResult): ProviderMessage {
        return {
            role: 'tool',
            content: result.content,
            toolCallId: result.toolCallId,
        };
    },

    formatAssistantMessage(
        content: string,
        toolCalls: ToolCall[],
        _thinking?: string
    ): ProviderMessage {
        return {
            role: 'assistant',
            content,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        };
    },
};
