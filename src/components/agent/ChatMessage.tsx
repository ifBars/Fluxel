import { Streamdown } from 'streamdown';
import { User, Bot } from 'lucide-react';
import { ToolCallDisplay } from './ToolCallDisplay.tsx';
import type { ChatMessage as ChatMessageType } from '@/stores/agent/types';
import { useProfiler } from '@/hooks/useProfiler';

interface Props {
    message: ChatMessageType;
}

export function ChatMessage({ message }: Props) {
    const { ProfilerWrapper } = useProfiler('ChatMessage');
    const isUser = message.role === 'user';

    return (
        <ProfilerWrapper>
            <div className={`flex gap-3 px-4 py-3 ${isUser ? 'bg-muted/30' : ''}`}>
                {/* Avatar */}
                <div
                    className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${isUser ? 'bg-secondary' : 'bg-primary'
                        }`}
                >
                    {isUser ? (
                        <User className="w-4 h-4 text-secondary-foreground" />
                    ) : (
                        <Bot className="w-4 h-4 text-primary-foreground" />
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                        <Streamdown
                            mode={message.isStreaming ? 'streaming' : 'static'}
                            isAnimating={message.isStreaming}
                        >
                            {message.content}
                        </Streamdown>
                    </div>

                    {/* Tool Calls */}
                    {message.toolCalls?.map(tc => {
                        const result = message.toolResults?.find(tr => tr.toolCallId === tc.id);
                        return (
                            <ToolCallDisplay
                                key={tc.id}
                                toolCall={tc}
                                result={result?.result ?? null}
                                error={result?.error}
                            />
                        );
                    })}
                </div>
            </div>
        </ProfilerWrapper>
    );
}
