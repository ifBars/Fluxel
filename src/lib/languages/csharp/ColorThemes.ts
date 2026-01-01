import type * as Monaco from 'monaco-editor';

/**
 * C# color themes with semantic token support
 * Semantic tokens provide better differentiation between:
 * - Class names (light blue)
 * - Method/Function names (purple)
 * - Property names (light blue)
 * - Parameters (light cyan/white)
 * - Variables (teal/light cyan)
 */

export interface CSharpColorPalette {
    keyword: string;
    keywordType: string;
    keywordPreprocessor: string;
    string: string;
    stringEscape: string;
    stringChar: string;
    stringInvalid: string;
    number: string;
    numberHex: string;
    numberBinary: string;
    numberFloat: string;
    comment: string;
    commentDoc: string;
    operator: string;
    delimiter: string;
    attribute: string;
    typeIdentifier: string;
    identifier: string;
    // Semantic tokens (LSP-provided) - Better differentiation
    semanticClass: string;
    semanticEnum: string;
    semanticInterface: string;
    semanticStruct: string;
    semanticNamespace: string;
    semanticMethod: string;
    semanticFunction: string;
    semanticParameter: string;
    semanticVariable: string;
    semanticProperty: string;
    semanticEnumMember: string;
    semanticEvent: string;
    semanticTypeParameter: string;
    semanticType: string;
}

// Default Fluxel Dark theme with improved differentiation
// Each category has a distinct color for maximum readability
export const fluxelDarkColors: CSharpColorPalette = {
    keyword: '#c586c0',                  // Purple/Magenta - keywords (if, class, return, etc.)
    keywordType: '#4ec9b0',               // Teal - built-in types (int, string, bool)
    keywordPreprocessor: '#9b9b9b',       // Gray - preprocessor directives
    string: '#ce9178',                    // Orange-brown - string literals
    stringEscape: '#d7ba7d',               // Light orange - escape sequences
    stringChar: '#ce9178',                 // Orange-brown - character literals
    stringInvalid: '#f44747',              // Red - invalid strings
    number: '#b5cea8',                    // Light green - numbers
    numberHex: '#b5cea8',                  // Light green - hex numbers
    numberBinary: '#b5cea8',               // Light green - binary numbers
    numberFloat: '#b5cea8',                // Light green - floats
    comment: '#6a9955',                    // Green - comments
    commentDoc: '#608b4e',                 // Darker green - XML doc comments
    operator: '#d4d4d4',                  // Light gray - operators
    delimiter: '#d4d4d4',                  // Light gray - delimiters
    attribute: '#4fc1ff',                 // Bright blue - attributes ([Test])
    typeIdentifier: '#4ec9b0',            // Teal - custom type names from Monarch (PascalCase)
    identifier: '#9cdcfe',                  // Light cyan - general identifiers (camelCase)
    
    // Semantic tokens - each category has its own distinct color
    semanticClass: '#4ec9b0',              // Teal - class names (MyClass)
    semanticEnum: '#b8d7a3',                // Pale green - enum types
    semanticInterface: '#9cd9a3',           // Light green - interfaces (IDisposable)
    semanticStruct: '#86c691',              // Medium green - structs
    semanticNamespace: '#c8c8c8',            // Light gray - namespaces (System.IO)
    semanticMethod: '#dcdcaa',               // Yellow - method/function calls (DoSomething)
    semanticFunction: '#dcdcaa',              // Yellow - function calls
    semanticParameter: '#7fb8d8',             // Soft blue - parameters (int x, string name)
    semanticVariable: '#9cdcfe',              // Light cyan - local variables
    semanticProperty: '#c9a0dc',              // Light purple - property access (.Length, .Count)
    semanticEnumMember: '#a8d4a8',            // Soft green - enum members (Color.Red)
    semanticEvent: '#e6c07b',                 // Orange-yellow - event names
    semanticTypeParameter: '#78dce8',       // Cyan - generic type params (<T>, <TKey>)
    semanticType: '#4ec9b0',                  // Teal - type references
};

