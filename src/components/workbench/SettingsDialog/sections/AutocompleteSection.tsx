import { useState } from "react";
import { Check, ExternalLink, Sparkles } from "lucide-react";

import type { SettingsState } from "@/stores";
import { RECOMMENDED_MODELS } from "@/lib/ollama";

export function AutocompleteSection({ settings }: { settings: SettingsState }) {
  const [customModel, setCustomModel] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleModelChange = (modelId: string) => {
    if (modelId === "custom") {
      setShowCustomInput(true);
    } else {
      setShowCustomInput(false);
      settings.setAutocompleteModel(modelId);
    }
  };

  const handleCustomModelSubmit = () => {
    if (customModel.trim()) {
      settings.setAutocompleteModel(customModel.trim());
      setShowCustomInput(false);
    }
  };

  const isCustomModel = !RECOMMENDED_MODELS.some(
    (m) => m.id === settings.autocompleteModel,
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">AI Autocomplete</h3>
        <p className="text-sm text-muted-foreground">
          Configure AI-powered code suggestions using Ollama
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <Sparkles size={16} />
            Enable AI Autocomplete
          </label>
          <span className="text-xs text-muted-foreground">
            Show inline suggestions as you type
          </span>
        </div>
        <button
          onClick={() =>
            settings.setAutocompleteEnabled(!settings.autocompleteEnabled)
          }
          className={`w-11 h-6 rounded-full transition-colors relative ${
            settings.autocompleteEnabled ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
              settings.autocompleteEnabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Model</label>
        <div className="space-y-2">
          {RECOMMENDED_MODELS.map((model) => (
            <button
              key={model.id}
              onClick={() => handleModelChange(model.id)}
              className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
                settings.autocompleteModel === model.id && !showCustomInput
                  ? "border-primary bg-primary/10 ring-1 ring-primary"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">{model.name}</span>
                <span className="text-xs text-muted-foreground">
                  {model.description}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">
                  {model.vram}
                </span>
                {settings.autocompleteModel === model.id && !showCustomInput && (
                  <Check size={14} className="text-primary" />
                )}
              </div>
            </button>
          ))}

          <button
            onClick={() => handleModelChange("custom")}
            className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
              showCustomInput || isCustomModel
                ? "border-primary bg-primary/10 ring-1 ring-primary"
                : "border-border hover:bg-muted/50"
            }`}
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">Custom Model</span>
              <span className="text-xs text-muted-foreground">
                {isCustomModel && !showCustomInput
                  ? settings.autocompleteModel
                  : "Enter a custom Ollama model name"}
              </span>
            </div>
            {(showCustomInput || isCustomModel) && (
              <Check size={14} className="text-primary" />
            )}
          </button>

          {showCustomInput && (
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="e.g., llama3.2:3b"
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                onKeyDown={(e) => e.key === "Enter" && handleCustomModelSubmit()}
              />
              <button
                onClick={handleCustomModelSubmit}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">
          Ollama Endpoint
        </label>
        <input
          type="text"
          value={settings.autocompleteEndpoint}
          onChange={(e) => settings.setAutocompleteEndpoint(e.target.value)}
          placeholder="http://localhost:11434"
          className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Default: http://localhost:11434
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between">
          <label className="text-sm font-medium text-foreground">
            Suggestion Delay
          </label>
          <span className="text-sm font-mono">
            {settings.autocompleteDebounceMs}ms
          </span>
        </div>
        <input
          type="range"
          min={100}
          max={1000}
          step={50}
          value={settings.autocompleteDebounceMs}
          onChange={(e) =>
            settings.setAutocompleteDebounceMs(parseInt(e.target.value))
          }
          className="w-full accent-primary h-2 bg-muted rounded-lg appearance-none cursor-pointer"
        />
        <p className="text-xs text-muted-foreground">
          Wait time before requesting suggestions. Lower = faster, but more API
          calls.
        </p>
      </div>

      <div className="p-4 rounded-lg border border-border bg-muted/30">
        <div className="flex items-start gap-3">
          <Sparkles size={20} className="text-primary shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm font-medium">Requires Ollama</p>
            <p className="text-xs text-muted-foreground">
              Autocomplete uses Ollama to run AI models locally on your machine.
              Make sure Ollama is installed and the selected model is pulled.
            </p>
            <a
              href="https://ollama.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Install Ollama <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
