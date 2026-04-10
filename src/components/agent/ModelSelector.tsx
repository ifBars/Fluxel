import { useRef, useState } from 'react';
import { Bot, Check, ChevronUp, Cloud, Settings } from 'lucide-react';
import { useAgentStore } from '@/stores/agent/useAgentStore';
import type { ModelConfig } from '@/stores/agent/types';
import { useReactiveEffect } from "@/hooks/useReactiveEffect";

interface ModelSelectorProps {
    className?: string;
}

export function ModelSelector({ className = '' }: ModelSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const model = useAgentStore(state => state.model);
    const setModel = useAgentStore(state => state.setModel);
    const provider = useAgentStore(state => state.provider);
    const models = useAgentStore(state => state.models);
    const toggleSettings = useAgentStore(state => state.toggleSettings);

    const enabledModels = models.filter((m: ModelConfig) => m.enabled);

    useReactiveEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleModelSelect = (newModel: string) => {
        setModel(newModel);
        setIsOpen(false);
    };

    const handleOpenSettings = () => {
        setIsOpen(false);
        toggleSettings('agent');
    };

    const ProviderIcon = provider === 'minimax' ? Cloud : Bot;

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/80 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                title="Change model"
            >
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-muted/70">
                    <ProviderIcon className="h-3.5 w-3.5" />
                </span>
                <span className="max-w-[120px] truncate">{model}</span>
                <ChevronUp className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute bottom-full left-0 z-50 mb-2 w-72 overflow-hidden rounded-2xl border border-border bg-popover/95 py-1 shadow-xl backdrop-blur animate-in slide-in-from-bottom-2 fade-in zoom-in-95 duration-100">
                    <div className="mb-1 border-b border-border bg-muted/20 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Select Model
                    </div>

                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar py-1">
                        {enabledModels.length > 0 ? (
                            enabledModels.map((m) => (
                                <button
                                    key={m.id}
                                    onClick={() => handleModelSelect(m.id)}
                                    className={`w-full px-3 py-2 text-left text-xs transition-colors hover:bg-muted ${model === m.id ? 'bg-primary/5 text-primary' : 'text-foreground'
                                        }`}
                                >
                                    <span className="flex items-center justify-between gap-3">
                                        <span className="flex min-w-0 items-center gap-2">
                                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted/70">
                                                {m.providerId === 'minimax' ? (
                                                    <Cloud className="h-3 w-3 text-muted-foreground" />
                                                ) : (
                                                    <Bot className="h-3 w-3 text-muted-foreground" />
                                                )}
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block truncate font-medium">{m.name}</span>
                                                <span className="block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                                                    {m.providerId}
                                                </span>
                                            </span>
                                        </span>
                                        {model === m.id && <Check className="ml-2 h-3.5 w-3.5 shrink-0 text-primary" />}
                                    </span>
                                </button>
                            ))
                        ) : (
                            <div className="px-3 py-2 text-center text-xs italic text-muted-foreground">
                                No models available. Configure providers in settings.
                            </div>
                        )}
                    </div>

                    <div className="mt-1 border-t border-border pt-1">
                        <button
                            onClick={handleOpenSettings}
                            className="flex w-full items-center gap-2 rounded-b-2xl px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <Settings className="h-3.5 w-3.5" />
                            Configure Providers & Models...
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
