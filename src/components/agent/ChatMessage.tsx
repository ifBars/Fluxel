import { useState } from 'react';
import { Brain, ChevronDown, Sparkles, User, Wrench } from 'lucide-react';
import { Streamdown } from 'streamdown';
import { cn } from '@/lib/utils';
import { useProfiler } from '@/hooks/useProfiler';
import type { ChatMessage as ChatMessageType } from '@/stores/agent/types';
import { ToolCallDisplay } from './ToolCallDisplay.tsx';

interface Props {
    message: ChatMessageType;
}

export function ChatMessage({ message }: Props) {
    const { ProfilerWrapper } = useProfiler('ChatMessage');
    const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);

    const isUser = message.role === 'user';
    const isTool = message.role === 'tool';
    const timestamp = message.timestamp instanceof Date
        ? message.timestamp
        : new Date(message.timestamp);

    const roleLabel = isUser ? 'You' : isTool ? 'Tool Output' : 'Fluxel Agent';
    const AvatarIcon = isUser ? User : isTool ? Wrench : Sparkles;

    return (
        <ProfilerWrapper>
            <div className={cn('flex px-1 py-1', isUser ? 'justify-end' : 'justify-start')}>
                <div className={cn('flex w-full gap-3', isUser ? 'max-w-[92%] flex-row-reverse' : 'max-w-[94%]')}>
                    <div
                        className={cn(
                            'mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border shadow-sm',
                            isUser && 'border-secondary/60 bg-secondary text-secondary-foreground',
                            !isUser && !isTool && 'border-primary/20 bg-primary/10 text-primary',
                            isTool && 'border-amber-500/20 bg-amber-500/10 text-amber-600'
                        )}
                    >
                        <AvatarIcon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className={cn('mb-1 flex items-center gap-2 px-1', isUser && 'justify-end')}>
                            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/75">
                                {roleLabel}
                            </span>
                            <span className="text-[11px] text-muted-foreground/60">
                                {timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            </span>
                            {message.isStreaming && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                                    Streaming
                                </span>
                            )}
                        </div>

                        <div
                            className={cn(
                                'overflow-hidden rounded-3xl border shadow-sm',
                                isUser && 'border-primary/20 bg-primary/8',
                                !isUser && !isTool && 'border-border/70 bg-card/90',
                                isTool && 'border-amber-500/20 bg-amber-500/5'
                            )}
                        >
                            {message.thinking && (
                                <div className="border-b border-border/70 bg-muted/40">
                                    <button
                                        onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                                        className="flex w-full items-center gap-2 px-4 py-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60"
                                    >
                                        <Brain className="h-3.5 w-3.5" />
                                        <span>Reasoning trace</span>
                                        <ChevronDown
                                            className={`ml-auto h-3.5 w-3.5 transition-transform duration-200 ${isThinkingExpanded ? 'rotate-180' : ''
                                                }`}
                                        />
                                    </button>
                                    {isThinkingExpanded && (
                                        <div className="border-t border-border/70 px-4 py-3">
                                            <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">
                                                {message.thinking}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="px-4 py-3">
                                <div className="prose prose-sm max-w-none text-foreground">
                                    <Streamdown
                                        mode={message.isStreaming ? 'streaming' : 'static'}
                                        isAnimating={message.isStreaming}
                                    >
                                        {message.content}
                                    </Streamdown>
                                </div>
                            </div>

                            {message.toolCalls && message.toolCalls.length > 0 && (
                                <div className="border-t border-border/70 px-4 py-3">
                                    {message.toolCalls.map(tc => {
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
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </ProfilerWrapper>
    );
}
