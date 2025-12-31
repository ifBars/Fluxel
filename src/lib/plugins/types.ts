/**
 * Fluxel Plugin System - Type Definitions
 * 
 * Core interfaces and types for the plugin architecture.
 */

import type * as Monaco from 'monaco-editor';

// ============================================================================
// Core Plugin Types
// ============================================================================

/**
 * Disposable resource that can be cleaned up
 */
export interface Disposable {
    dispose(): void;
}

/**
 * Monaco editor instance type alias
 */
export type MonacoInstance = typeof Monaco;

/**
 * Plugin activation events that trigger plugin loading
 */
export type ActivationEvent =
    | `onLanguage:${string}`        // Activated when a file of this language is opened
    | `onProject:${string}`         // Activated when project type is detected
    | `onCommand:${string}`         // Activated when a command is invoked
    | `onStartup`                   // Activated on Fluxel startup
    | `*`;                          // Always activated

/**
 * Plugin state in the registry
 */
export type PluginState = 'inactive' | 'activating' | 'active' | 'deactivating' | 'error';

/**
 * Plugin metadata and manifest
 */
export interface PluginManifest {
    /** Unique plugin identifier (e.g., "fluxel.s1api") */
    id: string;
    /** Human-readable plugin name */
    name: string;
    /** Semantic version string */
    version: string;
    /** Plugin description */
    description?: string;
    /** Plugin author */
    author?: string;
    /** Plugin repository URL */
    repository?: string;
    /** Events that trigger this plugin's activation */
    activationEvents: ActivationEvent[];
    /** Plugin dependencies (other plugin IDs) */
    dependencies?: string[];
    /** Whether this is a core/bundled plugin */
    isCore?: boolean;
}

/**
 * Main plugin interface that all plugins must implement
 */
export interface FluxelPlugin extends PluginManifest {
    /**
     * Called when the plugin is activated
     * @param context - Plugin context with APIs for extending Fluxel
     */
    activate(context: PluginContext): Promise<void>;

    /**
     * Called when the plugin is deactivated (optional)
     */
    deactivate?(): Promise<void>;
}

// ============================================================================
// Plugin Context & APIs
// ============================================================================

/**
 * Context object passed to plugins during activation
 * Provides APIs for extending Fluxel functionality
 */
export interface PluginContext {
    /** Monaco editor instance */
    readonly monaco: MonacoInstance;
    
    /** Plugin's unique ID */
    readonly pluginId: string;
    
    /** Disposables that will be cleaned up on deactivation */
    readonly subscriptions: Disposable[];

    /** Get the current workspace root path */
    getWorkspaceRoot(): string | null;

    /** Register language features (syntax, completions, etc.) */
    registerLanguageFeatures(config: LanguageFeatureConfig): Disposable;

    /** Register a project type detector */
    registerProjectDetector(detector: ProjectDetector): Disposable;

    /** Register a hover provider */
    registerHoverProvider(languageSelector: string, provider: HoverProvider): Disposable;

    /** Register a completion provider */
    registerCompletionProvider(languageSelector: string, provider: CompletionProvider): Disposable;

    /** Register syntax highlighting rules */
    registerSyntaxHighlighting(languageId: string, rules: SyntaxRule[]): Disposable;

    /** Log a message with plugin context */
    log(message: string, level?: 'info' | 'warn' | 'error'): void;
}

// ============================================================================
// Language Features
// ============================================================================

/**
 * Configuration for registering language features
 */
export interface LanguageFeatureConfig {
    /** Language ID (e.g., "csharp", "typescript") */
    languageId: string;
    
    /** Syntax highlighting rules */
    syntaxRules?: SyntaxRule[];
    
    /** Completion provider */
    completionProvider?: CompletionProvider;
    
    /** Hover provider */
    hoverProvider?: HoverProvider;
    
    /** Signature help provider */
    signatureHelpProvider?: SignatureHelpProvider;
}

/**
 * Syntax highlighting rule for Monaco Monarch tokenizer
 */
export interface SyntaxRule {
    /** Token name (e.g., "keyword.s1api", "type.phoneapp") */
    token: string;
    /** Regex pattern to match */
    regex: string | RegExp;
    /** Foreground color (hex) */
    foreground?: string;
    /** Font style */
    fontStyle?: 'italic' | 'bold' | 'underline';
}

