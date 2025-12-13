import { ReactNode, useState, useEffect, useMemo } from 'react';
import { useSettingsStore } from '@/stores';

// Type definitions for different icon pack function signatures
type IconPackFn2Args = (name: string, extension: string) => ReactNode;
type IconPackFnExtOnly = (extension: string) => ReactNode;
type IconPackFnNameOnly = (name: string) => ReactNode;
type IconPackFn = IconPackFn2Args | IconPackFnExtOnly | IconPackFnNameOnly;

// Lazy-loaded icon pack modules to prevent eager loading of all react-icons
// This prevents "Cannot set properties of undefined" errors during app initialization
const iconPackLoaders = {
    'material-design': () => import('./packs/reactIconsPack').then(m => m.getReactIconsFileIcon),
    'feather': () => import('./packs/featherPack').then(m => m.getFeatherFileIcon),
    'heroicons': () => import('./packs/heroiconsPack').then(m => m.getHeroiconsFileIcon),
    'bootstrap': () => import('./packs/bootstrapPack').then(m => m.getBootstrapFileIcon),
    'tabler': () => import('./packs/tablerPack').then(m => m.getTablerFileIcon),
    'phosphor': () => import('./packs/phosphorPack').then(m => m.getPhosphorFileIcon),
    'lucide': () => import('./packs/lucidePack').then(m => m.getLucideFileIcon),
    'react-file-icon': () => import('./packs/others').then(m => m.getReactFileIcon),
    'exuanbo': () => import('./packs/others').then(m => m.getExuanboFileIcon),
    'material': () => import('./packs/others').then(m => m.getMaterialFileIcon),
} as const;

// Helper to call icon function with correct arguments based on pack type
function callIconFunction(packKey: string, getIcon: IconPackFn, name: string, extension: string): ReactNode {
    if (packKey === 'react-file-icon') {
        return (getIcon as IconPackFnExtOnly)(extension);
    } else if (packKey === 'exuanbo' || packKey === 'material') {
        return (getIcon as IconPackFnNameOnly)(name);
    } else {
        return (getIcon as IconPackFn2Args)(name, extension);
    }
}

// Cache for loaded icon pack functions to prevent re-loading
const loadedPacks = new Map<string, IconPackFn>();

// Cache for resolved icons to avoid re-computing for the same file+pack combination
// Key format: `${packKey}:${name}:${extension}`
const iconCache = new Map<string, ReactNode>();

// Default icon to show while loading
const defaultIcon = <span className="inline-block w-4 h-4 bg-muted-foreground/20 rounded" />;

/**
 * Optimized file icon hook that uses a centralized cache to avoid
 * creating state and effects for every single file in large directories.
 */
export function useFileIcon(name: string, extension: string): ReactNode {
    const iconPack = useSettingsStore((state) => state.iconPack);
    const [icon, setIcon] = useState<ReactNode>(() => {
        // Try to get from cache immediately on mount
        const packKey = iconPack in iconPackLoaders ? iconPack : 'material-design';
        const cacheKey = `${packKey}:${name}:${extension}`;
        return iconCache.get(cacheKey) || defaultIcon;
    });

    // Memoize the cache key to avoid unnecessary effect triggers
    const cacheKey = useMemo(() => {
        const packKey = iconPack in iconPackLoaders ? iconPack : 'material-design';
        return `${packKey}:${name}:${extension}`;
    }, [iconPack, name, extension]);

    useEffect(() => {
        const packKey = iconPack in iconPackLoaders ? iconPack : 'material-design';
        
        // Check icon cache first (most common case for large directories)
        if (iconCache.has(cacheKey)) {
            setIcon(iconCache.get(cacheKey)!);
            return;
        }

        // Check if pack is already loaded
        if (loadedPacks.has(packKey)) {
            const getIcon = loadedPacks.get(packKey)!;
            const result = callIconFunction(packKey, getIcon, name, extension);
            iconCache.set(cacheKey, result);
            setIcon(result);
            return;
        }

        // Load the pack asynchronously (least common case)
        const loader = iconPackLoaders[packKey as keyof typeof iconPackLoaders];
        if (loader) {
            loader().then(getIcon => {
                loadedPacks.set(packKey, getIcon);
                const result = callIconFunction(packKey, getIcon, name, extension);
                iconCache.set(cacheKey, result);
                setIcon(result);
            });
        }
    }, [cacheKey, iconPack, name, extension]);

    return icon;
}

/**
 * Preload icon pack to avoid lazy loading during rendering.
 * Call this early in the app lifecycle for better performance.
 */
export async function preloadIconPack(packKey: keyof typeof iconPackLoaders): Promise<void> {
    if (loadedPacks.has(packKey)) {
        return;
    }
    
    const loader = iconPackLoaders[packKey];
    if (loader) {
        const getIcon = await loader();
        loadedPacks.set(packKey, getIcon);
    }
}

/**
 * Clear icon cache. Useful when changing icon packs.
 */
export function clearIconCache(): void {
    iconCache.clear();
}
