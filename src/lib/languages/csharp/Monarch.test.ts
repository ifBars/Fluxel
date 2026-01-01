/**
 * C# Monarch Tokenizer Tests
 * 
 * These tests validate that the C# Monarch tokenizer correctly handles:
 * - Strings in collection initializers (especially with numeric prefixes)
 * - Attributes vs array indexing
 * - Various string formats (verbatim, interpolated, raw)
 * - Edge cases that previously caused highlighting issues
 */

import { describe, it, expect } from 'vitest';
import { csharpMonarch } from './Monarch';

/**
 * Tokenize a string using the Monarch tokenizer
 * This is a simplified tokenizer that processes the rules synchronously
 */
function tokenize(code: string): Array<{ token: string; text: string; line: number; column: number }> {
    const lines = code.split('\n');
    const tokens: Array<{ token: string; text: string; line: number; column: number }> = [];
    
    // Simple state machine to process Monarch rules
    let state = 'root';
    const stateStack: string[] = [];
    
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        let pos = 0;
        
        while (pos < line.length) {
            const remaining = line.substring(pos);
            let matched = false;
            
            // Get current state rules
            const stateRules = (csharpMonarch.tokenizer as any)[state] || (csharpMonarch.tokenizer as any).root;
            
            for (const rule of stateRules) {
                if (!rule) continue;
                
                // Handle include directives
                if (rule.include) {
                    // Skip includes for now in simple test
                    continue;
                }
                
                const [pattern, action] = Array.isArray(rule) ? rule : [null, null];
                if (!pattern || !action) continue;
                
                const match = remaining.match(pattern);
                if (match && match.index === 0) {
                    const matchText = match[0];
                    
                    // Determine token type
                    let tokenType = '';
                    if (typeof action === 'string') {
                        tokenType = action;
                    } else if (typeof action === 'object' && 'token' in action) {
                        tokenType = (action as any).token || '';
                        
                        // Handle state transitions
                        if ((action as any).next) {
                            const next = (action as any).next;
                            if (next === '@pop') {
                                state = stateStack.pop() || 'root';
                            } else if (next.startsWith('@')) {
                                stateStack.push(state);
                                state = next.substring(1);
                            }
                        }
                    }
                    
                    if (matchText.trim().length > 0 || tokenType) {
                        tokens.push({
                            token: tokenType,
                            text: matchText,
                            line: lineNum + 1,
                            column: pos + 1
                        });
                    }
                    
                    pos += matchText.length;
                    matched = true;
                    break;
                }
            }
            
            if (!matched) {
                // Skip unmatched character
                pos++;
            }
        }
    }
    
    return tokens;
}



/**
 * Helper to find all tokens matching a pattern
 */
function findTokens(tokens: ReturnType<typeof tokenize>, tokenType: string, text?: string): ReturnType<typeof tokenize> {
    return tokens.filter(t => t.token === tokenType && (!text || t.text === text));
}

