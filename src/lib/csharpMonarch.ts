import type * as Monaco from 'monaco-editor';

/**
 * Monarch tokenizer for C# language
 * Provides comprehensive syntax highlighting for C# code
 */
export const csharpMonarch: Monaco.languages.IMonarchLanguage = {
    defaultToken: '',
    tokenPostfix: '.cs',

    // Keywords
    keywords: [
        'abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch', 'char',
        'checked', 'class', 'const', 'continue', 'decimal', 'default', 'delegate',
        'do', 'double', 'else', 'enum', 'event', 'explicit', 'extern', 'false',
        'finally', 'fixed', 'float', 'for', 'foreach', 'goto', 'if', 'implicit',
        'in', 'int', 'interface', 'internal', 'is', 'lock', 'long', 'namespace',
        'new', 'null', 'object', 'operator', 'out', 'override', 'params', 'private',
        'protected', 'public', 'readonly', 'ref', 'return', 'sbyte', 'sealed',
        'short', 'sizeof', 'stackalloc', 'static', 'string', 'struct', 'switch',
        'this', 'throw', 'true', 'try', 'typeof', 'uint', 'ulong', 'unchecked',
        'unsafe', 'ushort', 'using', 'virtual', 'void', 'volatile', 'while',
    ],

    // Contextual keywords
    contextualKeywords: [
        'add', 'alias', 'ascending', 'async', 'await', 'by', 'descending', 'dynamic',
        'equals', 'from', 'get', 'global', 'group', 'into', 'join', 'let', 'nameof',
        'on', 'orderby', 'partial', 'remove', 'select', 'set', 'value', 'var',
        'when', 'where', 'yield', 'record', 'init', 'with', 'and', 'or', 'not', 'nint', 'nuint'
    ],

    // Type keywords (built-in types)
    typeKeywords: [
        'bool', 'byte', 'sbyte', 'char', 'decimal', 'double', 'float', 'int', 'uint',
        'long', 'ulong', 'short', 'ushort', 'object', 'string', 'dynamic', 'void',
        'var', 'nint', 'nuint'
    ],

    // Operators
    operators: [
        '=', '??', '??=', '||', '&&', '==', '!=', '<', '>', '<=', '>=', '+', '-', '*', '/',
        '%', '!', '~', '&', '|', '^', '<<', '>>', '++', '--', '+=', '-=', '*=', '/=',
        '%=', '&=', '|=', '^=', '<<=', '>>=', '=>', '?', ':', '?.', '??'
    ],

    // Common symbols  
    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

    // Tokenizer rules
    tokenizer: {
        root: [
            // Whitespace
            { include: '@whitespace' },

            // Preprocessor directives
            [/^\s*#\s*\w+/, 'keyword.preprocessor'],

            // Attributes
            [/\[/, { token: 'delimiter.square', next: '@attribute' }],

            // Access modifiers and modifiers that precede type names
            [/\b(private|public|protected|internal|static|readonly|const|volatile|sealed|abstract|virtual|override|async|extern|unsafe|fixed)\b/, 
                { token: 'keyword', next: '@aftermodifier' }],

            // After 'new' keyword - next identifier is a type
            [/\bnew\b/, { token: 'keyword', next: '@afternew' }],

            // After 'as' or 'is' keyword - next identifier is a type
            [/\b(as|is)\b/, { token: 'keyword', next: '@afterasoris' }],

            // After 'typeof' - next identifier is a type
            [/\btypeof\b/, { token: 'keyword', next: '@aftertypeof' }],

            // After 'using' - next identifier is namespace/type
            [/\busing\b/, { token: 'keyword', next: '@afterusing' }],

            // After 'return' - next identifier might be a type (in some contexts)
            [/\breturn\b/, { token: 'keyword', next: '@afterreturn' }],

            // After ':' in inheritance/interface - next identifier is a type
            [/:/, { token: 'delimiter', next: '@aftercolon' }],

            // Generic type parameters <T>
            [/</, { token: 'delimiter.angle', next: '@generic' }],

            // Type keywords (built-in types) and identifiers
            [/\@?[a-zA-Z_]\w*/, {
                cases: {
                    '@typeKeywords': 'keyword.type',
                    '@keywords': 'keyword',
                    '@contextualKeywords': 'keyword',
                    '@default': 'identifier'
                }
            }],

            // Delimiters and operators
            [/[{}()\[\]]/, '@brackets'],
            [/[<>](?!@symbols)/, '@brackets'],
            [/@symbols/, {
                cases: {
                    '@operators': 'operator',
                    '@default': ''
                }
            }],

            // Numbers
            [/\d*\.\d+([eE][\-+]?\d+)?[fFdDmM]?/, 'number.float'],
            [/0[xX][0-9a-fA-F_]+[lLuU]*/, 'number.hex'],
            [/0[bB][01_]+[lLuU]*/, 'number.binary'],
            [/\d+[lLuU]*/, 'number'],

            // Delimiter
            [/[;,.]/, 'delimiter'],

            // Strings
            [/@"/, { token: 'string.quote', next: '@verbatimstring' }],
            [/\$@"/, { token: 'string.quote', next: '@interpolatedverbatimstring' }],
            [/\$"/, { token: 'string.quote', next: '@interpolatedstring' }],
            [/"([^"\\]|\\.)*$/, 'string.invalid'],
            [/"/, { token: 'string.quote', next: '@string' }],

            // Characters
            [/'[^\\']'/, 'string.char'],
            [/(')(@escapes)(')/, ['string.char', 'string.escape', 'string.char']],
            [/'/, 'string.invalid']
        ],

        // After access modifiers - detect type name vs variable name
        aftermodifier: [
            { include: '@whitespace' },
            // More modifiers (can have multiple like "private static readonly")
            [/\b(private|public|protected|internal|static|readonly|const|volatile|sealed|abstract|virtual|override|async|extern|unsafe|fixed)\b/, 
                { token: 'keyword', next: '@aftermodifier' }],
            // Type keywords
            [/\@?[a-zA-Z_]\w*/, {
                cases: {
                    '@typeKeywords': { token: 'keyword.type', next: '@aftertype' },
                    '@keywords': { token: 'keyword', next: '@pop' },
                    '@contextualKeywords': { token: 'keyword', next: '@pop' },
                    // If it's an identifier after modifiers, it's likely a type name
                    '@default': { token: 'type.identifier', next: '@aftertype' }
                }
            }],
            // Generic brackets - if we see < before a type name, we'll handle it in aftertype
            // But if we're here, it means we haven't seen the type name yet, so pop
            [/</, { token: 'delimiter.angle', next: '@pop' }],
            // Other cases - pop back to root
            [/./, { token: '', next: '@pop' }]
        ],

        // After type name - expect variable name or more type syntax
        aftertype: [
            { include: '@whitespace' },
            // Nullable type indicator
            [/\?/, { token: 'operator', next: '@aftertype' }],
            // Generic brackets - push generic state, then return here
            [/</, { token: 'delimiter.angle', next: '@generic' }],
            // Array brackets
            [/\[/, { token: 'delimiter.square', next: '@aftertype' }],
            // Variable name (identifier starting with _ or lowercase is likely a variable)
            [/\@?[a-zA-Z_]\w*/, {
                cases: {
                    '@keywords': { token: 'keyword', next: '@pop' },
                    '@contextualKeywords': { token: 'keyword', next: '@pop' },
                    // After type, identifier is the variable name
                    '@default': { token: 'identifier', next: '@pop' }
                }
            }],
            // Assignment or other operators
            [/=/, { token: 'operator', next: '@pop' }],
            // Semicolon or comma ends the declaration
            [/[;,.]/, { token: 'delimiter', next: '@pop' }],
            // Closing brace/paren might end declaration
            [/[})]/, { token: '@brackets', next: '@pop' }],
            // Other cases - pop back to root
            [/./, { token: '', next: '@pop' }]
        ],

        // After 'new' keyword
        afternew: [
            { include: '@whitespace' },
            [/\@?[a-zA-Z_]\w*/, {
                cases: {
                    '@typeKeywords': { token: 'keyword.type', next: '@pop' },
                    '@keywords': { token: 'keyword', next: '@pop' },
                    // After 'new', identifier is a type name
                    '@default': { token: 'type.identifier', next: '@pop' }
                }
            }],
            [/./, { token: '', next: '@pop' }]
        ],

        // After 'as' or 'is' keyword
        afterasoris: [
            { include: '@whitespace' },
            [/\@?[a-zA-Z_]\w*/, {
                cases: {
                    '@typeKeywords': { token: 'keyword.type', next: '@pop' },
                    '@keywords': { token: 'keyword', next: '@pop' },
                    // After 'as'/'is', identifier is a type name
                    '@default': { token: 'type.identifier', next: '@pop' }
                }
            }],
            [/./, { token: '', next: '@pop' }]
        ],

        // After ':' (inheritance/interface)
        aftercolon: [
            { include: '@whitespace' },
            [/\@?[a-zA-Z_]\w*/, {
                cases: {
                    '@typeKeywords': { token: 'keyword.type', next: '@pop' },
                    '@keywords': { token: 'keyword', next: '@pop' },
                    // After ':', identifier is likely a type name
                    '@default': { token: 'type.identifier', next: '@pop' }
                }
            }],
            [/./, { token: '', next: '@pop' }]
        ],

        // After 'typeof'
        aftertypeof: [
            { include: '@whitespace' },
            [/\(/, { token: 'delimiter.parenthesis', next: '@pop' }],
            [/\@?[a-zA-Z_]\w*/, {
                cases: {
                    '@typeKeywords': { token: 'keyword.type', next: '@pop' },
                    '@keywords': { token: 'keyword', next: '@pop' },
                    // After 'typeof', identifier is a type name
                    '@default': { token: 'type.identifier', next: '@pop' }
                }
            }],
            [/./, { token: '', next: '@pop' }]
        ],

        // After 'using'
        afterusing: [
            { include: '@whitespace' },
            [/\@?[a-zA-Z_]\w*/, {
                cases: {
                    '@typeKeywords': { token: 'keyword.type', next: '@pop' },
                    '@keywords': { token: 'keyword', next: '@pop' },
                    // After 'using', identifier is namespace/type
                    '@default': { token: 'type.identifier', next: '@pop' }
                }
            }],
            [/./, { token: '', next: '@pop' }]
        ],

        // After 'return' (might be a type in some contexts, but usually not)
        afterreturn: [
            { include: '@whitespace' },
            [/\@?[a-zA-Z_]\w*/, {
                cases: {
                    '@typeKeywords': { token: 'keyword.type', next: '@pop' },
                    '@keywords': { token: 'keyword', next: '@pop' },
                    '@default': { token: 'identifier', next: '@pop' }
                }
            }],
            [/./, { token: '', next: '@pop' }]
        ],

        // Generic type parameters
        generic: [
            { include: '@whitespace' },
            [/\@?[a-zA-Z_]\w*/, {
                cases: {
                    '@typeKeywords': 'keyword.type',
                    '@keywords': 'keyword',
                    // In generics, identifiers are type parameters or type names
                    '@default': 'type.identifier'
                }
            }],
            [/</, { token: 'delimiter.angle', next: '@generic' }], // nested generics
            [/>/, { token: 'delimiter.angle', next: '@pop' }],
            [/[,\?]/, 'delimiter'],
            [/./, '']
        ],

        whitespace: [
            [/[ \t\r\n]+/, ''],
            [/\/\*/, 'comment', '@comment'],
            [/\/\/.*$/, 'comment'],
            [/\/\/\/.*$/, 'comment.doc']
        ],

        comment: [
            [/[^\/*]+/, 'comment'],
            [/\*\//, 'comment', '@pop'],
            [/[\/*]/, 'comment']
        ],

        attribute: [
            { include: '@whitespace' },
            [/[a-zA-Z_]\w*/, 'attribute'],
            [/\]/, { token: 'delimiter.square', next: '@pop' }],
            [/"([^"\\]|\\.)*$/, 'string.invalid'],
            [/"/, { token: 'string.quote', next: '@string' }],
            { include: '@root' }
        ],

        string: [
            [/[^\\"]+/, 'string'],
            [/@escapes/, 'string.escape'],
            [/\\./, 'string.escape.invalid'],
            [/"/, { token: 'string.quote', next: '@pop' }]
        ],

        verbatimstring: [
            [/[^"]+/, 'string'],
            [/""/, 'string.escape'],
            [/"/, { token: 'string.quote', next: '@pop' }]
        ],

        interpolatedstring: [
            [/[^\\"{]+/, 'string'],
            [/@escapes/, 'string.escape'],
            [/\\./, 'string.escape.invalid'],
            [/{{/, 'string.escape'],
            [/{/, { token: 'string.quote', next: '@interpolation' }],
            [/"/, { token: 'string.quote', next: '@pop' }]
        ],

        interpolatedverbatimstring: [
            [/[^"{]+/, 'string'],
            [/{{/, 'string.escape'],
            [/""/, 'string.escape'],
            [/{/, { token: 'string.quote', next: '@interpolation' }],
            [/"/, { token: 'string.quote', next: '@pop' }]
        ],

        interpolation: [
            [/{/, { token: 'string.quote', next: '@interpolation' }],  // nested
            [/}/, { token: 'string.quote', next: '@pop' }],
            { include: '@root' }
        ],
    }
};