// Default Fluxel Light theme
export const fluxelLightColors: CSharpColorPalette = {
    keyword: '#af00db',                // Purple - keywords
    keywordType: '#0078d4',             // Blue - built-in types
    keywordPreprocessor: '#808080',     // Gray - preprocessor
    string: '#a31515',                  // Green - string literals
    stringEscape: '#bf8803',             // Darker green - escape sequences
    stringChar: '#a31515',               // Green - character literals
    stringInvalid: '#cd3131',            // Red - invalid strings
    number: '#098658',                  // Orange - numbers
    numberHex: '#098658',               // Orange - hex numbers
    numberBinary: '#098658',            // Orange - binary numbers
    numberFloat: '#098658',              // Orange - floats
    comment: '#008000',                  // Dark green - comments
    commentDoc: '#008000',               // Dark green - XML doc comments
    operator: '#000000',                  // Black - operators
    delimiter: '#000000',                 // Black - delimiters
    attribute: '#2b91af',               // Dark blue - attributes
    typeIdentifier: '#0078d4',            // Blue - custom type names (classes, interfaces)
    identifier: '#001080',                 // Dark gray - general identifiers
    // Semantic tokens (LSP-provided) - Better differentiation
    semanticClass: '#0078d4',            // Blue - class declarations
    semanticEnum: '#d46e1e',              // Orange - enum declarations
    semanticInterface: '#0078d4',         // Blue - interface declarations
    semanticStruct: '#0078d4',            // Blue - struct declarations
    semanticNamespace: '#795548',          // Teal - namespace declarations
    semanticMethod: '#795e48',             // Purple - method/function declarations
    semanticFunction: '#795e48',            // Purple - function declarations
    semanticParameter: '#001080',           // Dark gray - parameters
    semanticVariable: '#795548',            // Teal - variable/field declarations
    semanticProperty: '#0078d4',           // Blue - property declarations
    semanticEnumMember: '#001080',          // Dark gray - enum members
    semanticEvent: '#d46e1e',               // Orange - event declarations
    semanticTypeParameter: '#001080',     // Dark gray - generic type parameters
    semanticType: '#001080',                // Dark gray - type references
};

// VS Code Dark theme
export const vscodeDarkColors: CSharpColorPalette = {
    keyword: '#569cd6',                // Orange - keywords
    keywordType: '#4ec9b0',             // Light blue - built-in types
    keywordPreprocessor: '#9b9b9b',     // Gray - preprocessor
    string: '#ce9178',                  // Orange - string literals
    stringEscape: '#d7ba7d',             // Lighter orange - escape sequences
    stringChar: '#ce9178',               // Orange - character literals
    stringInvalid: '#f44747',            // Red - invalid strings
    number: '#b5cea8',                  // Light blue - numbers
    numberHex: '#b5cea8',                // Light blue - hex numbers
    numberBinary: '#b5cea8',             // Light blue - binary numbers
    numberFloat: '#b5cea8',              // Light blue - floats
    comment: '#6a9955',                  // Gray - comments
    commentDoc: '#6a9955',               // Lighter gray - XML doc comments
    operator: '#d4d4d4',                // Light cyan - operators
    delimiter: '#d4d4d4',                // Light cyan - delimiters
    attribute: '#4ec9b0',               // Light blue - attributes
    typeIdentifier: '#4ec9b0',            // Light blue - custom type names (classes, interfaces)
    identifier: '#d4d4d4',                // Light cyan - general identifiers
    // Semantic tokens (LSP-provided) - Better differentiation
    semanticClass: '#4ec9b0',            // Light blue - class declarations
    semanticEnum: '#b5cea8',              // Light blue - enum declarations
    semanticInterface: '#4ec9b0',         // Light blue - interface declarations
    semanticStruct: '#4ec9b0',            // Light blue - struct declarations
    semanticNamespace: '#569cd6',           // Orange - namespace declarations
    semanticMethod: '#569cd6',             // Orange - method/function declarations
    semanticFunction: '#569cd6',            // Orange - function declarations
    semanticParameter: '#d4d4d4',           // Light cyan - parameters
    semanticVariable: '#569cd6',            // Orange - variable/field declarations
    semanticProperty: '#4ec9b0',           // Light blue - property declarations
    semanticEnumMember: '#d4d4d4',          // Light cyan - enum members
    semanticEvent: '#4ec9b0',               // Light blue - event declarations
    semanticTypeParameter: '#d4d4d4',     // Light cyan - generic type parameters
    semanticType: '#d4d4d4',                // Light cyan - type references
};

