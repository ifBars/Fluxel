import { useRef, useEffect } from 'react';
import { useAgentStore } from '@/stores/agent/useAgentStore';
import { ChatMessage } from './ChatMessage';
import ScrollableArea from '@/components/ui/scrollable-area';

export function MessageList() {
    const conversations = useAgentStore(state => state.conversations);
    const activeConversationId = useAgentStore(state => state.activeConversationId);
    const isGenerating = useAgentStore(state => state.isGenerating);
    const streamingContent = useAgentStore(state => state.streamingContent);

    const scrollRef = useRef<HTMLDivElement>(null);

    const activeConversation = conversations.find(c => c.id === activeConversationId);
    const messages = activeConversation?.messages ?? [];

    // Auto-scroll to bottom when new messages arrive or streaming
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages.length, streamingContent]);

    if (!activeConversation) {
        return (
            <div className="flex-1 flex items-center justify-center text-muted-foreground p-8 text-center">
                <div>
                    <p className="text-lg font-medium mb-2">No conversation selected</p>
                    <p className="text-sm">Start a new conversation to begin</p>
                </div>
            </div>
        );
    }

    if (messages.length === 0 && !isGenerating) {
        return (
            <div className="flex-1 flex items-center justify-center text-muted-foreground p-8 text-center">
                <div>
                    <p className="text-lg font-medium mb-2">Start a conversation</p>
                    <p className="text-sm">Ask me anything about your code</p>
                </div>
            </div>
        );
    }

    return (
        <ScrollableArea ref={scrollRef} className="flex-1">
            <div className="flex flex-col">
                {messages.map(message => (
                    <ChatMessage key={message.id} message={message} />
                ))}

                {/* Streaming message or Loading indicator */}
                {isGenerating && (
                    <ChatMessage
                        message={{
                            id: 'streaming',
                            role: 'assistant',
                            content: streamingContent || 'Thinking...',
                            timestamp: new Date(),
                            isStreaming: true,
                        }}
                    />
                )}
            </div>
        </ScrollableArea>
    );
}
