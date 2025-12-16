/**
 * C# Workspace Symbol Search
 * 
 * Implementation of Phase 2.4 from the C# Enhancement Plan.
 * 
 * This module provides workspace-wide symbol search functionality using the LSP
 * `workspace/symbol` request. It allows searching for classes, methods, fields,
 * and other symbols across the entire C# project.
 * 
 * Features:
 * - Global symbol search via LSP workspace/symbol request
 * - Support for both SymbolInformation and WorkspaceSymbol LSP formats
 * - Automatic conversion of 0-indexed (LSP) to 1-indexed (display) positions
 * - Comprehensive type definitions with proper TypeScript types
 * - Error handling for LSP client not ready scenarios
 * - Helper functions for filtering and grouping symbols
 * 
 * Usage:
 * ```typescript
 * import { searchWorkspaceSymbols, SymbolKind, filterSymbolsByKind } from '@/lib/languages/csharp';
 * 
 * // Search for symbols matching "User"
 * const symbols = await searchWorkspaceSymbols("User");
 * 
 * // Filter to only get classes and interfaces
 * const types = filterSymbolsByKind(symbols, [SymbolKind.Class, SymbolKind.Interface]);
 * 
 * // Navigate to symbol location
 * symbols.forEach(symbol => {
 *   console.log(`${symbol.name} at ${symbol.location.uri}:${symbol.location.range.startLine}`);
 * });
 * ```
 * 
 * Next Steps (from Enhancement Plan):
 * - Add Ctrl+T keyboard shortcut for "Go to Symbol in Workspace" UI
 * - Create command palette integration
 * - Implement fuzzy search filtering in UI
 * - Add symbol preview on hover
 * 
 * @see docs/CSHARP_ENHANCEMENT_PLAN.md - Phase 2.4
 */

import { getCSharpLSPClient } from './CSharpLSPClient';
import { fileUriToFsPath } from '../base/fileUris';

/**
 * Symbol kinds from LSP specification
 * See: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#symbolKind
 */
export enum SymbolKind {
  File = 1,
  Module = 2,
  Namespace = 3,
  Package = 4,
  Class = 5,
  Method = 6,
  Property = 7,
  Field = 8,
  Constructor = 9,
  Enum = 10,
  Interface = 11,
  Function = 12,
  Variable = 13,
  Constant = 14,
  String = 15,
  Number = 16,
  Boolean = 17,
  Array = 18,
  Object = 19,
  Key = 20,
  Null = 21,
  EnumMember = 22,
  Struct = 23,
  Event = 24,
  Operator = 25,
  TypeParameter = 26,
}

/**
 * Location information for a symbol
 */
export interface SymbolLocation {
  /** File URI (e.g., file:///C:/path/to/file.cs) */
  uri: string;
  /** Range in the document (1-indexed for display) */
  range: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}

/**
 * Information about a symbol in the workspace
 */
export interface SymbolInfo {
  /** Symbol name (e.g., "MyClass", "DoSomething") */
  name: string;
  /** Symbol kind (class, method, field, etc.) */
  kind: SymbolKind;
  /** Location where the symbol is defined */
  location: SymbolLocation;
  /** Container name (e.g., namespace or parent class) */
  containerName?: string;
  /** Tags for additional metadata (deprecated, etc.) */
  tags?: number[];
}

/**
 * LSP SymbolInformation format from workspace/symbol response
 * See: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#symbolInformation
 */
interface LSPSymbolInformation {
  name: string;
  kind: number;
  location: {
    uri: string;
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  };
  containerName?: string;
  tags?: number[];
}

/**
 * LSP WorkspaceSymbol format (extended version with optional location)
 * See: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#workspaceSymbol
 */
interface LSPWorkspaceSymbol {
  name: string;
  kind: number;
  location?: {
    uri: string;
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  };
  containerName?: string;
  tags?: number[];
  data?: any;
}

/**
 * Search for symbols across the entire workspace
 * 
 * @param query - Search query string (can be empty for all symbols)
 * @returns Array of matching symbols with their locations
 * 
 * @example
 * ```typescript
 * // Search for classes/methods containing "User"
 * const symbols = await searchWorkspaceSymbols("User");
 * 
 * // Get all symbols (empty query)
 * const allSymbols = await searchWorkspaceSymbols("");
 * 
 * // Handle results
 * symbols.forEach(symbol => {
 *   console.log(`${symbol.name} (${SymbolKind[symbol.kind]}) at ${symbol.location.uri}`);
 * });
 * ```
 */