// Dracula theme
export const draculaColors: CSharpColorPalette = {
    keyword: '#ff79c6',                // Red/orange - keywords
    keywordType: '#8be9fd',             // Light blue - built-in types
    keywordPreprocessor: '#6272a4',     // Gray - preprocessor
    string: '#f1fa8c',                  // Green - string literals
    stringEscape: '#bd93f9',             // Lighter green - escape sequences
    stringChar: '#f1fa8c',               // Green - character literals
    stringInvalid: '#ff5555',            // Red - invalid strings
    number: '#bd93f9',                  // Light blue - numbers
    numberHex: '#bd93f9',                // Light blue - hex numbers
    numberBinary: '#bd93f9',             // Light blue - binary numbers
    numberFloat: '#bd93f9',              // Light blue - floats
    comment: '#6272a4',                  // Gray - comments
    commentDoc: '#6272a4',               // Lighter gray - XML doc comments
    operator: '#ff79c6',                // Red/orange - operators
    delimiter: '#f8f8f2',                 // Light gray - delimiters
    attribute: '#50fa7b',               // Green - attributes
    typeIdentifier: '#8be9fd',            // Light blue - custom type names (classes, interfaces)
    identifier: '#f8f8f2',                // Light gray - general identifiers
    // Semantic tokens (LSP-provided) - Better differentiation
    semanticClass: '#8be9fd',            // Light blue - class declarations
    semanticEnum: '#bd93f9',              // Light blue - enum declarations
    semanticInterface: '#8be9fd',         // Light blue - interface declarations
    semanticStruct: '#8be9fd',            // Light blue - struct declarations
    semanticNamespace: '#f8f8f2',           // Light gray - namespace declarations
    semanticMethod: '#ff79c6',             // Red/orange - method/function declarations
    semanticFunction: '#ff79c6',            // Red/orange - function declarations
    semanticParameter: '#f8f8f2',           // Light gray - parameters
    semanticVariable: '#ff79c6',            // Red/orange - variable/field declarations
    semanticProperty: '#8be9fd',           // Light blue - property declarations
    semanticEnumMember: '#f8f8f2',          // Light gray - enum members
    semanticEvent: '#50fa7b',               // Green - event declarations
    semanticTypeParameter: '#f8f8f2',     // Light gray - generic type parameters
    semanticType: '#f8f8f2',                // Light gray - type references
};

// Nord theme
export const nordColors: CSharpColorPalette = {
    keyword: '#81a1c1',                // Red/orange - keywords
    keywordType: '#8fbcbb',             // Light blue - built-in types
    keywordPreprocessor: '#616e88',     // Gray - preprocessor
    string: '#a3be8c',                  // Green - string literals
    stringEscape: '#ebcb8b',             // Lighter green - escape sequences
    stringChar: '#a3be8c',               // Green - character literals
    stringInvalid: '#bf616a',            // Red - invalid strings
    number: '#b48ead',                  // Light blue - numbers
    numberHex: '#b48ead',                // Light blue - hex numbers
    numberBinary: '#b48ead',             // Light blue - binary numbers
    numberFloat: '#b48ead',              // Light blue - floats
    comment: '#616e88',                  // Gray - comments
    commentDoc: '#616e88',               // Lighter gray - XML doc comments
    operator: '#81a1c1',                // Red/orange - operators
    delimiter: '#eceff4',                 // Light gray - delimiters
    attribute: '#88c0d0',               // Light blue - attributes
    typeIdentifier: '#8fbcbb',            // Light blue - custom type names (classes, interfaces)
    identifier: '#d8dee9',                // Light gray - general identifiers
    // Semantic tokens (LSP-provided) - Better differentiation
    semanticClass: '#8fbcbb',            // Light blue - class declarations
    semanticEnum: '#b48ead',              // Light blue - enum declarations
    semanticInterface: '#8fbcbb',         // Light blue - interface declarations
    semanticStruct: '#8fbcbb',            // Light blue - struct declarations
    semanticNamespace: '#d8dee9',           // Light gray - namespace declarations
    semanticMethod: '#81a1c1',             // Red/orange - method/function declarations
    semanticFunction: '#81a1c1',            // Red/orange - function declarations
    semanticParameter: '#d8dee9',           // Light gray - parameters
    semanticVariable: '#81a1c1',            // Red/orange - variable/field declarations
    semanticProperty: '#8fbcbb',           // Light blue - property declarations
    semanticEnumMember: '#d8dee9',          // Light gray - enum members
    semanticEvent: '#88c0d0',               // Light blue - event declarations
    semanticTypeParameter: '#d8dee9',     // Light gray - generic type parameters
    semanticType: '#d8dee9',                // Light gray - type references
};

