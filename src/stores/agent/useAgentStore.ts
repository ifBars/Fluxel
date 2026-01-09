import { create } from 'zustand';
import type { AgentState, ChatMessage, FileContext, AgentConversation, ProviderType } from './types';
import { getAvailableModels } from '@/lib/ollama/ollamaChatClient';
import { getAvailableMinimaxModels } from '@/lib/minimax';
import { getCachedModels, setCachedModels } from '@/lib/ollama/modelCache';

interface AgentActions {
    // Panel
    togglePanel: () => void;
    setOpen: (open: boolean) => void;

    // Models
    fetchModels: () => Promise<void>;

    // Conversations
    createConversation: () => string;
    deleteConversation: (id: string) => void;
    setActiveConversation: (id: string | null) => void;

    // Messages
    addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
    updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
    appendStreamingContent: (content: string) => void;
    setStreamingContent: (content: string) => void;
    appendStreamingThinking: (content: string) => void;
    setStreamingThinking: (content: string) => void;

    // Context
    attachFile: (file: FileContext) => void;
    removeFile: (path: string) => void;
    clearContext: () => void;

    // Generation
    setGenerating: (generating: boolean) => void;
    clearStreaming: () => void;

    // Settings
    setModel: (model: string) => void;
    setTemperature: (temperature: number) => void;
    setProvider: (provider: ProviderType) => void;
    setMinimaxApiKey: (key: string | null) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

// Default models per provider
const DEFAULT_MODELS: Record<ProviderType, string> = {
    ollama: 'qwen3:8b',
    minimax: 'MiniMax-M2.1',
};

export const useAgentStore = create<AgentState & AgentActions>((set, get) => ({
    // Initial state
    isOpen: false,
    isPanelMode: 'sidebar',
    conversations: [],
    activeConversationId: null,
    isGenerating: false,
    streamingContent: '',
    streamingThinking: '',
    attachedContext: [],
    provider: 'ollama',
    model: 'qwen3:8b',
    availableModels: getCachedModels() ?? [], // Load from cache on initialization
    temperature: 0.7,
    maxTurns: 15,
    minimaxApiKey: null,

    // Panel actions
    togglePanel: () => set(state => ({ isOpen: !state.isOpen })),
    setOpen: (open: boolean) => set({ isOpen: open }),

    // Model actions
    fetchModels: async () => {
        const { provider } = get();

        if (provider === 'minimax') {
            // MiniMax has a static model list
            const models = await getAvailableMinimaxModels();
            set({ availableModels: models });
            return;
        }

        // Ollama - check cache first for instant response
        const cached = getCachedModels();
        if (cached && cached.length > 0) {
            set({ availableModels: cached });
        }

        // Fetch fresh models in background and update cache
        try {
            const models = await getAvailableModels();
            set({ availableModels: models });
            setCachedModels(models);
        } catch (error) {
            console.error('[AgentStore] Failed to fetch models:', error);
            // Keep cached models if fetch fails
            if (!cached || cached.length === 0) {
                set({ availableModels: [] });
            }
        }
    },

    // Conversation actions
    createConversation: () => {
        const id = generateId();
        const newConversation: AgentConversation = {
            id,
            title: 'New Chat',
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        set(state => ({
            conversations: [...state.conversations, newConversation],
            activeConversationId: id,
        }));

        return id;
    },

    deleteConversation: (id: string) => {
        set(state => ({
            conversations: state.conversations.filter(c => c.id !== id),
            activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
        }));
    },

    setActiveConversation: (id: string | null) => {
        set({ activeConversationId: id });
    },

    // Message actions
    addMessage: (message) => {
        const { activeConversationId, conversations } = get();
        if (!activeConversationId) return;

        const newMessage: ChatMessage = {
            ...message,
            id: generateId(),
            timestamp: new Date(),
        };

        set({
            conversations: conversations.map(conv =>
                conv.id === activeConversationId
                    ? {
                        ...conv,
                        messages: [...conv.messages, newMessage],
                        updatedAt: new Date(),
                        // Auto-title from first user message
                        title: conv.messages.length === 0 && message.role === 'user'
                            ? message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '')
                            : conv.title,
                    }
                    : conv
            ),
        });
    },

    updateMessage: (id: string, updates: Partial<ChatMessage>) => {
        const { activeConversationId, conversations } = get();
        if (!activeConversationId) return;

        set({
            conversations: conversations.map(conv =>
                conv.id === activeConversationId
                    ? {
                        ...conv,
                        messages: conv.messages.map(msg =>
                            msg.id === id ? { ...msg, ...updates } : msg
                        ),
                        updatedAt: new Date(),
                    }
                    : conv
            ),
        });
    },

    appendStreamingContent: (content: string) => {
        set(state => ({ streamingContent: state.streamingContent + content }));
    },

    setStreamingContent: (content: string) => {
        set({ streamingContent: content });
    },

    appendStreamingThinking: (content: string) => {
        set(state => ({ streamingThinking: state.streamingThinking + content }));
    },

    setStreamingThinking: (content: string) => {
        set({ streamingThinking: content });
    },

    clearStreaming: () => {
        set({ streamingContent: '', streamingThinking: '' });
    },

    // Context actions
    attachFile: (file: FileContext) => {
        set(state => ({
            attachedContext: [...state.attachedContext, file],
        }));
    },

    removeFile: (path: string) => {
        set(state => ({
            attachedContext: state.attachedContext.filter(f => f.path !== path),
        }));
    },

    clearContext: () => {
        set({ attachedContext: [] });
    },

    // Generation actions
    setGenerating: (generating: boolean) => {
        set({ isGenerating: generating });
    },

    // Settings actions
    setModel: (model: string) => {
        set({ model });
    },

    setTemperature: (temperature: number) => {
        set({ temperature });
    },

    setProvider: (provider: ProviderType) => {
        const defaultModel = DEFAULT_MODELS[provider];
        set({
            provider,
            model: defaultModel,
            availableModels: [], // Clear models, will be fetched
        });
        // Trigger model fetch for new provider
        get().fetchModels();
    },

    setMinimaxApiKey: (key: string | null) => {
        set({ minimaxApiKey: key });
    },
}));

