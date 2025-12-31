/**
 * S1API Plugin
 * 
 * Provides comprehensive support for S1API mod development in Fluxel.
 * S1API is a modular, developer-friendly API for building mods for Schedule One.
 * 
 * ## Features
 * 
 * - **Syntax highlighting**: S1API-specific patterns (PhoneApp, Saveables, UIFactory)
 * - **IntelliSense**: Completions for S1API classes, methods, and patterns
 * - **Hover documentation**: Links to official S1API docs
 * - **Project detection**: Auto-detect S1API/MelonLoader projects
 * 
 * ## Activation
 * 
 * This plugin activates on:
 * - `onLanguage:csharp` - When a C# file is opened
 * - `onProject:s1api` - When an S1API project is detected
 * 
 * @see https://ifbars.github.io/S1API/docs/ - Official S1API Documentation
 * @module plugins/s1api
 */

import type { FluxelPlugin, PluginContext } from '@/lib/plugins/types';

import { S1API_PLUGIN_MANIFEST } from './manifest';
import { s1apiProjectDetector } from './detector';
import { registerS1APISyntax } from './syntax';
import { registerS1APIIntelliSense } from './intellisense';
import { registerS1APIHover } from './hover';

/**
 * S1API Plugin Implementation
 * 
 * Core plugin that provides S1API mod development support in Fluxel.
 */
export const S1APIPlugin: FluxelPlugin = {
    ...S1API_PLUGIN_MANIFEST,

    async activate(context: PluginContext): Promise<void> {
        context.log('Activating S1API plugin...');

        // Register project detector for S1API/MelonLoader mods
        context.registerProjectDetector(s1apiProjectDetector);
        context.log('Project detector registered');

        // Register syntax highlighting for S1API patterns
        registerS1APISyntax(context);

        // Register IntelliSense / completion provider
        registerS1APIIntelliSense(context);

        // Register hover documentation provider with S1API docs links
        registerS1APIHover(context);

        context.log('S1API plugin activated successfully');
    },

    async deactivate(): Promise<void> {
        console.log('[S1API Plugin] Deactivating...');
        // NOTE: Cleanup is handled automatically by context.subscriptions
    },
};

// Re-export sub-modules for standalone use
export { S1API_PLUGIN_MANIFEST } from './manifest';
export { s1apiProjectDetector } from './detector';
export { registerS1APISyntax, s1apiSyntaxRules, s1apiTokenColors } from './syntax';
export { registerS1APIIntelliSense, createS1APICompletionProvider } from './intellisense';
export { registerS1APIHover, createS1APIHoverProvider } from './hover';

// Default export for ESM imports
export default S1APIPlugin;

