import type { DetectedProject } from '@/lib/plugins/types';

export type ScheduleOneLibrary = 's1api' | 's1mapi' | 'steamnetworklib';
export type ScheduleOneFramework = 'melonloader' | 'harmony';
export type ScheduleOneRuntime = 'mono' | 'il2cpp' | 'cross-compat';
export type ScheduleOneFeature = 'building' | 'custom-npc' | 'networking' | 'phone-app' | 'saveable';

export interface ScheduleOneProjectMetadata {
    libraries: ScheduleOneLibrary[];
    frameworks: ScheduleOneFramework[];
    runtimes: ScheduleOneRuntime[];
    features: ScheduleOneFeature[];
    csprojCount: number;
    signalCount: number;
}

const EMPTY_METADATA: ScheduleOneProjectMetadata = {
    libraries: [],
    frameworks: [],
    runtimes: [],
    features: [],
    csprojCount: 0,
    signalCount: 0,
};

function collectEnumValues<T extends string>(value: unknown, allowed: readonly T[]): T[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const allowedSet = new Set(allowed);
    return Array.from(
        new Set(
            value.filter((entry): entry is T => typeof entry === 'string' && allowedSet.has(entry as T))
        )
    );
}

export function normalizeScheduleOneProjectMetadata(
    metadata?: Record<string, unknown>
): ScheduleOneProjectMetadata {
    if (!metadata) {
        return EMPTY_METADATA;
    }

    const libraries = collectEnumValues(metadata.libraries, ['s1api', 's1mapi', 'steamnetworklib'] as const);
    const frameworks = collectEnumValues(metadata.frameworks, ['melonloader', 'harmony'] as const);
    const runtimes = collectEnumValues(metadata.runtimes, ['mono', 'il2cpp', 'cross-compat'] as const);
    const features = collectEnumValues(metadata.features, ['building', 'custom-npc', 'networking', 'phone-app', 'saveable'] as const);

    return {
        libraries,
        frameworks,
        runtimes,
        features,
        csprojCount: typeof metadata.csprojCount === 'number' ? metadata.csprojCount : 0,
        signalCount: typeof metadata.signalCount === 'number' ? metadata.signalCount : 0,
    };
}

export function isScheduleOneDetectedProject(project: DetectedProject | null | undefined): boolean {
    return project?.type === 'schedule-one-mod' || project?.type === 's1api';
}

function formatLibraryTag(library: ScheduleOneLibrary): string {
    switch (library) {
        case 's1api':
            return 'S1API';
        case 's1mapi':
            return 'S1MAPI';
        case 'steamnetworklib':
            return 'SteamNetworkLib';
    }
}

function formatRuntimeTag(runtimes: ScheduleOneRuntime[]): string | null {
    if (runtimes.length === 0) {
        return null;
    }

    const ordered = ['mono', 'il2cpp', 'cross-compat']
        .filter((runtime): runtime is ScheduleOneRuntime => runtimes.includes(runtime as ScheduleOneRuntime))
        .map((runtime) => {
            switch (runtime) {
                case 'mono':
                    return 'Mono';
                case 'il2cpp':
                    return 'IL2CPP';
                case 'cross-compat':
                    return 'CrossCompat';
            }
        });

    return ordered.join(' / ');
}

export function formatScheduleOneProjectTags(project: DetectedProject | null | undefined): string[] {
    if (!project || !isScheduleOneDetectedProject(project)) {
        return [];
    }

    const metadata = normalizeScheduleOneProjectMetadata(project.metadata);
    const tags = ['Schedule 1'];

    for (const library of metadata.libraries) {
        tags.push(formatLibraryTag(library));
    }

    const runtimeTag = formatRuntimeTag(metadata.runtimes);
    if (runtimeTag) {
        tags.push(runtimeTag);
    }

    return tags;
}
