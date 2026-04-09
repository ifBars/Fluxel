import { describe, expect, it } from 'vitest';
import { shouldActivateCSharpProvider } from './LanguageController';

describe('LanguageController C# activation', () => {
    it('activates for dotnet and mixed projects', () => {
        expect(shouldActivateCSharpProvider('dotnet', null)).toBe(true);
        expect(shouldActivateCSharpProvider('mixed', null)).toBe(true);
    });

    it('activates for standalone C# tabs even without a detected dotnet project', () => {
        expect(shouldActivateCSharpProvider('unknown', 'csharp')).toBe(true);
        expect(shouldActivateCSharpProvider(null, 'csharp')).toBe(true);
    });

    it('stays off for non-C# editor contexts', () => {
        expect(shouldActivateCSharpProvider('javascript', 'typescript')).toBe(false);
        expect(shouldActivateCSharpProvider('unknown', 'plaintext')).toBe(false);
    });
});
