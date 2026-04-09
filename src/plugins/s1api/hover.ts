/**
 * Schedule 1 Modding Hover Provider
 *
 * Provides quick documentation for Schedule 1-specific libraries.
 */

import type { HoverInfo, HoverProvider, PluginContext } from '@/lib/plugins/types';

interface DocEntry {
    pattern: RegExp;
    title: string;
    description: string;
    docUrl?: string;
    example?: string;
}

const S1API_DOCS_BASE = 'https://ifbars.github.io/S1API/docs';
const S1MAPI_DOCS_BASE = 'https://ifbars.github.io/S1MAPI';
const STEAM_NETWORK_LIB_URL = 'https://github.com/ifBars/SteamNetworkLib';

const SCHEDULE_ONE_DOCUMENTATION: DocEntry[] = [
    {
        pattern: /\bPhoneApp\b/,
        title: 'S1API.PhoneApp.PhoneApp',
        description: 'Base class for Schedule 1 phone apps. Derive from it to add custom apps to the in-game phone.',
        docUrl: `${S1API_DOCS_BASE}/phone-apps.html`,
        example: 'public class MyApp : PhoneApp { ... }',
    },
    {
        pattern: /\bSaveable\b/,
        title: 'S1API.Saveables.Saveable',
        description: 'Persistent base class for mod-owned save data.',
        docUrl: `${S1API_DOCS_BASE}/save-system.html`,
        example: '[SaveableField("notes")] private List<string> _notes = new();',
    },
    {
        pattern: /\bSaveableField\b/,
        title: '[SaveableField] Attribute',
        description: 'Marks a field for automatic save/load through S1API.',
        docUrl: `${S1API_DOCS_BASE}/save-system.html`,
        example: '[SaveableField("player-score")] private int _score;',
    },
    {
        pattern: /\bUIFactory\b/,
        title: 'S1API.UI.UIFactory',
        description: 'Helper for building Schedule 1 UI quickly from code.',
        docUrl: `${S1API_DOCS_BASE}/ui.html`,
        example: 'UIFactory.Panel("Main", parent.transform, Color.black, fullAnchor: true)',
    },
    {
        pattern: /\bNPCPrefabBuilder\b/,
        title: 'S1API.Entities.NPCPrefabBuilder',
        description: 'Configures custom NPC prefabs, identities, schedules, and appearance.',
        docUrl: `${S1API_DOCS_BASE}/`,
        example: 'builder.WithIdentity("my_npc", "John", "Doe").WithSpawnPosition(new Vector3(100f, 0f, 100f));',
    },
    {
        pattern: /\bBuildingBuilder\b/,
        title: 'S1MAPI.Building.BuildingBuilder',
        description: 'High-level builder for Schedule 1 custom buildings, walls, floors, roofs, and lighting.',
        docUrl: `${S1MAPI_DOCS_BASE}/`,
        example: 'new BuildingBuilder("Shop").WithConfig(BuildingConfig.Medium).AddFloor().AddWalls(southDoor: true).Build();',
    },
    {
        pattern: /\bInteriorBuilder\b/,
        title: 'S1MAPI.Building.Interior.InteriorBuilder',
        description: 'Places Schedule 1 furniture, props, and decorative meshes inside custom structures.',
        docUrl: `${S1MAPI_DOCS_BASE}/`,
        example: 'var interior = new InteriorBuilder(building.transform); interior.AddDesk(position, Quaternion.identity);',
    },
    {
        pattern: /\bPrefabPlacer\b/,
        title: 'S1MAPI.Building.Components.PrefabPlacer',
        description: 'Places prefabs in custom buildings, including networked prefabs that must be spawned correctly.',
        docUrl: `${S1MAPI_DOCS_BASE}/`,
        example: 'placer.Place(Prefabs.ATM, position, rotation, networked: true);',
    },
    {
        pattern: /\bGltfLoader\b/,
        title: 'S1MAPI.Gltf.GltfLoader',
        description: 'Loads GLB and GLTF assets for Schedule 1 mods without requiring asset bundles.',
        docUrl: `${S1MAPI_DOCS_BASE}/`,
        example: 'GameObject? model = GltfLoader.LoadFromFile("path/to/model.glb");',
    },
    {
        pattern: /\bSteamNetworkClient\b/,
        title: 'SteamNetworkLib.SteamNetworkClient',
        description: 'Main entry point for Schedule 1 P2P networking, lobby data, and sync variables.',
        docUrl: STEAM_NETWORK_LIB_URL,
        example: 'var client = new SteamNetworkClient(); if (client.Initialize()) { ... }',
    },
    {
        pattern: /\bHostSyncVar\b/,
        title: 'SteamNetworkLib.Sync.HostSyncVar<T>',
        description: 'Host-authoritative sync value. Non-host writes are ignored.',
        docUrl: STEAM_NETWORK_LIB_URL,
        example: 'var round = _client.CreateHostSyncVar("Round", 0, new NetworkSyncOptions { KeyPrefix = "MyMod_" });',
    },
    {
        pattern: /\bClientSyncVar\b/,
        title: 'SteamNetworkLib.Sync.ClientSyncVar<T>',
        description: 'Per-player sync value used for player-owned state such as readiness or positions.',
        docUrl: STEAM_NETWORK_LIB_URL,
        example: 'var ready = _client.CreateClientSyncVar("Ready", false, new NetworkSyncOptions { KeyPrefix = "MyMod_" });',
    },
    {
        pattern: /\bNetworkSyncOptions\b/,
        title: 'SteamNetworkLib.Sync.NetworkSyncOptions',
        description: 'Controls sync throttling, key prefixing, and validation for SteamNetworkLib sync vars.',
        docUrl: STEAM_NETWORK_LIB_URL,
        example: 'new NetworkSyncOptions { KeyPrefix = "MyMod_", MaxSyncsPerSecond = 20 }',
    },
    {
        pattern: /\bRegisterMessageHandler\b/,
        title: 'SteamNetworkClient.RegisterMessageHandler<T>()',
        description: 'Registers a typed handler for incoming P2P messages.',
        docUrl: STEAM_NETWORK_LIB_URL,
        example: '_client.RegisterMessageHandler<TextMessage>((msg, sender) => { ... });',
    },
    {
        pattern: /\bProcessIncomingMessages\b/,
        title: 'SteamNetworkClient.ProcessIncomingMessages()',
        description: 'Must be called regularly, typically from OnUpdate, to process incoming SteamNetworkLib packets.',
        docUrl: STEAM_NETWORK_LIB_URL,
        example: 'public override void OnUpdate() { _client?.ProcessIncomingMessages(); }',
    },
];

