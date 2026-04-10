import { useRef } from 'react';
import { MessageSquareText, Sparkles } from 'lucide-react';
import ScrollableArea from '@/components/ui/scrollable-area';
import { useAgentStore } from '@/stores/agent/useAgentStore';
import { useReactiveEffect } from "@/hooks/useReactiveEffect";
import { ChatMessage } from './ChatMessage';

export function MessageList() {
    const conversations = useAgentStore(state => state.conversations);
    const activeConversationId = useAgentStore(state => state.activeConversationId);
    const isGenerating = useAgentStore(state => state.isGenerating);
    const streamingContent = useAgentStore(state => state.streamingContent);
    const streamingThinking = useAgentStore(state => state.streamingThinking);
    const createConversation = useAgentStore(state => state.createConversation);

    const scrollRef = useRef<HTMLDivElement>(null);

    const activeConversation = conversations.find(c => c.id === activeConversationId);
    const messages = activeConversation?.messages ?? [];

    useReactiveEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages.length, streamingContent, streamingThinking]);

    if (!activeConversation) {
        return (
            <div className="flex flex-1 items-center justify-center p-6">
                <div className="max-w-sm rounded-3xl border border-dashed border-border/80 bg-card/70 p-6 text-center shadow-sm">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <MessageSquareText className="h-5 w-5" />
                    </div>
                    <p className="text-base font-semibold text-foreground">No conversation selected</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Open a chat thread or start a fresh one to work through code, files, and tools here.
                    </p>
                    <button
                        onClick={() => createConversation()}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                        <Sparkles className="h-4 w-4" />
                        Start conversation
                    </button>
                </div>
            </div>
        );
    }

    if (messages.length === 0 && !isGenerating) {
        return (
            <div className="flex flex-1 items-center justify-center p-6">
                <div className="max-w-sm rounded-3xl border border-border/70 bg-gradient-to-br from-card via-card to-muted/20 p-6 text-center shadow-sm">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                        <Sparkles className="h-5 w-5" />
                    </div>
                    <p className="text-base font-semibold text-foreground">Start a conversation</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Ask for a code review, trace a bug, explain a subsystem, or make a targeted edit.
                    </p>
                    <div className="mt-4 space-y-2 text-left">
                        {[
                            'Explain the current workspace structure',
                            'Review the active file for bugs',
                            'Implement the change I have in mind',
                        ].map(prompt => (
                            <div
                                key={prompt}
                                className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-xs text-muted-foreground"
                            >
                                {prompt}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <ScrollableArea ref={scrollRef} className="flex-1">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 px-3 py-4">
                {messages.map(message => (
                    <ChatMessage key={message.id} message={message} />
                ))}

                {isGenerating && (
                    <ChatMessage
                        message={{
                            id: 'streaming',
                            role: 'assistant',
                            content: streamingContent || 'Thinking...',
                            timestamp: new Date(),
                            isStreaming: true,
                            thinking: streamingThinking || undefined,
                        }}
                    />
                )}
            </div>
        </ScrollableArea>
    );
}
