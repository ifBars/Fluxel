/**
 * MiniMax Provider Implementation
 * Handles communication with MiniMax API (Anthropic-compatible format)
 */

import { streamMinimaxChat, convertToolsToMinimaxFormat } from '@/lib/minimax';
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
 * Convert unified messages to MiniMax/Anthropic format
 * Handles the special tool_result format required by Anthropic API
 */
function toMinimaxMessages(messages: ProviderMessage[]): Array<{
    role: string;
    content: string | Array<{ type: string;[key: string]: unknown }>;
}> {
    const result: Array<{
        role: string;
        content: string | Array<{ type: string;[key: string]: unknown }>;
    }> = [];

    // Group consecutive tool results into a single user message
    let pendingToolResults: ToolResult[] = [];

    for (const msg of messages) {
        if (msg.role === 'system') {
            // System is handled separately in Anthropic format
            continue;
        }

        if (msg.role === 'tool') {
            // Accumulate tool results
            pendingToolResults.push({
                toolCallId: msg.toolCallId || '',
                content: msg.content,
            });
            continue;
        }

        // Flush pending tool results before adding other messages
        if (pendingToolResults.length > 0) {
            result.push({
                role: 'user',
                content: pendingToolResults.map(tr => ({
                    type: 'tool_result',
                    tool_use_id: tr.toolCallId,
                    content: tr.content,
                })),
            });
            pendingToolResults = [];
        }

        if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
            // Assistant message with tool calls needs special formatting
            const contentBlocks: Array<{ type: string;[key: string]: unknown }> = [];

            if (msg.content) {
                contentBlocks.push({ type: 'text', text: msg.content });
            }

            for (const tc of msg.toolCalls) {
                contentBlocks.push({
                    type: 'tool_use',
                    id: tc.id,
                    name: tc.name,
                    input: tc.arguments,
                });
            }

            result.push({
                role: 'assistant',
                content: contentBlocks,
            });
        } else {
            // Simple text message
            result.push({
                role: msg.role,
                content: msg.content,
            });
        }
    }

    // Flush any remaining tool results
    if (pendingToolResults.length > 0) {
        result.push({
            role: 'user',
            content: pendingToolResults.map(tr => ({
                type: 'tool_result',
                tool_use_id: tr.toolCallId,
                content: tr.content,
            })),
        });
    }

    return result;
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

        const minimaxMessages = toMinimaxMessages(messages);
        const minimaxTools = convertToolsToMinimaxFormat(
            tools.map(t => ({ type: 'function', function: t.function }))
        );

        console.log('[MiniMax Provider] Sending messages:', JSON.stringify(minimaxMessages, null, 2));

        const response = streamMinimaxChat(
            {
                model: options.model,
                messages: minimaxMessages as any,
                system: systemPrompt,
                maxTokens: options.maxTokens || 4096,
                temperature: options.temperature,
                tools: minimaxTools,
            },
            config.apiKey,
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
        // MiniMax/Anthropic requires tool_result format
        // This will be grouped into a user message by toMinimaxMessages
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
