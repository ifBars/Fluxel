/**
 * S1API Plugin Manifest
 * 
 * Metadata for the S1API plugin.
 */

import type { PluginManifest } from '@/lib/plugins/types';

export const S1API_PLUGIN_MANIFEST: PluginManifest = {
    id: 'fluxel.s1api',
    name: 'Schedule 1 Modding Support',
    version: '1.0.0',
    description: 'Provides Schedule 1-specific completions, docs, and project detection for S1API, S1MAPI, and SteamNetworkLib workflows.',
    author: 'Fluxel',
    activationEvents: [
        'onStartup',
        'onLanguage:csharp',
        'onProject:schedule-one-mod',
    ],
    dependencies: [],
    isCore: true,
};

