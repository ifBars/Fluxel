import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ConfigMetadata } from '@/lib/config/schemas/metadata-types';

interface ConfigMetadataState {
    /** Map of project root paths to their config metadata */
    metadataByProject: Record<string, ConfigMetadata>;

    /** Get metadata for a project */
    getMetadata: (projectRoot: string) => ConfigMetadata | null;

    /** Set metadata for a project */
    setMetadata: (projectRoot: string, metadata: ConfigMetadata) => void;

    /** Clear metadata for a project */
    clearMetadata: (projectRoot: string) => void;

    /** Clear all metadata */
    clearAllMetadata: () => void;
}

export const useConfigMetadataStore = create<ConfigMetadataState>()(
    persist(
        (set, get) => ({
            metadataByProject: {},

            getMetadata: (projectRoot: string) => {
                const normalized = projectRoot.replace(/\\/g, '/');
                return get().metadataByProject[normalized] ?? null;
            },

            setMetadata: (projectRoot: string, metadata: ConfigMetadata) => {
                const normalized = projectRoot.replace(/\\/g, '/');
                set((state) => ({
                    metadataByProject: {
                        ...state.metadataByProject,
                        [normalized]: metadata,
                    },
                }));
            },

            clearMetadata: (projectRoot: string) => {
                const normalized = projectRoot.replace(/\\/g, '/');
                set((state) => {
                    const { [normalized]: _, ...rest } = state.metadataByProject;
                    return { metadataByProject: rest };
                });
            },

            clearAllMetadata: () => {
                set({ metadataByProject: {} });
            },
        }),
        {
            name: 'fluxel-config-metadata-store',
        }
    )
);

