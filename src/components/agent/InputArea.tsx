import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import { Paperclip, Send, StopCircle, X } from 'lucide-react';
import { useAgentStore, useFileSystemStore } from '@/stores';
import { getProvider, type ProviderMessage, type ProviderType } from '@/lib/agent/providers';
import { SYSTEM_PROMPT } from '@/lib/agent/systemPrompt';
import { tools } from '@/lib/agent/tools';
import { cn } from '@/lib/utils';
import { useProfiler } from '@/hooks/useProfiler';
import { ModelSelector } from './ModelSelector';

function convertStoreMessages(
    messages: Array<{
        role: string;
        content: string;
        toolCalls?: Array<{ id?: string; name: string; arguments: Record<string, unknown> }>;
        toolCallId?: string;
    }>
): ProviderMessage[] {
    return messages.map(m => ({
        role: m.role as ProviderMessage['role'],
        content: m.content,
        toolCallId: m.toolCallId,
        toolCalls: m.toolCalls?.map(tc => ({
            id: tc.id || `legacy_${Date.now()}`,
            name: tc.name,
            arguments: tc.arguments,
        })),
    }));
}

export function InputArea({ panelWidth }: { panelWidth?: number }) {
    const { startSpan, trackInteraction, ProfilerWrapper } = useProfiler('AgentInputArea');
    const [input, setInput] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const isGenerating = useAgentStore(state => state.isGenerating);
    const attachedContext = useAgentStore(state => state.attachedContext);
    const model = useAgentStore(state => state.model);
    const temperature = useAgentStore(state => state.temperature);
    const activeConversationId = useAgentStore(state => state.activeConversationId);
    const provider = useAgentStore(state => state.provider) as ProviderType;
    const providerConfigs = useAgentStore(state => state.providerConfigs);
    const workspaceRoot = useFileSystemStore(state => state.rootPath);

    const addMessage = useAgentStore(state => state.addMessage);
    const setGenerating = useAgentStore(state => state.setGenerating);
    const appendStreamingContent = useAgentStore(state => state.appendStreamingContent);
    const appendStreamingThinking = useAgentStore(state => state.appendStreamingThinking);
    const clearStreaming = useAgentStore(state => state.clearStreaming);
    const removeFile = useAgentStore(state => state.removeFile);
    const createConversation = useAgentStore(state => state.createConversation);

    const handleSendMessage = useCallback(async () => {
        if (!input.trim() || isGenerating) return;

        const userMessage = input.trim();
        setInput('');

        trackInteraction('message_sent', {
            length: userMessage.length.toString(),
            hasContext: (attachedContext.length > 0).toString(),
            model,
            provider,
        });

        if (!activeConversationId) {
            createConversation();
        }

        addMessage({
            role: 'user',
            content: userMessage,
        });

        let finalUserContent = userMessage;
        if (attachedContext.length > 0) {
            const contextPrefix = attachedContext
                .map(ctx => `File: ${ctx.path}\n\`\`\`\n${ctx.content ?? '(content not loaded)'}\n\`\`\``)
                .join('\n\n');
            finalUserContent = `${contextPrefix}\n\n${userMessage}`;
        }

        setGenerating(true);
        clearStreaming();

        const controller = new AbortController();
        abortControllerRef.current = controller;

        const turnSpan = startSpan('process_turn', 'frontend_network');

        try {
            const providerImpl = getProvider(provider);

            const config = {
                apiKey: providerConfigs?.[provider]?.apiKey,
                apiBase: providerConfigs?.[provider]?.apiBase,
            };

            const currentConversationId = activeConversationId || useAgentStore.getState().activeConversationId!;
            const conversation = useAgentStore.getState().conversations.find(c => c.id === currentConversationId);

            const history = conversation?.messages.map(m => ({
                role: m.role,
                content: m.content,
                toolCallId: m.toolCallId,
                toolCalls: m.toolCalls?.map(tc => ({
                    id: tc.id,
                    name: tc.name,
                    arguments: tc.arguments,
                })),
            })) || [];

            const historyMessages = convertStoreMessages(history.slice(0, -1));
            const currentMessages: ProviderMessage[] = [
                ...historyMessages,
                { role: 'user', content: finalUserContent },
            ];

            const workspaceContext = workspaceRoot
                ? `\n\n## WORKSPACE CONTEXT\nThe current project workspace root is: ${workspaceRoot}\nALL file paths should be relative to this root or use this as the absolute base path.\nWhen using tools, ALWAYS use "${workspaceRoot}" as the base path.\n`
                : '\n\n## WORKSPACE CONTEXT\nNo workspace is currently open. Ask the user to open a project folder first.\n';

            const fullSystemPrompt = SYSTEM_PROMPT + workspaceContext;

            const toolDefs = tools.map(t => ({
                type: 'function' as const,
                function: t.function,
            }));

            let keepGoing = true;
            let loopCount = 0;
            const MAX_LOOPS = 5;

            while (keepGoing && loopCount < MAX_LOOPS) {
                loopCount++;
                const streamSpan = startSpan('llm_stream_response_loop', 'frontend_network');

                const result = await providerImpl.stream(
                    currentMessages,
                    fullSystemPrompt,
                    toolDefs,
                    {
                        model,
                        temperature,
                        abortSignal: controller.signal,
                    },
                    {
                        onContent: appendStreamingContent,
                        onThinking: appendStreamingThinking,
                    },
                    config
                );

                await streamSpan.end({
                    contentLength: result.content.length.toString(),
                    toolCalls: result.toolCalls.length.toString(),
                    hasThinking: (!!result.thinking).toString(),
                });

                const hasContent = result.content.length > 0;
                const hasTools = result.toolCalls.length > 0;

                if (hasContent || result.thinking) {
                    addMessage({
                        role: 'assistant',
                        content: result.content,
                        thinking: result.thinking,
                        toolCalls: result.toolCalls.map(tc => ({
                            id: tc.id,
                            name: tc.name,
                            arguments: tc.arguments,
                            status: 'pending' as const,
                        })),
                    });
                    clearStreaming();
                }

                currentMessages.push(
                    providerImpl.formatAssistantMessage(result.content, result.toolCalls, result.thinking)
                );

                if (hasTools) {
                    for (const call of result.toolCalls) {
                        const tool = tools.find(t => t.function.name === call.name);
                        let resultString = '';

                        const toolSpan = startSpan(`execute_tool:${call.name}`, 'frontend_network');

                        if (tool) {
                            try {
                                trackInteraction('tool_execution_start', { tool: call.name });
                                const toolResult = await tool.execute(call.arguments);
                                resultString = toolResult;
                                await toolSpan.end({ success: 'true', resultLength: toolResult.length.toString() });
                            } catch (e) {
                                const errorMessage = e instanceof Error ? e.message : String(e);
                                resultString = `Error executing tool: ${errorMessage}`;
                                await toolSpan.end({ success: 'false', error: errorMessage });
                            }
                        } else {
                            resultString = `Error: Tool ${call.name} not found.`;
                            await toolSpan.end({ success: 'false', error: 'tool_not_found' });
                        }

                        addMessage({
                            role: 'tool',
                            content: `Tool ${call.name} output:\n\`\`\`\n${resultString}\n\`\`\``,
                            toolCallId: call.id,
                        });

                        currentMessages.push(
                            providerImpl.formatToolResult({
                                toolCallId: call.id,
                                content: resultString,
                            })
                        );
                    }
                } else {
                    keepGoing = false;
                }
            }

            await turnSpan.end({
                loops: loopCount.toString(),
                success: 'true',
                provider,
            });
        } catch (error) {
            await turnSpan.end({
                success: 'false',
                error: error instanceof Error ? error.message : String(error),
            });

            if (error instanceof Error && error.name !== 'AbortError') {
                console.error('Chat error:', error);
                addMessage({
                    role: 'assistant',
                    content: `Error: ${error.message}`,
                });
            }
        } finally {
            setGenerating(false);
            clearStreaming();
            abortControllerRef.current = null;
        }
    }, [
        input,
        isGenerating,
        attachedContext,
        model,
        temperature,
        activeConversationId,
        provider,
        providerConfigs,
        workspaceRoot,
        addMessage,
        setGenerating,
        appendStreamingContent,
        appendStreamingThinking,
        clearStreaming,
        createConversation,
        startSpan,
        trackInteraction,
    ]);

    const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    }, [handleSendMessage]);

    const handleStop = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setGenerating(false);
            clearStreaming();
        }
    }, [setGenerating, clearStreaming]);

    const composerHint = activeConversationId
        ? 'Send a follow-up, ask for a refactor, or request a review.'
        : 'Describe the task and Fluxel will start a fresh chat.';
    const showFooterHint = (panelWidth ?? 0) > 420;

    return (
        <ProfilerWrapper>
            <div className="border-t border-border/80 bg-gradient-to-t from-background via-background/95 to-background/80 p-4 backdrop-blur-sm">
                {attachedContext.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                        {attachedContext.map(ctx => (
                            <div
                                key={ctx.path}
                                className="flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-xs shadow-sm"
                            >
                                <Paperclip className="h-3 w-3 text-muted-foreground" />
                                <span className="max-w-[150px] truncate">
                                    {ctx.path.split('/').pop()}
                                </span>
                                <button
                                    onClick={() => removeFile(ctx.path)}
                                    className="text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="overflow-hidden rounded-[1.5rem] border border-border/80 bg-card/95 shadow-sm">
                    <div className="border-b border-border/60 px-4 py-2.5">
                        <p className="text-xs text-muted-foreground">
                            {composerHint}
                        </p>
                    </div>

                    <div className="px-3 pt-2">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask Fluxel to inspect, change, or explain something..."
                            className="min-h-[72px] max-h-[220px] w-full resize-none bg-transparent px-1 py-2 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70"
                            style={{ height: 'auto' }}
                            rows={2}
                            disabled={isGenerating}
                            onInput={e => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = 'auto';
                                target.style.height = `${Math.min(target.scrollHeight, 220)}px`;
                            }}
                        />
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                            <ModelSelector />
                            <span className="rounded-full border border-border/70 bg-background/70 px-2 py-1 text-[11px] text-muted-foreground">
                                {provider}
                            </span>
                            {attachedContext.length > 0 && (
                                <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                                    {attachedContext.length} context {attachedContext.length === 1 ? 'file' : 'files'}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {showFooterHint && (
                                <span className="hidden text-[11px] text-muted-foreground lg:inline">
                                    Shift+Enter for new line
                                </span>
                            )}

                            {isGenerating ? (
                                <button
                                    onClick={handleStop}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
                                    title="Stop generation"
                                >
                                    <StopCircle className="h-4 w-4" />
                                    <span className={cn(!showFooterHint && 'sr-only')}>Stop</span>
                                </button>
                            ) : (
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!input.trim()}
                                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground/60"
                                    title="Send message"
                                >
                                    <Send className="h-4 w-4" />
                                    <span className={cn(!showFooterHint && 'sr-only')}>Send</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </ProfilerWrapper>
    );
}
