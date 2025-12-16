import { useEffect } from 'react';
import { useAgentStore } from '@/stores/agent/useAgentStore';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { Bot, X, Plus, History, Settings, RefreshCw } from 'lucide-react';
import { TitlebarDropdown } from '@/components/ui/TitlebarDropdown';
import { useProfiler } from '@/hooks/useProfiler';

export function AgentPanel() {
    const { ProfilerWrapper, startSpan, trackInteraction } = useProfiler('AgentPanel');
    const isOpen = useAgentStore(state => state.isOpen);
    // const conversations = useAgentStore(state => state.conversations); // Unused
    // const activeConversationId = useAgentStore(state => state.activeConversationId); // Unused
    const togglePanel = useAgentStore(state => state.togglePanel);
    const createConversation = useAgentStore(state => state.createConversation);

    // Model state
    const model = useAgentStore(state => state.model);
    const availableModels = useAgentStore(state => state.availableModels);
    const fetchModels = useAgentStore(state => state.fetchModels);
    const setModel = useAgentStore(state => state.setModel);

    // Fetch models when panel opens
    useEffect(() => {
        if (isOpen) {
            const span = startSpan('fetch_models', 'frontend_network');
            fetchModels()
                .then(() => span.end({ count: availableModels.length.toString() }))
                .catch((e) => span.end({ error: e.message }));
        }
    }, [isOpen, fetchModels, startSpan, availableModels.length]);

    const handleModelChange = (newModel: string) => {
        trackInteraction('change_model', { from: model, to: newModel });
        setModel(newModel);
    };

    const handleCreateConversation = () => {
        trackInteraction('create_conversation');
        createConversation();
    };

    const handleTogglePanel = () => {
        trackInteraction('close_panel');
        togglePanel();
    };

    const handleRefreshModels = () => {
        trackInteraction('refresh_models');
        const span = startSpan('fetch_models_manual', 'frontend_network');
        fetchModels()
            .then(() => span.end({ count: availableModels.length.toString() }))
            .catch((e) => span.end({ error: e.message }));
    };

    const modelOptions = availableModels.map(m => ({
        value: m,
        label: m,
        icon: <Bot className="w-3 h-3" />
    }));

    if (!isOpen) return null;

    return (
        <ProfilerWrapper>
            <div className="flex flex-col h-full bg-card border-l border-border">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                    <div className="flex items-center gap-2">
                        <TitlebarDropdown
                            value={model}
                            options={modelOptions}
                            onChange={handleModelChange}
                            direction="down"
                            width="auto"
                            className="min-w-[140px]"
                            placeholder="Select Model"
                        />
                        <button
                            onClick={handleRefreshModels}
                            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"
                            title="Refresh models"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleCreateConversation}
                            className="p-1.5 rounded hover:bg-muted transition-colors"
                            title="New conversation"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                        <button
                            className="p-1.5 rounded hover:bg-muted transition-colors"
                            title="Conversation history (coming soon)"
                            disabled
                        >
                            <History className="w-4 h-4 opacity-50" />
                        </button>
                        <button
                            className="p-1.5 rounded hover:bg-muted transition-colors"
                            title="Agent settings (coming soon)"
                            disabled
                        >
                            <Settings className="w-4 h-4 opacity-50" />
                        </button>
                        <button
                            onClick={handleTogglePanel}
                            className="p-1.5 rounded hover:bg-muted transition-colors"
                            title="Close panel"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <MessageList />

                {/* Input */}
                <InputArea />
            </div>
        </ProfilerWrapper>
    );
}