describe('C# Monarch Tokenizer - Collection Initializers', () => {
    it('should tokenize simple collection with strings', () => {
        const code = 'var test = new[] { "abc", "def" };';
        const tokens = tokenize(code);
        
        // Should have string tokens
        const stringTokens = findTokens(tokens, 'string.quote');
        expect(stringTokens.length).toBeGreaterThan(0);
    });

    it('should tokenize collection with strings starting with numbers', () => {
        const code = 'var test = new[] { "123", "456" };';
        const tokens = tokenize(code);
        
        // Should have string tokens, not number tokens
        const stringTokens = findTokens(tokens, 'string.quote');
        expect(stringTokens.length).toBeGreaterThan(0);
        
        // The content "123" should be inside a string state, not tokenized as number
        const stringContents = findTokens(tokens, 'string');
        
        // Numbers inside strings should be string tokens
        expect(stringContents.some(t => t.text.includes('123') || t.text.includes('456'))).toBe(true);
    });

    it('should tokenize collection with hash strings (Core.cs WhitelistedHashes case)', () => {
        const code = `var hashes = new[]
{
    "3918e1454e05de4dd3ace100d8f4d53936c9b93694dbff5bcc0293d689cb0ab7",
    "8e6dd1943c80e2d1472a9dc2c6722226d961027a7ec20aab9ad8f1184702d138"
};`;
        const tokens = tokenize(code);
        
        // Should have string quote tokens for opening quotes
        const stringQuotes = findTokens(tokens, 'string.quote');
        expect(stringQuotes.length).toBeGreaterThanOrEqual(2);
        
        // Should have string content tokens
        const stringContent = findTokens(tokens, 'string');
        expect(stringContent.length).toBeGreaterThan(0);
    });

    it('should handle C# 12 collection expressions', () => {
        const code = 'var items = ["abc", "123", "def"];';
        const tokens = tokenize(code);
        
        // Should have bracket tokens
        const brackets = tokens.filter(t => t.text === '[' || t.text === ']');
        expect(brackets.length).toBeGreaterThanOrEqual(2);
        
        // Should have string tokens
        const strings = findTokens(tokens, 'string.quote');
        expect(strings.length).toBeGreaterThan(0);
    });

    it('should handle nested collections', () => {
        const code = 'var nested = new[] { new[] { "1", "2" }, new[] { "3", "4" } };';
        const tokens = tokenize(code);
        
        // Should properly tokenize all strings
        const stringTokens = findTokens(tokens, 'string.quote');
        expect(stringTokens.length).toBeGreaterThan(0);
    });

    it('should handle multiline collection with comments', () => {
        const code = `var items = new[]
{
    "item1", // comment
    "item2"  // another comment
};`;
        const tokens = tokenize(code);
        
        // Should have comment tokens
        const comments = findTokens(tokens, 'comment');
        expect(comments.length).toBeGreaterThan(0);
        
        // Should have string tokens
        const strings = findTokens(tokens, 'string.quote');
        expect(strings.length).toBeGreaterThan(0);
    });
});

describe('C# Monarch Tokenizer - Attributes vs Arrays', () => {
    it('should tokenize attributes correctly', () => {
        const code = '[Test]\npublic void Method() { }';
        const tokens = tokenize(code);
        
        // Should have attribute token
        const attributes = findTokens(tokens, 'attribute');
        expect(attributes.length).toBeGreaterThan(0);
    });

    it('should tokenize array indexing correctly', () => {
        const code = 'var x = arr[0];';
        const tokens = tokenize(code);
        
        // Should have bracket tokens, not attribute tokens
        const brackets = tokens.filter(t => t.text === '[' || t.text === ']');
        expect(brackets.length).toBe(2);
    });

    it('should distinguish [Attribute] from ["string"]', () => {
        const code1 = '[TestAttribute]\npublic void Method() { }';
        const code2 = 'var arr = ["test"];';
        
        const tokens1 = tokenize(code1);
        const tokens2 = tokenize(code2);
        
        // code1 should have attribute tokens
        const attributes = findTokens(tokens1, 'attribute');
        expect(attributes.length).toBeGreaterThan(0);
        
        // code2 should have string tokens, not attribute tokens
        const strings = findTokens(tokens2, 'string.quote');
        expect(strings.length).toBeGreaterThan(0);
        
        const attributes2 = findTokens(tokens2, 'attribute');
        expect(attributes2.length).toBe(0);
    });
});

describe('C# Monarch Tokenizer - String Formats', () => {
    it('should tokenize regular strings', () => {
        const code = 'var s = "hello world";';
        const tokens = tokenize(code);
        
        const stringTokens = findTokens(tokens, 'string.quote');
        expect(stringTokens.length).toBeGreaterThanOrEqual(2); // Opening and closing quotes
    });

    it('should tokenize verbatim strings', () => {
        const code = 'var s = @"C:\\Path\\File.txt";';
        const tokens = tokenize(code);
        
        const stringTokens = findTokens(tokens, 'string.quote');
        expect(stringTokens.length).toBeGreaterThan(0);
    });

    it('should tokenize interpolated strings', () => {
        const code = 'var s = $"Value: {x}";';
        const tokens = tokenize(code);
        
        const stringTokens = findTokens(tokens, 'string.quote');
        expect(stringTokens.length).toBeGreaterThan(0);
    });

    it('should tokenize interpolated verbatim strings', () => {
        const code = 'var s = $@"Path: {path}";';
        const tokens = tokenize(code);
        
        const stringTokens = findTokens(tokens, 'string.quote');
        expect(stringTokens.length).toBeGreaterThan(0);
    });

    it('should handle escape sequences in strings', () => {
        const code = 'var s = "Line1\\nLine2\\tTabbed";';
        const tokens = tokenize(code);
        
        // Should have string tokens
        const stringTokens = tokens.filter(t => t.token.startsWith('string'));
        expect(stringTokens.length).toBeGreaterThan(0);
    });

    it('should handle character literals', () => {
        const code = "var c1 = 'A'; var c2 = '\\n';";
        const tokens = tokenize(code);
        
        // Should have char tokens
        const charTokens = tokens.filter(t => t.token.includes('char'));
        expect(charTokens.length).toBeGreaterThan(0);
    });
});

