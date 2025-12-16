import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { Send, Paperclip, StopCircle, X } from 'lucide-react';
import { useAgentStore, useFileSystemStore } from '@/stores';
import { streamChat } from '@/lib/ollama/ollamaChatClient';
import type { OllamaChatMessage, OllamaToolCall } from '@/lib/ollama/ollamaChatClient';
import { SYSTEM_PROMPT } from '@/lib/agent/systemPrompt';
import { tools } from '@/lib/agent/tools';
import { useProfiler } from '@/hooks/useProfiler';

/**
 * Parse tool calls that appear as JSON in text content.
 * Some models return tool calls as text rather than structured data.
 * Returns extracted tool calls and the remaining text content.
 */
function parseToolCallsFromText(content: string): {
    toolCalls: OllamaToolCall[];
    remainingContent: string
} {
    const toolCalls: OllamaToolCall[] = [];
    let remainingContent = content;

    // Look for patterns that start tool call JSON objects
    const toolCallStarts = [...content.matchAll(/\{\s*"name"\s*:/g)];

    for (const match of toolCallStarts) {
        const startIndex = match.index!;

        // Find the complete JSON object by counting braces
        let braceCount = 0;
        let endIndex = startIndex;
        let inString = false;
        let escaped = false;

        for (let i = startIndex; i < content.length; i++) {
            const char = content[i];

            if (escaped) {
                escaped = false;
                continue;
            }

            if (char === '\\') {
                escaped = true;
                continue;
            }

            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (char === '{') braceCount++;
                if (char === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                        endIndex = i + 1;
                        break;
                    }
                }
            }
        }

        if (endIndex > startIndex) {
            const jsonStr = content.slice(startIndex, endIndex);
            try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.name && parsed.arguments && tools.some(t => t.function.name === parsed.name)) {
                    toolCalls.push({
                        function: {
                            name: parsed.name,
                            arguments: parsed.arguments
                        }
                    });
                    remainingContent = remainingContent.replace(jsonStr, '').trim();
                }
            } catch {
                // Invalid JSON, skip
            }
        }
    }

    return { toolCalls, remainingContent };
}

