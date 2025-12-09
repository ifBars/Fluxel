/**
 * Configuration system public API
 *
 * Re-exports all public functions and types from the config system
 */

export { loadConfigMetadata, getConfigMetadata } from './loader';
export { parseViteConfig } from './parsers/vite';
export { useConfigMetadataStore } from '@/stores/useConfigMetadataStore';

// Re-export types and constants
export type {
    ConfigMetadata,
    ConfigResult,
    DevServerConfig,
    HmrConfig,
    BuildConfig,
    TauriConfig,
    WindowConfig,
    ProjectInfo,
    PathAliases,
    DependencyInfo,
} from './schemas/metadata-types';

export {
    CONFIG_FILE_PATHS,
    DEFAULT_PORTS,
    DEFAULT_PROJECT,
    DEFAULT_WINDOW,
    DEFAULT_DEV_SERVER,
    DEFAULT_HMR,
    DEFAULT_BUILD,
    CONFIG_METADATA_VERSION,
} from './constants';