function findDocumentation(word: string): DocEntry | null {
    for (const doc of SCHEDULE_ONE_DOCUMENTATION) {
        if (doc.pattern.test(word)) {
            return doc;
        }
    }

    return null;
}

function formatDocumentation(doc: DocEntry): string[] {
    const contents: string[] = [];

    contents.push(`**${doc.title}**`);
    contents.push('');
    contents.push(doc.description);

    if (doc.example) {
        contents.push('');
        contents.push('```csharp');
        contents.push(doc.example);
        contents.push('```');
    }

    if (doc.docUrl) {
        contents.push('');
        contents.push(`[View documentation](${doc.docUrl})`);
    }

    return [contents.join('\n')];
}

export function createS1APIHoverProvider(_context: PluginContext): HoverProvider {
    return {
        provideHover(model, position): HoverInfo | null {
            const wordInfo = model.getWordAtPosition(position);
            if (!wordInfo) {
                return null;
            }

            const word = wordInfo.word;
            const doc = findDocumentation(word);
            if (!doc) {
                return null;
            }

            return {
                contents: formatDocumentation(doc),
                range: {
                    startLineNumber: position.lineNumber,
                    startColumn: wordInfo.startColumn,
                    endLineNumber: position.lineNumber,
                    endColumn: wordInfo.endColumn,
                },
            };
        },
    };
}

export function registerS1APIHover(context: PluginContext): void {
    const provider = createS1APIHoverProvider(context);
    context.registerHoverProvider('csharp', provider);
    context.log('Schedule 1 hover documentation registered');
}
