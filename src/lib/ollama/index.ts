/**
 * Ollama integration for code autocomplete
 * Provides GitHub Copilot-style inline suggestions using local LLMs
 */

export {
    // Client
    generateCompletion,
    generateCompletionSync,
    checkOllamaHealth,
    getAvailableModels,
    DEFAULT_CONFIG,
    type OllamaConfig,
    type FIMRequest,
} from "./ollamaClient";

export {
    // Provider
    createInlineCompletionProvider,
    registerInlineCompletionProvider,
    DEFAULT_PROVIDER_CONFIG,
    type InlineCompletionProviderConfig,
} from "./inlineCompletionProvider";

/**
 * Recommended models for code autocomplete
 * Ordered by speed/quality tradeoff
 */
export const RECOMMENDED_MODELS = [
    {
        id: "qwen2.5-coder:1.5b",
        name: "Qwen 2.5 Coder 1.5B",
        description: "Fast & lightweight, great for autocomplete",
        vram: "~1GB",
    },
    {
        id: "qwen2.5-coder:3b",
        name: "Qwen 2.5 Coder 3B",
        description: "Better quality, slower output",
        vram: "~2GB",
    },
    {
        id: "ministral-3:3b",
        name: "Ministral 3 3B",
        description: "Good quality, slower output",
        vram: "~3GB",
    },
    {
        id: "gemma3:1b",
        name: "Gemma3 1B",
        description: "Very lightweight option",
        vram: "~0.8GB",
    },
    {
        id: "qwen3:1.7b",
        name: "Qwen3 1.7B",
        description: "Decent option",
        vram: "~1.4GB",
    },
    {
        id: "deepseek-coder:1.3b",
        name: "DeepSeek Coder 1.3B",
        description: "Very lightweight option",
        vram: "~1GB",
    },
    {
        id: "starcoder2:3b",
        name: "Starcoder2 3B",
        description: "Community favorite for autocomplete",
        vram: "~3GB",
    },
] as const;

export type RecommendedModelId = typeof RECOMMENDED_MODELS[number]["id"];
