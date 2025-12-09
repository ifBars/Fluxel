/**
 * Zod validation schemas for the config metadata system
 *
 * This file contains Zod schemas that provide runtime validation
 * for all configuration data. These schemas match the TypeScript
 * interfaces defined in metadata-types.ts.
 */

import { z } from 'zod';
import {
  DEFAULT_PROJECT,
  DEFAULT_WINDOW,
  DEFAULT_DEV_SERVER,
  DEFAULT_HMR,
  DEFAULT_BUILD,
  DEFAULT_PACKAGE_MANAGER,
  DEFAULT_FRAMEWORK,
  CONFIG_METADATA_VERSION,
  PACKAGE_MANAGERS,
  SUPPORTED_FRAMEWORKS,
} from '../constants';

/**
 * Package manager schema
 */
export const packageManagerSchema = z.enum(PACKAGE_MANAGERS);

/**
 * Framework schema
 */
export const frameworkSchema = z.enum(SUPPORTED_FRAMEWORKS);

/**
 * HMR protocol schema
 */
export const hmrProtocolSchema = z.enum(['ws', 'wss']);

/**
 * Port number validation helper
 */
const portSchema = z
  .number()
  .int()
  .positive()
  .min(1)
  .max(65535)
  .describe('Port number (1-65535)');

/**
 * Development server configuration schema
 */
export const devServerConfigSchema = z.object({
  host: z.string().min(1).default(DEFAULT_DEV_SERVER.HOST),
  port: portSchema.default(DEFAULT_DEV_SERVER.PORT),
  strictPort: z.boolean().default(DEFAULT_DEV_SERVER.STRICT_PORT),
  clearScreen: z.boolean().default(DEFAULT_DEV_SERVER.CLEAR_SCREEN),
  https: z.boolean().optional(),
  open: z.boolean().optional(),
});

/**
 * HMR configuration schema
 */
export const hmrConfigSchema = z.object({
  enabled: z.boolean().default(DEFAULT_HMR.ENABLED),
  port: portSchema.default(DEFAULT_HMR.PORT),
  protocol: hmrProtocolSchema.default(DEFAULT_HMR.PROTOCOL),
  host: z.string().optional(),
  clientPath: z.string().optional(),
});

/**
 * Window configuration schema
 */
export const windowConfigSchema = z.object({
  title: z.string().min(1).default(DEFAULT_WINDOW.TITLE),
  width: z.number().int().positive().default(DEFAULT_WINDOW.WIDTH),
  height: z.number().int().positive().default(DEFAULT_WINDOW.HEIGHT),
  minWidth: z.number().int().positive().optional(),
  minHeight: z.number().int().positive().optional(),
  maxWidth: z.number().int().positive().optional(),
  maxHeight: z.number().int().positive().optional(),
  decorations: z.boolean().default(DEFAULT_WINDOW.DECORATIONS),
  transparent: z.boolean().default(DEFAULT_WINDOW.TRANSPARENT),
  resizable: z.boolean().optional(),
  fullscreen: z.boolean().optional(),
  alwaysOnTop: z.boolean().optional(),
});

/**
 * Tauri bundle configuration schema
 */
export const tauriBundleConfigSchema = z.object({
  active: z.boolean().default(DEFAULT_BUILD.BUNDLE_ACTIVE),
  targets: z.string().default(DEFAULT_BUILD.BUNDLE_TARGETS),
  icon: z.array(z.string()).optional(),
});

/**
 * Tauri configuration schema
 */
export const tauriConfigSchema = z.object({
  productName: z.string().min(1).default(DEFAULT_PROJECT.NAME),
  version: z.string().min(1).default(DEFAULT_PROJECT.VERSION),
  identifier: z.string().min(1).default(`com.tauri.${DEFAULT_PROJECT.NAME}`),
  beforeDevCommand: z.string().min(1),
  beforeBuildCommand: z.string().min(1),
  devUrl: z.string().url(),
  frontendDist: z.string().min(1).default(DEFAULT_BUILD.FRONTEND_DIST),
  window: windowConfigSchema,
  bundle: tauriBundleConfigSchema.optional(),
});

/**
 * Build configuration schema
 */
export const buildConfigSchema = z.object({
  outDir: z.string().min(1).default(DEFAULT_BUILD.DIST_DIR),
  target: z.string().optional(),
  minify: z.boolean().optional(),
  sourcemap: z.boolean().optional(),
  emitDeclaration: z.boolean().optional(),
});

/**
 * Dependency information schema
 */
export const dependencyInfoSchema = z.object({
  dependencies: z.record(z.string(), z.string()).default({}),
  devDependencies: z.record(z.string(), z.string()).default({}),
  peerDependencies: z.record(z.string(), z.string()).optional(),
});

/**
 * Path aliases schema
 */
export const pathAliasesSchema = z.object({
  baseUrl: z.string().optional(),
  paths: z.record(z.string(), z.array(z.string())).optional(),
});

/**
 * Project information schema
 */
