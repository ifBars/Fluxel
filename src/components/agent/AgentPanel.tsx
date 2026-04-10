import { useRef, useState } from 'react';
import { Loader2, Plus, Settings, Sparkles, X } from 'lucide-react';
import { useAgentStore } from '@/stores/agent/useAgentStore';
import { useProfiler } from '@/hooks/useProfiler';
import { useReactiveEffect } from "@/hooks/useReactiveEffect";
import { InputArea } from './InputArea';
import { MessageList } from './MessageList';

export function AgentPanel() {
    const { ProfilerWrapper } = useProfiler('AgentPanel');
    const isOpen = useAgentStore(state => state.isOpen);
    const togglePanel = useAgentStore(state => state.togglePanel);
    const createConversation = useAgentStore(state => state.createConversation);
    const toggleSettings = useAgentStore(state => state.toggleSettings);
    const conversations = useAgentStore(state => state.conversations);
    const activeConversationId = useAgentStore(state => state.activeConversationId);
    const isGenerating = useAgentStore(state => state.isGenerating);
    const model = useAgentStore(state => state.model);

    const containerRef = useRef<HTMLDivElement>(null);
    const [panelWidth, setPanelWidth] = useState(500);
    const activeConversation = conversations.find(c => c.id === activeConversationId);

    useReactiveEffect(() => {
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
                className="relative flex h-full flex-col overflow-hidden border-l border-border bg-background"
            >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_65%)]" />

                <div className="relative shrink-0 border-b border-border/80 bg-gradient-to-b from-muted/30 via-background/95 to-background/80 backdrop-blur">
                    <div className="flex items-start justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/80">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
                                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                                </span>
                                Agent Workspace
                                {isGenerating && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Running
                                    </span>
                                )}
                            </div>

                            <div className="mt-2 flex items-center gap-2">
                                <h2 className="truncate text-sm font-semibold text-foreground">
                                    {activeConversation?.title || 'New conversation'}
                                </h2>
                                <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                    {conversations.length} {conversations.length === 1 ? 'chat' : 'chats'}
                                </span>
                            </div>

                            <p className="mt-1 truncate text-xs text-muted-foreground">
                                {model || 'Select a model to start the conversation'}
                            </p>
                        </div>

                        <div className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-background/80 p-1 shadow-sm">
                            <button
                                onClick={() => createConversation()}
                                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                title="New conversation"
                            >
                                <Plus className="h-4 w-4" />
                            </button>

                            <button
                                onClick={() => toggleSettings('agent')}
                                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                title="Agent settings"
                            >
                                <Settings className="h-4 w-4" />
                            </button>

                            <button
                                onClick={() => togglePanel()}
                                className="ml-1 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                title="Close panel"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>

                <MessageList />
                <InputArea panelWidth={panelWidth} />
            </div>
        </ProfilerWrapper>
    );
}
