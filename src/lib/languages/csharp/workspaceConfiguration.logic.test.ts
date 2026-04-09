import { describe, expect, it } from 'vitest';

import { choosePreferredBuildConfiguration } from './workspaceConfiguration';

describe('C# workspace configuration selection', () => {
    it('prefers a saved configuration when it exists', () => {
        const result = choosePreferredBuildConfiguration(
            [{ name: 'CrossCompat' }, { name: 'Mono' }, { name: 'Il2cpp' }],
            'Mono'
        );

        expect(result).toBe('Mono');
    });

    it('falls back to Debug when available', () => {
        const result = choosePreferredBuildConfiguration(
            [{ name: 'Release' }, { name: 'Debug' }],
            null
        );

        expect(result).toBe('Debug');
    });

    it('falls back to the first configuration for custom-config projects', () => {
        const result = choosePreferredBuildConfiguration(
            [{ name: 'CrossCompat' }, { name: 'Mono' }, { name: 'Il2cpp' }],
            null
        );

        expect(result).toBe('CrossCompat');
    });
});
