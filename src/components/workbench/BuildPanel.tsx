import { useEffect, useRef, useState } from 'react';
import { X, Loader2, CheckCircle2, XCircle, Terminal, Copy, Check } from 'lucide-react';
import { useBuildPanelStore } from '@/stores';
import ScrollableArea from '@/components/ui/scrollable-area';

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
        const iconSize = 'var(--build-panel-header-icon-size, 1rem)';
        switch (buildStatus) {
            case 'running':
                return <Loader2 style={{ width: iconSize, height: iconSize }} className="animate-spin text-primary" />;
            case 'success':
                return <CheckCircle2 style={{ width: iconSize, height: iconSize }} className="text-green-500" />;
            case 'error':
                return <XCircle style={{ width: iconSize, height: iconSize }} className="text-red-500" />;
            default:
                return <Terminal style={{ width: iconSize, height: iconSize }} className="text-muted-foreground" />;
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
            <div 
                className="flex items-center justify-between border-b border-border bg-muted/30 shrink-0"
                style={{
                    height: 'var(--build-panel-header-height, 2.25rem)',
                    paddingLeft: 'var(--build-panel-header-padding-x, 0.75rem)',
                    paddingRight: 'var(--build-panel-header-padding-x, 0.75rem)',
                    paddingTop: 'var(--build-panel-header-padding-y, 0.5rem)',
                    paddingBottom: 'var(--build-panel-header-padding-y, 0.5rem)',
                }}
            >
                <div 
                    className="flex items-center"
                    style={{ gap: 'var(--build-panel-header-gap, 0.5rem)' }}
                >
                    {getStatusIcon()}
                    <span 
                        className="font-medium"
                        style={{ fontSize: 'var(--build-panel-header-font-size, 0.75rem)' }}
                    >
                        {getStatusText()}
                    </span>
                </div>
                <div 
                    className="flex items-center"
                    style={{ gap: 'var(--build-panel-header-gap, 0.5rem)' }}
                >
                    <button
                        onClick={handleCopy}
                        className="rounded hover:bg-muted transition-colors mr-1"
                        style={{ padding: 'var(--build-panel-button-padding, 0.25rem)' }}
                        aria-label="Copy output"
                        title="Copy output"
                    >
                        {isCopied ? (
                            <Check style={{ 
                                width: 'var(--build-panel-header-icon-size, 1rem)', 
                                height: 'var(--build-panel-header-icon-size, 1rem)' 
                            }} className="text-green-500" />
                        ) : (
                            <Copy style={{ 
                                width: 'var(--build-panel-header-icon-size, 1rem)', 
                                height: 'var(--build-panel-header-icon-size, 1rem)' 
                            }} className="text-muted-foreground" />
                        )}
                    </button>
                    <button
                        onClick={closePanel}
                        className="rounded hover:bg-muted transition-colors"
                        style={{ padding: 'var(--build-panel-button-padding, 0.25rem)' }}
                        aria-label="Close panel"
                    >
                        <X style={{ 
                            width: 'var(--build-panel-header-icon-size, 1rem)', 
                            height: 'var(--build-panel-header-icon-size, 1rem)' 
                        }} className="text-muted-foreground" />
                    </button>
                </div>
            </div>

            {/* Output Area */}
            <ScrollableArea
                ref={outputRef}
                className="flex-1 font-mono select-text"
                style={{ 
                    fontFamily: 'var(--font-mono, monospace)',
                    padding: 'var(--build-panel-output-padding, 0.75rem)',
                    fontSize: 'var(--build-panel-output-font-size, 0.75rem)',
                    lineHeight: 'var(--build-panel-output-line-height, 1.625)',
                }}
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
            </ScrollableArea>
        </div>
    );
}