export async function searchWorkspaceSymbols(query: string): Promise<SymbolInfo[]> {
  try {
    const lspClient = getCSharpLSPClient();

    // Check if LSP is started
    if (!lspClient.getIsStarted()) {
      console.warn('[WorkspaceSymbols] LSP client not started');
      return [];
    }

    // Send workspace/symbol request to LSP server
    const result = await lspClient.sendRequest<LSPSymbolInformation[] | LSPWorkspaceSymbol[] | null>(
      'workspace/symbol',
      { query }
    );

    if (!result || !Array.isArray(result)) {
      return [];
    }

    // Convert LSP symbols to our SymbolInfo format
    const symbols: SymbolInfo[] = [];

    for (const lspSymbol of result) {
      // Handle both SymbolInformation and WorkspaceSymbol formats
      // WorkspaceSymbol may have optional location that needs to be resolved
      if (!lspSymbol.location) {
        // Skip symbols without location (would need resolve operation)
        console.warn('[WorkspaceSymbols] Symbol without location:', lspSymbol.name);
        continue;
      }

      // Convert LSP symbol to our format
      const symbolInfo: SymbolInfo = {
        name: lspSymbol.name,
        kind: lspSymbol.kind as SymbolKind,
        location: {
          uri: lspSymbol.location.uri,
          range: {
            // Convert from 0-indexed (LSP) to 1-indexed (display)
            startLine: lspSymbol.location.range.start.line + 1,
            startColumn: lspSymbol.location.range.start.character + 1,
            endLine: lspSymbol.location.range.end.line + 1,
            endColumn: lspSymbol.location.range.end.character + 1,
          },
        },
        containerName: lspSymbol.containerName,
        tags: lspSymbol.tags,
      };

      symbols.push(symbolInfo);
    }

    console.log(`[WorkspaceSymbols] Found ${symbols.length} symbols matching query: "${query}"`);
    return symbols;
  } catch (error) {
    // Handle errors gracefully
    if (error instanceof Error) {
      if (error.message.includes('not started')) {
        console.warn('[WorkspaceSymbols] LSP client not ready');
      } else {
        console.error('[WorkspaceSymbols] Error searching workspace symbols:', error);
      }
    } else {
      console.error('[WorkspaceSymbols] Unknown error:', error);
    }
    return [];
  }
}

/**
 * Get a human-readable string for a symbol kind
 * 
 * @param kind - The symbol kind enum value
 * @returns Human-readable string (e.g., "Class", "Method")
 */
export function getSymbolKindLabel(kind: SymbolKind): string {
  return SymbolKind[kind] || 'Unknown';
}

/**
 * Filter symbols by kind
 * 
 * @param symbols - Array of symbols to filter
 * @param kinds - Array of symbol kinds to include
 * @returns Filtered array of symbols
 * 
 * @example
 * ```typescript
 * const symbols = await searchWorkspaceSymbols("User");
 * 
 * // Get only classes and interfaces
 * const types = filterSymbolsByKind(symbols, [
 *   SymbolKind.Class,
 *   SymbolKind.Interface
 * ]);
 * ```
 */
export function filterSymbolsByKind(
  symbols: SymbolInfo[],
  kinds: SymbolKind[]
): SymbolInfo[] {
  return symbols.filter(symbol => kinds.includes(symbol.kind));
}

/**
 * Group symbols by their container (namespace/class)
 * 
 * @param symbols - Array of symbols to group
 * @returns Map of container name to symbols
 * 
 * @example
 * ```typescript
 * const symbols = await searchWorkspaceSymbols("User");
 * const grouped = groupSymbolsByContainer(symbols);
 * 
 * grouped.forEach((symbols, container) => {
 *   console.log(`${container}:`);
 *   symbols.forEach(s => console.log(`  - ${s.name}`));
 * });
 * ```
 */
export function groupSymbolsByContainer(
  symbols: SymbolInfo[]
): Map<string, SymbolInfo[]> {
  const groups = new Map<string, SymbolInfo[]>();

  for (const symbol of symbols) {
    const container = symbol.containerName || '(global)';
    if (!groups.has(container)) {
      groups.set(container, []);
    }
    groups.get(container)!.push(symbol);
  }

  return groups;
}

/**
 * Extract file path from URI
 * Handles both file:///C:/path/to/file.cs and C:/path/to/file.cs formats
 * 
 * @param uri - The URI to convert
 * @returns File path
 */
export function uriToFilePath(uri: string): string {
  return fileUriToFsPath(uri);
}
