import { ReactNode, useState, useEffect } from 'react';
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

export function useFileIcon(name: string, extension: string): ReactNode {
    const { iconPack } = useSettingsStore();
    const [icon, setIcon] = useState<ReactNode>(
        <span className="inline-block w-4 h-4 bg-muted-foreground/20 rounded" />
    );

    useEffect(() => {
        const packKey = iconPack in iconPackLoaders ? iconPack : 'material-design';

        // Check if already loaded from cache
        if (loadedPacks.has(packKey)) {
            const getIcon = loadedPacks.get(packKey)!;
            const result = callIconFunction(packKey, getIcon, name, extension);
            setIcon(result);
            return;
        }

        // Load the pack asynchronously
        const loader = iconPackLoaders[packKey as keyof typeof iconPackLoaders];
        if (loader) {
            loader().then(getIcon => {
                loadedPacks.set(packKey, getIcon);
                const result = callIconFunction(packKey, getIcon, name, extension);
                setIcon(result);
            });
        }
    }, [iconPack, name, extension]);

    return icon;
}