/**
 * Hover information returned by hover providers
 */
export interface HoverInfo {
    /** Markdown content to display */
    contents: string[];
    /** Optional range to highlight */
    range?: {
        startLineNumber: number;
        startColumn: number;
        endLineNumber: number;
        endColumn: number;
    };
}

/**
 * Hover provider interface
 */
export interface HoverProvider {
    provideHover(
        model: Monaco.editor.ITextModel,
        position: Monaco.Position,
        token: Monaco.CancellationToken
    ): HoverInfo | null | Promise<HoverInfo | null>;
}

/**
 * Completion item for IntelliSense
 */
export interface CompletionItem {
    /** Display label */
    label: string;
    /** Kind of completion (class, method, property, etc.) */
    kind: Monaco.languages.CompletionItemKind;
    /** Text to insert */
    insertText: string;
    /** Whether insertText is a snippet */
    insertTextRules?: Monaco.languages.CompletionItemInsertTextRule;
    /** Documentation (markdown) */
    documentation?: string;
    /** Detail text shown after the label */
    detail?: string;
    /** Sort text for ordering */
    sortText?: string;
    /** Filter text for matching */
    filterText?: string;
}

/**
 * Completion provider interface
 */
export interface CompletionProvider {
    triggerCharacters?: string[];
    provideCompletionItems(
        model: Monaco.editor.ITextModel,
        position: Monaco.Position,
        context: Monaco.languages.CompletionContext,
        token: Monaco.CancellationToken
    ): CompletionItem[] | Promise<CompletionItem[]>;
}

/**
 * Signature help provider interface
 */
export interface SignatureHelpProvider {
    signatureHelpTriggerCharacters?: string[];
    provideSignatureHelp(
        model: Monaco.editor.ITextModel,
        position: Monaco.Position,
        token: Monaco.CancellationToken,
        context: Monaco.languages.SignatureHelpContext
    ): Monaco.languages.SignatureHelpResult | null | Promise<Monaco.languages.SignatureHelpResult | null>;
}

// ============================================================================
// Project Detection
// ============================================================================

/**
 * Detected project type information
 */
export interface DetectedProject {
    /** Project type identifier (e.g., "s1api", "tauri", "react") */
    type: string;
    /** Human-readable project name */
    name: string;
    /** Confidence level (0-1) */
    confidence: number;
    /** Additional metadata about the detected project */
    metadata?: Record<string, unknown>;
}

/**
 * Project detector interface
 */
export interface ProjectDetector {
    /** Unique detector ID */
    id: string;
    /** Project type this detector identifies */
    projectType: string;
    
    /**
     * Detect if the workspace is this project type
     * @param workspaceRoot - Root path of the workspace
     * @returns Detection result or null if not detected
     */
    detect(workspaceRoot: string): Promise<DetectedProject | null>;
}

// ============================================================================
// Plugin Registry Types
// ============================================================================

/**
 * Registered plugin entry in the registry
 */
export interface RegisteredPlugin {
    /** Plugin manifest/metadata */
    manifest: PluginManifest;
    /** Current plugin state */
    state: PluginState;
    /** Plugin instance (if loaded) */
    instance?: FluxelPlugin;
    /** Error message if state is 'error' */
    error?: string;
    /** Source of the plugin */
    source: 'core' | 'community';
    /** Path to plugin (for community plugins) */
    path?: string;
}

/**
 * Plugin load result
 */
export interface PluginLoadResult {
    success: boolean;
    plugin?: FluxelPlugin;
    error?: string;
}

/**
 * Plugin activation result
 */
export interface PluginActivationResult {
    pluginId: string;
    success: boolean;
    error?: string;
    activationTimeMs: number;
}

// ============================================================================
// Events
// ============================================================================

/**
 * Plugin event types
 */
export type PluginEventType =
    | 'plugin:registered'
    | 'plugin:activated'
    | 'plugin:deactivated'
    | 'plugin:error'
    | 'project:detected';

/**
 * Plugin event payload
 */
export interface PluginEvent {
    type: PluginEventType;
    pluginId?: string;
    data?: unknown;
    timestamp: number;
}

/**
 * Plugin event listener
 */
export type PluginEventListener = (event: PluginEvent) => void;

