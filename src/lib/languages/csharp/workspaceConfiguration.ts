import type { BuildConfiguration } from './BuildManager';
import { getProjectConfigurations } from './BuildManager';
import { useProjectSettingsStore } from '@/stores/project/useProjectSettingsStore';

export function choosePreferredBuildConfiguration(
    configurations: BuildConfiguration[],
    savedConfiguration: string | null
): string | null {
    if (configurations.length === 0) {
        return null;
    }

    if (savedConfiguration && configurations.some((configuration) => configuration.name === savedConfiguration)) {
        return savedConfiguration;
    }

    return configurations.find((configuration) => configuration.name === 'Debug')?.name
        ?? configurations[0]?.name
        ?? null;
}

export async function resolveWorkspaceBuildConfiguration(workspaceRoot: string): Promise<string | null> {
    if (!workspaceRoot) {
        return null;
    }

    const savedConfiguration = useProjectSettingsStore.getState()
        .getSettings(workspaceRoot)
        .selectedBuildConfiguration;

    try {
        const configurations = await getProjectConfigurations(workspaceRoot);
        const preferredConfiguration = choosePreferredBuildConfiguration(configurations, savedConfiguration);

        if (preferredConfiguration && preferredConfiguration !== savedConfiguration) {
            useProjectSettingsStore.getState().setSettings(workspaceRoot, {
                selectedBuildConfiguration: preferredConfiguration,
            });
        }

        return preferredConfiguration;
    } catch {
        return savedConfiguration;
    }
}
