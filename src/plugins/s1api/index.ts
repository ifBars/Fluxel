/**
 * Schedule 1 Modding Plugin
 *
 * Provides Schedule 1-specific modding support in Fluxel.
 * The plugin focuses on the Schedule 1 ecosystem libraries rather than generic
 * Unity or MelonLoader support.
 * 
 * ## Features
 * 
 * - **Syntax highlighting**: Schedule 1 API patterns across S1API, S1MAPI, and SteamNetworkLib
 * - **IntelliSense**: Completions for common Schedule 1 modding workflows
 * - **Hover documentation**: Quick docs for Schedule 1-specific libraries and patterns
 * - **Project detection**: Auto-detect Schedule 1 mod projects from their library stack
 * 
 * ## Activation
 * 
 * This plugin activates on:
 * - `onStartup` - Registers project detection early
 * - `onLanguage:csharp` - When a C# file is opened
 * - `onProject:schedule-one-mod` - When a Schedule 1 mod project is detected
 * 
 * @see https://ifbars.github.io/S1API/docs/ - S1API Documentation
 * @see https://ifbars.github.io/S1MAPI/ - S1MAPI Documentation
 * @module plugins/s1api
 */

import type { FluxelPlugin, PluginContext } from '@/lib/plugins/types';

import { S1API_PLUGIN_MANIFEST } from './manifest';
import { s1apiProjectDetector } from './detector';
import { registerS1APISyntax } from './syntax';
import { registerS1APIIntelliSense } from './intellisense';
import { registerS1APIHover } from './hover';
import { scheduleOneNewFileTemplates } from './newFileTemplates';

/**
 * Schedule 1 Modding Plugin Implementation
 *
 * Core plugin that provides Schedule 1-specific mod development support in Fluxel.
 */
export const S1APIPlugin: FluxelPlugin = {
    ...S1API_PLUGIN_MANIFEST,

    async activate(context: PluginContext): Promise<void> {
        context.log('Activating Schedule 1 modding plugin...');

        // Register project detector for Schedule 1 mod projects
        context.registerProjectDetector(s1apiProjectDetector);
        context.log('Project detector registered');

        // Register syntax highlighting for S1API patterns
        registerS1APISyntax(context);

        // Register IntelliSense / completion provider
        registerS1APIIntelliSense(context);

        // Register hover documentation provider with S1API docs links
        registerS1APIHover(context);

        // Register Schedule 1-specific file creation templates
        context.registerNewFileTemplates(scheduleOneNewFileTemplates);

        context.log('Schedule 1 modding plugin activated successfully');
    },

    async deactivate(): Promise<void> {
        console.log('[ScheduleOne Plugin] Deactivating...');
        // NOTE: Cleanup is handled automatically by context.subscriptions
    },
};

// Re-export sub-modules for standalone use
export { S1API_PLUGIN_MANIFEST } from './manifest';
export { s1apiProjectDetector } from './detector';
export { registerS1APISyntax, s1apiSyntaxRules, s1apiTokenColors } from './syntax';
export { registerS1APIIntelliSense, createS1APICompletionProvider } from './intellisense';
export { registerS1APIHover, createS1APIHoverProvider } from './hover';
export { scheduleOneNewFileTemplates } from './newFileTemplates';

// Default export for ESM imports
export default S1APIPlugin;

