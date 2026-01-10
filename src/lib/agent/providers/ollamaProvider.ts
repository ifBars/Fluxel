/**
 * Ollama Provider Implementation
 * Handles communication with local Ollama instance
 */

import { streamChat } from '@/lib/ollama/ollamaChatClient';
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
 * Convert unified messages to Ollama format
 */
function toOllamaMessages(messages: ProviderMessage[]): Array<{
    role: string;
    content: string;
    tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }>;
}> {
    return messages.map(msg => {
        const base: { role: string; content: string; tool_calls?: any } = {
            role: msg.role,
            content: msg.content,
        };

        if (msg.toolCalls && msg.toolCalls.length > 0) {
            base.tool_calls = msg.toolCalls.map(tc => ({
                function: {
                    name: tc.name,
                    arguments: tc.arguments,
                }
            }));
        }

        return base;
    });
}

/**
 * Convert Ollama tool calls to unified format
 */
function fromOllamaToolCalls(
    toolCalls: Array<{ function: { name: string; arguments: Record<string, unknown> } }> | undefined
): ToolCall[] {
    if (!toolCalls) return [];

    return toolCalls.map((tc, index) => ({
        // Ollama doesn't provide IDs, so we generate them
        id: `ollama_${Date.now()}_${index}`,
        name: tc.function.name,
        arguments: tc.function.arguments,
    }));
}

/**
 * Parse tool calls that appear as JSON in text content
 * Some Ollama models return tool calls as text rather than structured data
 */
function parseToolCallsFromText(
    content: string,
    availableTools: ToolDefinition[]
): { toolCalls: ToolCall[]; remainingContent: string } {
    const toolCalls: ToolCall[] = [];
    let remainingContent = content;

    // Look for patterns that start tool call JSON objects
    const toolCallStarts = [...content.matchAll(/\{\s*"name"\s*:/g)];

    for (const match of toolCallStarts) {
        const startIndex = match.index!;

        // Find the complete JSON object by counting braces
        let braceCount = 0;
        let endIndex = startIndex;
        let inString = false;
        let escaped = false;

        for (let i = startIndex; i < content.length; i++) {
            const char = content[i];

            if (escaped) {
                escaped = false;
                continue;
            }

            if (char === '\\') {
                escaped = true;
                continue;
            }

            if (char === '"') {
                inString = !inString;
            } else if (!inString) {
                if (char === '{') braceCount++;
                else if (char === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                        endIndex = i + 1;
                        break;
                    }
                }
            }
        }

        if (endIndex > startIndex) {
            const jsonStr = content.slice(startIndex, endIndex);
            try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.name && parsed.arguments &&
                    availableTools.some(t => t.function.name === parsed.name)) {
                    toolCalls.push({
                        id: `ollama_parsed_${Date.now()}_${toolCalls.length}`,
                        name: parsed.name,
                        arguments: parsed.arguments
                    });
                    remainingContent = remainingContent.replace(jsonStr, '').trim();
                }
            } catch {
                // Invalid JSON, skip
            }
        }
    }

    return { toolCalls, remainingContent };
}

export const ollamaProvider: AgentProvider = {
    name: 'ollama',

    async stream(
        messages: ProviderMessage[],
        systemPrompt: string,
        tools: ToolDefinition[],
        options: StreamOptions,
        callbacks: StreamCallbacks,
        _config: ProviderConfig
    ): Promise<StreamResult> {
        let accumulatedContent = '';
        const collectedToolCalls: ToolCall[] = [];

        // Prepend system message
        const ollamaMessages = [
            { role: 'system', content: systemPrompt },
            ...toOllamaMessages(messages)
        ];

        // Convert tools to Ollama format
        const ollamaTools = tools.map(t => ({
            type: 'function' as const,
            function: t.function,
        }));

        const response = streamChat(
            {
                model: options.model,
                messages: ollamaMessages as any,
                stream: true,
                options: { temperature: options.temperature },
                tools: ollamaTools,
            },
            undefined,
            options.abortSignal
        );

        for await (const chunk of response) {
            if (chunk.message?.content) {
                accumulatedContent += chunk.message.content;
                callbacks.onContent(chunk.message.content);
            }

            // Collect tool calls from structured response
            if (chunk.message?.tool_calls) {
                const converted = fromOllamaToolCalls(chunk.message.tool_calls);
                collectedToolCalls.push(...converted);
            }
        }

        // Also check for tool calls in text content (some models output JSON)
        if (accumulatedContent && collectedToolCalls.length === 0) {
            const parsed = parseToolCallsFromText(accumulatedContent, tools);
            if (parsed.toolCalls.length > 0) {
                collectedToolCalls.push(...parsed.toolCalls);
                accumulatedContent = parsed.remainingContent;
            }
        }

        return {
            content: accumulatedContent,
            toolCalls: collectedToolCalls,
        };
    },

    formatToolResult(result: ToolResult): ProviderMessage {
        // Ollama uses simple tool role messages
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
