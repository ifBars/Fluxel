import { useEffect, useState } from 'react';
import { useAgentStore } from '@/stores/agent/useAgentStore';
import type { ProviderType } from '@/stores/agent/types';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { Bot, X, Plus, History, Settings, RefreshCw, Cloud, Key, CheckCircle, XCircle } from 'lucide-react';
import { TitlebarDropdown } from '@/components/ui/TitlebarDropdown';
import { useProfiler } from '@/hooks/useProfiler';
import { checkMinimaxHealth } from '@/lib/minimax';

export function AgentPanel() {
    const { ProfilerWrapper, startSpan, trackInteraction } = useProfiler('AgentPanel');
    const isOpen = useAgentStore(state => state.isOpen);
    const togglePanel = useAgentStore(state => state.togglePanel);
    const createConversation = useAgentStore(state => state.createConversation);

    // Provider state
    const provider = useAgentStore(state => state.provider);
    const setProvider = useAgentStore(state => state.setProvider);
    const minimaxApiKey = useAgentStore(state => state.minimaxApiKey);
    const setMinimaxApiKey = useAgentStore(state => state.setMinimaxApiKey);

    // Model state
    const model = useAgentStore(state => state.model);
    const availableModels = useAgentStore(state => state.availableModels);
    const fetchModels = useAgentStore(state => state.fetchModels);
    const setModel = useAgentStore(state => state.setModel);
    const [isLoadingModels, setIsLoadingModels] = useState(false);

    // Settings dialog state
    const [showSettings, setShowSettings] = useState(false);
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

    // Defer model fetching to background - don't block render
    useEffect(() => {
        if (isOpen) {
            setIsLoadingModels(true);

            const timeoutId = setTimeout(() => {
                const span = startSpan('fetch_models', 'frontend_network');
                fetchModels()
                    .then(() => {
                        span.end({ count: availableModels.length.toString(), provider });
                        setIsLoadingModels(false);
                    })
                    .catch((e) => {
                        span.end({ error: e.message });
                        setIsLoadingModels(false);
                    });
            }, 0);

            return () => clearTimeout(timeoutId);
        }
    }, [isOpen, fetchModels, startSpan, availableModels.length, provider]);

    const handleProviderChange = (newProvider: string) => {
        const typedProvider = newProvider as ProviderType;
        trackInteraction('change_provider', { from: provider, to: newProvider });

        // If switching to MiniMax without API key, show settings
        if (typedProvider === 'minimax' && !minimaxApiKey) {
            setShowSettings(true);
            return;
        }

        setProvider(typedProvider);
    };

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
        setIsLoadingModels(true);
        const span = startSpan('fetch_models_manual', 'frontend_network');
        fetchModels()
            .then(() => {
                span.end({ count: availableModels.length.toString() });
                setIsLoadingModels(false);
            })
            .catch((e) => {
                span.end({ error: e.message });
                setIsLoadingModels(false);
            });
    };

    const handleTestConnection = async () => {
        if (!apiKeyInput.trim()) return;

        setIsTestingConnection(true);
        setConnectionStatus('idle');

        try {
            const isHealthy = await checkMinimaxHealth(apiKeyInput.trim());
            setConnectionStatus(isHealthy ? 'success' : 'error');
        } catch {
            setConnectionStatus('error');
        } finally {
            setIsTestingConnection(false);
        }
    };

    const handleSaveApiKey = () => {
        if (apiKeyInput.trim()) {
            setMinimaxApiKey(apiKeyInput.trim());
            // Now switch to MiniMax provider
            setProvider('minimax');
        }
        setShowSettings(false);
        setApiKeyInput('');
        setConnectionStatus('idle');
    };

    const handleCancelSettings = () => {
        setShowSettings(false);
        setApiKeyInput('');
        setConnectionStatus('idle');
    };

    const providerOptions = [
        { value: 'ollama', label: 'Ollama (Local)', icon: <Bot className="w-3 h-3" /> },
        { value: 'minimax', label: 'MiniMax (Cloud)', icon: <Cloud className="w-3 h-3" /> },
    ];

    const modelOptions = availableModels.map(m => ({
        value: m,
        label: m,
        icon: provider === 'minimax' ? <Cloud className="w-3 h-3" /> : <Bot className="w-3 h-3" />
    }));

    if (!isOpen) return null;

    return (
        <ProfilerWrapper>
            <div className="flex flex-col h-full bg-card border-l border-border">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                    <div className="flex items-center gap-2">
                        {/* Provider Dropdown */}
                        <TitlebarDropdown
                            value={provider}
                            options={providerOptions}
                            onChange={handleProviderChange}
                            direction="down"
                            width="auto"
                            className="min-w-[130px]"
                            placeholder="Provider"
                        />

                        {/* Model Dropdown */}
                        <TitlebarDropdown
                            value={model}
                            options={modelOptions}
                            onChange={handleModelChange}
                            direction="down"
                            width="auto"
                            className="min-w-[140px]"
                            placeholder="Select Model"
                        />

                        {/* API Key Status for MiniMax */}
                        {provider === 'minimax' && (
                            <div
                                className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${minimaxApiKey ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'
                                    }`}
                                title={minimaxApiKey ? 'API Key configured' : 'API Key not configured'}
                            >
                                <Key className="w-3 h-3" />
                                {minimaxApiKey ? 'Configured' : 'Not Set'}
                            </div>
                        )}

                        <button
                            onClick={handleRefreshModels}
                            className={`p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground ${isLoadingModels ? 'animate-spin' : ''}`}
                            title="Refresh models"
                            disabled={isLoadingModels}
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
                            onClick={() => setShowSettings(true)}
                            className="p-1.5 rounded hover:bg-muted transition-colors"
                            title="Agent settings"
                        >
                            <Settings className="w-4 h-4" />
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

                {/* Settings Dialog */}
                {showSettings && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
                        <div className="bg-card border border-border rounded-lg shadow-lg w-[400px] max-w-[90%]">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                                <h3 className="font-semibold">Agent Settings</h3>
                                <button onClick={handleCancelSettings} className="p-1 hover:bg-muted rounded">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="p-4 space-y-4">
                                {/* MiniMax API Key */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <Cloud className="w-4 h-4" />
                                        MiniMax API Key
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="password"
                                            value={apiKeyInput}
                                            onChange={(e) => setApiKeyInput(e.target.value)}
                                            placeholder={minimaxApiKey ? '••••••••••••••••' : 'Enter API key...'}
                                            className="flex-1 px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                        />
                                        <button
                                            onClick={handleTestConnection}
                                            disabled={!apiKeyInput.trim() || isTestingConnection}
                                            className="px-3 py-2 bg-muted hover:bg-muted/80 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isTestingConnection ? 'Testing...' : 'Test'}
                                        </button>
                                    </div>

                                    {/* Connection Status */}
                                    {connectionStatus !== 'idle' && (
                                        <div className={`flex items-center gap-2 text-sm ${connectionStatus === 'success' ? 'text-green-500' : 'text-red-500'
                                            }`}>
                                            {connectionStatus === 'success' ? (
                                                <>
                                                    <CheckCircle className="w-4 h-4" />
                                                    Connection successful!
                                                </>
                                            ) : (
                                                <>
                                                    <XCircle className="w-4 h-4" />
                                                    Connection failed. Please check your API key.
                                                </>
                                            )}
                                        </div>
                                    )}

                                    <p className="text-xs text-muted-foreground">
                                        Get your API key from <a href="https://platform.minimax.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">platform.minimax.io</a>
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
                                <button
                                    onClick={handleCancelSettings}
                                    className="px-4 py-2 text-sm hover:bg-muted rounded-md transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveApiKey}
                                    disabled={!apiKeyInput.trim()}
                                    className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Messages */}
                <MessageList />

                {/* Input */}
                <InputArea />
            </div>
        </ProfilerWrapper>
    );
}

