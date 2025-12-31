/**
 * S1API IntelliSense / Completion Provider
 * 
 * Provides code completions for S1API classes, methods, and patterns.
 */

import type { CompletionProvider, CompletionItem, PluginContext } from '@/lib/plugins/types';
import type * as Monaco from 'monaco-editor';

/**
 * S1API completion items
 */
function createS1APICompletions(monaco: typeof Monaco): CompletionItem[] {
    return [
        // PhoneApp overrides
        {
            label: 'AppName',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'protected override string AppName => "${1:MyApp}";',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'The internal name of the phone app (used for identification).',
            detail: 'S1API PhoneApp override',
            sortText: '0_appname',
        },
        {
            label: 'AppTitle',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'protected override string AppTitle => "${1:My App}";',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'The display title shown in the phone app.',
            detail: 'S1API PhoneApp override',
            sortText: '0_apptitle',
        },
        {
            label: 'IconLabel',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'protected override string IconLabel => "${1:App}";',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'The label shown under the app icon on the home screen.',
            detail: 'S1API PhoneApp override',
            sortText: '0_iconlabel',
        },
        {
            label: 'IconFileName',
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: 'protected override string IconFileName => "${1:icon.png}";',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'The filename of the app icon (placed next to the mod DLL).',
            detail: 'S1API PhoneApp override',
            sortText: '0_iconfilename',
        },

        // PhoneApp lifecycle methods
        {
            label: 'OnCreated',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: [
                'protected override void OnCreated()',
                '{',
                '\tbase.OnCreated();',
                '\t$0',
                '}',
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Called when the phone app is created. Initialize instance references here.',
            detail: 'S1API PhoneApp lifecycle',
            sortText: '1_oncreated',
        },
        {
            label: 'OnCreatedUI',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: [
                'protected override void OnCreatedUI(GameObject container)',
                '{',
                '\t$0',
                '}',
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Called when the phone app UI should be created. Build your UI here.',
            detail: 'S1API PhoneApp lifecycle',
            sortText: '1_oncreatedui',
        },

        // UIFactory methods
        {
            label: 'UIFactory.Panel',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: 'UIFactory.Panel("${1:PanelName}", ${2:parent}.transform, new Color(${3:0.1f}, ${4:0.1f}, ${5:0.1f}), fullAnchor: ${6:true})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Creates a UI panel with the specified name, parent, color, and anchoring.',
            detail: 'S1API UIFactory',
            sortText: '2_panel',
        },
        {
            label: 'UIFactory.Text',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: 'UIFactory.Text("${1:TextName}", "${2:Text content}", ${3:parent}.transform, ${4:22}, TextAnchor.${5:MiddleCenter})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Creates a text element with the specified content, size, and alignment.',
            detail: 'S1API UIFactory',
            sortText: '2_text',
        },
        {
            label: 'UIFactory.Button',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: 'UIFactory.Button("${1:ButtonName}", "${2:Button Text}", ${3:parent}.transform, () => { $0 })',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Creates a button with the specified text and click handler.',
            detail: 'S1API UIFactory',
            sortText: '2_button',
        },

        // SaveableField attribute
        {
            label: 'SaveableField',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '[SaveableField("${1:field-key}")] private ${2:string} _${3:fieldName} = ${4:default};',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Marks a field to be automatically saved/loaded per save slot.',
            detail: 'S1API Saveables attribute',
            sortText: '3_saveablefield',
        },

        // Saveable lifecycle
        {
            label: 'OnLoaded',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: [
                'protected override void OnLoaded()',
                '{',
                '\t// Apply loaded data',
                '\t$0',
                '}',
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Called after saveable data is loaded from disk.',
            detail: 'S1API Saveable lifecycle',
            sortText: '3_onloaded',
        },
        {
            label: 'OnSaved',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: [
                'protected override void OnSaved()',
                '{',
                '\t// Flush caches before save',
                '\t$0',
                '}',
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Called before saveable data is written to disk.',
            detail: 'S1API Saveable lifecycle',
            sortText: '3_onsaved',
        },

        // PhoneCall patterns
        {
            label: 'PhoneCallDefinition',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
                'public class ${1:MyCall} : PhoneCallDefinition',
                '{',
                '\tprotected ${1:MyCall}() : base("${2:Caller Name}") { }',
                '',
                '\tpublic static void Enqueue()',
                '\t{',
                '\t\tvar call = new ${1:MyCall}();',
                '\t\tvar stage = call.AddStage("${3:Message}");',
                '\t\tstage.AddSystemTrigger(S1API.PhoneCalls.Constants.SystemTriggerType.StartTrigger);',
                '\t\tCallManager.QueueCall(call);',
                '\t}',
                '}',
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Creates a new phone call definition with stages and triggers.',
            detail: 'S1API PhoneCall template',
            sortText: '4_phonecall',
        },

        // CallManager
        {
            label: 'CallManager.QueueCall',
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: 'CallManager.QueueCall(${1:callDefinition})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Queues a phone call to be made to the player.',
            detail: 'S1API CallManager',
            sortText: '4_queuecall',
        },

        // Common using statements
        {
            label: 'using S1API',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
                'using S1API.PhoneApp;',
                'using S1API.UI;',
                'using S1API.Saveables;',
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Common S1API using statements for phone apps.',
            detail: 'S1API imports',
            sortText: '5_usings',
        },

        // Full PhoneApp template
        {
            label: 'S1API PhoneApp Template',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
                'using UnityEngine;',
                'using UnityEngine.UI;',
                'using S1API.PhoneApp;',
                'using S1API.UI;',
                '',
                'public class ${1:MyApp} : PhoneApp',
                '{',
                '\tpublic static ${1:MyApp} Instance;',
                '',
                '\tprotected override string AppName => "${2:myapp}";',
                '\tprotected override string AppTitle => "${3:My App}";',
                '\tprotected override string IconLabel => "${4:App}";',
                '\tprotected override string IconFileName => "${5:icon.png}";',
                '',
                '\tprotected override void OnCreated()',
                '\t{',
                '\t\tbase.OnCreated();',
                '\t\tInstance = this;',
                '\t}',
                '',
                '\tprotected override void OnCreatedUI(GameObject container)',
                '\t{',
                '\t\tvar panel = UIFactory.Panel("MainPanel", container.transform, new Color(0.1f, 0.1f, 0.1f), fullAnchor: true);',
                '\t\tUIFactory.Text("Title", "📱 ${3:My App}", panel.transform, 22, TextAnchor.MiddleCenter);',
                '\t\t$0',
                '\t}',
                '}',
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Complete S1API PhoneApp template with all required overrides and UI setup.',
            detail: 'S1API full template',
            sortText: '0_template',
        },
    ];
}

/**
 * S1API Completion Provider
 */
export function createS1APICompletionProvider(context: PluginContext): CompletionProvider {
    const completions = createS1APICompletions(context.monaco);

    return {
        triggerCharacters: ['.', '[', ' '],

        provideCompletionItems(
            model,
            position,
            _completionContext,
            _token
        ): CompletionItem[] {
            const lineContent = model.getLineContent(position.lineNumber);
            const textUntilPosition = lineContent.substring(0, position.column - 1);

            // Check if we're in a context where S1API completions make sense
            const isAfterColon = textUntilPosition.trim().endsWith(':');
            const isAfterOverride = /override\s+\w*$/.test(textUntilPosition);
            const isAfterUIFactory = /UIFactory\.$/.test(textUntilPosition);
            const isAfterCallManager = /CallManager\.$/.test(textUntilPosition);
            const isEmptyOrUsing = textUntilPosition.trim() === '' || textUntilPosition.includes('using');
            const isInClass = /class\s+\w+\s*:\s*\w*$/.test(textUntilPosition);

            // Filter completions based on context
            let filteredCompletions = completions;

            if (isAfterUIFactory) {
                filteredCompletions = completions.filter(c => 
                    c.label.toString().startsWith('UIFactory.')
                );
            } else if (isAfterCallManager) {
                filteredCompletions = completions.filter(c => 
                    c.label.toString().startsWith('CallManager.')
                );
            } else if (isAfterOverride || isAfterColon) {
                filteredCompletions = completions.filter(c => 
                    c.detail?.includes('override') || c.detail?.includes('lifecycle')
                );
            } else if (isInClass) {
                // Show base class completions
                filteredCompletions = completions.filter(c =>
                    c.detail?.includes('template') || c.kind === context.monaco.languages.CompletionItemKind.Class
                );
            }

            // Always include templates at the top when starting fresh
            if (isEmptyOrUsing && !isAfterUIFactory && !isAfterCallManager) {
                const templates = completions.filter(c => 
                    c.label.toString().includes('Template') || c.label.toString().startsWith('using')
                );
                filteredCompletions = [...templates, ...filteredCompletions.filter(c => !templates.includes(c))];
            }

            return filteredCompletions;
        },
    };
}

/**
 * Register S1API IntelliSense with the plugin context
 */
export function registerS1APIIntelliSense(context: PluginContext): void {
    const provider = createS1APICompletionProvider(context);
    context.registerCompletionProvider('csharp', provider);
    context.log('S1API IntelliSense registered');
}

