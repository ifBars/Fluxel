import { readDir } from '@tauri-apps/plugin-fs';
import { BaseLSPClient } from '../base/BaseLSPClient';
import type { LSPClientConfig } from '../base/types';
import { fsPathToLspUri } from '../base/fileUris';
import { FrontendProfiler } from '@/lib/services';

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
        return FrontendProfiler.profileAsync('csharp_lsp_start', 'lsp_request', async () => {
            if (!workspaceRoot) {
                console.warn('[CSharpLSP] Refusing to start without workspace root');
                return;
            }

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
        }, { workspaceRoot: workspaceRoot || 'undefined' });
    }

    /**
     * csharp-ls is sensitive to workspace URI canonicalization and may treat rootUri + workspaceFolders as
     * two separate folders. Provide rootUri + workspaceFolders that both point to the same folder using
     * standard LSP file URIs so the server does not invent a default workspace.
     */
    protected buildInitializeParams(workspaceRoot: string): any {
        const normalizedRoot = workspaceRoot.replace(/\\/g, '/');
        const workspaceName = normalizedRoot.split('/').pop() || 'workspace';
        const rootUri = fsPathToLspUri(workspaceRoot);

        return {
            processId: null,
            rootPath: normalizedRoot,
            rootUri,
            capabilities: this.getClientCapabilities(),
            workspaceFolders: [
                {
                    uri: rootUri,
                    name: workspaceName,
                },
            ],
        };
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
            return FrontendProfiler.profileAsync('csharp_workspace_config', 'lsp_request', async () => {
                const solution = await findSolutionOrProjectFile(this.getWorkspaceRoot());
                const items = Array.isArray(params?.items) && params.items.length > 0 ? params.items : [{}];
                return items.map(() => ({
                    // Be liberal in what we return: different clients/servers use different casing/keys.
                    solution,
                    solutionPath: solution,
                    SolutionPath: solution,
                    applyFormattingOptions: false,
                    ApplyFormattingOptions: false,
                }));
            });
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
 * Attempt to find a .sln file near the workspace root (depth 3 to match backend)
 */
async function findSolutionFile(workspaceRoot?: string): Promise<string | null> {
    if (!workspaceRoot) return null;

    return FrontendProfiler.profileAsync('find_solution_file', 'frontend_render', async () => {
        try {
            // Check root directory first
            const rootEntries = await readDir(workspaceRoot);
            const rootSln = rootEntries.find((entry) => entry.name?.toLowerCase().endsWith('.sln') && !entry.isDirectory);
            if (rootSln && rootSln.name) {
                return normalizePath(`${workspaceRoot}/${rootSln.name}`);
            }

            // Search depth 1
            for (const entry of rootEntries) {
                if (!entry.name || !entry.isDirectory) continue;
                const depth1Path = normalizePath(`${workspaceRoot}/${entry.name}`);

                const depth1Entries = await readDir(depth1Path);
                const depth1Sln = depth1Entries.find((child) => child.name?.toLowerCase().endsWith('.sln') && !child.isDirectory);
                if (depth1Sln && depth1Sln.name) {
                    return normalizePath(`${depth1Path}/${depth1Sln.name}`);
                }

                // Search depth 2
                for (const depth1Entry of depth1Entries) {
                    if (!depth1Entry.name || !depth1Entry.isDirectory) continue;
                    const depth2Path = normalizePath(`${depth1Path}/${depth1Entry.name}`);

                    const depth2Entries = await readDir(depth2Path);
                    const depth2Sln = depth2Entries.find((child) => child.name?.toLowerCase().endsWith('.sln') && !child.isDirectory);
                    if (depth2Sln && depth2Sln.name) {
                        return normalizePath(`${depth2Path}/${depth2Sln.name}`);
                    }
                }
            }
        } catch (error) {
            console.warn('[CSharpLSP] Failed to search for solution file:', error);
        }

        return null;
    });
}

/**
 * Find a .sln (preferred) or .csproj file near the workspace root (depth 3 to match backend).
 */
async function findSolutionOrProjectFile(workspaceRoot?: string): Promise<string | null> {
    if (!workspaceRoot) return null;

    return FrontendProfiler.profileAsync('find_solution_or_project', 'frontend_render', async () => {
        const solution = await findSolutionFile(workspaceRoot);
        if (solution) return solution;

        try {
            // Check root directory first
            const rootEntries = await readDir(workspaceRoot);
            const rootCsproj = rootEntries.find((entry) => entry.name?.toLowerCase().endsWith('.csproj') && !entry.isDirectory);
            if (rootCsproj && rootCsproj.name) {
                return normalizePath(`${workspaceRoot}/${rootCsproj.name}`);
            }

            // Search depth 1
            for (const entry of rootEntries) {
                if (!entry.name || !entry.isDirectory) continue;
                const depth1Path = normalizePath(`${workspaceRoot}/${entry.name}`);

                const depth1Entries = await readDir(depth1Path);
                const depth1Csproj = depth1Entries.find((child) => child.name?.toLowerCase().endsWith('.csproj') && !child.isDirectory);
                if (depth1Csproj && depth1Csproj.name) {
                    return normalizePath(`${depth1Path}/${depth1Csproj.name}`);
                }

                // Search depth 2
                for (const depth1Entry of depth1Entries) {
                    if (!depth1Entry.name || !depth1Entry.isDirectory) continue;
                    const depth2Path = normalizePath(`${depth1Path}/${depth1Entry.name}`);

                    const depth2Entries = await readDir(depth2Path);
                    const depth2Csproj = depth2Entries.find((child) => child.name?.toLowerCase().endsWith('.csproj') && !child.isDirectory);
                    if (depth2Csproj && depth2Csproj.name) {
                        return normalizePath(`${depth2Path}/${depth2Csproj.name}`);
                    }
                }
            }
        } catch (error) {
            console.warn('[CSharpLSP] Failed to search for project file:', error);
        }

        return null;
    });
}

function normalizePath(path: string): string {
    return path.replace(/\\/g, '/');
}
