/**
 * Plugins - Public API
 * 
 * This module provides access to all plugins and the plugin initialization system.
 */

// Core plugins registry
export { registerCorePlugins, CORE_PLUGIN_IDS } from './core';
export type { CorePluginId } from './core';

// S1API Plugin
export { S1APIPlugin } from './s1api';
export * from './s1api/manifest';

