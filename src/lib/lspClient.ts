import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { readDir } from '@tauri-apps/plugin-fs';

/**
 * LSP JSON-RPC message structure
 */
export interface LSPMessage {
    jsonrpc: '2.0';
    id?: number | string;
    method?: string;
    params?: any;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}

/**
 * LSP notification from server
 */
export interface LSPNotification {
    method: string;
    params?: any;
}

type LSPRequestHandler = (params: any) => Promise<any>;

/**
 * LSP client for communicating with language servers via Tauri IPC
 * Handles message routing, request/response correlation, and notifications
 */
export class LSPClient {
    private messageId = 0;
    private pendingRequests = new Map<number, {
        resolve: (result: any) => void;
        reject: (error: any) => void;
    }>();
    private notificationHandlers = new Map<string, ((params: any) => void)[]>();
    private requestHandlers = new Map<string, LSPRequestHandler>();
    private unlisten: UnlistenFn | null = null;
    private isStarted = false;
    private workspaceRoot?: string;

    constructor(private languageId: string) {
        this.registerDefaultRequestHandlers();
    }

    /**
     * Start the LSP client and language server
     */
    async start(workspaceRoot?: string): Promise<void> {
        // Restart if workspace changes
        if (this.isStarted && workspaceRoot && this.workspaceRoot && workspaceRoot !== this.workspaceRoot) {
            await this.stop();
        }

        if (this.isStarted) {
            console.log(`[LSPClient:${this.languageId}] Already started`);
            return;
        }

        this.workspaceRoot = workspaceRoot;

        try {
            console.log(`[LSPClient:${this.languageId}] Starting language server...`);
            console.log(`[LSPClient:${this.languageId}] This may take a moment if csharp-ls needs to be installed...`);

            // Listen for LSP messages from Rust backend
            this.unlisten = await listen<LSPMessage>('lsp-message', (event) => {
                this.handleMessage(event.payload);
            });

            // Start the language server process (this will auto-install if needed)
            await invoke('start_csharp_ls', { workspace_root: workspaceRoot });

            this.isStarted = true;
            console.log(`[LSPClient:${this.languageId}] Language server started`);
        } catch (error) {
            console.error(`[LSPClient:${this.languageId}] Failed to start:`, error);

            // Show user-friendly error message
            if (error && typeof error === 'string') {
                if (error.includes('dotnet')) {
                    console.error('[LSPClient] .NET SDK is required. Please install from: https://dotnet.microsoft.com/download');
                } else if (error.includes('csharp-ls')) {
                    console.error('[LSPClient] Failed to install csharp-ls automatically. Please install manually: dotnet tool install --global csharp-ls');
                }
            }

            throw error;
        }
    }

    /**
     * Stop the LSP client and language server
     */
    async stop(): Promise<void> {
        if (!this.isStarted) {
            return;
        }

        try {
            console.log(`[LSPClient:${this.languageId}] Stopping language server...`);

            // Send shutdown request
            await this.sendRequest('shutdown', {});

            // Send exit notification
            await this.sendNotification('exit', {});

            // Stop the language server process
            await invoke('stop_csharp_ls');

            // Cleanup
            if (this.unlisten) {
                this.unlisten();
                this.unlisten = null;
            }

            this.isStarted = false;
            this.workspaceRoot = undefined;
            this.pendingRequests.clear();
            console.log(`[LSPClient:${this.languageId}] Language server stopped`);
        } catch (error) {
            console.error(`[LSPClient:${this.languageId}] Error stopping:`, error);
        }
    }

    /**
     * Get the workspace root used to start the LSP
     */
    getWorkspaceRoot(): string | undefined {
        return this.workspaceRoot;
    }

