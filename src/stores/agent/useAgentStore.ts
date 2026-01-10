import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AgentState, ChatMessage, FileContext, AgentConversation, ProviderType, ModelConfig, ProviderConfig } from './types';
import { getAvailableModels } from '@/lib/ollama/ollamaChatClient';
import { getAvailableMinimaxModels } from '@/lib/minimax';



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
    setModel: (modelId: string) => void;
    setTemperature: (temperature: number) => void;
    setProvider: (provider: ProviderType) => void;

    // New Config Actions
    toggleSettings: (section?: string) => void;
    updateProviderConfig: (providerId: string, config: Partial<ProviderConfig>) => void;
    toggleModelEnabled: (modelId: string, enabled: boolean) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

// Default models per provider to fallback to
const DEFAULT_MODELS: Record<string, string> = {
    ollama: 'qwen2.5-coder:1.5b',
    minimax: 'MiniMax-M2.1',
};

export const useAgentStore = create<AgentState & AgentActions>()(
    persist(
        (set, get) => ({
            // Initial state
            isOpen: false,
            isPanelMode: 'sidebar',
            conversations: [],
            activeConversationId: null,
            isGenerating: false,
            streamingContent: '',
            streamingThinking: '',
            attachedContext: [],

            // Legacy/Compat
            provider: 'ollama',
            model: 'qwen2.5-coder:1.5b',
            availableModels: [],

            // New Configuration State
            settingsOpen: false,
            settingsSection: undefined,
            providerConfigs: {
                ollama: { id: 'ollama', name: 'Ollama', enabled: true },
                minimax: { id: 'minimax', name: 'MiniMax', enabled: false }
            },
            models: [],
            activeModelId: 'qwen2.5-coder:1.5b',

            temperature: 0.7,
            maxTurns: 15,
            minimaxApiKey: null,

            // Panel actions
            togglePanel: () => set(state => ({ isOpen: !state.isOpen })),
            setOpen: (open: boolean) => set({ isOpen: open }),

            // Config Actions
            toggleSettings: (section) => set(state => ({
                settingsOpen: !state.settingsOpen,
                settingsSection: section
            })),

            updateProviderConfig: (providerId, config) => set(state => ({
                providerConfigs: {
                    ...state.providerConfigs,
                    [providerId]: { ...state.providerConfigs[providerId], ...config }
                }
            })),

            toggleModelEnabled: (modelId, enabled) => set(state => ({
                models: state.models.map(m => m.id === modelId ? { ...m, enabled } : m)
            })),

            // Model actions
            fetchModels: async () => {
                const { providerConfigs } = get();
                let allModels: ModelConfig[] = [];

                // 1. Fetch Ollama
                if (providerConfigs.ollama?.enabled) {
                    try {
                        const ollamaModels = await getAvailableModels();
                        const mapped = ollamaModels.map(name => ({
                            id: name,
                            name: name,
                            providerId: 'ollama',
                            enabled: true
                        }));
                        allModels = [...allModels, ...mapped];
                    } catch (e) {
                        console.error('Failed to fetch Ollama models', e);
                    }
                }

                // 2. Fetch MiniMax
                // if (providerConfigs.minimax?.enabled) { // Allow fetching even if disabled to show what's available? No, only enabled providers.
                try {
                    // Always fetch minimax since it's static list usually, unless explicitly disabled by user later? 
                    // For now let's just fetch it if the provider block exists.
                    const minimaxModels = await getAvailableMinimaxModels();
                    const mapped = minimaxModels.map(name => ({
                        id: name,
                        name: name,
                        providerId: 'minimax',
                        enabled: true
                    }));
                    allModels = [...allModels, ...mapped];
                } catch (e) {
                    console.error('Failed to fetch MiniMax models', e);
                }
                // }

                // Merge with existing state to preserve 'enabled' preferences
                set(state => {
                    const existingMap = new Map(state.models.map(m => [m.id, m]));
                    const merged = allModels.map(newModel => {
                        const existing = existingMap.get(newModel.id);
                        // If it existed before, keep its enabled state. If new, default to true.
                        return existing ? { ...newModel, enabled: existing.enabled } : newModel;
                    });

                    return {
                        models: merged,
                        // Update legacy availableModels for backward compat if needed
                        availableModels: merged.map(m => m.id)
                    };
                });
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
            setModel: (modelId: string) => {
                const { models } = get();
                const selectedModel = models.find(m => m.id === modelId);

                if (selectedModel) {
                    set({
                        activeModelId: modelId,
                        model: modelId,
                        provider: selectedModel.providerId as ProviderType
                    });
                } else {
                    set({ activeModelId: modelId, model: modelId });
                }
            },

            setTemperature: (temperature: number) => {
                set({ temperature });
            },

            setProvider: (provider: ProviderType) => {
                set({ provider });
                // Auto-switch to default model for this provider if current active model is not from this provider
                const defaultModel = DEFAULT_MODELS[provider];
                if (defaultModel) {
                    set({ activeModelId: defaultModel, model: defaultModel });
                }
            },
        }),
        {
            name: 'agent-storage',
            partialize: (state) => ({
                providerConfigs: state.providerConfigs,
                models: state.models,
                activeModelId: state.activeModelId,
                activeConversationId: state.activeConversationId,
                conversations: state.conversations,
                temperature: state.temperature,
                minimaxApiKey: state.minimaxApiKey,
            }),
        }
    )
);
