export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';
export type ProviderType = 'ollama' | 'minimax';

export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    status: 'pending' | 'executing' | 'completed' | 'error';
}

export interface ToolResult {
    toolCallId: string;
    result: string | null;
    error?: string;
}

export interface ChatMessage {
    id: string;
    role: MessageRole;
    content: string;
    timestamp: Date;
    toolCalls?: ToolCall[];
    toolResults?: ToolResult[];
    isStreaming?: boolean;
    thinking?: string; // MiniMax thinking blocks
}

export interface AgentConversation {
    id: string;
    title: string;
    messages: ChatMessage[];
    createdAt: Date;
    updatedAt: Date;
}

export interface FileContext {
    path: string;
    content?: string;
    selectionRange?: { start: number; end: number };
}

export interface AgentState {
    // UI State
    isOpen: boolean;
    isPanelMode: 'sidebar' | 'overlay';

    // Conversation State
    conversations: AgentConversation[];
    activeConversationId: string | null;

    // Current Session
    isGenerating: boolean;
    streamingContent: string;
    streamingThinking: string; // MiniMax thinking stream
    attachedContext: FileContext[];

    // Settings
    provider: ProviderType;
    model: string;
    availableModels: string[];
    temperature: number;
    maxTurns: number;

    // MiniMax settings
    minimaxApiKey: string | null;
}