    /**
     * Send a request to the language server and wait for response
     */
    async sendRequest<T = any>(method: string, params: any): Promise<T> {
        if (!this.isStarted) {
            throw new Error('LSP client not started');
        }

        const id = ++this.messageId;
        const message: LSPMessage = {
            jsonrpc: '2.0',
            id,
            method,
            params,
        };

        return new Promise<T>((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });

            invoke('send_lsp_message', { message: JSON.stringify(message) })
                .catch((error) => {
                    this.pendingRequests.delete(id);
                    reject(error);
                });
        });
    }

    /**
     * Send a notification to the language server (no response expected)
     */
    async sendNotification(method: string, params: any): Promise<void> {
        if (!this.isStarted) {
            throw new Error('LSP client not started');
        }

        const message: LSPMessage = {
            jsonrpc: '2.0',
            method,
            params,
        };

        await invoke('send_lsp_message', { message: JSON.stringify(message) });
    }

    /**
     * Register a handler for server notifications
     */
    onNotification(method: string, handler: (params: any) => void): void {
        if (!this.notificationHandlers.has(method)) {
            this.notificationHandlers.set(method, []);
        }
        this.notificationHandlers.get(method)!.push(handler);
    }

    /**
     * Register a handler for server->client requests
     */
    onRequest(method: string, handler: LSPRequestHandler): void {
        this.requestHandlers.set(method, handler);
    }

    /**
     * Handle incoming LSP messages from the server
     */
    private handleMessage(message: LSPMessage): void {
        // Handle response to our request
        if (message.id !== undefined) {
            const pending = this.pendingRequests.get(message.id as number);
            if (pending) {
                this.pendingRequests.delete(message.id as number);

                if (message.error) {
                    pending.reject(message.error);
                } else {
                    pending.resolve(message.result);
                }
                return;
            }

            // Server -> client request
            if (message.method) {
                const handler = this.requestHandlers.get(message.method);
                if (handler) {
                    handler(message.params)
                        .then((result) => this.sendResponse(message.id!, result))
                        .catch((error) => this.sendErrorResponse(message.id!, error));
                } else {
                    this.sendErrorResponse(message.id!, {
                        code: -32601,
                        message: `Method not found: ${message.method}`,
                    });
                }
                return;
            }
        }

        // Handle server notification
        if (message.method) {
            const handlers = this.notificationHandlers.get(message.method);
            if (handlers) {
                handlers.forEach(handler => handler(message.params));
            }
        }
    }

    /**
     * Initialize the language server with capabilities
     */
    async initialize(workspaceRoot: string): Promise<any> {
        const normalizedRoot = workspaceRoot.replace(/\\/g, '/');
        const workspaceName = normalizedRoot.split('/').pop() || 'workspace';
        const rootUri = `file:///${normalizedRoot}`;

        const initParams = {
            processId: null,
            rootPath: normalizedRoot, // Deprecated but some servers still use it
            rootUri: rootUri,
            capabilities: {
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
            },
            workspaceFolders: [
                {
                    uri: rootUri,
                    name: workspaceName,
                },
            ],
        };

        const result = await this.sendRequest('initialize', initParams);

        // Send initialized notification
        await this.sendNotification('initialized', {});

        return result;
    }

    /**
     * Send a JSON-RPC response back to the server
     */
    private async sendResponse(id: number | string, result: any): Promise<void> {
        const response: LSPMessage = { jsonrpc: '2.0', id, result };
        await invoke('send_lsp_message', { message: JSON.stringify(response) });
    }

    /**
     * Send a JSON-RPC error response back to the server
     */
    private async sendErrorResponse(id: number | string, error: any): Promise<void> {
        const safeError =
            typeof error === 'object' && error !== null
                ? error
                : { code: -32603, message: String(error) };
        const response: LSPMessage = { jsonrpc: '2.0', id, error: safeError as any };
        await invoke('send_lsp_message', { message: JSON.stringify(response) });
    }

    /**
     * Register handlers the server typically requests
     */
    private registerDefaultRequestHandlers(): void {
        // Handle dynamic capability registration (critical for csharp-ls features)
        this.onRequest('client/registerCapability', async (params: any) => {
            // Accept all capability registrations - csharp-ls uses this to register
            // textDocument/definition, textDocument/hover, etc.
            console.log('[LSPClient] Received capability registration:',
                params?.registrations?.map((r: any) => r.method).join(', ') || 'unknown');
            return null; // Success - no error means registration accepted
        });

        this.onRequest('client/unregisterCapability', async (_params: any) => {
            // Accept capability unregistration
            return null;
        });

        this.onRequest('workspace/configuration', async (params: any) => {
            const solution = await findSolutionFile(this.workspaceRoot);
            const items = Array.isArray(params?.items) && params.items.length > 0 ? params.items : [{}];
            return items.map(() => ({
                solution,
                applyFormattingOptions: false,
            }));
        });

        // Handle window/workDoneProgress/create (required by some LSP servers)
        this.onRequest('window/workDoneProgress/create', async (_params: any) => {
            return null; // Accept progress token creation
        });
    }
}

// Global LSP client instance for C#
let csharpLSPClient: LSPClient | null = null;

/**
 * Get or create the C# LSP client instance
 */
export function getCSharpLSPClient(): LSPClient {
    if (!csharpLSPClient) {
        csharpLSPClient = new LSPClient('csharp');
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
        console.warn('[LSPClient] Failed to search for solution file:', error);
    }

    return null;
}

function normalizePath(path: string): string {
    return path.replace(/\\/g, '/');
}
