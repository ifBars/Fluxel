/**
 * Schedule 1 Modding IntelliSense / Completion Provider
 *
 * Provides Schedule 1-specific completions for S1API, S1MAPI, and
 * SteamNetworkLib workflows.
 */

import type { CompletionItem, CompletionProvider, PluginContext } from '@/lib/plugins/types';
import type * as Monaco from 'monaco-editor';

function createScheduleOneCompletions(monaco: typeof Monaco): CompletionItem[] {
    return [
        {
            label: 'AppName',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'protected override string AppName => "${1:myapp}";',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Internal identifier for an S1API phone app.',
            detail: 'Schedule 1 phone app override',
            sortText: '0_appname',
        },
        {
            label: 'AppTitle',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'protected override string AppTitle => "${1:My App}";',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Display title for an S1API phone app.',
            detail: 'Schedule 1 phone app override',
            sortText: '0_apptitle',
        },
        {
            label: 'IconLabel',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'protected override string IconLabel => "${1:App}";',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Short label shown below the phone app icon.',
            detail: 'Schedule 1 phone app override',
            sortText: '0_iconlabel',
        },
        {
            label: 'IconFileName',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'protected override string IconFileName => "${1:icon.png}";',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Phone app icon filename placed next to the mod DLL.',
            detail: 'Schedule 1 phone app override',
            sortText: '0_iconfilename',
        },
        {
            label: 'OnCreated',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: [
                'protected override void OnCreated()',
                '{',
                '\tbase.OnCreated();',
                '\t$0',
                '}',
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Called after an S1API phone app instance is created.',
            detail: 'Schedule 1 phone app lifecycle',
            sortText: '1_oncreated',
        },
        {
            label: 'OnCreatedUI',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: [
                'protected override void OnCreatedUI(GameObject container)',
                '{',
                '\t$0',
                '}',
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Called when an S1API phone app should build its UI.',
            detail: 'Schedule 1 phone app lifecycle',
            sortText: '1_oncreatedui',
        },
        {
            label: 'UIFactory.Panel',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: 'UIFactory.Panel("${1:PanelName}", ${2:parent}.transform, new Color(${3:0.1f}, ${4:0.1f}, ${5:0.1f}), fullAnchor: ${6:true})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Create an S1API panel.',
            detail: 'Schedule 1 UI',
            sortText: '2_panel',
        },
        {
            label: 'UIFactory.Text',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: 'UIFactory.Text("${1:TextName}", "${2:Text content}", ${3:parent}.transform, ${4:22}, TextAnchor.${5:MiddleCenter})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Create an S1API text element.',
            detail: 'Schedule 1 UI',
            sortText: '2_text',
        },
        {
            label: 'UIFactory.Button',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: 'UIFactory.Button("${1:ButtonName}", "${2:Button Text}", ${3:parent}.transform, () => { $0 })',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Create an S1API button.',
            detail: 'Schedule 1 UI',
            sortText: '2_button',
        },
        {
            label: 'SaveableField',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '[SaveableField("${1:field-key}")] private ${2:string} _${3:fieldName} = ${4:default};',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Persist a field through S1API saveables.',
            detail: 'Schedule 1 persistence',
            sortText: '3_saveablefield',
        },
        {
            label: 'S1API NPC Template',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
                'using S1API.Entities;',
                'using S1API.Entities.Schedule;',
                'using UnityEngine;',
                '',
                'public class ${1:MyNpc} : NPC',
                '{',
                '\tpublic override bool IsPhysical => true;',
                '\tpublic override bool IsDealer => false;',
                '',
                '\tprotected override void ConfigurePrefab(NPCPrefabBuilder builder)',
                '\t{',
                '\t\tbuilder.WithIdentity("${2:my_npc}", "${3:John}", "${4:Doe}")',
                '\t\t\t.WithSpawnPosition(new Vector3(${5:100f}, ${6:0f}, ${7:100f}));',
                '\t}',
                '',
                '\tprotected override void OnCreated()',
                '\t{',
                '\t\tbase.OnCreated();',
                '\t\tAppearance.Build();',
                '\t\tSchedule.Enable();',
                '\t\t$0',
                '\t}',
                '}',
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Create a custom NPC with S1API prefab and schedule hooks.',
            detail: 'Schedule 1 NPC template',
            sortText: '0_s1api_npc_template',
        },
        {
            label: 'S1API PhoneApp Template',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
                'using UnityEngine;',
                'using S1API.PhoneApp;',
                'using S1API.UI;',
                '',
                'public class ${1:MyApp} : PhoneApp',
                '{',
                '\tpublic static ${1:MyApp}? Instance;',
                '',
                '\tprotected override string AppName => "${2:myapp}";',
                '\tprotected override string AppTitle => "${3:My App}";',
                '\tprotected override string IconLabel => "${4:App}";',
                '\tprotected override string IconFileName => "${5:icon.png}";',
                '',
                '\tprotected override void OnCreated()',
                '\t{',
                '\t\tbase.OnCreated();',
                '\t\tInstance = this;',
                '\t}',
                '',
                '\tprotected override void OnCreatedUI(GameObject container)',
                '\t{',
                '\t\tvar panel = UIFactory.Panel("MainPanel", container.transform, new Color(0.1f, 0.1f, 0.1f), fullAnchor: true);',
                '\t\tUIFactory.Text("Title", "${3:My App}", panel.transform, 22, TextAnchor.MiddleCenter);',
                '\t\t$0',
                '\t}',
                '}',
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Complete S1API phone app scaffold.',
            detail: 'Schedule 1 phone app template',
            sortText: '0_phoneapp_template',
        },
        {
            label: 'S1MAPI Building Template',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
                'using S1MAPI.Building;',
                'using S1MAPI.Building.Interior;',
                'using UnityEngine;',
                '',
                'GameObject building = new BuildingBuilder("${1:MyBuilding}")',
                '\t.WithConfig(BuildingConfig.${2:Medium})',
                '\t.AddFloor()',
                '\t.AddCeiling()',
                '\t.AddWalls(${3:southDoor}: true)',
                '\t.Build();',
                '',
                'building.transform.position = new Vector3(${4:100f}, ${5:0f}, ${6:50f});',
                '',
                'var interior = new InteriorBuilder(building.transform);',
                'interior.AddDesk(new Vector3(${7:2f}, ${8:0f}, ${9:2f}), Quaternion.identity);',
                'interior.Build();',
                '$0',
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Create a Schedule 1 building with S1MAPI builders.',
            detail: 'Schedule 1 building template',
            sortText: '0_s1mapi_template',
        },
        {
            label: 'BuildingBuilder',
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: 'new BuildingBuilder("${1:MyBuilding}")',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Primary S1MAPI builder for buildings and interior shells.',
            detail: 'Schedule 1 building API',
            sortText: '2_buildingbuilder',
        },
        {
            label: 'InteriorBuilder',
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: 'new InteriorBuilder(${1:building}.transform)',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Place Schedule 1 furniture and meshes inside a building.',
            detail: 'Schedule 1 building API',
            sortText: '2_interiorbuilder',
        },
        {
            label: 'GltfLoader.LoadFromFile',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: 'GltfLoader.LoadFromFile("${1:path/to/model.glb}")',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Load a GLB model through S1MAPI.',
            detail: 'Schedule 1 building API',
            sortText: '2_gltfloader',
        },
        {
            label: 'SteamNetworkClient',
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: 'new SteamNetworkClient()',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Main SteamNetworkLib networking client.',
            detail: 'Schedule 1 networking API',
            sortText: '2_steamnetworkclient',
        },
        {
            label: 'CreateHostSyncVar',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: '_client.CreateHostSyncVar("${1:State}", ${2:defaultValue}, new NetworkSyncOptions { KeyPrefix = "${3:MyMod_}" })',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Create a host-authoritative sync variable with SteamNetworkLib.',
            detail: 'Schedule 1 networking API',
            sortText: '2_hostsyncvar',
        },
        {
            label: 'CreateClientSyncVar',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: '_client.CreateClientSyncVar("${1:Ready}", ${2:false}, new NetworkSyncOptions { KeyPrefix = "${3:MyMod_}" })',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Create a per-player sync variable with SteamNetworkLib.',
            detail: 'Schedule 1 networking API',
            sortText: '2_clientsyncvar',
        },
        {
            label: 'SteamNetworkLib Setup',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
                'using SteamNetworkLib;',
                '',
                'private SteamNetworkClient? _client;',
                '',
                'public override void OnLateInitializeMelon()',
                '{',
                '\t_client = new SteamNetworkClient();',
                '\tif (_client.Initialize())',
                '\t{',
                '\t\t_client.OnLobbyJoined += (_, e) => { $0 };',
                '\t}',
                '}',
                '',
                'public override void OnUpdate()',
                '{',
                '\t_client?.ProcessIncomingMessages();',
                '}',
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Minimal SteamNetworkLib lifecycle scaffold for a Schedule 1 mod.',
            detail: 'Schedule 1 networking template',
            sortText: '0_network_template',
        },
        {
            label: 'using Schedule 1 APIs',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
                'using S1API.Entities;',
                'using S1API.PhoneApp;',
                'using S1API.UI;',
                'using S1MAPI.Building;',
                'using SteamNetworkLib;',
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Common Schedule 1 modding imports.',
            detail: 'Schedule 1 imports',
            sortText: '5_usings',
        },
    ];
}

export function createS1APICompletionProvider(context: PluginContext): CompletionProvider {
    const completions = createScheduleOneCompletions(context.monaco);

    return {
        triggerCharacters: ['.', '[', ' '],

        provideCompletionItems(model, position): CompletionItem[] {
            const lineContent = model.getLineContent(position.lineNumber);
            const textUntilPosition = lineContent.substring(0, position.column - 1);

            const isAfterOverride = /override\s+\w*$/.test(textUntilPosition);
            const isAfterUIFactory = /UIFactory\.$/.test(textUntilPosition);
            const isAfterSteamNetworkClient = /SteamNetworkClient\.$/.test(textUntilPosition);
            const isEmptyOrUsing = textUntilPosition.trim() === '' || textUntilPosition.includes('using');
            const isBuildingContext = /\b(BuildingBuilder|InteriorBuilder|GltfLoader|PrefabRef)\b/.test(textUntilPosition);

            let filteredCompletions = completions;

            if (isAfterUIFactory) {
                filteredCompletions = completions.filter((completion) =>
                    completion.label.toString().startsWith('UIFactory.')
                );
            } else if (isAfterSteamNetworkClient) {
                filteredCompletions = completions.filter((completion) =>
                    completion.label.toString().startsWith('CreateHostSyncVar')
                    || completion.label.toString().startsWith('CreateClientSyncVar')
                    || completion.label.toString().startsWith('SteamNetworkClient')
                );
            } else if (isAfterOverride) {
                filteredCompletions = completions.filter((completion) =>
                    completion.detail?.includes('override') || completion.detail?.includes('lifecycle')
                );
            } else if (isBuildingContext) {
                filteredCompletions = completions.filter((completion) =>
                    completion.detail?.includes('building')
                );
            }

            if (isEmptyOrUsing && !isAfterUIFactory && !isAfterSteamNetworkClient) {
                const templates = completions.filter((completion) =>
                    completion.label.toString().includes('Template')
                    || completion.label.toString().includes('Setup')
                    || completion.label.toString().startsWith('using')
                );

                filteredCompletions = [
                    ...templates,
                    ...filteredCompletions.filter((completion) => !templates.includes(completion)),
                ];
            }

            return filteredCompletions;
        },
    };
}

export function registerS1APIIntelliSense(context: PluginContext): void {
    const provider = createS1APICompletionProvider(context);
    context.registerCompletionProvider('csharp', provider);
    context.log('Schedule 1 IntelliSense registered');
}
