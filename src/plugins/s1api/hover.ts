/**
 * S1API Hover Provider
 * 
 * Provides hover documentation with links to S1API docs.
 */

import type { HoverProvider, HoverInfo, PluginContext } from '@/lib/plugins/types';

/**
 * S1API documentation entries
 */
interface DocEntry {
    pattern: RegExp;
    title: string;
    description: string;
    docUrl?: string;
    example?: string;
}

const S1API_DOCS_BASE = 'https://ifbars.github.io/S1API/docs';

/**
 * Documentation database for S1API types and methods
 */
const S1API_DOCUMENTATION: DocEntry[] = [
    // PhoneApp class
    {
        pattern: /\bPhoneApp\b/,
        title: 'S1API.PhoneApp.PhoneApp',
        description: 'Base class for creating phone applications in Schedule One. Derive from this class to create custom phone apps that appear on the in-game phone.',
        docUrl: `${S1API_DOCS_BASE}/phone-apps.html`,
        example: `public class MyApp : PhoneApp { ... }`,
    },
    // PhoneApp properties
    {
        pattern: /\bAppName\b/,
        title: 'PhoneApp.AppName',
        description: 'Internal identifier for the phone app. Used for registration and lookup. Should be unique across all mods.',
        docUrl: `${S1API_DOCS_BASE}/phone-apps.html`,
    },
    {
        pattern: /\bAppTitle\b/,
        title: 'PhoneApp.AppTitle',
        description: 'Display title shown in the phone app header. This is what players see when they open your app.',
        docUrl: `${S1API_DOCS_BASE}/phone-apps.html`,
    },
    {
        pattern: /\bIconLabel\b/,
        title: 'PhoneApp.IconLabel',
        description: 'Short label displayed under the app icon on the phone home screen. Keep it brief (1-2 words).',
        docUrl: `${S1API_DOCS_BASE}/phone-apps.html`,
    },
    {
        pattern: /\bIconFileName\b/,
        title: 'PhoneApp.IconFileName',
        description: 'Filename of the app icon image. Place the image file next to your mod DLL. Recommended size: 128x128 pixels.',
        docUrl: `${S1API_DOCS_BASE}/phone-apps.html`,
    },
    // PhoneApp lifecycle
    {
        pattern: /\bOnCreated\b/,
        title: 'PhoneApp.OnCreated()',
        description: 'Called when the phone app instance is created. Use this to store the Instance reference and initialize non-UI state.',
        docUrl: `${S1API_DOCS_BASE}/phone-apps.html`,
        example: `protected override void OnCreated() { base.OnCreated(); Instance = this; }`,
    },
    {
        pattern: /\bOnCreatedUI\b/,
        title: 'PhoneApp.OnCreatedUI(GameObject container)',
        description: 'Called when the app UI should be built. Create your UI elements here using UIFactory.',
        docUrl: `${S1API_DOCS_BASE}/phone-apps.html`,
        example: `protected override void OnCreatedUI(GameObject container) { var panel = UIFactory.Panel("Main", container.transform, Color.black); }`,
    },

    // Saveable system
    {
        pattern: /\bSaveable\b/,
        title: 'S1API.Saveables.Saveable',
        description: 'Base class for persistent mod data. Fields marked with [SaveableField] are automatically saved and loaded per save slot.',
        docUrl: `${S1API_DOCS_BASE}/save-system.html`,
    },
    {
        pattern: /\bSaveableField\b/,
        title: '[SaveableField] Attribute',
        description: 'Marks a field for automatic persistence. The string parameter is the JSON key used for storage.',
        docUrl: `${S1API_DOCS_BASE}/save-system.html`,
        example: `[SaveableField("player-notes")] private List<string> _notes = new();`,
    },
    {
        pattern: /\bOnLoaded\b/,
        title: 'Saveable.OnLoaded()',
        description: 'Called after save data is loaded from disk. Use this to apply loaded values to game state.',
        docUrl: `${S1API_DOCS_BASE}/save-system.html`,
    },
    {
        pattern: /\bOnSaved\b/,
        title: 'Saveable.OnSaved()',
        description: 'Called before save data is written to disk. Use this to flush caches or prepare data for persistence.',
        docUrl: `${S1API_DOCS_BASE}/save-system.html`,
    },

    // UIFactory
    {
        pattern: /\bUIFactory\b/,
        title: 'S1API.UI.UIFactory',
        description: 'Utility class for creating UI elements quickly and consistently. Provides methods for panels, text, buttons, layouts, and more.',
        docUrl: `${S1API_DOCS_BASE}/ui.html`,
    },
    {
        pattern: /UIFactory\.Panel\b/,
        title: 'UIFactory.Panel()',
        description: 'Creates a UI panel with background color. Use `fullAnchor: true` to stretch to fill the parent container.',
        docUrl: `${S1API_DOCS_BASE}/ui.html`,
        example: `UIFactory.Panel("MainPanel", parent.transform, new Color(0.1f, 0.1f, 0.1f), fullAnchor: true)`,
    },
    {
        pattern: /UIFactory\.Text\b/,
        title: 'UIFactory.Text()',
        description: 'Creates a text element with customizable font size and alignment.',
        docUrl: `${S1API_DOCS_BASE}/ui.html`,
        example: `UIFactory.Text("Title", "Hello World", panel.transform, 22, TextAnchor.MiddleCenter)`,
    },
    {
        pattern: /UIFactory\.Button\b/,
        title: 'UIFactory.Button()',
        description: 'Creates a clickable button with text label and click handler.',
        docUrl: `${S1API_DOCS_BASE}/ui.html`,
        example: `UIFactory.Button("Submit", "Click Me", panel.transform, () => Debug.Log("Clicked!"))`,
    },

    // Phone Calls
    {
        pattern: /\bPhoneCallDefinition\b/,
        title: 'S1API.PhoneCalls.PhoneCallDefinition',
        description: 'Base class for defining scripted phone calls. Create stages with messages and triggers to build call flows.',
        docUrl: `${S1API_DOCS_BASE}/phone-calls.html`,
    },
    {
        pattern: /\bCallManager\b/,
        title: 'S1API.PhoneCalls.CallManager',
        description: 'Static class for queueing and managing phone calls. Use QueueCall() to schedule a call.',
        docUrl: `${S1API_DOCS_BASE}/phone-calls.html`,
    },
    {
        pattern: /\bQueueCall\b/,
        title: 'CallManager.QueueCall()',
        description: 'Queues a phone call to be made to the player. The call will ring when the game is ready.',
        docUrl: `${S1API_DOCS_BASE}/phone-calls.html`,
        example: `CallManager.QueueCall(new MyPhoneCall())`,
    },
    {
        pattern: /\bAddStage\b/,
        title: 'PhoneCallDefinition.AddStage()',
        description: 'Adds a new stage to the phone call with the specified message. Returns the stage for adding triggers.',
        docUrl: `${S1API_DOCS_BASE}/phone-calls.html`,
    },
    {
        pattern: /\bSystemTriggerType\b/,
        title: 'S1API.PhoneCalls.Constants.SystemTriggerType',
        description: 'Enum of system triggers for phone call stages: StartTrigger, EndTrigger, etc.',
        docUrl: `${S1API_DOCS_BASE}/phone-calls.html`,
    },

    // Cross-runtime
    {
        pattern: /\bMonoMelon\b/,
        title: 'S1API MonoMelon',
        description: 'Configuration for Mono runtime builds of S1API mods.',
        docUrl: `${S1API_DOCS_BASE}/getting-started.html`,
    },
    {
        pattern: /\bIl2CppMelon\b/,
        title: 'S1API Il2CppMelon',
        description: 'Configuration for IL2CPP runtime builds of S1API mods.',
        docUrl: `${S1API_DOCS_BASE}/getting-started.html`,
    },
];

