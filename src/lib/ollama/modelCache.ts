/**
 * Cache for AI models with TTL support
 * Reduces network requests and improves initial load performance
 */

const CACHE_KEY = 'fluxel:ai_models';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CachedModels {
    models: string[];
    timestamp: number;
}

/**
 * Get cached models if still valid
 */
export function getCachedModels(): string[] | null {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return null;

        const data: CachedModels = JSON.parse(cached);
        const age = Date.now() - data.timestamp;

        if (age > CACHE_TTL_MS) {
            // Cache expired, remove it
            localStorage.removeItem(CACHE_KEY);
            return null;
        }

        return data.models;
    } catch (e) {
        console.warn('[ModelCache] Failed to read cache:', e);
        return null;
    }
}

/**
 * Cache models with current timestamp
 */
export function setCachedModels(models: string[]): void {
    try {
        const data: CachedModels = {
            models,
            timestamp: Date.now(),
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('[ModelCache] Failed to write cache:', e);
    }
}

/**
 * Clear the cache
 */
export function clearCache(): void {
    try {
        localStorage.removeItem(CACHE_KEY);
    } catch (e) {
        console.warn('[ModelCache] Failed to clear cache:', e);
    }
}

/**
 * Check if cache exists and is valid
 */
export function hasValidCache(): boolean {
    return getCachedModels() !== null;
}

