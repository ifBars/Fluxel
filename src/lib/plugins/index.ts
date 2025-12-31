/**
 * Fluxel Plugin System - Public API
 * 
 * This module exports the plugin system's public interface for extending
 * Fluxel with additional language support, tools, and integrations.
 * 
 * ## Overview
 * 
 * The plugin system supports two types of plugins:
 * - **Core plugins**: Bundled at build time (e.g., S1API support)
 * - **Community plugins**: Loaded from ~/.fluxel/plugins/ at runtime
 * 
 * ## Key Components
 * 
 * - `PluginHost`: Central manager for plugin lifecycle
 * - `PluginLoader`: Handles loading core and community plugins
 * - `PluginContext`: API surface provided to plugins during activation
 * 
 * ## Usage
 * 
 * For React components, use the `usePlugins` hook from `@/hooks/usePlugins`.
 * 
 * @module plugins
 */

// Types - Core interfaces for plugin development
export * from './types';

// Plugin Host - Manages plugin lifecycle and activation
export { PluginHost, getPluginHost } from './PluginHost';

// Plugin Loader - Handles static and dynamic plugin loading
export { PluginLoader, getPluginLoader, getCommunityPluginsPath } from './PluginLoader';
export type { CommunityPluginMeta } from './PluginLoader';

// Plugin Context - API provided to plugins during activation
export { createPluginContext, disposePluginContext } from './PluginContext';

