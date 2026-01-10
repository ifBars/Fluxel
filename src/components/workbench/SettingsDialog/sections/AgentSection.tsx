import { useState } from "react";
import { useAgentStore } from "@/stores";
import { Eye, EyeOff, Plug, RefreshCw, AlertCircle } from "lucide-react";

export function AgentSection() {
    const {
        providerConfigs,
        models,
        updateProviderConfig,
        toggleModelEnabled,
        fetchModels,
    } = useAgentStore();

    // Local state for API key visibility
    const [showKey, setShowKey] = useState<Record<string, boolean>>({});

    const toggleShowKey = (id: string) => {
        setShowKey(prev => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-1">Agent Settings</h3>
                <p className="text-sm text-muted-foreground">
                    Configure AI providers and manage available models.
                </p>
            </div>

            {/* Providers Configuration */}
            <div className="space-y-4">
                <h4 className="text-sm font-medium text-foreground/80 uppercase tracking-wider">Providers</h4>
                <div className="grid gap-4">
                    {/* Ollama Card */}
                    <div className="bg-muted/20 border border-border rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-orange-500/10 rounded-md">
                                    <Plug className="w-4 h-4 text-orange-500" />
                                </div>
                                <div>
                                    <div className="font-medium">Ollama</div>
                                    <div className="text-xs text-muted-foreground">Local LLM runner</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 text-green-500 rounded text-xs font-medium">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                    Active
                                </div>
                            </div>
                        </div>

                        <div className="text-sm text-muted-foreground">
                            Ollama runs locally on port 11434. No API key required.
                        </div>
                    </div>

                    {/* MiniMax Card */}
                    <div className="bg-muted/20 border border-border rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-blue-500/10 rounded-md">
                                    <Plug className="w-4 h-4 text-blue-500" />
                                </div>
                                <div>
                                    <div className="font-medium">MiniMax</div>
                                    <div className="text-xs text-muted-foreground">Cloud Provider</div>
                                </div>
                            </div>
                            <button
                                onClick={() => updateProviderConfig('minimax', { enabled: !providerConfigs.minimax?.enabled })}
                                className={`w-9 h-5 rounded-full relative transition-colors ${providerConfigs.minimax?.enabled ? "bg-primary" : "bg-muted"
                                    }`}
                            >
                                <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform ${providerConfigs.minimax?.enabled ? "translate-x-4" : ""
                                    }`} />
                            </button>
                        </div>

                        {providerConfigs.minimax?.enabled && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                <label className="text-xs font-medium">API Key</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type={showKey['minimax'] ? "text" : "password"}
                                            value={providerConfigs.minimax?.apiKey || ""}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                updateProviderConfig('minimax', { apiKey: val });
                                            }}
                                            className="w-full h-9 bg-background border border-border rounded-md px-3 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                            placeholder="sk-..."
                                        />
                                        <button
                                            onClick={() => toggleShowKey('minimax')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showKey['minimax'] ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Model Management */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-foreground/80 uppercase tracking-wider">Models</h4>
                    <button
                        onClick={() => fetchModels()}
                        className="text-xs flex items-center gap-1.5 text-primary hover:underline"
                    >
                        <RefreshCw size={12} />
                        Refresh List
                    </button>
                </div>

                <div className="bg-card border border-border rounded-lg overflow-hidden">
                    {models.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                            <AlertCircle className="w-8 h-8 opacity-50" />
                            No models found. Make sure providers are configured and running.
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {models.map(model => (
                                <div key={model.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">{model.name}</span>
                                        <span className="text-xs text-muted-foreground capitalize">{model.providerId}</span>
                                    </div>
                                    <button
                                        onClick={() => toggleModelEnabled(model.id, !model.enabled)}
                                        className={`w-9 h-5 rounded-full relative transition-colors ${model.enabled ? "bg-primary" : "bg-muted"
                                            }`}
                                    >
                                        <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform ${model.enabled ? "translate-x-4" : ""
                                            }`} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
