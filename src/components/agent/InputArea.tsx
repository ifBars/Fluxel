import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { Send, Paperclip, StopCircle, X } from 'lucide-react';
import { useAgentStore, useFileSystemStore } from '@/stores';
import { getProvider, type ProviderMessage, type ProviderType } from '@/lib/agent/providers';
import { SYSTEM_PROMPT } from '@/lib/agent/systemPrompt';
import { tools } from '@/lib/agent/tools';
import { useProfiler } from '@/hooks/useProfiler';
import { ModelSelector } from './ModelSelector';

/**
 * Convert store messages to unified ProviderMessage format
 */
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

export function InputArea({ }: { panelWidth?: number }) {
    const { startSpan, trackInteraction, ProfilerWrapper } = useProfiler('AgentInputArea');
    const [input, setInput] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Store selectors
    const isGenerating = useAgentStore(state => state.isGenerating);
    const attachedContext = useAgentStore(state => state.attachedContext);
    const model = useAgentStore(state => state.model);
    const temperature = useAgentStore(state => state.temperature);
    const activeConversationId = useAgentStore(state => state.activeConversationId);
    const provider = useAgentStore(state => state.provider) as ProviderType;
    const providerConfigs = useAgentStore(state => state.providerConfigs);
    const workspaceRoot = useFileSystemStore(state => state.rootPath);

    // Store actions
    const addMessage = useAgentStore(state => state.addMessage);
    const setGenerating = useAgentStore(state => state.setGenerating);
    const appendStreamingContent = useAgentStore(state => state.appendStreamingContent);
    const appendStreamingThinking = useAgentStore(state => state.appendStreamingThinking);
    const clearStreaming = useAgentStore(state => state.clearStreaming);
    const removeFile = useAgentStore(state => state.removeFile);
    const createConversation = useAgentStore(state => state.createConversation);

    /**
     * Main message handler - uses the provider abstraction
     */
    const handleSendMessage = useCallback(async () => {
        if (!input.trim() || isGenerating) return;

        const userMessage = input.trim();
        setInput('');

        trackInteraction('message_sent', {
            length: userMessage.length.toString(),
            hasContext: (attachedContext.length > 0).toString(),
            model,
            provider
        });

        // Create conversation if needed
        if (!activeConversationId) {
            createConversation();
        }

        // Add user message to UI
        addMessage({
            role: 'user',
            content: userMessage,
        });

        // Add context if attached
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
            // Get provider implementation
            const providerImpl = getProvider(provider);

            // Get provider config
            const config = {
                apiKey: providerConfigs?.[provider]?.apiKey,
                apiBase: providerConfigs?.[provider]?.apiBase,
            };

            // Get conversation history
            const currentConversationId = activeConversationId || useAgentStore.getState().activeConversationId!;
            const conversation = useAgentStore.getState().conversations.find(c => c.id === currentConversationId);

            // Convert to provider message format
            const history = conversation?.messages.map(m => ({
                role: m.role,
                content: m.content,
                toolCalls: m.toolCalls?.map(tc => ({
                    id: tc.id,
                    name: tc.name,
                    arguments: tc.arguments,
                })),
            })) || [];

            // Build messages (exclude the last one we just added, add the full user content)
            const historyMessages = convertStoreMessages(history.slice(0, -1));
            const currentMessages: ProviderMessage[] = [
                ...historyMessages,
                { role: 'user', content: finalUserContent }
            ];

            // Build system prompt with workspace context
            const workspaceContext = workspaceRoot
                ? `\n\n## WORKSPACE CONTEXT\nThe current project workspace root is: ${workspaceRoot}\nALL file paths should be relative to this root or use this as the absolute base path.\nWhen using tools, ALWAYS use "${workspaceRoot}" as the base path.\n`
                : '\n\n## WORKSPACE CONTEXT\nNo workspace is currently open. Ask the user to open a project folder first.\n';

            const fullSystemPrompt = SYSTEM_PROMPT + workspaceContext;

            // Tool definitions
            const toolDefs = tools.map(t => ({
                type: 'function' as const,
                function: t.function,
            }));

            // Agentic loop
            let keepGoing = true;
            let loopCount = 0;
            const MAX_LOOPS = 5;

            while (keepGoing && loopCount < MAX_LOOPS) {
                loopCount++;
                const streamSpan = startSpan('llm_stream_response_loop', 'frontend_network');

                // Stream response from provider
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
                    hasThinking: (!!result.thinking).toString()
                });

                const hasContent = result.content.length > 0;
                const hasTools = result.toolCalls.length > 0;

                // 1. Commit Assistant Message to UI
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

                // 2. Add assistant message to current turn
                currentMessages.push(
                    providerImpl.formatAssistantMessage(result.content, result.toolCalls, result.thinking)
                );

                // 3. Handle Tools
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

                        // Add to UI
                        addMessage({
                            role: 'tool',
                            content: `Tool ${call.name} output:\n\`\`\`\n${resultString}\n\`\`\``,
                        });

                        // Add tool result to current turn (properly formatted for API)
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
                provider
            });

        } catch (error) {
            await turnSpan.end({
                success: 'false',
                error: error instanceof Error ? error.message : String(error)
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
        model,
        temperature,
        provider,
        providerConfigs,
        activeConversationId,
        attachedContext,
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

    return (
        <ProfilerWrapper>
            <div className="border-t border-border bg-background/80 backdrop-blur-sm p-4">
                {/* Attached Files */}
                {attachedContext.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                        {attachedContext.map(ctx => (
                            <div
                                key={ctx.path}
                                className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md text-xs"
                            >
                                <Paperclip className="w-3 h-3 text-muted-foreground" />
                                <span className="truncate max-w-[150px]">
                                    {ctx.path.split('/').pop()}
                                </span>
                                <button
                                    onClick={() => removeFile(ctx.path)}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Input Area */}
                <div className="flex items-end gap-2">
                    <div className="flex-1 relative">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask anything..."
                            className="w-full resize-none rounded-lg border border-border bg-background px-4 py-3 pr-12 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors min-h-[48px] max-h-[200px]"
                            style={{ height: 'auto' }}
                            rows={1}
                            disabled={isGenerating}
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = 'auto';
                                target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
                            }}
                        />
                    </div>

                    {isGenerating ? (
                        <button
                            onClick={handleStop}
                            className="p-3 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                            title="Stop generation"
                        >
                            <StopCircle className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSendMessage}
                            disabled={!input.trim()}
                            className="p-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Send message"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Footer with Model Selector */}
                <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                    <ModelSelector />
                    <span>Shift+Enter for new line</span>
                </div>
            </div>
        </ProfilerWrapper>
    );
}