// GitHub Dark theme
export const githubDarkColors: CSharpColorPalette = {
    keyword: '#ff7b72',                // Red/orange - keywords
    keywordType: '#79c0ff',             // Light blue - built-in types
    keywordPreprocessor: '#8b949e',     // Gray - preprocessor
    string: '#a5d6ff',                  // Green - string literals
    stringEscape: '#d29922',             // Lighter green - escape sequences
    stringChar: '#a5d6ff',               // Green - character literals
    stringInvalid: '#ffa657',            // Red - invalid strings
    number: '#79c0ff',                  // Light blue - numbers
    numberHex: '#79c0ff',                // Light blue - hex numbers
    numberBinary: '#79c0ff',             // Light blue - binary numbers
    numberFloat: '#79c0ff',              // Light blue - floats
    comment: '#8b949e',                  // Gray - comments
    commentDoc: '#8b949e',               // Lighter gray - XML doc comments
    operator: '#ff7b72',                // Red/orange - operators
    delimiter: '#e6edf3',                 // Light gray - delimiters
    attribute: '#d2a8ff',               // Light blue - attributes
    typeIdentifier: '#ffa657',            // Light blue - custom type names (classes, interfaces)
    identifier: '#e6edf3',                // Light gray - general identifiers
    // Semantic tokens (LSP-provided) - Better differentiation
    semanticClass: '#ffa657',            // Light blue - class declarations
    semanticEnum: '#79c0ff',              // Light blue - enum declarations
    semanticInterface: '#ffa657',         // Light blue - interface declarations
    semanticStruct: '#ffa657',            // Light blue - struct declarations
    semanticNamespace: '#e6edf3',           // Light gray - namespace declarations
    semanticMethod: '#ff7b72',             // Red/orange - method/function declarations
    semanticFunction: '#ff7b72',            // Red/orange - function declarations
    semanticParameter: '#e6edf3',           // Light gray - parameters
    semanticVariable: '#ff7b72',            // Red/orange - variable/field declarations
    semanticProperty: '#ffa657',           // Light blue - property declarations
    semanticEnumMember: '#e6edf3',          // Light gray - enum members
    semanticEvent: '#d2a8ff',               // Light blue - event declarations
    semanticTypeParameter: '#e6edf3',     // Light gray - generic type parameters
    semanticType: '#e6edf3',                // Light gray - type references
};

export interface CSharpColorTheme {
    name: string;
    id: string;
    base: 'vs-dark' | 'vs' | 'hc-black';
    colors: CSharpColorPalette;
}

// Define custom C# color themes
export const csharpColorThemes: CSharpColorTheme[] = [
    {
        name: 'Fluxel Dark',
        id: 'fluxel-dark',
        base: 'vs-dark',
        colors: fluxelDarkColors,
    },
    {
        name: 'Fluxel Light',
        id: 'fluxel-light',
        base: 'vs',
        colors: fluxelLightColors,
    },
    {
        name: 'VS Code Dark',
        id: 'vscode-dark',
        base: 'vs-dark',
        colors: vscodeDarkColors,
    },
    {
        name: 'Dracula',
        id: 'dracula',
        base: 'vs-dark',
        colors: draculaColors,
    },
    {
        name: 'Nord',
        id: 'nord',
        base: 'vs-dark',
        colors: nordColors,
    },
    {
        name: 'GitHub Dark',
        id: 'github-dark',
        base: 'vs-dark',
        colors: githubDarkColors,
    },
];

/**
 * Convert a color palette to Monaco theme rules
 * Now includes semantic token support for better differentiation
 * 
 * Token types from our enhanced Monarch tokenizer:
 * - type.identifier: PascalCase types (classes, interfaces, structs)
 * - function: method/function calls (identifier followed by parenthesis)
 * - variable: camelCase variables and fields
 * - property: property access (obj.Property)
 * - attribute: attribute names in [brackets]
 * - parameter: method parameters
 * - typeParameter: generic type parameters (<T>)
 * - namespace: namespace identifiers
 * - keyword.type: built-in types (int, string, bool)
 * 
 * Semantic tokens (LSP-provided) override these with more accurate info
 */
