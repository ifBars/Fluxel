/**
 * Common types and interfaces for AI providers
 * Following SOLID principles - this file defines the contract all providers must implement
 */

/**
 * Tool definition following OpenAI/Anthropic format
 */
export interface ToolDefinition {
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
/**
 * Unified message format used internally
 * Each provider converts to/from their specific format
 */
export interface ProviderMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    /** Tool call ID - used when role is 'tool' to link result to the call */
    toolCallId?: string;
    /** Tool calls made by assistant */
    toolCalls?: ToolCall[];
}

/**
 * A tool invocation requested by the model
 */
export interface ToolCall {
    /** Unique ID for this tool call (required for Anthropic format) */
    id: string;
    /** Name of the tool to execute */
    name: string;
    /** Arguments to pass to the tool */
    arguments: Record<string, unknown>;
}

/**
 * Result of executing a tool
 */
export interface ToolResult {
    /** ID of the tool call this result is for */
    toolCallId: string;
    /** The tool's output */
    content: string;
    /** Whether tool execution resulted in an error */
    isError?: boolean;
}

/**
 * Result of a streaming response
 */
export interface StreamResult {
    /** Text content from the model */
    content: string;
    /** Thinking/reasoning content (for models like Claude) */
    thinking?: string;
    /** Tool calls the model wants to make */
    toolCalls: ToolCall[];
}

/**
 * Options passed to stream()
 */
export interface StreamOptions {
    /** Model to use */
    model: string;
    /** Temperature for sampling */
    temperature?: number;
    /** Maximum tokens to generate */
    maxTokens?: number;
    /** Abort signal for cancellation */
    abortSignal?: AbortSignal;
}

/**
 * Callbacks for streaming updates
 */
export interface StreamCallbacks {
    /** Called when text content is received */
    onContent: (text: string) => void;
    /** Called when thinking content is received */
    onThinking?: (text: string) => void;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
    apiKey?: string;
    apiBase?: string;
}

/**
 * Interface that all AI providers must implement
 * Single Responsibility: Each provider handles its own API format and streaming
 */
export interface AgentProvider {
    /** Provider name for logging */
    readonly name: string;

    /**
     * Stream a chat completion
     * @param messages - Conversation history in unified format
     * @param systemPrompt - System instructions
     * @param tools - Available tool definitions
     * @param options - Model and generation options
     * @param callbacks - Streaming update callbacks
     * @param config - Provider-specific configuration
     * @returns Promise resolving to the complete response
     */
    stream(
        messages: ProviderMessage[],
        systemPrompt: string,
        tools: ToolDefinition[],
        options: StreamOptions,
        callbacks: StreamCallbacks,
        config: ProviderConfig
    ): Promise<StreamResult>;

    /**
     * Format a tool result for sending back to the API
     * Each provider has its own format requirements
     * @param result - The tool execution result
     * @returns Message in the format this provider expects
     */
    formatToolResult(result: ToolResult): ProviderMessage;

    /**
     * Format an assistant message with tool calls
     * @param content - Text content
     * @param toolCalls - Tool calls to include
     * @param thinking - Optional thinking content
     * @returns Message in the format this provider expects
     */
    formatAssistantMessage(
        content: string,
        toolCalls: ToolCall[],
        thinking?: string
    ): ProviderMessage;
}

/**
 * Available provider types
 */
export type ProviderType = 'ollama' | 'minimax';
