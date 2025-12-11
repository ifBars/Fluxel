import { ReactNode } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { getReactIconsFileIcon } from './packs/reactIconsPack';
import { getLucideFileIcon } from './packs/lucidePack';
import { getReactFileIcon, getExuanboFileIcon, getMaterialFileIcon } from './packs/others';

export function useFileIcon(name: string, extension: string): ReactNode {
    const { iconPack } = useSettingsStore();

    switch (iconPack) {
        case 'lucide':
            return getLucideFileIcon(name, extension);
        case 'react-file-icon':
            return getReactFileIcon(extension);
        case 'exuanbo':
            return getExuanboFileIcon(name);
        case 'material':
            return getMaterialFileIcon(name);
        case 'react-icons':
        default:
            return getReactIconsFileIcon(name, extension);
    }
}
