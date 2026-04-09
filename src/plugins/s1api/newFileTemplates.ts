import type { NewFileTemplate, NewFileTemplateBuildArgs, NewFileTemplateContext } from '@/lib/plugins/types';

import { isScheduleOneDetectedProject } from './projectProfile';

function isScheduleOneContext(context: NewFileTemplateContext): boolean {
    return context.detectedProjects.some((project) => isScheduleOneDetectedProject(project));
}

function withNamespace(args: NewFileTemplateBuildArgs, lines: string[]): string {
    const content: string[] = [];

    if (args.namespaceName) {
        content.push(`namespace ${args.namespaceName};`, '');
    }

    content.push(...lines);
    return `${content.join('\n')}\n`;
}

export const scheduleOneNewFileTemplates: NewFileTemplate[] = [
    {
        id: 'fluxel.s1api.phone-app',
        label: 'S1API Phone App',
        description: 'Create a Schedule 1 phone app scaffold.',
        category: 'Schedule 1',
        extension: 'cs',
        suggestedBaseName: 'NewPhoneApp',
        priority: 220,
        matches: isScheduleOneContext,
        buildContent: (args) => withNamespace(args, [
            'using UnityEngine;',
            'using S1API.PhoneApp;',
            'using S1API.UI;',
            '',
            `public class ${args.typeName} : PhoneApp`,
            '{',
            `    public static ${args.typeName}? Instance;`,
            '',
            `    protected override string AppName => "${args.baseName.toLowerCase()}";`,
            `    protected override string AppTitle => "${args.baseName}";`,
            '    protected override string IconLabel => "App";',
            '    protected override string IconFileName => "icon.png";',
            '',
            '    protected override void OnCreated()',
            '    {',
            '        base.OnCreated();',
            '        Instance = this;',
            '    }',
            '',
            '    protected override void OnCreatedUI(GameObject container)',
            '    {',
            '        var panel = UIFactory.Panel("MainPanel", container.transform, new Color(0.1f, 0.1f, 0.1f), fullAnchor: true);',
            `        UIFactory.Text("Title", "${args.baseName}", panel.transform, 22, TextAnchor.MiddleCenter);`,
            '    }',
            '}',
        ]),
    },
    {
        id: 'fluxel.s1api.npc',
        label: 'S1API NPC',
        description: 'Create a custom NPC scaffold.',
        category: 'Schedule 1',
        extension: 'cs',
        suggestedBaseName: 'NewNpc',
        priority: 219,
        matches: isScheduleOneContext,
        buildContent: (args) => withNamespace(args, [
            'using S1API.Entities;',
            'using S1API.Entities.Schedule;',
            'using UnityEngine;',
            '',
            `public class ${args.typeName} : NPC`,
            '{',
            '    public override bool IsPhysical => true;',
            '    public override bool IsDealer => false;',
            '',
            '    protected override void ConfigurePrefab(NPCPrefabBuilder builder)',
            '    {',
            `        builder.WithIdentity("${args.baseName.toLowerCase()}", "${args.baseName}", "NPC")`,
            '            .WithSpawnPosition(new Vector3(100f, 0f, 100f));',
            '    }',
            '',
            '    protected override void OnCreated()',
            '    {',
            '        base.OnCreated();',
            '        Appearance.Build();',
            '        Schedule.Enable();',
            '    }',
            '}',
        ]),
    },
    {
        id: 'fluxel.s1api.network',
        label: 'SteamNetworkLib Setup',
        description: 'Create a minimal SteamNetworkLib lifecycle scaffold.',
        category: 'Schedule 1',
        extension: 'cs',
        suggestedBaseName: 'NetworkHooks',
        priority: 218,
        matches: isScheduleOneContext,
        buildContent: (args) => withNamespace(args, [
            'using SteamNetworkLib;',
            '',
            `public class ${args.typeName}`,
            '{',
            '    private SteamNetworkClient? _client;',
            '',
            '    public void OnLateInitializeMelon()',
            '    {',
            '        _client = new SteamNetworkClient();',
            '        if (_client.Initialize())',
            '        {',
            '            _client.OnLobbyJoined += (_, _) =>',
            '            {',
            '            };',
            '        }',
            '    }',
            '',
            '    public void OnUpdate()',
            '    {',
            '        _client?.ProcessIncomingMessages();',
            '    }',
            '}',
        ]),
    },
];
