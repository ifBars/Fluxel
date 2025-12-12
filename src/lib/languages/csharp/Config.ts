import type * as Monaco from 'monaco-editor';
import { csharpMonarch } from './Monarch';

/**
 * C# language configuration for Monaco Editor
 * Defines syntax highlighting, brackets, comments, and other language features
 */
export const csharpLanguageConfig: Monaco.languages.LanguageConfiguration = {
    comments: {
        lineComment: '//',
        blockComment: ['/*', '*/'],
    },
    brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')'],
    ],
    autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"', notIn: ['string'] },
        { open: "'", close: "'", notIn: ['string', 'comment'] },
    ],
    surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
        { open: '<', close: '>' },
    ],
    folding: {
        markers: {
            start: /^\s*#region\b/,
            end: /^\s*#endregion\b/,
        },
    },
    wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
    indentationRules: {
        increaseIndentPattern: /^.*\{[^}"']*$/,
        decreaseIndentPattern: /^[^{]*\}/,
    },
};

// Track if we've already registered C# to prevent duplicate registrations
let csharpRegistered = false;

/**
 * Register C# language configuration with Monaco
 */
export function registerCSharpLanguage(monaco: typeof Monaco): void {
    // Prevent duplicate registration
    if (csharpRegistered) {
        return;
    }

    // Register the language
    monaco.languages.register({ id: 'csharp', extensions: ['.cs', '.csx'] });

    // Set language configuration (brackets, comments, etc.)
    monaco.languages.setLanguageConfiguration('csharp', csharpLanguageConfig);

    // Register Monarch tokenizer for syntax highlighting
    monaco.languages.setMonarchTokensProvider('csharp', csharpMonarch);

    csharpRegistered = true;
    console.log('[CSharp] Language configuration and tokenizer registered');
}
