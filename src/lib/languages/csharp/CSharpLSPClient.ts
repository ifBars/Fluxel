import { readDir } from '@tauri-apps/plugin-fs';
import { BaseLSPClient } from '../base/BaseLSPClient';
import type { LSPClientConfig } from '../base/types';

/**
 * C#-specific LSP client
 * Extends BaseLSPClient with C#-specific functionality
 */
export class CSharpLSPClient extends BaseLSPClient {
    constructor() {
        const config: LSPClientConfig = {
            languageId: 'csharp',
            startCommand: 'start_csharp_ls',
            stopCommand: 'stop_csharp_ls',
            sendMessageCommand: 'send_lsp_message',
        };
        super(config);
    }

    /**
     * Start the C# LSP client with enhanced error handling
     */
    async start(workspaceRoot?: string): Promise<void> {
        try {
            console.log('[CSharpLSP] This may take a moment if csharp-ls needs to be installed...');
            await super.start(workspaceRoot);
        } catch (error) {
            // Show user-friendly error message
            if (error && typeof error === 'string') {
                if (error.includes('dotnet')) {
                    console.error('[CSharpLSP] .NET SDK is required. Please install from: https://dotnet.microsoft.com/download');
                } else if (error.includes('csharp-ls')) {
                    console.error('[CSharpLSP] Failed to install csharp-ls automatically. Please install manually: dotnet tool install --global csharp-ls');
                }
            }
            throw error;
        }
    }

    /**
     * Get C#-specific client capabilities
     */
    protected getClientCapabilities(): any {
        return {
            textDocument: {
                completion: {
                    completionItem: {
                        snippetSupport: true,
                        documentationFormat: ['markdown', 'plaintext'],
                        resolveSupport: {
                            properties: ['documentation', 'detail', 'additionalTextEdits'],
                        },
                    },
                    contextSupport: true,
                },
                hover: {
                    contentFormat: ['markdown', 'plaintext'],
                },
                signatureHelp: {
                    signatureInformation: {
                        documentationFormat: ['markdown', 'plaintext'],
                        parameterInformation: {
                            labelOffsetSupport: true,
                        },
                    },
                },
                definition: { linkSupport: true },
                typeDefinition: { linkSupport: true },
                implementation: { linkSupport: true },
                references: {},
                documentHighlight: {},
                documentSymbol: {
                    hierarchicalDocumentSymbolSupport: true,
                },
                codeAction: {
                    codeActionLiteralSupport: {
                        codeActionKind: {
                            valueSet: [
                                'quickfix',
                                'refactor',
                                'refactor.extract',
                                'refactor.inline',
                                'refactor.rewrite',
                                'source',
                                'source.organizeImports',
                            ],
                        },
                    },
                    resolveSupport: {
                        properties: ['edit'],
                    },
                },
                codeLens: {},
                formatting: {},
                rangeFormatting: {},
                rename: {
                    prepareSupport: true,
                },
                publishDiagnostics: {
                    relatedInformation: true,
                    tagSupport: {
                        valueSet: [1, 2], // Unnecessary and Deprecated
                    },
                },
                semanticTokens: {
                    multilineTokenSupport: false,
                    overlappingTokenSupport: false,
                    tokenTypes: [
                        'namespace', 'class', 'enum', 'interface', 'struct', 'typeParameter',
                        'type', 'parameter', 'variable', 'property', 'enumMember', 'event',
                        'function', 'method', 'macro', 'keyword', 'modifier', 'comment',
                        'string', 'number', 'regexp', 'operator',
                    ],
                    tokenModifiers: [
                        'declaration', 'definition', 'readonly', 'static', 'deprecated',
                        'abstract', 'async', 'modification', 'documentation', 'defaultLibrary',
                    ],
                    formats: ['relative'],
                    requests: {
                        full: true,
                        range: false,
                    },
                },
            },
            workspace: {
                workspaceFolders: true,
                didChangeConfiguration: {
                    dynamicRegistration: true,
                },
                symbol: {
                    symbolKind: {
                        valueSet: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26],
                    },
                },
            },
        };
    }

    /**
     * Register C#-specific request handlers
     */
    protected registerDefaultRequestHandlers(): void {
        // Call base class handlers first
        super.registerDefaultRequestHandlers();

        // C#-specific handler for workspace configuration
        this.onRequest('workspace/configuration', async (params: any) => {
            const solution = await findSolutionFile(this.getWorkspaceRoot());
            const items = Array.isArray(params?.items) && params.items.length > 0 ? params.items : [{}];
            return items.map(() => ({
                solution,
                applyFormattingOptions: false,
            }));
        });
    }
}

// Global LSP client instance for C#
let csharpLSPClient: CSharpLSPClient | null = null;

/**
 * Get or create the C# LSP client instance
 */
export function getCSharpLSPClient(): CSharpLSPClient {
    if (!csharpLSPClient) {
        csharpLSPClient = new CSharpLSPClient();
    }
    return csharpLSPClient;
}

/**
 * Attempt to find a .sln file near the workspace root (depth 2)
 */
async function findSolutionFile(workspaceRoot?: string): Promise<string | null> {
    if (!workspaceRoot) return null;

    try {
        const entries = await readDir(workspaceRoot);

        for (const entry of entries) {
            if (!entry.name) continue;
            const fullPath = normalizePath(`${workspaceRoot}/${entry.name}`);
            if (entry.isDirectory) {
                const childEntries = await readDir(fullPath);
                const found = childEntries.find((child) => child.name?.toLowerCase().endsWith('.sln'));
                if (found && found.name) {
                    return normalizePath(`${fullPath}/${found.name}`);
                }
            } else if (entry.name.toLowerCase().endsWith('.sln')) {
                return fullPath;
            }
        }
    } catch (error) {
        console.warn('[CSharpLSP] Failed to search for solution file:', error);
    }

    return null;
}

function normalizePath(path: string): string {
    return path.replace(/\\/g, '/');
}