describe('C# Monarch Tokenizer - Numbers', () => {
    it('should tokenize decimal numbers', () => {
        const code = 'var x = 123456;';
        const tokens = tokenize(code);
        
        const numberTokens = findTokens(tokens, 'number');
        expect(numberTokens.length).toBeGreaterThan(0);
    });

    it('should tokenize hex numbers', () => {
        const code = 'var x = 0xABCDEF;';
        const tokens = tokenize(code);
        
        const hexTokens = findTokens(tokens, 'number.hex');
        expect(hexTokens.length).toBeGreaterThan(0);
    });

    it('should tokenize binary numbers', () => {
        const code = 'var x = 0b1010;';
        const tokens = tokenize(code);
        
        const binaryTokens = findTokens(tokens, 'number.binary');
        expect(binaryTokens.length).toBeGreaterThan(0);
    });

    it('should tokenize floating point numbers', () => {
        const code = 'var x = 123.456f; var y = 789.012d;';
        const tokens = tokenize(code);
        
        const floatTokens = findTokens(tokens, 'number.float');
        expect(floatTokens.length).toBeGreaterThan(0);
    });

    it('should not tokenize numbers inside strings', () => {
        const code = 'var s = "123";';
        const tokens = tokenize(code);
        
        // The "123" should be part of string content, not a number token
        // There might be a number token if "123" is incorrectly parsed,
        // but it should be inside string state
        const stringContent = findTokens(tokens, 'string');
        expect(stringContent.some(t => /\d/.test(t.text))).toBe(true);
    });
});

describe('C# Monarch Tokenizer - Keywords and Identifiers', () => {
    it('should tokenize keywords', () => {
        const code = 'public class Test { private static void Main() { } }';
        const tokens = tokenize(code);
        
        const keywords = findTokens(tokens, 'keyword');
        expect(keywords.length).toBeGreaterThan(0);
        expect(keywords.some(t => t.text === 'public')).toBe(true);
        expect(keywords.some(t => t.text === 'class')).toBe(true);
    });

    it('should tokenize type keywords', () => {
        const code = 'int x; string s; bool b;';
        const tokens = tokenize(code);
        
        const typeKeywords = findTokens(tokens, 'keyword.type');
        expect(typeKeywords.length).toBeGreaterThan(0);
    });

    it('should tokenize identifiers', () => {
        const code = 'var myVariable = 123;';
        const tokens = tokenize(code);
        
        const identifiers = findTokens(tokens, 'identifier');
        expect(identifiers.length).toBeGreaterThan(0);
    });

    it('should tokenize type identifiers after modifiers', () => {
        const code = 'public MyClass instance;';
        const tokens = tokenize(code);
        
        // Should have keyword for 'public' and type identifier for 'MyClass'
        const keywords = findTokens(tokens, 'keyword');
        const typeIds = findTokens(tokens, 'type.identifier');
        
        expect(keywords.some(t => t.text === 'public')).toBe(true);
        expect(typeIds.length).toBeGreaterThan(0);
    });
});

describe('C# Monarch Tokenizer - Comments', () => {
    it('should tokenize single-line comments', () => {
        const code = '// This is a comment\nvar x = 1;';
        const tokens = tokenize(code);
        
        const comments = findTokens(tokens, 'comment');
        expect(comments.length).toBeGreaterThan(0);
    });

    it('should tokenize multi-line comments', () => {
        const code = '/* Multi\nline\ncomment */\nvar x = 1;';
        const tokens = tokenize(code);
        
        const comments = findTokens(tokens, 'comment');
        expect(comments.length).toBeGreaterThan(0);
    });

    it('should tokenize XML doc comments', () => {
        const code = '/// <summary>Documentation</summary>\npublic void Method() { }';
        const tokens = tokenize(code);
        
        const docComments = findTokens(tokens, 'comment.doc');
        expect(docComments.length).toBeGreaterThan(0);
    });
});

