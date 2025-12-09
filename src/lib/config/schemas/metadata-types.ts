/**
 * TypeScript type definitions for the config metadata system
 *
 * This file contains all TypeScript interfaces and types used throughout
 * the config metadata system. These types provide compile-time safety
 * and IDE autocomplete support.
 */

import type {
  PACKAGE_MANAGERS,
  SUPPORTED_FRAMEWORKS,
} from '../constants';

/**
 * Supported package managers
 */
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

/**
 * Supported frontend frameworks
 */
export type Framework = (typeof SUPPORTED_FRAMEWORKS)[number];

/**
 * HMR protocol types
 */
export type HmrProtocol = 'ws' | 'wss';

/**
 * Development server configuration
 */
export interface DevServerConfig {
  /**
   * Server host address (e.g., "localhost", "0.0.0.0")
   */
  host: string;

  /**
   * Server port number
   */
  port: number;

  /**
   * Whether to fail if the port is not available
   */
  strictPort: boolean;

  /**
   * Whether to clear the console on restart
   */
  clearScreen: boolean;

  /**
   * Whether HTTPS is enabled
   */
  https?: boolean;

  /**
   * Open browser on server start
   */
  open?: boolean;
}

/**
 * Hot Module Replacement (HMR) configuration
 */
export interface HmrConfig {
  /**
   * Whether HMR is enabled
   */
  enabled: boolean;

  /**
   * HMR server port
   */
  port: number;

  /**
   * HMR protocol (ws or wss)
   */
  protocol: HmrProtocol;

  /**
   * HMR host (defaults to dev server host)
   */
  host?: string;

  /**
   * HMR client path
   */
  clientPath?: string;
}

/**
 * Window configuration from Tauri
 */
export interface WindowConfig {
  /**
   * Window title
   */
  title: string;

  /**
   * Default window width in pixels
   */
  width: number;

  /**
   * Default window height in pixels
   */
  height: number;

  /**
   * Minimum window width in pixels
   */
  minWidth?: number;

  /**
   * Minimum window height in pixels
   */
  minHeight?: number;

  /**
   * Maximum window width in pixels
   */
  maxWidth?: number;

  /**
   * Maximum window height in pixels
   */
  maxHeight?: number;

  /**
   * Whether window decorations (title bar, borders) are enabled
   */
  decorations: boolean;

  /**
   * Whether the window is transparent
   */
  transparent: boolean;

  /**
   * Whether the window is resizable
   */
  resizable?: boolean;

  /**
   * Whether the window is fullscreen
   */
  fullscreen?: boolean;

  /**
   * Whether the window is always on top
   */
  alwaysOnTop?: boolean;
}

/**
 * Tauri application configuration
 */
export interface TauriConfig {
  /**
   * Product name
   */
  productName: string;

  /**
   * Application version
   */
  version: string;

  /**
   * Application identifier (bundle ID)
   */
  identifier: string;

  /**
   * Command to run before dev
   */
  beforeDevCommand: string;

  /**
   * Command to run before build
   */
  beforeBuildCommand: string;

  /**
   * Development server URL
   */
  devUrl: string;

  /**
   * Frontend distribution directory (relative to src-tauri)
   */
  frontendDist: string;

  /**
   * Window configuration
   */
  window: WindowConfig;

  /**
   * Bundle configuration
   */
  bundle?: {
    active: boolean;
    targets: string;
    icon?: string[];
  };
}

/**
 * Build configuration
 */
export interface BuildConfig {
  /**
   * Output directory for built files
   */
  outDir: string;

  /**
   * Build target (e.g., "esnext", "es2020")
   */
  target?: string;

  /**
   * Whether to minify the output
   */
  minify?: boolean;

  /**
   * Whether to generate sourcemaps
   */
  sourcemap?: boolean;

  /**
   * Whether to emit declaration files
   */
  emitDeclaration?: boolean;
}

/**
 * Package.json dependency information
 */
export interface DependencyInfo {
  /**
   * Production dependencies
   */
  dependencies: Record<string, string>;

  /**
   * Development dependencies
   */
  devDependencies: Record<string, string>;

  /**
   * Peer dependencies
   */
  peerDependencies?: Record<string, string>;
}

/**
 * Project information from package.json
 */
export interface ProjectInfo {
  /**
   * Project name
   */
  name: string;

  /**
   * Project version
   */
  version: string;

  /**
   * Project description
   */
  description?: string;

  /**
   * Whether the package is private
   */
  private?: boolean;

  /**
   * Module type (module or commonjs)
   */
  type?: 'module' | 'commonjs';

  /**
   * License identifier
   */
  license?: string;

  /**
   * Author information
   */
  author?: string;
}

/**
 * Path alias configuration from tsconfig.json
 */
export interface PathAliases {
  /**
   * Base URL for path resolution
   */
  baseUrl?: string;

  /**
   * Path mappings (e.g., { "@/*": ["./src/*"] })
   */
  paths?: Record<string, string[]>;
}

/**
 * Complete configuration metadata for the project
 *
 * This is the main interface that aggregates all configuration
 * information from various config files (vite, tauri, package.json, etc.)
 */
export interface ConfigMetadata {
  /**
   * Metadata schema version for future compatibility
   */
  version: string;

  /**
   * Timestamp of when the metadata was last updated
   */
  lastUpdated: string;

  /**
   * Project information from package.json
   */
  project: ProjectInfo;

  /**
   * Frontend framework detected
   */
  framework: Framework;

  /**
   * Package manager being used
   */
  packageManager: PackageManager;

  /**
   * Development server configuration
   */
  devServer: DevServerConfig;

  /**
   * HMR configuration
   */
  hmr: HmrConfig;

  /**
   * Tauri configuration
   */
  tauri: TauriConfig;

  /**
   * Build configuration
   */
  build: BuildConfig;

  /**
   * TypeScript path aliases
   */
  pathAliases?: PathAliases;

  /**
   * Installed dependencies
   */
  dependencies?: DependencyInfo;

  /**
   * Scripts from package.json
   */
  scripts?: Record<string, string>;

  /**
   * Whether the project uses TypeScript
   */
  isTypeScript?: boolean;

  /**
   * Additional metadata for extensibility
   */
  custom?: Record<string, unknown>;
}

/**
 * Result type for config operations
 */
export type ConfigResult<T> =
  | { success: true; data: T; errors?: never }
  | { success: false; data?: never; errors: string[] };

/**
 * Config file parse result
 */
export interface ConfigFileResult<T> {
  filePath: string;
  exists: boolean;
  isValid: boolean;
  data?: T;
  errors?: string[];
}
