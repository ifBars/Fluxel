/**
 * Schedule 1 Modding Project Detector
 *
 * Detects Schedule 1 mod projects that use Schedule-specific libraries such as
 * S1API, S1MAPI, or SteamNetworkLib. Generic Unity and MelonLoader indicators
 * are only used as supporting signals.
 */

import type { DetectedProject, ProjectDetector } from '@/lib/plugins/types';

import type {
    ScheduleOneFeature,
    ScheduleOneFramework,
    ScheduleOneLibrary,
    ScheduleOneProjectMetadata,
    ScheduleOneRuntime,
} from './projectProfile';

interface MutableScheduleOneProjectMetadata {
    libraries: Set<ScheduleOneLibrary>;
    frameworks: Set<ScheduleOneFramework>;
    runtimes: Set<ScheduleOneRuntime>;
    features: Set<ScheduleOneFeature>;
    csprojCount: number;
    signalCount: number;
}

interface DetectionSignal {
    confidence: number;
    metadata: ScheduleOneProjectMetadata;
}

function createMutableMetadata(): MutableScheduleOneProjectMetadata {
    return {
        libraries: new Set(),
        frameworks: new Set(),
        runtimes: new Set(),
        features: new Set(),
        csprojCount: 0,
        signalCount: 0,
    };
}

function finalizeMetadata(metadata: MutableScheduleOneProjectMetadata): ScheduleOneProjectMetadata {
    return {
        libraries: Array.from(metadata.libraries),
        frameworks: Array.from(metadata.frameworks),
        runtimes: Array.from(metadata.runtimes),
        features: Array.from(metadata.features),
        csprojCount: metadata.csprojCount,
        signalCount: metadata.signalCount,
    };
}

function addLibrarySignal(
    metadata: MutableScheduleOneProjectMetadata,
    library: ScheduleOneLibrary,
    confidence: number
): number {
    metadata.libraries.add(library);
    metadata.signalCount += 1;
    return confidence;
}

function addFeatureSignal(
    metadata: MutableScheduleOneProjectMetadata,
    feature: ScheduleOneFeature,
    confidence: number
): number {
    metadata.features.add(feature);
    metadata.signalCount += 1;
    return confidence;
}

function addFrameworkContext(
    metadata: MutableScheduleOneProjectMetadata,
    framework: ScheduleOneFramework,
    confidence = 0
): number {
    metadata.frameworks.add(framework);
    return confidence;
}

function addRuntimeContext(
    metadata: MutableScheduleOneProjectMetadata,
    runtime: ScheduleOneRuntime,
    confidence = 0
): number {
    metadata.runtimes.add(runtime);
    return confidence;
}

function mergeMetadata(
    target: MutableScheduleOneProjectMetadata,
    source: ScheduleOneProjectMetadata
): void {
    source.libraries.forEach((library) => target.libraries.add(library));
    source.frameworks.forEach((framework) => target.frameworks.add(framework));
    source.runtimes.forEach((runtime) => target.runtimes.add(runtime));
    source.features.forEach((feature) => target.features.add(feature));
    target.csprojCount += source.csprojCount;
    target.signalCount += source.signalCount;
}

function hasScheduleOneSpecificSignal(metadata: ScheduleOneProjectMetadata): boolean {
    return metadata.libraries.length > 0 || metadata.features.length > 0;
}

