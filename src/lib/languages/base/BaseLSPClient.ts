import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { LSPMessage, LSPRequestHandler, LSPClientConfig } from './types';
import { FrontendProfiler } from '@/lib/services/FrontendProfiler';

/**
 * Generic LSP client for communicating with language servers via Tauri IPC
 * Handles message routing, request/response correlation, and notifications
 *
 * This is a generic implementation that can be used with any LSP server.
 * Language-specific clients should extend this class.
 */
export class BaseLSPClient {
    private messageId = 0;
    private pendingRequests = new Map<number, {
        resolve: (result: any) => void;
        reject: (error: any) => void;
    }>();
    private notificationHandlers = new Map<string, ((params: any) => void)[]>();
    private requestHandlers = new Map<string, LSPRequestHandler>();
    private unlisten: UnlistenFn | null = null;
    private isStarted = false;
    private isInitialized = false;
    private workspaceRoot?: string;
    private openDocuments = new Set<string>();
    private startPromise: Promise<void> | null = null;
    private initializePromise: Promise<any> | null = null;

    constructor(protected config: LSPClientConfig) {
        this.registerDefaultRequestHandlers();
    }

    /**
     * Get the language ID for this client
     */
    getLanguageId(): string {
        return this.config.languageId;
    }

    /**
     * Start the LSP client and language server
     */
    async start(workspaceRoot?: string): Promise<void> {
        // If a start is already in progress, wait for it to complete
        if (this.startPromise) {
            console.log(`[LSPClient:${this.config.languageId}] Start already in progress, joining existing promise...`);
            return this.startPromise;
        }

        this.startPromise = FrontendProfiler.profileAsync('lsp_start', 'lsp_request', async () => {
            // Restart if workspace changes
            if (this.isStarted && workspaceRoot && this.workspaceRoot && workspaceRoot !== this.workspaceRoot) {
                await this.stop();
            }

            if (this.isStarted) {
                console.log(`[LSPClient:${this.config.languageId}] Already started`);
                return;
            }

            this.workspaceRoot = workspaceRoot;

            try {
                console.log(`[LSPClient:${this.config.languageId}] Starting language server...`);

                // Listen for LSP messages from Rust backend
                this.unlisten = await listen<LSPMessage>('lsp-message', (event) => {
                    this.handleMessage(event.payload);
                });

                // Start the language server process
                await invoke(this.config.startCommand, { workspace_root: workspaceRoot });

                this.isStarted = true;
                console.log(`[LSPClient:${this.config.languageId}] Language server started`);
            } catch (error) {
                console.error(`[LSPClient:${this.config.languageId}] Failed to start:`, error);
                throw error;
            }
        }, { languageId: this.config.languageId, ...(workspaceRoot && { workspaceRoot }) });

        try {
            await this.startPromise;
        } finally {
            this.startPromise = null;
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
            console.log(`[LSPClient:${this.config.languageId}] Stopping language server...`);

            // Send shutdown request
            await this.sendRequest('shutdown', {});

            // Send exit notification
            await this.sendNotification('exit', {});

            // Stop the language server process
            await invoke(this.config.stopCommand);

            // Cleanup
            if (this.unlisten) {
                this.unlisten();
                this.unlisten = null;
            }

            this.isStarted = false;
            this.isInitialized = false;
            this.workspaceRoot = undefined;
            this.pendingRequests.clear();
            this.openDocuments.clear();
            this.startPromise = null;
            this.initializePromise = null;
            console.log(`[LSPClient:${this.config.languageId}] Language server stopped`);
        } catch (error) {
            console.error(`[LSPClient:${this.config.languageId}] Error stopping:`, error);
        }
    }

    /**
     * Get the workspace root used to start the LSP
     */
    getWorkspaceRoot(): string | undefined {
        return this.workspaceRoot;
    }

    /**
     * Check if the LSP client is started
     */
    getIsStarted(): boolean {
        return this.isStarted;
    }

    /**
     * Track whether the client believes a document has been opened with `textDocument/didOpen`.
     * This is best-effort state to avoid duplicate opens from multiple call sites.
     */
    isDocumentOpen(uri: string): boolean {
        return this.openDocuments.has(uri);
    }

    /**
     * Send a request to the language server and wait for response
     */
    async sendRequest<T = any>(method: string, params: any): Promise<T> {
        return await FrontendProfiler.profileAsync('lsp_request', 'lsp_request', async () => {
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

            const sendCommand = this.config.sendMessageCommand || 'send_lsp_message';

            return new Promise<T>((resolve, reject) => {
                this.pendingRequests.set(id, { resolve, reject });

                invoke(sendCommand, { message: JSON.stringify(message) })
                    .catch((error) => {
                        this.pendingRequests.delete(id);
                        reject(error);
                    });
            });
        }, { languageId: this.config.languageId, method });
    }