export function InputArea() {
    const { startSpan, trackInteraction, ProfilerWrapper } = useProfiler('AgentInputArea');
    const [input, setInput] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const isGenerating = useAgentStore(state => state.isGenerating);
    const attachedContext = useAgentStore(state => state.attachedContext);
    const model = useAgentStore(state => state.model);
    const temperature = useAgentStore(state => state.temperature);
    const activeConversationId = useAgentStore(state => state.activeConversationId);

    // Get workspace root for tool context
    const workspaceRoot = useFileSystemStore(state => state.rootPath);

    const addMessage = useAgentStore(state => state.addMessage);
    const setGenerating = useAgentStore(state => state.setGenerating);
    const appendStreamingContent = useAgentStore(state => state.appendStreamingContent);
    const clearStreaming = useAgentStore(state => state.clearStreaming);
    const removeFile = useAgentStore(state => state.removeFile);
    const createConversation = useAgentStore(state => state.createConversation);

    const handleSendMessage = useCallback(async () => {
        if (!input.trim() || isGenerating) return;

        const userMessage = input.trim();
        setInput('');

        // Track user interaction
        trackInteraction('message_sent', {
            length: userMessage.length.toString(),
            hasContext: (attachedContext.length > 0).toString(),
            model
        });

        // Create conversation if none active
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
        
        // Start profiling the entire turn
        const turnSpan = startSpan('process_turn', 'frontend_network');

        try {
            // Get fresh conversation state
            const currentConversationId = activeConversationId || useAgentStore.getState().activeConversationId!;
            const conversation = useAgentStore.getState().conversations.find(c => c.id === currentConversationId);

            // Prepare history
            const history = conversation?.messages.map(m => {
                // We need to map the store's message structure to Ollama's structure
                const msg: OllamaChatMessage = {
                    role: m.role as 'system' | 'user' | 'assistant' | 'tool',
                    content: m.content
                };
                if (m.toolCalls) {
                    msg.tool_calls = m.toolCalls.map(tc => ({
                        function: {
                            name: tc.name,
                            arguments: tc.arguments
                        }
                    }));
                }
                return msg;
            }) || [];

            // The last message in history is the one we just added (the user message without context details if we want to keep UI clean, 
            // OR we update the UI to show context? The UI shows attached chips, so text msg is usually just user text.
            // But for LLM we need full text.
            // So we take history EXCEPT the last one, and replace it with our enriched one.

            const messagesForLlm = history.slice(0, -1);
            messagesForLlm.push({ role: 'user', content: finalUserContent });

            // Build system prompt with workspace context
            const workspaceContext = workspaceRoot
                ? `\n\n## WORKSPACE CONTEXT\nThe current project workspace root is: ${workspaceRoot}\nALL file paths should be relative to this root or use this as the absolute base path.\nWhen using tools, ALWAYS use "${workspaceRoot}" as the base path.\n`
                : '\n\n## WORKSPACE CONTEXT\nNo workspace is currently open. Ask the user to open a project folder first.\n';

            // Ensure System Prompt is first (with workspace context)
            const finalMessages: OllamaChatMessage[] = [
                { role: 'system', content: SYSTEM_PROMPT + workspaceContext } as OllamaChatMessage,
                ...messagesForLlm.filter(m => m.role !== 'system')
            ];

            // Turn Loop
            let keepGoing = true;
            let loopCount = 0;
            const MAX_LOOPS = 5;

            // We need to track the messages accumulated in THIS turn to append to history for subsequent loops
            let currentTurnMessages = [...finalMessages];

            while (keepGoing && loopCount < MAX_LOOPS) {
                loopCount++;
                let accumulatedContent = '';
                const collectedToolCalls: any[] = []; // OllamaToolCall[]
                
                const streamSpan = startSpan(`llm_stream_response_loop_${loopCount}`, 'frontend_network');

                const response = streamChat(
                    {
                        model,
                        messages: currentTurnMessages,
                        stream: true,
                        options: { temperature },
                        tools: tools.map(t => ({
                            type: 'function',
                            function: t.function
                        }))
                    },
                    undefined,
                    controller.signal
                );

                for await (const chunk of response) {
                    if (chunk.message?.content) {
                        accumulatedContent += chunk.message.content;
                        appendStreamingContent(chunk.message.content);
                    }
                    if (chunk.message?.tool_calls) {
                        collectedToolCalls.push(...chunk.message.tool_calls);
                    }
                }
                
                await streamSpan.end({ 
                    contentLength: accumulatedContent.length.toString(),
                    toolCalls: collectedToolCalls.length.toString()
                });

                // Fallback: Check if model returned tool calls as JSON in text content
                // Some models don't use the structured tool_calls field
                if (collectedToolCalls.length === 0 && accumulatedContent.length > 0) {
                    const parsed = parseToolCallsFromText(accumulatedContent);
                    if (parsed.toolCalls.length > 0) {
                        collectedToolCalls.push(...parsed.toolCalls);
                        accumulatedContent = parsed.remainingContent;
                        // Clear and re-stream the cleaned content
                        clearStreaming();
                        if (accumulatedContent.length > 0) {
                            appendStreamingContent(accumulatedContent);
                        }
                    }
                }

                // Turn completed
                const hasContent = accumulatedContent.length > 0;
                const hasTools = collectedToolCalls.length > 0;

                // 1. Commit Assistant Message to UI (if text)
                if (hasContent) {
                    addMessage({
                        role: 'assistant',
                        content: accumulatedContent,
                    });
                    clearStreaming();
                }

                // 2. Append to LLM history
                currentTurnMessages.push({
                    role: 'assistant',
                    content: accumulatedContent,
                    tool_calls: hasTools ? collectedToolCalls : undefined
                });

                // 3. Handle Tools
                if (hasTools) {
                    for (const call of collectedToolCalls) {
                        const tool = tools.find(t => t.function.name === call.function.name);
                        let resultString = '';
                        
                        const toolSpan = startSpan(`execute_tool:${call.function.name}`, 'frontend_network');

                        if (tool) {
                            try {
                                // Optional: User toast "Running tool..."
                                trackInteraction('tool_execution_start', { tool: call.function.name });
                                const result = await tool.execute(call.function.arguments);
                                resultString = result;
                                await toolSpan.end({ success: 'true', resultLength: result.length.toString() });
                            } catch (e) {
                                const errorMessage = e instanceof Error ? e.message : String(e);
                                resultString = `Error executing tool: ${errorMessage}`;
                                await toolSpan.end({ success: 'false', error: errorMessage });
                            }
                        } else {
                            resultString = `Error: Tool ${call.function.name} not found.`;
                            await toolSpan.end({ success: 'false', error: 'tool_not_found' });
                        }

                        // Add tool result to UI
                        // Use a distinct look by handling 'tool' role in MessageList, or just standard message
                        addMessage({
                            role: 'tool',
                            content: `Tool ${call.function.name} output:\n\`\`\`\n${resultString}\n\`\`\``,
                            // We can store metadata if we want rich UI later
                        });

                        // Add to LLM history
                        currentTurnMessages.push({
                            role: 'tool',
                            content: resultString,
                        });
                    }
                    // Loop continues
                } else {
                    keepGoing = false;
                }
            }
            
            await turnSpan.end({ 
                loops: loopCount.toString(), 
                success: 'true' 
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
        activeConversationId,
        attachedContext,
        model,
        temperature,
        workspaceRoot,
        addMessage,
        setGenerating,
        appendStreamingContent,
        clearStreaming,
        createConversation,
        startSpan,
        trackInteraction,
        tools // Added dependency
    ]);

    const handleStopGeneration = useCallback(() => {
        if (abortControllerRef.current) {
            trackInteraction('stop_generation');
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    }, [trackInteraction]);

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Auto-resize textarea
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    };

    return (
        <ProfilerWrapper>
            <div className="border-t border-border p-3 bg-card">
                {/* Context Chips */}
                {attachedContext.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                        {attachedContext.map(ctx => (
                            <span
                                key={ctx.path}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs"
                            >
                                {ctx.path.split(/[\\/]/).pop()}
                                <button
                                    onClick={() => removeFile(ctx.path)}
                                    className="hover:text-destructive"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                {/* Input Row */}
                <div className="flex items-end gap-2">
                    <div className="flex-1 relative">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask Fluxel Agent..."
                            rows={1}
                            disabled={isGenerating}
                            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed custom-scrollbar"
                            style={{ maxHeight: '200px' }}
                        />
                        <div className="absolute right-2 bottom-2 flex items-center gap-1">
                            <button
                                className="p-1 hover:bg-muted rounded transition-colors"
                                title="Attach file (coming soon)"
                                disabled
                            >
                                <Paperclip className="w-4 h-4 text-muted-foreground opacity-50" />
                            </button>
                        </div>
                    </div>

                    {isGenerating ? (
                        <button
                            onClick={handleStopGeneration}
                            className="shrink-0 p-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                            title="Stop generation"
                        >
                            <StopCircle className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSendMessage}
                            disabled={!input.trim()}
                            className="shrink-0 p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title="Send message (Enter)"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Model info moved to AgentPanel header */}
                <div className="mt-1 flex justify-end">
                    <div className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded">
                        Temp: {temperature}
                    </div>
                </div>
            </div>
        </ProfilerWrapper>
    );
}