export function inspectScheduleOneCsproj(content: string): DetectionSignal {
    const metadata = createMutableMetadata();
    metadata.csprojCount = 1;

    let confidence = 0;

    if (/(<PackageReference\s+Include=["']S1API(?:\.Forked)?["'])|(<Reference\s+Include=["']S1API(?:\.Forked)?["'])/i.test(content)) {
        confidence += addLibrarySignal(metadata, 's1api', 0.55);
    }

    if (/(<PackageReference\s+Include=["']S1MAPI["'])|(<Reference\s+Include=["'](?:S1MAPI|MAPI)["'])/i.test(content)) {
        confidence += addLibrarySignal(metadata, 's1mapi', 0.5);
        confidence += addFeatureSignal(metadata, 'building', 0.08);
    }

    if (/(<PackageReference\s+Include=["']SteamNetworkLib["'])|(<Reference\s+Include=["']SteamNetworkLib["'])/i.test(content)) {
        confidence += addLibrarySignal(metadata, 'steamnetworklib', 0.5);
        confidence += addFeatureSignal(metadata, 'networking', 0.08);
    }

    if (/(<PackageReference\s+Include=["']LavaGang\.MelonLoader["'])|(<Reference\s+Include=["']MelonLoader["'])/i.test(content)) {
        confidence += addFrameworkContext(metadata, 'melonloader', 0.04);
    }

    if (/(<PackageReference\s+Include=["']0Harmony["'])|(<Reference\s+Include=["']0Harmony["'])/i.test(content)) {
        confidence += addFrameworkContext(metadata, 'harmony', 0.03);
    }

    if (/\b(Mono|MonoMelon)\b/i.test(content)) {
        addRuntimeContext(metadata, 'mono');
    }

    if (/\b(Il2Cpp|Il2cpp|Il2CppMelon)\b/i.test(content)) {
        addRuntimeContext(metadata, 'il2cpp');
    }

    if (/\b(CrossCompat|UseLocalS1APIForked)\b/i.test(content)) {
        addRuntimeContext(metadata, 'cross-compat');
    }

    if (/TVGS|Schedule I|ScheduleOne/i.test(content)) {
        confidence += 0.03;
    }

    return {
        confidence: Math.min(confidence, 1),
        metadata: finalizeMetadata(metadata),
    };
}

export function inspectScheduleOneSource(content: string): DetectionSignal {
    const metadata = createMutableMetadata();
    let confidence = 0;

    if (/\busing\s+S1API\b|\busing\s+S1API\./i.test(content)) {
        confidence += addLibrarySignal(metadata, 's1api', 0.35);
    }

    if (/\busing\s+S1MAPI\b|\busing\s+S1MAPI\./i.test(content)) {
        confidence += addLibrarySignal(metadata, 's1mapi', 0.32);
        confidence += addFeatureSignal(metadata, 'building', 0.08);
    }

    if (/\busing\s+SteamNetworkLib\b|\busing\s+SteamNetworkLib\./i.test(content)) {
        confidence += addLibrarySignal(metadata, 'steamnetworklib', 0.32);
        confidence += addFeatureSignal(metadata, 'networking', 0.08);
    }

    if (/\bPhoneApp\b|\bAppName\b|\bUIFactory\./.test(content)) {
        confidence += addFeatureSignal(metadata, 'phone-app', 0.18);
    }

    if (/\bSaveable\b|\[SaveableField\b/.test(content)) {
        confidence += addFeatureSignal(metadata, 'saveable', 0.18);
    }

    if (/\bNPCPrefabBuilder\b|\bEntities\.NPCs\b|\bCustomNPC\b|\bConfigurePrefab\b/.test(content)) {
        confidence += addFeatureSignal(metadata, 'custom-npc', 0.18);
    }

    if (/\bBuildingBuilder\b|\bInteriorBuilder\b|\bPrefabPlacer\b|\bGltfLoader\b|\bPrefabRef\b/.test(content)) {
        confidence += addFeatureSignal(metadata, 'building', 0.18);
    }

    if (/\bSteamNetworkClient\b|\bHostSyncVar\b|\bClientSyncVar\b|\bRegisterMessageHandler\b|\bProcessIncomingMessages\b/.test(content)) {
        confidence += addFeatureSignal(metadata, 'networking', 0.18);
    }

    if (/\bMelonMod\b|\[assembly:\s*MelonInfo\b|\[assembly:\s*MelonGame\b/.test(content)) {
        confidence += addFrameworkContext(metadata, 'melonloader', 0.03);
    }

    if (/\bHarmonyPatch\b|\bHarmonyLib\.Harmony\b/.test(content)) {
        confidence += addFrameworkContext(metadata, 'harmony', 0.02);
    }

    if (/#if\s+MONO\b/.test(content)) {
        addRuntimeContext(metadata, 'mono');
    }

    if (/#if\s+IL2CPP\b|\bIl2CppInterop\b/.test(content)) {
        addRuntimeContext(metadata, 'il2cpp');
    }

    if (/#if\s+(?:MONO|IL2CPP)\b/.test(content) && /#elif\s+(?:MONO|IL2CPP)\b/.test(content)) {
        addRuntimeContext(metadata, 'cross-compat');
    }

    if (/Schedule I|ScheduleOne|TVGS/.test(content)) {
        confidence += 0.02;
    }

    return {
        confidence: Math.min(confidence, 1),
        metadata: finalizeMetadata(metadata),
    };
}

export function mergeScheduleOneSignals(signals: DetectionSignal[]): DetectionSignal {
    if (signals.length === 0) {
        return {
            confidence: 0,
            metadata: finalizeMetadata(createMutableMetadata()),
        };
    }

    const combined = createMutableMetadata();
    let totalConfidence = 0;
    let contributingSignals = 0;

    for (const signal of signals) {
        if (!hasScheduleOneSpecificSignal(signal.metadata)) {
            continue;
        }

        mergeMetadata(combined, signal.metadata);
        totalConfidence += signal.confidence;
        contributingSignals += 1;
    }

    if (contributingSignals === 0) {
        return {
            confidence: 0,
            metadata: finalizeMetadata(combined),
        };
    }

    const normalizedConfidence = Math.min(
        totalConfidence / contributingSignals + Math.min(combined.signalCount * 0.03, 0.2),
        1
    );

    return {
        confidence: normalizedConfidence,
        metadata: finalizeMetadata(combined),
    };
}

/**
 * Schedule 1 Project Detector
 */
export const s1apiProjectDetector: ProjectDetector = {
    id: 'schedule-one-mod-detector',
    projectType: 'schedule-one-mod',

    async detect(workspaceRoot: string): Promise<DetectedProject | null> {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            const { join } = await import('@tauri-apps/api/path');
            const { exists, readTextFile } = await import('@tauri-apps/plugin-fs');

            interface DirEntry {
                name: string;
                isDirectory: boolean;
                isIgnored?: boolean;
            }

            const entries = await invoke<DirEntry[]>('list_directory_entries', {
                path: workspaceRoot,
                workspaceRoot,
                maxEntries: 250,
            }).catch(() => [] as DirEntry[]);

            const signals: DetectionSignal[] = [];
            const csprojFiles = entries.filter((entry) => !entry.isDirectory && entry.name.endsWith('.csproj'));
            const sourceFiles = entries.filter((entry) => !entry.isDirectory && entry.name.endsWith('.cs')).slice(0, 12);

            for (const csprojFile of csprojFiles) {
                try {
                    const csprojPath = await join(workspaceRoot, csprojFile.name);
                    const content = await readTextFile(csprojPath);
                    signals.push(inspectScheduleOneCsproj(content));
                } catch {
                    // Ignore unreadable project files
                }
            }

            for (const sourceFile of sourceFiles) {
                try {
                    const sourcePath = await join(workspaceRoot, sourceFile.name);
                    const content = await readTextFile(sourcePath);
                    signals.push(inspectScheduleOneSource(content));
                } catch {
                    // Ignore unreadable source files
                }
            }

            const melonInfoPath = await join(workspaceRoot, 'MelonInfo.cs');
            if (await exists(melonInfoPath)) {
                signals.push(
                    inspectScheduleOneSource(
                        '[assembly: MelonInfo(typeof(Core), "Schedule I Mod", "1.0.0", "Fluxel")]'
                    )
                );
            }

            const combined = mergeScheduleOneSignals(signals);
            if (!hasScheduleOneSpecificSignal(combined.metadata) || combined.confidence < 0.32) {
                return null;
            }

            return {
                type: 'schedule-one-mod',
                name: 'Schedule 1 Mod Project',
                confidence: combined.confidence,
                metadata: {
                    libraries: combined.metadata.libraries,
                    frameworks: combined.metadata.frameworks,
                    runtimes: combined.metadata.runtimes,
                    features: combined.metadata.features,
                    csprojCount: combined.metadata.csprojCount,
                    signalCount: combined.metadata.signalCount,
                },
            };
        } catch (error) {
            console.error('[ScheduleOne Detector] Detection failed:', error);
            return null;
        }
    },
};
