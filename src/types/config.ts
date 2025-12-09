/**
 * Public-facing configuration types for the Fluxel application
 *
 * This file re-exports the configuration types that should be used
 * throughout the application. It provides a clean API surface and
 * centralizes type imports.
 */

// Core metadata types
export type {
  ConfigMetadata,
  DevServerConfig,
  HmrConfig,
  WindowConfig,
  TauriConfig,
  BuildConfig,
  DependencyInfo,
  PathAliases,
  ProjectInfo,
  PackageManager,
  Framework,
  HmrProtocol,
  ConfigResult,
  ConfigFileResult,
} from '@/lib/config/schemas/metadata-types';

// Zod schemas for validation
export {
  configMetadataSchema,
  devServerConfigSchema,
  hmrConfigSchema,
  windowConfigSchema,
  tauriConfigSchema,
  buildConfigSchema,
  dependencyInfoSchema,
  pathAliasesSchema,
  projectInfoSchema,
  packageManagerSchema,
  frameworkSchema,
  hmrProtocolSchema,
  viteConfigSchema,
  packageJsonSchema,
  tauriConfigJsonSchema,
  tsConfigSchema,
} from '@/lib/config/schemas/config-schema';

// Constants
export {
  CONFIG_FILE_PATHS,
  DEFAULT_PORTS,
  DEFAULT_PROJECT,
  DEFAULT_WINDOW,
  DEFAULT_DEV_SERVER,
  DEFAULT_HMR,
  DEFAULT_BUILD,
  PACKAGE_MANAGERS,
  DEFAULT_PACKAGE_MANAGER,
  SUPPORTED_FRAMEWORKS,
  DEFAULT_FRAMEWORK,
  CONFIG_METADATA_VERSION,
} from '@/lib/config/constants';
