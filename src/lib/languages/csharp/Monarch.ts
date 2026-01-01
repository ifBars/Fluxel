import type * as Monaco from 'monaco-editor';

/**
 * Enhanced Monarch tokenizer for C# language
 * Provides better differentiation between token types:
 * - Type names (class, interface, struct references)
 * - Method/function calls
 * - Parameters
 * - Variables
 * - Attributes
 * - Generic type parameters
 * 
 * @see https://github.com/microsoft/monaco-editor/blob/main/src/basic-languages/csharp/csharp.ts
 */
export const csharpMonarch: Monaco.languages.IMonarchLanguage = {
    defaultToken: '',
    tokenPostfix: '.cs',

    // C# keywords
    keywords: [
        'abstract', 'as', 'base', 'break', 'case', 'catch',
        'checked', 'const', 'continue', 'default', 'delegate',
        'do', 'else', 'event', 'explicit', 'extern', 'false',
        'finally', 'fixed', 'for', 'foreach', 'goto', 'if', 'implicit',
        'in', 'internal', 'is', 'lock', 'new', 'null', 'operator', 'out', 'override', 'params', 'private',
        'protected', 'public', 'readonly', 'ref', 'return', 'sealed',
        'sizeof', 'stackalloc', 'static', 'switch',
        'this', 'throw', 'true', 'try', 'typeof', 'unchecked',
        'unsafe', 'virtual', 'volatile', 'while',
        // Contextual keywords
        'add', 'alias', 'ascending', 'async', 'await', 'by', 'descending', 'dynamic',
        'equals', 'from', 'get', 'global', 'group', 'into', 'join', 'let', 'nameof',
        'on', 'orderby', 'partial', 'remove', 'select', 'set', 'value', 'var',
        'when', 'where', 'yield', 'record', 'init', 'with', 'and', 'or', 'not',
        'required', 'scoped', 'file'
    ],

    // Built-in type keywords - these get special coloring
    typeKeywords: [
        'bool', 'byte', 'char', 'decimal', 'double', 'float', 'int', 'long',
        'object', 'sbyte', 'short', 'string', 'uint', 'ulong', 'ushort', 'void',
        'nint', 'nuint'
    ],

    // Keywords that introduce a type context (next identifier is a type)
    typeFollows: [
        'class', 'interface', 'struct', 'enum', 'namespace'
    ],

    // Keywords that indicate the next token should be treated as a namespace
    namespaceFollows: [
        'namespace', 'using'
    ],

    // C# operators
    operators: [
        '=', '??', '||', '&&', '|', '^', '&', '==', '!=', '<=', '>=', '<<',
        '+', '-', '*', '/', '%', '!', '~', '++', '--', '+=',
        '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=', '>>', '=>'
    ],

    // Common symbols
    symbols: /[=><!~?:&|+\-*\/\^%]+/,

    // Escape sequences
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

    // Tokenizer rules with enhanced differentiation
    tokenizer: {
        root: [
            // IMPORTANT: Whitespace and comments MUST come first to prevent
            // comment text from being tokenized as identifiers
            { include: '@whitespace' },

            // Strings - MUST come early to prevent other rules from consuming quote chars
            [/"([^"\\]|\\.)*$/, 'string.invalid'],  // non-terminated string
            [/"/, { token: 'string.quote', next: '@string' }],
            [/\$@"/, { token: 'string.quote', next: '@litinterpstring' }],
            [/@\$"/, { token: 'string.quote', next: '@litinterpstring' }],
            [/@"/, { token: 'string.quote', next: '@litstring' }],
            [/\$"/, { token: 'string.quote', next: '@interpolatedstring' }],

            // Characters
            [/'[^\\']'/, 'string'],
            [/(')(@escapes)(')/, ['string', 'string.escape', 'string']],
            [/'/, 'string.invalid'],

            // Attributes: [AttributeName] - only when [ is followed by uppercase letter
            // This prevents array indexing and collection expressions from being mishandled
            [/\[(?=[A-Z])/, { token: '@brackets', next: '@attribute' }],

            // Preprocessor directives
            [/^[ \t\v\f]*#\w.*$/, 'namespace.cpp'],

            // Type declarations: class Foo, interface IBar, struct Baz, enum MyEnum
            [/(class|interface|struct|enum|record)(\s+)([A-Z]\w*)/, [
                { token: 'keyword.$1' },
                '',
                'type.identifier'
            ]],

            // Namespace declarations: namespace Foo.Bar
            [/(namespace)(\s+)/, [
                { token: 'keyword.$1' },
                { token: '', next: '@namespace' }
            ]],

            // Generic type parameters in declaration: <T, TKey, TValue>
            [/<(?=[A-Z])/, { token: '@brackets', next: '@typeArguments' }],

            // Method call detection: identifier followed by ( - must be before generic identifier rules
            // This handles: DoSomething(, Console.WriteLine(, etc.
            [/([a-z_]\w*)(\s*)(\()/, [
                'function',
                '',
                '@brackets'
            ]],

            // Method call with generics: Method<T>(
            [/([a-z_]\w*)(\s*)(<)/, [
                'function',
                '',
                { token: '@brackets', next: '@typeArguments' }
            ]],

            // Property/Field access on type: Type.Property or Type.Field
            [/([A-Z]\w*)(\.)([A-Z]\w*)(?=\s*[\.])/, [
                'type.identifier',
                'delimiter',
                'type.identifier'
            ]],

            // Type followed by property/method: Console.WriteLine
            [/([A-Z]\w*)(\.)([a-z_]\w*)(\s*)(\()/, [
                'type.identifier',
                'delimiter',
                'function',
                '',
                '@brackets'
            ]],

            // Type.Property or Type.StaticField
            [/([A-Z]\w*)(\.)([A-Z]\w*)/, [
                'type.identifier',
                'delimiter',
                'property'
            ]],

            // Type.member (property or field access)
            [/([A-Z]\w*)(\.)([a-z_]\w*)/, [
                'type.identifier',
                'delimiter',
                'property'
            ]],

            // Variable/instance method call: instance.Method(
            [/([a-z_]\w*)(\.)([a-z_]\w*)(\s*)(\()/, [
                'variable',
                'delimiter',
                'function',
                '',
                '@brackets'
            ]],

            // Variable.Property access
            [/([a-z_]\w*)(\.)([a-zA-Z_]\w*)/, [
                'variable',
                'delimiter',
                'property'
            ]],

            // Cast expressions: (Type)
            [/(\()([A-Z]\w*)(\))(?=\s*[a-z_\(])/, [
                '@brackets',
                'type.identifier',
                '@brackets'
            ]],

            // Type reference in variable declaration: Type variableName (PascalCase followed by camelCase)
            [/([A-Z]\w*)(?=\s+[a-z_]\w*\s*[=;,\)])/, 'type.identifier'],

            // Type reference in array: Type[]
            [/([A-Z]\w*)(?=\s*\[\s*\])/, 'type.identifier'],

            // Type reference with generics: List<, Dictionary<
            [/([A-Z]\w*)(<)/, [
                'type.identifier',
                { token: '@brackets', next: '@typeArguments' }
            ]],

            // Nullable type: Type?
            [/([A-Z]\w*)(\?)/, [
                'type.identifier',
                'delimiter'
            ]],

            // new Type( - constructor call
            [/(new)(\s+)([A-Z]\w*)/, [
                'keyword',
                '',
                'type.identifier'
            ]],

            // Inheritance/implementation: : BaseClass, IInterface
            [/(:)(\s*)([A-Z]\w*)/, [
                'delimiter',
                '',
                'type.identifier'
            ]],

            // typeof(Type), nameof(Type), default(Type)
            [/(typeof|nameof|default)(\s*)(\()([A-Z]\w*)(\))/, [
                'keyword',
                '',
                '@brackets',
                'type.identifier',
                '@brackets'
            ]],

            // is/as type checking: is Type, as Type
            [/(is|as)(\s+)([A-Z]\w*)/, [
                'keyword',
                '',
                'type.identifier'
            ]],

            // Return type before method name in declarations - e.g., "void Method", "Task<T> Method"
            // This is tricky, we handle via typeKeywords

            // Built-in type keywords (int, string, bool, etc.)
            [/@?[a-zA-Z_]\w*/, {
                cases: {
                    '@typeKeywords': 'keyword.type',
                    '@namespaceFollows': { token: 'keyword.$0', next: '@namespace' },
                    '@typeFollows': { token: 'keyword.$0' },
                    '@keywords': { token: 'keyword.$0' },
                    // PascalCase = likely type reference
                    '[A-Z]\\w*': 'type.identifier',
                    // camelCase or _underscore = variable/identifier
                    '@default': 'identifier'
                }
            }],

            // Closing bracket - check for interpolated string context
            [/}/, {
                cases: {
                    '$S2==interpolatedstring': { token: 'string.quote', next: '@pop' },
                    '$S2==litinterpstring': { token: 'string.quote', next: '@pop' },
                    '@default': '@brackets'
                }
            }],

            // Other brackets
            [/[{}()\[\]]/, '@brackets'],
            [/[<>](?!@symbols)/, '@brackets'],

            // Operators
            [/@symbols/, {
                cases: {
                    '@operators': 'delimiter',
                    '@default': ''
                }
            }],

            // Numbers
            [/[0-9_]*\.[0-9_]+([eE][\-+]?\d+)?[fFdDmM]?/, 'number.float'],
            [/0[xX][0-9a-fA-F_]+[lLuU]*/, 'number.hex'],
            [/0[bB][01_]+[lLuU]*/, 'number.hex'],
            [/[0-9_]+[lLuU]*/, 'number'],

            // Delimiter: after number because of .\d floats
            [/[;,.]/, 'delimiter']
        ],

        // Attribute context: [AttributeName] or [Attribute(args)]
        attribute: [
            { include: '@whitespace' },
            [/[A-Z]\w*/, 'attribute'],
            [/\(/, { token: '@brackets', next: '@attributeArgs' }],
            [/\]/, { token: '@brackets', next: '@pop' }],
            [/,/, 'delimiter'],
            // Fallback - if we hit something unexpected, pop back to root
            [/./, { token: '@rematch', next: '@pop' }]
        ],

        // Attribute arguments
        attributeArgs: [
            { include: '@whitespace' },
            [/[A-Z]\w*/, 'type.identifier'],
            [/[a-z_]\w*/, 'identifier'],
            [/"/, { token: 'string.quote', next: '@string' }],
            [/'[^\\']'/, 'string'],
            [/[0-9_]+/, 'number'],
            [/true|false/, 'keyword'],
            [/=/, 'delimiter'],
            [/,/, 'delimiter'],
            [/\)/, { token: '@brackets', next: '@pop' }]
        ],

        // Generic type arguments: <T, TKey, List<int>>
        typeArguments: [
            { include: '@whitespace' },
            [/@?[a-zA-Z_]\w*/, {
                cases: {
                    '@typeKeywords': 'keyword.type',
                    '@keywords': 'keyword',
                    '[A-Z]\\w*': 'type.identifier',
                    '@default': 'typeParameter'
                }
            }],
            [/</, { token: '@brackets', next: '@typeArguments' }],  // Nested generics
            [/>/, { token: '@brackets', next: '@pop' }],
            [/,/, 'delimiter'],
            [/\[\]/, 'delimiter'],  // Array type
            [/\?/, 'delimiter'],    // Nullable
            [/\./, 'delimiter']     // Qualified type name
        ],

        // Namespace handling (after 'namespace' or 'using')
        namespace: [
            { include: '@whitespace' },
            [/[A-Za-z_]\w*/, 'namespace'],
            [/[\.=;]/, { token: 'delimiter', next: '@pop' }],
            ['', '', '@pop']
        ],

        // Method parameter list context
        parameters: [
            { include: '@whitespace' },
            // Parameter modifiers
            [/(ref|out|in|params)(\s+)/, ['keyword', '']],
            // Type followed by parameter name
            [/([A-Z]\w*)(\s+)([a-z_]\w*)/, [
                'type.identifier',
                '',
                'parameter'
            ]],
            // Built-in type followed by parameter name
            [/(int|string|bool|long|double|float|decimal|char|byte|short|object|dynamic|var)(\s+)([a-z_]\w*)/, [
                'keyword.type',
                '',
                'parameter'
            ]],
            // Generic type
            [/([A-Z]\w*)(<)/, [
                'type.identifier',
                { token: '@brackets', next: '@typeArguments' }
            ]],
            [/[A-Z]\w*/, 'type.identifier'],
            [/[a-z_]\w*/, 'parameter'],
            [/,/, 'delimiter'],
            [/=/, 'delimiter'],  // Default value
            [/"/, { token: 'string.quote', next: '@string' }],
            [/[0-9]+/, 'number'],
            [/\)/, { token: '@brackets', next: '@pop' }]
        ],

        // Block comment
        comment: [
            [/[^\/*]+/, 'comment'],
            [/\/\*/, 'comment', '@push'],
            [/\*\//, 'comment', '@pop'],
            [/[\/*]/, 'comment']
        ],

        // XML documentation comment
        docComment: [
            [/[^<]+/, 'comment.doc'],
            [/<\/?[\w]+[^>]*>/, 'comment.doc.tag'],
            [/$/, 'comment.doc', '@pop']
        ],

        // Regular string
        string: [
            [/[^\\"]+/, 'string'],
            [/@escapes/, 'string.escape'],
            [/\\./, 'string.escape.invalid'],
            [/"/, { token: 'string.quote', next: '@pop' }]
        ],

        // Verbatim string (literal string)
        litstring: [
            [/[^"]+/, 'string'],
            [/""/, 'string.escape'],
            [/"/, { token: 'string.quote', next: '@pop' }]
        ],

        // Interpolated verbatim string ($@"..." or @$"...")
        litinterpstring: [
            [/[^"{]+/, 'string'],
            [/""/, 'string.escape'],
            [/{{/, 'string.escape'],
            [/}}/, 'string.escape'],
            [/{/, { token: 'string.quote', next: 'root.litinterpstring' }],
            [/"/, { token: 'string.quote', next: '@pop' }]
        ],

        // Interpolated string ($"...")
        interpolatedstring: [
            [/[^\\"{]+/, 'string'],
            [/@escapes/, 'string.escape'],
            [/\\./, 'string.escape.invalid'],
            [/{{/, 'string.escape'],
            [/}}/, 'string.escape'],
            [/{/, { token: 'string.quote', next: 'root.interpolatedstring' }],
            [/"/, { token: 'string.quote', next: '@pop' }]
        ],

        // Whitespace and comments
        whitespace: [
            [/^[ \t\v\f]*#((r)|(load))(?=\s)/, 'directive.csx'],
            [/[ \t\v\f\r\n]+/, ''],
            [/\/\*/, 'comment', '@comment'],
            [/\/\/\/.*$/, 'comment.doc'],  // XML doc comment
            [/\/\/.*$/, 'comment']
        ]
    }
};
