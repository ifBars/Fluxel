import { useEffect, useRef, useState } from 'react';
import { X, Loader2, CheckCircle2, XCircle, Terminal, Copy, Check } from 'lucide-react';
import { useBuildPanelStore } from '@/stores/useBuildPanelStore';

export default function BuildPanel() {
    const {
        isOpen,
        isBuilding,
        buildStatus,
        buildOutput,
        buildStartTime,
        buildEndTime,
        closePanel,
    } = useBuildPanelStore();

    const outputRef = useRef<HTMLDivElement>(null);
    const [isCopied, setIsCopied] = useState(false);

    // Auto-scroll to bottom when new output is added
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [buildOutput]);

    if (!isOpen) return null;

    const getBuildDuration = () => {
        if (!buildStartTime) return null;
        const endTime = buildEndTime || Date.now();
        const duration = (endTime - buildStartTime) / 1000;
        return duration.toFixed(2);
    };

    const getStatusIcon = () => {
        switch (buildStatus) {
            case 'running':
                return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
            case 'success':
                return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case 'error':
                return <XCircle className="w-4 h-4 text-red-500" />;
            default:
                return <Terminal className="w-4 h-4 text-muted-foreground" />;
        }
    };

    const getStatusText = () => {
        const duration = getBuildDuration();
        switch (buildStatus) {
            case 'running':
                return 'Building...';
            case 'success':
                return `Build succeeded${duration ? ` (${duration}s)` : ''}`;
            case 'error':
                return `Build failed${duration ? ` (${duration}s)` : ''}`;
            default:
                return 'Build Output';
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(buildOutput.join('\n'));
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    return (
        <div className="flex flex-col h-full bg-card resize-none overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30 shrink-0">
                <div className="flex items-center gap-2">
                    {getStatusIcon()}
                    <span className="text-xs font-medium">{getStatusText()}</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleCopy}
                        className="p-1 rounded hover:bg-muted transition-colors mr-1"
                        aria-label="Copy output"
                        title="Copy output"
                    >
                        {isCopied ? (
                            <Check className="w-4 h-4 text-green-500" />
                        ) : (
                            <Copy className="w-4 h-4 text-muted-foreground" />
                        )}
                    </button>
                    <button
                        onClick={closePanel}
                        className="p-1 rounded hover:bg-muted transition-colors"
                        aria-label="Close panel"
                    >
                        <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                </div>
            </div>

            {/* Output Area */}
            <div
                ref={outputRef}
                className="flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed select-text"
                style={{ fontFamily: 'var(--font-mono, monospace)' }}
            >
                {buildOutput.length === 0 ? (
                    <div className="text-muted-foreground italic">
                        {isBuilding ? 'Waiting for build output...' : 'No build output yet.'}
                    </div>
                ) : (
                    buildOutput.map((line, index) => (
                        <div
                            key={index}
                            className={`whitespace-pre-wrap ${line.toLowerCase().includes('error')
                                ? 'text-red-400'
                                : line.toLowerCase().includes('warning')
                                    ? 'text-yellow-400'
                                    : 'text-foreground'
                                }`}
                        >
                            {line}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
