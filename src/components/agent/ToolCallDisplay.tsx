import { Wrench, CheckCircle2, Loader2, XCircle, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { ToolCall } from '@/stores/agent/types';

interface Props {
    toolCall: ToolCall;
    result?: string | null;
    error?: string;
}

export function ToolCallDisplay({ toolCall, result, error }: Props) {
    const [isExpanded, setExpanded] = useState(false);

    const statusIcon = {
        pending: <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />,
        executing: <Loader2 className="w-3 h-3 animate-spin text-primary" />,
        completed: <CheckCircle2 className="w-3 h-3 text-green-500" />,
        error: <XCircle className="w-3 h-3 text-destructive" />,
    }[toolCall.status];

    return (
        <div className="mt-2 rounded-md border border-border bg-muted/20 overflow-hidden">
            <button
                onClick={() => setExpanded(!isExpanded)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/40 transition-colors"
            >
                <Wrench className="w-4 h-4 text-primary" />
                <span className="font-mono text-sm">{toolCall.name}</span>
                {statusIcon}
                <ChevronDown
                    className={`w-4 h-4 ml-auto transition-transform ${isExpanded ? 'rotate-180' : ''
                        }`}
                />
            </button>

            {isExpanded && (
                <div className="px-3 py-2 border-t border-border bg-card/50">
                    <div className="text-xs text-muted-foreground mb-1">Arguments:</div>
                    <pre className="text-xs font-mono overflow-x-auto bg-muted/30 p-2 rounded">
                        {JSON.stringify(toolCall.arguments, null, 2)}
                    </pre>

                    {error && (
                        <div className="mt-2 pt-2 border-t border-border">
                            <div className="text-xs text-destructive mb-1">Error:</div>
                            <pre className="text-xs font-mono text-destructive bg-destructive/10 p-2 rounded">
                                {error}
                            </pre>
                        </div>
                    )}

                    {result && !error && (
                        <div className="mt-2 pt-2 border-t border-border">
                            <div className="text-xs text-muted-foreground mb-1">Result:</div>
                            <pre className="text-xs font-mono bg-muted/30 p-2 rounded max-h-48 overflow-auto">
                                {result}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
