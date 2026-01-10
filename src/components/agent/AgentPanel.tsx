import { useEffect, useState, useRef } from 'react';
import { useAgentStore } from '@/stores/agent/useAgentStore';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { Plus, Settings, X, Sparkles } from 'lucide-react';
import { useProfiler } from '@/hooks/useProfiler';

export function AgentPanel() {
    const { ProfilerWrapper } = useProfiler('AgentPanel');
    const isOpen = useAgentStore(state => state.isOpen);
    const togglePanel = useAgentStore(state => state.togglePanel);
    const createConversation = useAgentStore(state => state.createConversation);
    const toggleSettings = useAgentStore(state => state.toggleSettings);

    // Responsive state
    const containerRef = useRef<HTMLDivElement>(null);
    const [panelWidth, setPanelWidth] = useState(500);

    // Observe container width changes
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new ResizeObserver(entries => {
            const entry = entries[0];
            if (entry) {
                setPanelWidth(entry.contentRect.width);
            }
        });

        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    if (!isOpen) return null;

    return (
        <ProfilerWrapper>
            <div
                ref={containerRef}
                className="flex flex-col h-full bg-card border-l border-border relative"
            >
                {/* Header */}
                <div className="shrink-0 border-b border-border bg-muted/20">
                    <div className="flex items-center justify-between px-3 py-2">
                        {/* Left: Title/Icon */}
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                            <Sparkles className="w-4 h-4 text-primary" />
                            <span>Agent</span>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-1">
                            {/* New Conversation */}
                            <button
                                onClick={() => createConversation()}
                                className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                title="New conversation"
                            >
                                <Plus className="w-4 h-4" />
                            </button>

                            {/* Settings */}
                            <button
                                onClick={() => toggleSettings('agent')}
                                className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                title="Agent settings"
                            >
                                <Settings className="w-4 h-4" />
                            </button>

                            {/* Close */}
                            <button
                                onClick={() => togglePanel()}
                                className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground ml-1"
                                title="Close panel"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Messages Area */}
                <MessageList />

                {/* Input Area */}
                <InputArea panelWidth={panelWidth} />
            </div>
        </ProfilerWrapper>
    );
}
