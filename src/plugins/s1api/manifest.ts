/**
 * S1API Plugin Manifest
 * 
 * Metadata for the S1API plugin.
 */

import type { PluginManifest } from '@/lib/plugins/types';

export const S1API_PLUGIN_MANIFEST: PluginManifest = {
    id: 'fluxel.s1api',
    name: 'S1API Support',
    version: '1.0.0',
    description: 'Provides IntelliSense, syntax highlighting, and documentation for S1API mod development.',
    author: 'Fluxel',
    repository: 'https://github.com/ifbars/S1API',
    activationEvents: [
        'onLanguage:csharp',
        'onProject:s1api',
    ],
    dependencies: [],
    isCore: true,
};