    /**
     * Send a notification to the language server (no response expected)
     */
    async sendNotification(method: string, params: any): Promise<void> {
        if (!this.isStarted) {
            throw new Error('LSP client not started');
        }

        // Best-effort local tracking for didOpen/didClose to reduce duplicate notifications.
        try {
            if (method === 'textDocument/didOpen') {
                const uri = params?.textDocument?.uri;
                if (typeof uri === 'string') this.openDocuments.add(uri);
            } else if (method === 'textDocument/didClose') {
                const uri = params?.textDocument?.uri;
                if (typeof uri === 'string') this.openDocuments.delete(uri);
            }
        } catch {
            // Ignore tracking errors
        }

        const message: LSPMessage = {
            jsonrpc: '2.0',
            method,
            params,
        };

        const sendCommand = this.config.sendMessageCommand || 'send_lsp_message';
        await invoke(sendCommand, { message: JSON.stringify(message) });
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
            // Track diagnostics specifically
            if (message.method === 'textDocument/publishDiagnostics') {
                const uri = message.params?.uri;
                const diagCount = message.params?.diagnostics?.length ?? 0;
                FrontendProfiler.trackInteraction('lsp_diagnostics_received', {
                    language: this.config.languageId,
                    uri: uri ? String(uri) : 'unknown',
                    count: String(diagCount)
                });
            }

            const handlers = this.notificationHandlers.get(message.method);
            if (handlers) {
                handlers.forEach(handler => handler(message.params));
            }
        }
    }

    /**
     * Initialize the language server with capabilities
     * This is a basic implementation that can be overridden by subclasses
     */
    async initialize(workspaceRoot: string): Promise<any> {
        if (!this.isStarted) {
            throw new Error('LSP client must be started before initialization');
        }

        if (this.isInitialized) {
            console.log(`[LSPClient:${this.config.languageId}] Already initialized`);
            return Promise.resolve();
        }

        // If an initialization is already in progress, wait for it to complete
        if (this.initializePromise) {
            console.log(`[LSPClient:${this.config.languageId}] Initialize already in progress, joining existing promise...`);
            return this.initializePromise;
        }

        this.initializePromise = FrontendProfiler.profileAsync('lsp_initialize', 'lsp_request', async () => {
            try {
                console.log(`[LSPClient:${this.config.languageId}] Initializing language server...`);

                const initParams = this.buildInitializeParams(workspaceRoot);

                console.log(`[LSPClient:${this.config.languageId}] Sending initialize request...`);
                const result = await this.sendRequest('initialize', initParams);
                console.log(`[LSPClient:${this.config.languageId}] Initialize response received`);

                // Send initialized notification
                await this.sendNotification('initialized', {});
                console.log(`[LSPClient:${this.config.languageId}] Initialized notification sent`);

                this.isInitialized = true;

                return result;
            } catch (error) {
                console.error(`[LSPClient:${this.config.languageId}] Initialization failed:`, error);
                throw error;
            }
        }, { languageId: this.config.languageId });

        try {
            return await this.initializePromise;
        } finally {
            this.initializePromise = null;
        }
    }

    /**
     * Build params for the `initialize` request.
     * Subclasses can override to customize URI normalization, workspace folders, and init options.
     */
    protected buildInitializeParams(workspaceRoot: string): any {
        const normalizedRoot = workspaceRoot.replace(/\\/g, '/');
        const workspaceName = normalizedRoot.split('/').pop() || 'workspace';
        const rootUri = `file:///${normalizedRoot}`;

        return {
            processId: null,
            rootPath: normalizedRoot,
            rootUri: rootUri,
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
     * Get client capabilities to send during initialization
     * Override in subclasses to customize capabilities
     */
    protected getClientCapabilities(): any {
        return {
            textDocument: {
                completion: {
                    completionItem: {
                        snippetSupport: true,
                        documentationFormat: ['markdown', 'plaintext'],
                    },
                },
                hover: {
                    contentFormat: ['markdown', 'plaintext'],
                },
                definition: { linkSupport: true },
                references: {},
                documentHighlight: {},
            },
            workspace: {
                workspaceFolders: true,
            },
        };
    }

    /**
     * Send a JSON-RPC response back to the server
     */
    private async sendResponse(id: number | string, result: any): Promise<void> {
        const response: LSPMessage = { jsonrpc: '2.0', id, result };
        const sendCommand = this.config.sendMessageCommand || 'send_lsp_message';
        await invoke(sendCommand, { message: JSON.stringify(response) });
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
        const sendCommand = this.config.sendMessageCommand || 'send_lsp_message';
        await invoke(sendCommand, { message: JSON.stringify(response) });
    }

    /**
     * Register handlers the server typically requests
     * Override in subclasses to add language-specific handlers
     */
    protected registerDefaultRequestHandlers(): void {
        // Handle dynamic capability registration
        this.onRequest('client/registerCapability', async (params: any) => {
            const registrations = params?.registrations || [];
            const methods = registrations.map((r: any) => r.method || r.methodName || 'unknown').join(', ');
            console.log(`[LSPClient:${this.config.languageId}] Received capability registration: ${methods || 'none'}`);
            // Accept all capability registrations - the server is telling us what it supports
            return null;
        });

        this.onRequest('client/unregisterCapability', async (_params: any) => {
            console.log(`[LSPClient:${this.config.languageId}] Received capability unregistration`);
            return null;
        });

        // Handle window/workDoneProgress/create
        this.onRequest('window/workDoneProgress/create', async (_params: any) => {
            return null;
        });
    }
}
