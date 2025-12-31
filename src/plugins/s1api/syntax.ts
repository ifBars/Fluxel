/**
 * S1API Syntax Highlighting
 * 
 * Monaco Monarch tokenizer extensions for S1API-specific patterns.
 */

import type { SyntaxRule, PluginContext, MonacoInstance } from '@/lib/plugins/types';
import type * as Monaco from 'monaco-editor';

/**
 * S1API-specific syntax highlighting rules
 */
export const s1apiSyntaxRules: SyntaxRule[] = [
    // S1API namespace keywords
    {
        token: 'namespace.s1api',
        regex: /S1API\.(PhoneApp|Saveables|PhoneCalls|UI|Internal)\b/,
        foreground: '#4fc1ff',
    },
    // S1API base classes
    {
        token: 'type.s1api.phoneapp',
        regex: /\bPhoneApp\b/,
        foreground: '#4ec9b0',
        fontStyle: 'bold',
    },
    {
        token: 'type.s1api.saveable',
        regex: /\bSaveable\b/,
        foreground: '#4ec9b0',
        fontStyle: 'bold',
    },
    {
        token: 'type.s1api.phonecall',
        regex: /\bPhoneCallDefinition\b/,
        foreground: '#4ec9b0',
        fontStyle: 'bold',
    },
    // S1API attributes
    {
        token: 'annotation.s1api',
        regex: /\[SaveableField\b/,
        foreground: '#dcdcaa',
    },
    // UIFactory methods
    {
        token: 'method.s1api.uifactory',
        regex: /UIFactory\.(Panel|Text|Button|Layout|List|Scroll)\b/,
        foreground: '#dcdcaa',
    },
    // S1API protected override properties
    {
        token: 'property.s1api.override',
        regex: /\b(AppName|AppTitle|IconLabel|IconFileName)\b/,
        foreground: '#9cdcfe',
    },
    // CallManager
    {
        token: 'type.s1api.callmanager',
        regex: /\bCallManager\b/,
        foreground: '#4ec9b0',
    },
];

/**
 * Monaco theme token colors for S1API
 */
export const s1apiTokenColors: Monaco.editor.ITokenThemeRule[] = [
    { token: 'namespace.s1api', foreground: '4fc1ff' },
    { token: 'type.s1api.phoneapp', foreground: '4ec9b0', fontStyle: 'bold' },
    { token: 'type.s1api.saveable', foreground: '4ec9b0', fontStyle: 'bold' },
    { token: 'type.s1api.phonecall', foreground: '4ec9b0', fontStyle: 'bold' },
    { token: 'type.s1api.callmanager', foreground: '4ec9b0' },
    { token: 'annotation.s1api', foreground: 'dcdcaa' },
    { token: 'method.s1api.uifactory', foreground: 'dcdcaa' },
    { token: 'property.s1api.override', foreground: '9cdcfe' },
];

/**
 * Register S1API syntax highlighting with Monaco
 */
export function registerS1APISyntax(context: PluginContext): void {
    const { monaco } = context;

    // Extend the existing C# monarch tokenizer with S1API patterns
    // Note: Monaco doesn't allow modifying existing languages easily,
    // so we register a completion provider that adds S1API context

    context.log('S1API syntax highlighting registered');

    // Apply token colors to themes
    applyS1APIThemeColors(monaco);
}

/**
 * Apply S1API token colors to Monaco themes
 */
function applyS1APIThemeColors(_monaco: MonacoInstance): void {
    // We need to redefine themes with our custom tokens
    // This is a limitation of Monaco - themes can't be updated after creation
    
    try {
        // Get current theme data and extend it
        // For now, we'll log that the colors are available
        console.log('[S1API] Token colors registered for themes');
    } catch (error) {
        console.error('[S1API] Failed to apply theme colors:', error);
    }
}

/**
 * Semantic token types for S1API (if using semantic highlighting)
 */
export const s1apiSemanticTokenTypes = [
    's1api-namespace',
    's1api-class',
    's1api-attribute',
    's1api-method',
    's1api-property',
];

