/**
 * ReAct-style Function Calling Polyfill for Ollama
 * Based on OLLAMA_FUNCTION_CALLING_CONTEXT.md
 */

import type { OllamaChatMessage } from './ollamaChatClient';

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, {
            type: string;
            description: string;
            enum?: string[];
        }>;
        required?: string[];
    };
}

export interface ToolCall {
    name: string;
    arguments: Record<string, unknown>;
}

export interface FunctionCallingConfig {
    systemPrompt: string;
    tools: ToolDefinition[];
    maxTurns: number;
    toolExecutor?: (name: string, args: Record<string, unknown>) => Promise<string | null>;
    onToolCall?: (name: string, args: Record<string, unknown>) => void;
    onToolResult?: (name: string, result: string | null) => void;
    onStreamChunk?: (chunk: string) => void;
}

/**
 * Build system prompt with tool definitions
 */
function buildSystemPrompt(config: FunctionCallingConfig): string {
    const toolDescriptions = config.tools
        .map(tool => {
            const params = JSON.stringify(tool.parameters, null, 2);
            return `<TOOL name="${tool.name}">
Description: ${tool.description}
Parameters:
${params}
</TOOL>`;
        })
        .join('\n\n');

    return `${config.systemPrompt}

AVAILABLE TOOLS:
${toolDescriptions}

INSTRUCTIONS:
- To use a tool, output: <TOOL_CALL>{"name": "tool_name", "arguments": {...}}</TOOL_CALL>
- Call ONE tool per turn
- After receiving <TOOL_RESULT>, continue reasoning
- When task is complete, output: <COMPLETE/>
- Do NOT make up tool results - wait for <TOOL_RESULT>`;
}

/**
 * Sanitize JSON string by escaping unescaped control characters
 */
function sanitizeJsonString(str: string): string {
    // Replace unescaped newlines and tabs
    return str
        .replace(/(?<!\\)\n/g, '\\n')
        .replace(/(?<!\\)\t/g, '\\t')
        .replace(/(?<!\\)\r/g, '\\r');
}

/**
 * Parse tool call from response
 */
function parseToolCall(content: string): ToolCall | null {
    const match = content.match(/<TOOL_CALL>(.*?)<\/TOOL_CALL>/s);
    if (!match) return null;

    try {
        const sanitized = sanitizeJsonString(match[1].trim());
        const parsed = JSON.parse(sanitized);

        if (!parsed.name || typeof parsed.name !== 'string') {
            throw new Error('Missing or invalid tool name');
        }

        return {
            name: parsed.name,
            arguments: parsed.arguments || parsed.args || {},
        };
    } catch (e) {
        console.warn('Failed to parse tool call:', e);
        return null;
    }
}

/**
 * Check if response contains completion signal
 */
function isComplete(content: string): boolean {
    return /<COMPLETE\s*\/>/.test(content);
}

/**
 * Execute function calling loop with ReAct pattern
 */
export async function polyfillFunctionCalling(
    generateFn: (messages: OllamaChatMessage[]) => AsyncGenerator<string>,
    config: FunctionCallingConfig
): Promise<void> {
    const messages: OllamaChatMessage[] = [
        {
            role: 'system',
            content: buildSystemPrompt(config),
        },
        {
            role: 'user',
            content: 'Begin the task.',
        },
    ];

    for (let turn = 0; turn < config.maxTurns; turn++) {
        let responseContent = '';

        // Generate response
        try {
            for await (const chunk of generateFn(messages)) {
                responseContent += chunk;
                config.onStreamChunk?.(chunk);
            }
        } catch (e) {
            console.error('Generation error:', e);
            break;
        }

        // Add assistant response to history
        messages.push({
            role: 'assistant',
            content: responseContent,
        });

        // Check for completion
        if (isComplete(responseContent)) {
            break;
        }

        // Try to parse tool call
        const toolCall = parseToolCall(responseContent);

        if (!toolCall) {
            // No tool call, just a regular response - continue conversation
            continue;
        }

        // Notify about tool call
        config.onToolCall?.(toolCall.name, toolCall.arguments);

        // Execute tool
        let result: string | null = null;
        let error: string | undefined;

        if (config.toolExecutor) {
            try {
                result = await config.toolExecutor(toolCall.name, toolCall.arguments);
                config.onToolResult?.(toolCall.name, result);
            } catch (e) {
                error = e instanceof Error ? e.message : String(e);
                console.error('Tool execution error:', e);
            }
        }

        // Build tool result message
        let toolResultContent: string;
        if (error) {
            toolResultContent = `<TOOL_RESULT>{"status": "error", "message": "${error}"}</TOOL_RESULT>`;
        } else if (result !== null) {
            // Escape the result for JSON
            const escapedResult = JSON.stringify(result);
            toolResultContent = `<TOOL_RESULT>${escapedResult}</TOOL_RESULT>`;
        } else {
            // Sink-only tool (no return value)
            toolResultContent = `<TOOL_RESULT>{"status": "ok"}</TOOL_RESULT>`;
        }

        // Add tool result to conversation
        messages.push({
            role: 'user',
            content: toolResultContent,
        });
    }
}
