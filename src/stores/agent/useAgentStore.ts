import { create } from 'zustand';
import type { AgentState, ChatMessage, FileContext, AgentConversation } from './types';
import { getAvailableModels } from '@/lib/ollama/ollamaChatClient';

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
}

const generateId = () => Math.random().toString(36).substring(2, 11);

export const useAgentStore = create<AgentState & AgentActions>((set, get) => ({
    // Initial state
    isOpen: false,
    isPanelMode: 'sidebar',
    conversations: [],
    activeConversationId: null,
    isGenerating: false,
    streamingContent: '',
    attachedContext: [],
    model: 'qwen3:8b',
    availableModels: [],
    temperature: 0.7,
    maxTurns: 15,

    // Panel actions
    togglePanel: () => set(state => ({ isOpen: !state.isOpen })),
    setOpen: (open: boolean) => set({ isOpen: open }),

    // Model actions
    fetchModels: async () => {
        const models = await getAvailableModels();
        set({ availableModels: models });
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

    clearStreaming: () => {
        set({ streamingContent: '' });
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
}));
