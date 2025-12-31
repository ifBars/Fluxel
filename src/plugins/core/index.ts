/**
 * Core Plugins Registry
 * 
 * This module registers all bundled (core) plugins that are included
 * in the Fluxel build. Core plugins are always available and do not
 * require user installation.
 * 
 * ## Adding New Core Plugins
 * 
 * 1. Create the plugin in `src/plugins/{plugin-name}/`
 * 2. Import and register it in `registerCorePlugins()`
 * 3. Add the plugin ID to `CORE_PLUGIN_IDS`
 * 
 * @module plugins/core
 */

import { getPluginLoader } from '@/lib/plugins';

import { S1APIPlugin } from '../s1api';

/**
 * Register all core plugins with the plugin loader
 * 
 * This function should be called once during app initialization,
 * after the plugin host has been initialized with Monaco.
 */
export function registerCorePlugins(): void {
    const loader = getPluginLoader();

    // Register S1API plugin for MelonLoader mod development
    loader.registerCorePlugin(S1APIPlugin);

    // TODO: Add more core plugins here as they are developed
    // loader.registerCorePlugin(TauriPlugin);
    // loader.registerCorePlugin(ReactPlugin);

    console.log('[CorePlugins] All core plugins registered');
}

/**
 * List of all core plugin IDs for type-safe references
 */
export const CORE_PLUGIN_IDS = [
    'fluxel.s1api',
] as const;

/**
 * Type representing valid core plugin IDs
 */
export type CorePluginId = typeof CORE_PLUGIN_IDS[number];

