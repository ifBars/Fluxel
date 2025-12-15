import { useEffect } from 'react';
import { useAgentStore } from '@/stores/agent/useAgentStore';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { Bot, X, Plus, History, Settings, RefreshCw } from 'lucide-react';
import { TitlebarDropdown } from '@/components/ui/TitlebarDropdown';

export function AgentPanel() {
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
            fetchModels();
        }
    }, [isOpen, fetchModels]);

    const modelOptions = availableModels.map(m => ({
        value: m,
        label: m,
        icon: <Bot className="w-3 h-3" />
    }));

    if (!isOpen) return null;

    if (!isOpen) return null;

    return (
        <div className="flex flex-col h-full bg-card border-l border-border">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                    <TitlebarDropdown
                        value={model}
                        options={modelOptions}
                        onChange={setModel}
                        direction="down"
                        width="auto"
                        className="min-w-[140px]"
                        placeholder="Select Model"
                    />
                    <button
                        onClick={() => fetchModels()}
                        className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"
                        title="Refresh models"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => createConversation()}
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
                        onClick={togglePanel}
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
    );
}
