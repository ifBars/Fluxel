/**
 * Provider Factory and Exports
 * Central entry point for all AI provider implementations
 */

export * from './types';

import type { AgentProvider, ProviderType } from './types';
import { ollamaProvider } from './ollamaProvider';
import { minimaxProvider } from './minimaxProvider';

/**
 * Map of provider type to implementation
 */
const providers: Record<ProviderType, AgentProvider> = {
    ollama: ollamaProvider,
    minimax: minimaxProvider,
};

/**
 * Get the provider implementation for a given type
 * Open/Closed Principle: Add new providers by adding to the map, not modifying this function
 */
export function getProvider(type: ProviderType): AgentProvider {
    const provider = providers[type];
    if (!provider) {
        throw new Error(`Unknown provider type: ${type}`);
    }
    return provider;
}

/**
 * Check if a provider type is valid
 */
export function isValidProvider(type: string): type is ProviderType {
    return type in providers;
}

/**
 * Get all available provider types
 */
export function getAvailableProviders(): ProviderType[] {
    return Object.keys(providers) as ProviderType[];
}