export function paletteToThemeRules(colors: CSharpColorPalette): Monaco.editor.ITokenThemeRule[] {
    return [
        // =====================================================
        // MONARCH TOKENIZER RULES (pure syntax-based)
        // =====================================================
        
        // Keywords
        { token: 'keyword.cs', foreground: colors.keyword.replace('#', ''), fontStyle: 'bold' },
        { token: 'keyword', foreground: colors.keyword.replace('#', ''), fontStyle: 'bold' },
        // Specific keyword variants
        { token: 'keyword.class.cs', foreground: colors.keyword.replace('#', ''), fontStyle: 'bold' },
        { token: 'keyword.interface.cs', foreground: colors.keyword.replace('#', ''), fontStyle: 'bold' },
        { token: 'keyword.struct.cs', foreground: colors.keyword.replace('#', ''), fontStyle: 'bold' },
        { token: 'keyword.enum.cs', foreground: colors.keyword.replace('#', ''), fontStyle: 'bold' },
        { token: 'keyword.namespace.cs', foreground: colors.keyword.replace('#', ''), fontStyle: 'bold' },
        
        // Built-in type keywords (int, string, bool, etc.) - distinct color
        { token: 'keyword.type.cs', foreground: colors.keywordType.replace('#', '') },
        { token: 'keyword.type', foreground: colors.keywordType.replace('#', '') },
        
        // Preprocessor directives
        { token: 'keyword.preprocessor.cs', foreground: colors.keywordPreprocessor.replace('#', '') },
        { token: 'keyword.preprocessor', foreground: colors.keywordPreprocessor.replace('#', '') },
        { token: 'namespace.cpp.cs', foreground: colors.keywordPreprocessor.replace('#', '') },
        { token: 'namespace.cpp', foreground: colors.keywordPreprocessor.replace('#', '') },
        
        // Strings
        { token: 'string.cs', foreground: colors.string.replace('#', '') },
        { token: 'string', foreground: colors.string.replace('#', '') },
        { token: 'string.quote.cs', foreground: colors.string.replace('#', '') },
        { token: 'string.quote', foreground: colors.string.replace('#', '') },
        { token: 'string.escape.cs', foreground: colors.stringEscape.replace('#', '') },
        { token: 'string.escape', foreground: colors.stringEscape.replace('#', '') },
        { token: 'string.char.cs', foreground: colors.stringChar.replace('#', '') },
        { token: 'string.char', foreground: colors.stringChar.replace('#', '') },
        { token: 'string.invalid.cs', foreground: colors.stringInvalid.replace('#', '') },
        { token: 'string.invalid', foreground: colors.stringInvalid.replace('#', '') },
        
        // Numbers
        { token: 'number.cs', foreground: colors.number.replace('#', '') },
        { token: 'number', foreground: colors.number.replace('#', '') },
        { token: 'number.hex.cs', foreground: colors.numberHex.replace('#', '') },
        { token: 'number.hex', foreground: colors.numberHex.replace('#', '') },
        { token: 'number.binary.cs', foreground: colors.numberBinary.replace('#', '') },
        { token: 'number.binary', foreground: colors.numberBinary.replace('#', '') },
        { token: 'number.float.cs', foreground: colors.numberFloat.replace('#', '') },
        { token: 'number.float', foreground: colors.numberFloat.replace('#', '') },
        
        // Comments
        { token: 'comment.cs', foreground: colors.comment.replace('#', ''), fontStyle: 'italic' },
        { token: 'comment', foreground: colors.comment.replace('#', ''), fontStyle: 'italic' },
        { token: 'comment.doc.cs', foreground: colors.commentDoc.replace('#', ''), fontStyle: 'italic' },
        { token: 'comment.doc', foreground: colors.commentDoc.replace('#', ''), fontStyle: 'italic' },
        { token: 'comment.doc.tag.cs', foreground: colors.commentDoc.replace('#', '') },
        { token: 'comment.doc.tag', foreground: colors.commentDoc.replace('#', '') },
        
        // Operators and delimiters
        { token: 'operator.cs', foreground: colors.operator.replace('#', '') },
        { token: 'operator', foreground: colors.operator.replace('#', '') },
        { token: 'delimiter.cs', foreground: colors.delimiter.replace('#', '') },
        { token: 'delimiter', foreground: colors.delimiter.replace('#', '') },
        { token: 'delimiter.angle.cs', foreground: colors.delimiter.replace('#', '') },
        { token: 'delimiter.angle', foreground: colors.delimiter.replace('#', '') },
        { token: 'delimiter.square.cs', foreground: colors.delimiter.replace('#', '') },
        { token: 'delimiter.square', foreground: colors.delimiter.replace('#', '') },
        { token: 'delimiter.parenthesis.cs', foreground: colors.delimiter.replace('#', '') },
        { token: 'delimiter.parenthesis', foreground: colors.delimiter.replace('#', '') },
        
        // =====================================================
        // TYPE IDENTIFIERS - PascalCase names (classes, interfaces, etc.)
        // =====================================================
        { token: 'type.identifier.cs', foreground: colors.typeIdentifier.replace('#', '') },
        { token: 'type.identifier', foreground: colors.typeIdentifier.replace('#', '') },
        
        // =====================================================
        // ATTRIBUTES - [AttributeName]
        // =====================================================
        { token: 'attribute.cs', foreground: colors.attribute.replace('#', '') },
        { token: 'attribute', foreground: colors.attribute.replace('#', '') },
        
        // =====================================================
        // FUNCTIONS/METHODS - identifier followed by (
        // =====================================================
        { token: 'function.cs', foreground: colors.semanticFunction.replace('#', '') },
        { token: 'function', foreground: colors.semanticFunction.replace('#', '') },
        
        // =====================================================
        // VARIABLES - camelCase identifiers
        // =====================================================
        { token: 'variable.cs', foreground: colors.semanticVariable.replace('#', '') },
        { token: 'variable', foreground: colors.semanticVariable.replace('#', '') },
        
        // =====================================================
        // PROPERTIES - accessed via dot notation
        // =====================================================
        { token: 'property.cs', foreground: colors.semanticProperty.replace('#', '') },
        { token: 'property', foreground: colors.semanticProperty.replace('#', '') },
        
        // =====================================================
        // PARAMETERS - in method parameter lists
        // =====================================================
        { token: 'parameter.cs', foreground: colors.semanticParameter.replace('#', '') },
        { token: 'parameter', foreground: colors.semanticParameter.replace('#', '') },
        
        // =====================================================
        // TYPE PARAMETERS - generic types (<T>, <TKey>)
        // =====================================================
        { token: 'typeParameter.cs', foreground: colors.semanticTypeParameter.replace('#', '') },
        { token: 'typeParameter', foreground: colors.semanticTypeParameter.replace('#', '') },
        
        // =====================================================
        // NAMESPACES
        // =====================================================
        { token: 'namespace.cs', foreground: colors.semanticNamespace.replace('#', '') },
        { token: 'namespace', foreground: colors.semanticNamespace.replace('#', '') },
        
        // =====================================================
        // GENERAL IDENTIFIERS - fallback for unclassified
        // =====================================================
        { token: 'identifier.cs', foreground: colors.identifier.replace('#', '') },
        { token: 'identifier', foreground: colors.identifier.replace('#', '') },
        
        // =====================================================
        // SEMANTIC TOKEN RULES (LSP-provided) - More accurate
        // These override Monarch tokens when LSP is available
        // =====================================================
        
        // Classes
        { token: 'class.cs', foreground: colors.semanticClass.replace('#', '') },
        { token: 'class', foreground: colors.semanticClass.replace('#', '') },
        { token: 'class.static.cs', foreground: colors.semanticClass.replace('#', ''), fontStyle: 'italic' },
        { token: 'class.static', foreground: colors.semanticClass.replace('#', ''), fontStyle: 'italic' },
        
        // Enums
        { token: 'enum.cs', foreground: colors.semanticEnum.replace('#', '') },
        { token: 'enum', foreground: colors.semanticEnum.replace('#', '') },
        
        // Interfaces
        { token: 'interface.cs', foreground: colors.semanticInterface.replace('#', ''), fontStyle: 'italic' },
        { token: 'interface', foreground: colors.semanticInterface.replace('#', ''), fontStyle: 'italic' },
        
        // Structs
        { token: 'struct.cs', foreground: colors.semanticStruct.replace('#', '') },
        { token: 'struct', foreground: colors.semanticStruct.replace('#', '') },
        
        // Methods (LSP version)
        { token: 'method.cs', foreground: colors.semanticMethod.replace('#', '') },
        { token: 'method', foreground: colors.semanticMethod.replace('#', '') },
        { token: 'method.static.cs', foreground: colors.semanticMethod.replace('#', ''), fontStyle: 'italic' },
        { token: 'method.static', foreground: colors.semanticMethod.replace('#', ''), fontStyle: 'italic' },
        
        // Functions (LSP version)
        { token: 'function.static.cs', foreground: colors.semanticFunction.replace('#', ''), fontStyle: 'italic' },
        { token: 'function.static', foreground: colors.semanticFunction.replace('#', ''), fontStyle: 'italic' },
        
        // Variables (LSP version with modifiers)
        { token: 'variable.readonly.cs', foreground: colors.semanticVariable.replace('#', ''), fontStyle: 'italic' },
        { token: 'variable.readonly', foreground: colors.semanticVariable.replace('#', ''), fontStyle: 'italic' },
        { token: 'variable.static.cs', foreground: colors.semanticVariable.replace('#', ''), fontStyle: 'italic' },
        { token: 'variable.static', foreground: colors.semanticVariable.replace('#', ''), fontStyle: 'italic' },
        
        // Properties (LSP version with modifiers)
        { token: 'property.static.cs', foreground: colors.semanticProperty.replace('#', ''), fontStyle: 'italic' },
        { token: 'property.static', foreground: colors.semanticProperty.replace('#', ''), fontStyle: 'italic' },
        
        // Enum members
        { token: 'enumMember.cs', foreground: colors.semanticEnumMember.replace('#', '') },
        { token: 'enumMember', foreground: colors.semanticEnumMember.replace('#', '') },
        
        // Events
        { token: 'event.cs', foreground: colors.semanticEvent.replace('#', '') },
        { token: 'event', foreground: colors.semanticEvent.replace('#', '') },
        
        // Type references (LSP)
        { token: 'type.cs', foreground: colors.semanticType.replace('#', '') },
        { token: 'type', foreground: colors.semanticType.replace('#', '') },
        
        // CSX directives
        { token: 'directive.csx.cs', foreground: colors.keywordPreprocessor.replace('#', '') },
        { token: 'directive.csx', foreground: colors.keywordPreprocessor.replace('#', '') },
    ];
}

