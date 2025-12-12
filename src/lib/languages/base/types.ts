/**
 * Shared types for language support infrastructure
 */

import type * as Monaco from 'monaco-editor';

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

/**
 * LSP request handler signature
 */
export type LSPRequestHandler = (params: any) => Promise<any>;

/**
 * Configuration for LSP client
 */
export interface LSPClientConfig {
    languageId: string;
    startCommand: string;
    stopCommand: string;
    sendMessageCommand?: string;
}

/**
 * Language provider interface
 */
export interface ILanguageProvider {
    /**
     * Unique identifier for the language
     */
    readonly languageId: string;

    /**
     * Start the language provider
     */
    start(workspaceRoot?: string): Promise<void>;

    /**
     * Stop the language provider
     */
    stop(): Promise<void>;

    /**
     * Dispose of all resources
     */
    dispose(): void;

    /**
     * Check if the provider is started
     */
    isStarted(): boolean;
}

/**
 * Monaco editor instance type alias
 */
export type MonacoInstance = typeof Monaco;
