import { describe, expect, it } from 'vitest';

import { inspectScheduleOneCsproj, inspectScheduleOneSource, mergeScheduleOneSignals } from './detector';
import { formatScheduleOneProjectTags } from './projectProfile';

describe('Schedule 1 detector', () => {
    it('detects Schedule 1-specific libraries from project files', () => {
        const result = inspectScheduleOneCsproj(`
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup>
                <TargetFramework>netstandard2.1</TargetFramework>
                <Configurations>Mono;Il2Cpp;CrossCompat</Configurations>
              </PropertyGroup>
              <ItemGroup>
                <PackageReference Include="S1API.Forked" Version="2.8.9" />
                <PackageReference Include="LavaGang.MelonLoader" Version="0.7.0" />
              </ItemGroup>
            </Project>
        `);

        expect(result.metadata.libraries).toContain('s1api');
        expect(result.metadata.frameworks).toContain('melonloader');
        expect(result.metadata.runtimes).toContain('mono');
        expect(result.metadata.runtimes).toContain('il2cpp');
        expect(result.metadata.runtimes).toContain('cross-compat');
        expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('keeps generic MelonLoader and Harmony projects out of Schedule 1 detection on their own', () => {
        const csprojSignal = inspectScheduleOneCsproj(`
            <Project Sdk="Microsoft.NET.Sdk">
              <ItemGroup>
                <PackageReference Include="LavaGang.MelonLoader" Version="0.7.0" />
                <Reference Include="0Harmony" />
              </ItemGroup>
            </Project>
        `);
        const sourceSignal = inspectScheduleOneSource(`
            using MelonLoader;
            using HarmonyLib;

            public class Core : MelonMod
            {
                public override void OnInitializeMelon() {}
            }
        `);

        const result = mergeScheduleOneSignals([csprojSignal, sourceSignal]);

        expect(result.confidence).toBe(0);
        expect(result.metadata.libraries).toHaveLength(0);
        expect(result.metadata.features).toHaveLength(0);
    });

    it('captures S1MAPI and SteamNetworkLib workflows from source', () => {
        const result = inspectScheduleOneSource(`
            using S1MAPI.Building;
            using SteamNetworkLib;

            public class Core
            {
                void Build()
                {
                    var building = new BuildingBuilder("Shop").AddFloor().Build();
                    var client = new SteamNetworkClient();
                    client.ProcessIncomingMessages();
                }
            }
        `);

        expect(result.metadata.libraries).toContain('s1mapi');
        expect(result.metadata.libraries).toContain('steamnetworklib');
        expect(result.metadata.features).toContain('building');
        expect(result.metadata.features).toContain('networking');
    });

    it('formats concise Schedule 1 tags for the workbench', () => {
        const tags = formatScheduleOneProjectTags({
            type: 'schedule-one-mod',
            name: 'Schedule 1 Mod Project',
            confidence: 0.84,
            metadata: {
                libraries: ['s1api', 'steamnetworklib'],
                frameworks: ['melonloader'],
                runtimes: ['mono', 'il2cpp'],
                features: ['custom-npc', 'networking'],
                csprojCount: 1,
                signalCount: 4,
            },
        });

        expect(tags).toEqual(['Schedule 1', 'S1API', 'SteamNetworkLib', 'Mono / IL2CPP']);
    });
});