export const projectInfoSchema = z.object({
  name: z.string().min(1).default(DEFAULT_PROJECT.NAME),
  version: z.string().min(1).default(DEFAULT_PROJECT.VERSION),
  description: z.string().optional(),
  private: z.boolean().optional(),
  type: z.enum(['module', 'commonjs']).optional(),
  license: z.string().optional(),
  author: z.string().optional(),
});

/**
 * Main configuration metadata schema
 */
export const configMetadataSchema = z.object({
  version: z.string().default(CONFIG_METADATA_VERSION),
  lastUpdated: z.string().datetime(),
  project: projectInfoSchema,
  framework: frameworkSchema.default(DEFAULT_FRAMEWORK),
  packageManager: packageManagerSchema.default(DEFAULT_PACKAGE_MANAGER),
  devServer: devServerConfigSchema,
  hmr: hmrConfigSchema,
  tauri: tauriConfigSchema,
  build: buildConfigSchema,
  pathAliases: pathAliasesSchema.optional(),
  dependencies: dependencyInfoSchema.optional(),
  scripts: z.record(z.string(), z.string()).optional(),
  isTypeScript: z.boolean().optional(),
  custom: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Vite config schema (partial - only fields we need to extract)
 */
export const viteConfigSchema = z.object({
  server: z
    .object({
      port: portSchema.optional(),
      host: z.union([z.string(), z.boolean()]).optional(),
      strictPort: z.boolean().optional(),
      https: z.boolean().optional(),
      open: z.boolean().optional(),
      hmr: z
        .union([
          z.boolean(),
          z.object({
            protocol: hmrProtocolSchema.optional(),
            host: z.string().optional(),
            port: portSchema.optional(),
            clientPath: z.string().optional(),
          }),
        ])
        .optional(),
    })
    .optional(),
  build: z
    .object({
      outDir: z.string().optional(),
      target: z.string().optional(),
      minify: z.boolean().optional(),
      sourcemap: z.boolean().optional(),
    })
    .optional(),
  clearScreen: z.boolean().optional(),
});

/**
 * Package.json schema (partial - only fields we need)
 */
export const packageJsonSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  private: z.boolean().optional(),
  type: z.enum(['module', 'commonjs']).optional(),
  license: z.string().optional(),
  author: z.string().optional(),
  scripts: z.record(z.string(), z.string()).optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
  peerDependencies: z.record(z.string(), z.string()).optional(),
});

/**
 * Tauri config JSON schema (partial - only fields we need)
 */
export const tauriConfigJsonSchema = z.object({
  productName: z.string().optional(),
  version: z.string().optional(),
  identifier: z.string().optional(),
  build: z
    .object({
      beforeDevCommand: z.string().optional(),
      beforeBuildCommand: z.string().optional(),
      devUrl: z.string().optional(),
      frontendDist: z.string().optional(),
    })
    .optional(),
  app: z
    .object({
      windows: z
        .array(
          z.object({
            title: z.string().optional(),
            width: z.number().optional(),
            height: z.number().optional(),
            minWidth: z.number().optional(),
            minHeight: z.number().optional(),
            maxWidth: z.number().optional(),
            maxHeight: z.number().optional(),
            decorations: z.boolean().optional(),
            transparent: z.boolean().optional(),
            resizable: z.boolean().optional(),
            fullscreen: z.boolean().optional(),
            alwaysOnTop: z.boolean().optional(),
          })
        )
        .optional(),
    })
    .optional(),
  bundle: z
    .object({
      active: z.boolean().optional(),
      targets: z.string().optional(),
      icon: z.array(z.string()).optional(),
    })
    .optional(),
});

/**
 * TypeScript config schema (partial - only fields we need)
 */
export const tsConfigSchema = z.object({
  compilerOptions: z
    .object({
      baseUrl: z.string().optional(),
      paths: z.record(z.string(), z.array(z.string())).optional(),
      target: z.string().optional(),
      declaration: z.boolean().optional(),
      sourceMap: z.boolean().optional(),
    })
    .optional(),
});

// Type inference helpers - these create TypeScript types from the Zod schemas
export type DevServerConfig = z.infer<typeof devServerConfigSchema>;
export type HmrConfig = z.infer<typeof hmrConfigSchema>;
export type WindowConfig = z.infer<typeof windowConfigSchema>;
export type TauriConfig = z.infer<typeof tauriConfigSchema>;
export type BuildConfig = z.infer<typeof buildConfigSchema>;
export type DependencyInfo = z.infer<typeof dependencyInfoSchema>;
export type PathAliases = z.infer<typeof pathAliasesSchema>;
export type ProjectInfo = z.infer<typeof projectInfoSchema>;
export type ConfigMetadata = z.infer<typeof configMetadataSchema>;
export type ViteConfig = z.infer<typeof viteConfigSchema>;
export type PackageJson = z.infer<typeof packageJsonSchema>;
export type TauriConfigJson = z.infer<typeof tauriConfigJsonSchema>;
export type TsConfig = z.infer<typeof tsConfigSchema>;
export type PackageManager = z.infer<typeof packageManagerSchema>;
export type Framework = z.infer<typeof frameworkSchema>;
export type HmrProtocol = z.infer<typeof hmrProtocolSchema>;
