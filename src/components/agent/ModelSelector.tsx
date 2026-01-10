import { useState, useRef, useEffect } from 'react';
import { useAgentStore } from '@/stores/agent/useAgentStore';
import { Bot, Cloud, ChevronUp, Check, Settings } from 'lucide-react';
import type { ModelConfig } from '@/stores/agent/types';

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

    // Filter to only enabled models
    const enabledModels = models.filter((m: ModelConfig) => m.enabled);

    // Close on click outside
    useEffect(() => {
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/40 hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border"
                title="Change model"
            >
                <ProviderIcon className="w-3.5 h-3.5" />
                <span className="max-w-[120px] truncate">{model}</span>
                <ChevronUp className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute bottom-full mb-2 left-0 w-64 bg-popover border border-border rounded-lg shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 slide-in-from-bottom-2">
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/20 border-b border-border mb-1">
                        Select Model
                    </div>

                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar py-1">
                        {enabledModels.length > 0 ? (
                            enabledModels.map((m) => (
                                <button
                                    key={m.id}
                                    onClick={() => handleModelSelect(m.id)}
                                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-muted transition-colors ${model === m.id ? 'text-primary font-medium bg-primary/5' : 'text-foreground'
                                        }`}
                                >
                                    <span className="flex items-center gap-2">
                                        {m.providerId === 'minimax' ? (
                                            <Cloud className="w-3 h-3 text-muted-foreground" />
                                        ) : (
                                            <Bot className="w-3 h-3 text-muted-foreground" />
                                        )}
                                        <span className="truncate">{m.name}</span>
                                    </span>
                                    {model === m.id && <Check className="w-3 h-3 text-primary shrink-0 ml-2" />}
                                </button>
                            ))
                        ) : (
                            <div className="px-3 py-2 text-xs text-muted-foreground text-center italic">
                                No models available. Configure providers in settings.
                            </div>
                        )}
                    </div>

                    <div className="border-t border-border mt-1 pt-1">
                        <button
                            onClick={handleOpenSettings}
                            className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors rounded-b-lg"
                        >
                            <Settings className="w-3.5 h-3.5" />
                            Configure Providers & Models...
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
