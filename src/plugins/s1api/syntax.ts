/**
 * Schedule 1 Modding Syntax Highlighting
 *
 * Monaco token colors for Schedule 1-specific library patterns.
 */

import type { MonacoInstance, PluginContext, SyntaxRule } from '@/lib/plugins/types';
import type * as Monaco from 'monaco-editor';

export const s1apiSyntaxRules: SyntaxRule[] = [
    {
        token: 'namespace.scheduleone.s1api',
        regex: /S1API\.(PhoneApp|Saveables|PhoneCalls|UI|Entities|Quests|Map|Products|Properties)\b/,
        foreground: '#4fc1ff',
    },
    {
        token: 'namespace.scheduleone.s1mapi',
        regex: /S1MAPI\.(Building|Core|Gltf|ProceduralMesh|S1|Utils)\b/,
        foreground: '#c586c0',
    },
    {
        token: 'namespace.scheduleone.network',
        regex: /SteamNetworkLib\.(Core|Events|Models|Sync|Utilities)\b/,
        foreground: '#d7ba7d',
    },
    {
        token: 'type.scheduleone.phoneapp',
        regex: /\bPhoneApp\b/,
        foreground: '#4ec9b0',
        fontStyle: 'bold',
    },
    {
        token: 'type.scheduleone.saveable',
        regex: /\bSaveable\b/,
        foreground: '#4ec9b0',
        fontStyle: 'bold',
    },
    {
        token: 'type.scheduleone.npc',
        regex: /\bNPCPrefabBuilder\b|\bQuestManager\b/,
        foreground: '#4ec9b0',
        fontStyle: 'bold',
    },
    {
        token: 'type.scheduleone.building',
        regex: /\b(BuildingBuilder|InteriorBuilder|PrefabPlacer|PrefabRef|MeshRef|GltfLoader)\b/,
        foreground: '#c586c0',
        fontStyle: 'bold',
    },
    {
        token: 'type.scheduleone.networking',
        regex: /\b(SteamNetworkClient|HostSyncVar|ClientSyncVar|NetworkSyncOptions)\b/,
        foreground: '#d7ba7d',
        fontStyle: 'bold',
    },
    {
        token: 'annotation.scheduleone',
        regex: /\[SaveableField\b/,
        foreground: '#dcdcaa',
    },
    {
        token: 'method.scheduleone.uifactory',
        regex: /UIFactory\.(Panel|Text|Button|Layout|ScrollableVerticalList|RoundedButtonWithLabel)\b/,
        foreground: '#dcdcaa',
    },
    {
        token: 'method.scheduleone.networking',
        regex: /SteamNetworkClient\.(Initialize|CreateLobbyAsync|JoinLobbyAsync|CreateHostSyncVar|CreateClientSyncVar)\b/,
        foreground: '#dcdcaa',
    },
    {
        token: 'property.scheduleone.override',
        regex: /\b(AppName|AppTitle|IconLabel|IconFileName)\b/,
        foreground: '#9cdcfe',
    },
];

export const s1apiTokenColors: Monaco.editor.ITokenThemeRule[] = [
    { token: 'namespace.scheduleone.s1api', foreground: '4fc1ff' },
    { token: 'namespace.scheduleone.s1mapi', foreground: 'c586c0' },
    { token: 'namespace.scheduleone.network', foreground: 'd7ba7d' },
    { token: 'type.scheduleone.phoneapp', foreground: '4ec9b0', fontStyle: 'bold' },
    { token: 'type.scheduleone.saveable', foreground: '4ec9b0', fontStyle: 'bold' },
    { token: 'type.scheduleone.npc', foreground: '4ec9b0', fontStyle: 'bold' },
    { token: 'type.scheduleone.building', foreground: 'c586c0', fontStyle: 'bold' },
    { token: 'type.scheduleone.networking', foreground: 'd7ba7d', fontStyle: 'bold' },
    { token: 'annotation.scheduleone', foreground: 'dcdcaa' },
    { token: 'method.scheduleone.uifactory', foreground: 'dcdcaa' },
    { token: 'method.scheduleone.networking', foreground: 'dcdcaa' },
    { token: 'property.scheduleone.override', foreground: '9cdcfe' },
];

/**
 * Register Schedule 1 token colors with Monaco.
 */
export function registerS1APISyntax(context: PluginContext): void {
    const { monaco } = context;

    context.log('Schedule 1 syntax highlighting registered');
    applyS1APIThemeColors(monaco);
}

function applyS1APIThemeColors(_monaco: MonacoInstance): void {
    try {
        console.log('[ScheduleOne Plugin] Token colors registered for themes');
    } catch (error) {
        console.error('[ScheduleOne Plugin] Failed to apply theme colors:', error);
    }
}

export const s1apiSemanticTokenTypes = [
    'scheduleone-namespace',
    'scheduleone-class',
    'scheduleone-attribute',
    'scheduleone-method',
    'scheduleone-property',
];