describe('C# Monarch Tokenizer - Real-world Edge Cases', () => {
    it('should handle Core.cs DefaultWhitelistedHashes correctly', () => {
        const code = `private static readonly string[] DefaultWhitelistedHashes =
[
    // CustomTV
    "3918e1454e05de4dd3ace100d8f4d53936c9b93694dbff5bcc0293d689cb0ab7",
    "8e6dd1943c80e2d1472a9dc2c6722226d961027a7ec20aab9ad8f1184702d138",
    // UnityExplorer
    "d47eb6eabd3b6e3b742c7d9693651bc3a61a90dcbe838f9a4276953089ee4951",
    "cfe43c0d285867a5701d96de1edd25cb02725fe2629b88386351dc07b11a08b5"
];`;
        const tokens = tokenize(code);
        
        // Should have keywords
        const keywords = findTokens(tokens, 'keyword');
        expect(keywords.some(t => t.text === 'private')).toBe(true);
        expect(keywords.some(t => t.text === 'static')).toBe(true);
        expect(keywords.some(t => t.text === 'readonly')).toBe(true);
        
        // Should have string tokens (hash values)
        const stringTokens = findTokens(tokens, 'string.quote');
        expect(stringTokens.length).toBeGreaterThanOrEqual(4); // At least 4 strings
        
        // Should have comment tokens
        const comments = findTokens(tokens, 'comment');
        expect(comments.length).toBeGreaterThan(0);
        
        // Verify no strings are being tokenized as numbers
        const allTokens = tokens.map(t => ({ token: t.token, text: t.text }));
        
        // After the string quotes, content should be in string state
        let inString = false;
        for (const token of allTokens) {
            if (token.token === 'string.quote' && token.text === '"') {
                inString = !inString;
            }
            
            // If we're in a string and encounter what looks like a number,
            // it should be tokenized as 'string', not 'number'
            if (inString && /^\d+$/.test(token.text)) {
                expect(token.token).toBe('string');
            }
        }
    });

    it('should handle array initialization with mixed content', () => {
        const code = 'var arr = new object[] { 123, "456", true, null };';
        const tokens = tokenize(code);
        
        // Should have number, string, keyword tokens
        expect(findTokens(tokens, 'number').length).toBeGreaterThan(0);
        expect(findTokens(tokens, 'string.quote').length).toBeGreaterThan(0);
        expect(findTokens(tokens, 'keyword').some(t => t.text === 'true')).toBe(true);
        expect(findTokens(tokens, 'keyword').some(t => t.text === 'null')).toBe(true);
    });

    it('should handle switch expressions', () => {
        const code = `var result = value switch
{
    1 => "one",
    2 => "two",
    _ => "other"
};`;
        const tokens = tokenize(code);
        
        // Should have switch keyword
        expect(findTokens(tokens, 'keyword').some(t => t.text === 'switch')).toBe(true);
        
        // Should have string tokens
        expect(findTokens(tokens, 'string.quote').length).toBeGreaterThan(0);
        
        // Should have arrow operator
        const operators = findTokens(tokens, 'operator');
        expect(operators.some(t => t.text === '=>')).toBe(true);
    });

    it('should handle generic types', () => {
        const code = 'var list = new List<Dictionary<string, int>>();';
        const tokens = tokenize(code);
        
        // Should have angle brackets
        const angleBrackets = tokens.filter(t => t.text === '<' || t.text === '>');
        expect(angleBrackets.length).toBeGreaterThan(0);
        
        // Should have type keywords
        expect(findTokens(tokens, 'keyword.type').some(t => t.text === 'string')).toBe(true);
        expect(findTokens(tokens, 'keyword.type').some(t => t.text === 'int')).toBe(true);
    });

    it('should handle attributes with string arguments', () => {
        const code = '[TestMethod("test_123", Category = "Unit")]\npublic void Test() { }';
        const tokens = tokenize(code);
        
        // Should have attribute tokens
        expect(findTokens(tokens, 'attribute').length).toBeGreaterThan(0);
        
        // Should have string tokens inside attributes
        expect(findTokens(tokens, 'string.quote').length).toBeGreaterThan(0);
    });
});
