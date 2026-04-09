import { describe, expect, it } from 'vitest';
import {
    getLanguageFromExtension,
    isCSharpRelatedExtension,
    isCSharpSourceExtension,
    isDotNetWorkspaceExtension,
} from './fs';

describe('fs language detection', () => {
    it('recognizes additional C# source extensions', () => {
        expect(isCSharpSourceExtension('cs')).toBe(true);
        expect(isCSharpSourceExtension('csx')).toBe(true);
        expect(isCSharpSourceExtension('cake')).toBe(true);
        expect(getLanguageFromExtension('cake')).toBe('csharp');
    });

    it('recognizes dotnet workspace files including slnx', () => {
        expect(isDotNetWorkspaceExtension('csproj')).toBe(true);
        expect(isDotNetWorkspaceExtension('sln')).toBe(true);
        expect(isDotNetWorkspaceExtension('slnx')).toBe(true);
        expect(getLanguageFromExtension('slnx')).toBe('plaintext');
    });

    it('maps razor templates to html while keeping them C#-related', () => {
        expect(getLanguageFromExtension('razor')).toBe('html');
        expect(getLanguageFromExtension('cshtml')).toBe('html');
        expect(isCSharpRelatedExtension('razor')).toBe(true);
        expect(isCSharpRelatedExtension('cshtml')).toBe(true);
    });
});