/**
 * Find matching documentation for the word at position
 */
function findDocumentation(word: string): DocEntry | null {
    for (const doc of S1API_DOCUMENTATION) {
        if (doc.pattern.test(word)) {
            return doc;
        }
    }
    return null;
}

/**
 * Format documentation as Markdown
 */
function formatDocumentation(doc: DocEntry): string[] {
    const contents: string[] = [];

    // Title
    contents.push(`**${doc.title}**`);
    contents.push('');

    // Description
    contents.push(doc.description);

    // Example
    if (doc.example) {
        contents.push('');
        contents.push('```csharp');
        contents.push(doc.example);
        contents.push('```');
    }

    // Documentation link
    if (doc.docUrl) {
        contents.push('');
        contents.push(`[📖 View S1API Documentation](${doc.docUrl})`);
    }

    return [contents.join('\n')];
}

/**
 * S1API Hover Provider
 */
export function createS1APIHoverProvider(_context: PluginContext): HoverProvider {
    return {
        provideHover(
            model,
            position,
            _token
        ): HoverInfo | null {
            // Get the word at the current position
            const wordInfo = model.getWordAtPosition(position);
            if (!wordInfo) {
                return null;
            }

            const word = wordInfo.word;

            // Also check for compound patterns like "UIFactory.Panel"
            const lineContent = model.getLineContent(position.lineNumber);
            const beforeWord = lineContent.substring(0, wordInfo.startColumn - 1);
            const compoundWord = beforeWord.endsWith('.') 
                ? beforeWord.split(/\s/).pop()?.replace('.', '') + '.' + word
                : word;

            // Try to find documentation
            const doc = findDocumentation(compoundWord) || findDocumentation(word);
            if (!doc) {
                return null;
            }

            return {
                contents: formatDocumentation(doc),
                range: {
                    startLineNumber: position.lineNumber,
                    startColumn: wordInfo.startColumn,
                    endLineNumber: position.lineNumber,
                    endColumn: wordInfo.endColumn,
                },
            };
        },
    };
}

/**
 * Register S1API hover provider with the plugin context
 */
export function registerS1APIHover(context: PluginContext): void {
    const provider = createS1APIHoverProvider(context);
    context.registerHoverProvider('csharp', provider);
    context.log('S1API hover documentation registered');
}