/**
 * Apply a C# color theme to Monaco
 */
export function applyCSharpColorTheme(
    monaco: typeof Monaco,
    themeId: string,
    theme: CSharpColorTheme,
    editorBackground: string,
    editorForeground: string,
    cursorColor: string,
    selectionBackground: string,
    activeLineForeground: string,
    activeLineBackground: string,
): void {
    monaco.editor.defineTheme(themeId, {
        base: theme.base,
        inherit: true,
        rules: paletteToThemeRules(theme.colors),
        colors: {
            'editor.background': editorBackground,
            'editor.foreground': editorForeground,
            'editorCursor.foreground': cursorColor,
            'editor.selectionBackground': selectionBackground,
            'editor.lineHighlightBackground': activeLineBackground,
            'editorLineNumber.activeForeground': activeLineForeground,
        },
    });
}

/**
 * Get theme colors for a base theme (dark/light)
 */
export function getBaseThemeColors(base: 'vs-dark' | 'vs' | 'hc-black'): {
    editorBackground: string;
    editorForeground: string;
    cursorColor: string;
    selectionBackground: string;
    activeLineForeground: string;
    activeLineBackground: string;
} {
    if (base === 'vs-dark' || base === 'hc-black') {
        return {
            editorBackground: '#1a1a1a',
            editorForeground: '#d4d4d4',
            cursorColor: '#f97316',
            selectionBackground: '#f9731633',
            activeLineForeground: '#f97316',
            activeLineBackground: '#ffffff08',
        };
    } else {
        return {
            editorBackground: '#fafafa',
            editorForeground: '#1e1e1e',
            cursorColor: '#f97316',
            selectionBackground: '#f9731633',
            activeLineForeground: '#f97316',
            activeLineBackground: '#f0f0f0',
        };
    }
}

/**
 * Register all C# color themes with Monaco
 */
export function registerCSharpColorThemes(monaco: typeof Monaco): void {
    csharpColorThemes.forEach((theme) => {
        const colors = getBaseThemeColors(theme.base);
        applyCSharpColorTheme(
            monaco,
            theme.id,
            theme,
            colors.editorBackground,
            colors.editorForeground,
            colors.cursorColor,
            colors.selectionBackground,
            colors.activeLineForeground,
            colors.activeLineBackground,
        );
    });
}
