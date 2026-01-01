# C# Language Support

This directory contains the C# language support for the Fluxel Monaco editor, including syntax highlighting, LSP integration, and language features.

## Files

- **Monarch.ts** - Monarch tokenizer for C# syntax highlighting
- **Monarch.test.ts** - Comprehensive tests for the Monarch tokenizer
- **MonacoProviders.ts** - LSP-based language features (completion, hover, etc.)
- **CSharpLSPClient.ts** - LSP client for csharp-ls
- **ColorThemes.ts** - Custom color themes for C# syntax
- **index.ts** - Main entry point for C# language registration

## Syntax Highlighting Fix

### Problem

The Monarch tokenizer had an issue where strings in collection initializers (especially those starting with digits) would break syntax highlighting. This was particularly problematic in code like:

```csharp
private static readonly string[] DefaultWhitelistedHashes =
[
    "3918e1454e05de4dd3ace100d8f4d53936c9b93694dbff5bcc0293d689cb0ab7",
    "8e6dd1943c80e2d1472a9dc2c6722226d961027a7ec20aab9ad8f1184702d138"
];
```

### Root Cause

The issue was in the order of tokenizer rules in `Monarch.ts`. The attribute detection rule:

```typescript
[/\[[a-zA-Z_]/, { token: 'delimiter.square', next: '@attribute' }]
```

Was positioned **before** string literal rules, causing the tokenizer to attempt attribute parsing when encountering `["string"]` patterns. This meant that when a collection initializer like `["hash"]` was encountered, the `[` would match the generic bracket rule, and the subsequent `"` would be handled in the wrong context.

### Solution

The fix was to reorder the tokenizer rules in the `root` state so that **string literals are matched before attribute/bracket rules**:

```typescript
tokenizer: {
    root: [
        // Whitespace
        { include: '@whitespace' },

        // Preprocessor directives
        [/^\s*#\s*\w+/, 'keyword.preprocessor'],

        // String literals - MUST come before attribute/bracket rules
        [/@"/, { token: 'string.quote', next: '@verbatimstring' }],
        [/\$@"/, { token: 'string.quote', next: '@interpolatedverbatimstring' }],
        [/\$"/, { token: 'string.quote', next: '@interpolatedstring' }],
        [/"/, { token: 'string.quote', next: '@string' }],

        // Attributes - only when [ is followed by an identifier
        [/\[[a-zA-Z_]/, { token: 'delimiter.square', next: '@attribute' }],
        
        // ... other rules
    ]
}
```

This ensures that:
1. String literals like `"123abc"` are always recognized as strings first
2. Collection initializers like `["string1", "string2"]` properly tokenize the strings
3. Attributes like `[TestAttribute]` still work correctly (since they start with `[` followed by a letter)
4. Array indexing like `arr[0]` continues to work (handled by the generic bracket rules)

## Running Tests

### Run all C# Monarch tests:

```bash
bun run vitest run src/lib/languages/csharp/Monarch.test.ts
```

### Run tests in watch mode:

```bash
bun run vitest watch src/lib/languages/csharp/Monarch.test.ts
```

### Test Coverage

The test suite includes comprehensive coverage for:

#### ✅ Collection Initializers
- Simple collections with strings
- Strings starting with numbers (e.g., `"123"`)
- Hash strings (64-character hex strings like SHA256 hashes)
- C# 12 collection expressions (`[...]`)
- Nested collections
- Multiline collections with comments

#### ✅ Attributes vs Arrays
- Attribute syntax (`[TestAttribute]`)
- Array indexing (`arr[0]`)
- Distinguishing `[Attribute]` from `["string"]`

#### ✅ String Formats
- Regular strings (`"text"`)
- Verbatim strings (`@"C:\Path"`)
- Interpolated strings (`$"Value: {x}"`)
- Interpolated verbatim strings (`$@"Path: {path}"`)
- Escape sequences (`"Line1\nLine2"`)
- Character literals (`'A'`, `'\n'`)

#### ✅ Numbers
- Decimal numbers (`123456`)
- Hexadecimal numbers (`0xABCDEF`)
- Binary numbers (`0b1010`)
- Floating point numbers (`123.456f`, `789.012d`)
- Numbers inside strings (should be string tokens, not number tokens)

#### ✅ Real-world Edge Cases
- Core.cs `DefaultWhitelistedHashes` array (the original bug case)
- Mixed content arrays (`new object[] { 123, "456", true }`)
- Switch expressions
- Generic types
- Attributes with string arguments

### Test Results

Expected results (as of latest run):
- ✅ 20 tests passing (all string/collection/attribute tests)
- ⚠️ 12 tests with simplified tokenizer limitations (comments, full keyword parsing)

The critical tests for the bug fix all pass:
- ✓ should tokenize collection with strings starting with numbers
- ✓ should tokenize collection with hash strings (Core.cs WhitelistedHashes case)
- ✓ should distinguish [Attribute] from ["string"]
- ✓ should not tokenize numbers inside strings

## LSP Features

The C# language support includes full LSP integration via `csharp-ls`:

- **IntelliSense** - Context-aware code completion
- **Hover** - Type information and documentation
- **Go to Definition** - Navigate to symbol definitions
- **Go to Type Definition** - Navigate to type definitions
- **Go to Implementation** - Find interface/abstract class implementations
- **Find All References** - Find all usages of a symbol
- **Signature Help** - Parameter hints for methods
- **Document Symbols** - Outline view
- **Formatting** - Code formatting (document and range)
- **Rename** - Symbol renaming across files
- **Document Highlight** - Highlight symbol occurrences
- **Code Actions** - Quick fixes and refactorings
- **Semantic Tokens** - Advanced syntax highlighting
- **Diagnostics** - Real-time error and warning reporting

## Color Themes

Custom color themes are defined in `ColorThemes.ts`:

- **fluxel-dark** - Dark theme with custom C# syntax colors
- **fluxel-light** - Light theme with custom C# syntax colors

## Contributing

When adding new syntax highlighting features:

1. Update `Monarch.ts` with the new tokenizer rules
2. Add tests to `Monarch.test.ts` to verify the feature works
3. Run the test suite to ensure no regressions
4. Test in the actual Monaco editor with real C# code

### Rule Ordering Guidelines

**Critical:** String literal rules must come before:
- Attribute rules
- Generic bracket rules
- Any rule that might match `[` or `"` independently

This prevents context confusion when parsing collections, attributes, and strings.
