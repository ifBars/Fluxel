/**
 * Configuration system constants and default values
 *
 * This file contains default values for the config metadata system,
 * including file paths, port numbers, and fallback configurations.
 */

/**
 * Configuration file paths (relative to project root)
 */
export const CONFIG_FILE_PATHS = {
  VITE: 'vite.config.ts',
  VITE_JS: 'vite.config.js',
  TAURI: 'src-tauri/tauri.conf.json',
  PACKAGE: 'package.json',
  TSCONFIG: 'tsconfig.json',
} as const;

/**
 * Default port numbers for development
 */
export const DEFAULT_PORTS = {
  DEV_SERVER: 1420,
  HMR: 1421,
} as const;

/**
 * Default project information
 */
export const DEFAULT_PROJECT = {
  NAME: 'fluxel',
  VERSION: '0.1.0',
  DESCRIPTION: 'A Tauri desktop application',
} as const;

/**
 * Default window configuration
 */
export const DEFAULT_WINDOW = {
  TITLE: 'Fluxel',
  WIDTH: 1280,
  HEIGHT: 800,
  MIN_WIDTH: 800,
  MIN_HEIGHT: 600,
  DECORATIONS: false,
  TRANSPARENT: true,
} as const;

/**
 * Default dev server configuration
 */
export const DEFAULT_DEV_SERVER = {
  HOST: 'localhost',
  PORT: DEFAULT_PORTS.DEV_SERVER,
  STRICT_PORT: true,
  CLEAR_SCREEN: false,
} as const;

/**
 * Default HMR configuration
 */
export const DEFAULT_HMR = {
  ENABLED: true,
  PORT: DEFAULT_PORTS.HMR,
  PROTOCOL: 'ws',
} as const;

/**
 * Default build configuration
 */
export const DEFAULT_BUILD = {
  DIST_DIR: 'dist',
  FRONTEND_DIST: '../dist',
  BUNDLE_ACTIVE: true,
  BUNDLE_TARGETS: 'all',
} as const;

/**
 * Supported package managers
 */
export const PACKAGE_MANAGERS = ['bun', 'npm', 'yarn', 'pnpm'] as const;

/**
 * Default package manager
 */
export const DEFAULT_PACKAGE_MANAGER = 'bun' as const;

/**
 * Supported frameworks (extensible for future use)
 */
export const SUPPORTED_FRAMEWORKS = [
  'react',
  'vue',
  'svelte',
  'solid',
  'preact',
  'vanilla',
] as const;

/**
 * Default framework
 */
export const DEFAULT_FRAMEWORK = 'react' as const;

/**
 * Config metadata version for schema evolution
 */
export const CONFIG_METADATA_VERSION = '1.0.0' as const;
