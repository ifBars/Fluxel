/**
 * Plugin Host
 * 
 * Central manager for the plugin system. Handles plugin lifecycle,
 * activation events, and coordination between plugins.
 */

import type {
    FluxelPlugin,
    RegisteredPlugin,
    PluginState,
    PluginContext,
    PluginActivationResult,
    PluginEvent,
    PluginEventListener,
    PluginEventType,
    ProjectDetector,
    DetectedProject,
    Disposable,
    MonacoInstance,
    ActivationEvent,
} from './types';
import { createPluginContext, disposePluginContext } from './PluginContext';

/**
 * Plugin Host - Manages plugin lifecycle and activation
 */
export class PluginHost {
    private static instance: PluginHost | null = null;

    private plugins = new Map<string, RegisteredPlugin>();
    private contexts = new Map<string, PluginContext>();
    private projectDetectors = new Map<string, ProjectDetector>();
    private detectedProjects = new Map<string, DetectedProject>();
    private eventListeners = new Map<PluginEventType, Set<PluginEventListener>>();
    
    private monaco: MonacoInstance | null = null;
    private workspaceRoot: string | null = null;
    private initialized = false;

    private constructor() {}

    /**
     * Get the singleton instance
     */
    static getInstance(): PluginHost {
        if (!PluginHost.instance) {
            PluginHost.instance = new PluginHost();
        }
        return PluginHost.instance;
    }

    /**
     * Initialize the plugin host with Monaco
     */
    initialize(monaco: MonacoInstance): void {
        if (this.initialized) {
            console.warn('[PluginHost] Already initialized');
            return;
        }

        this.monaco = monaco;
        this.initialized = true;
        console.log('[PluginHost] Initialized');
    }

    /**
     * Set the current workspace root
     */
    setWorkspaceRoot(root: string | null): void {
        const previousRoot = this.workspaceRoot;
        this.workspaceRoot = root;

        if (root && root !== previousRoot) {
            // Run project detection when workspace changes
            void this.detectProjects();
        }
    }

    /**
     * Get the current workspace root
     */
    getWorkspaceRoot(): string | null {
        return this.workspaceRoot;
    }

    /**
     * Register a plugin
     */
    register(plugin: FluxelPlugin, source: 'core' | 'community' = 'core', path?: string): void {
        if (this.plugins.has(plugin.id)) {
            console.warn(`[PluginHost] Plugin ${plugin.id} is already registered`);
            return;
        }

        const registered: RegisteredPlugin = {
            manifest: {
                id: plugin.id,
                name: plugin.name,
                version: plugin.version,
                description: plugin.description,
                author: plugin.author,
                repository: plugin.repository,
                activationEvents: plugin.activationEvents,
                dependencies: plugin.dependencies,
                isCore: source === 'core',
            },
            state: 'inactive',
            instance: plugin,
            source,
            path,
        };

        this.plugins.set(plugin.id, registered);
        console.log(`[PluginHost] Registered plugin: ${plugin.id} (${source})`);

        this.emit({
            type: 'plugin:registered',
            pluginId: plugin.id,
            data: registered.manifest,
            timestamp: Date.now(),
        });

        // Check if plugin should be activated immediately
        if (plugin.activationEvents.includes('*') || plugin.activationEvents.includes('onStartup')) {
            void this.activatePlugin(plugin.id);
        }
    }

    /**
     * Activate a specific plugin
     */
    async activatePlugin(pluginId: string): Promise<PluginActivationResult> {
        const startTime = performance.now();
        const registered = this.plugins.get(pluginId);

        if (!registered) {
            return {
                pluginId,
                success: false,
                error: `Plugin ${pluginId} not found`,
                activationTimeMs: 0,
            };
        }

        if (registered.state === 'active') {
            return {
                pluginId,
                success: true,
                activationTimeMs: 0,
            };
        }

        if (registered.state === 'activating') {
            return {
                pluginId,
                success: false,
                error: 'Plugin is already activating',
                activationTimeMs: 0,
            };
        }

        if (!this.monaco) {
            return {
                pluginId,
                success: false,
                error: 'Plugin host not initialized (Monaco not available)',
                activationTimeMs: 0,
            };
        }

        // Check dependencies
        if (registered.manifest.dependencies) {
            for (const depId of registered.manifest.dependencies) {
                const dep = this.plugins.get(depId);
                if (!dep || dep.state !== 'active') {
                    // Try to activate dependency first
                    const depResult = await this.activatePlugin(depId);
                    if (!depResult.success) {
                        return {
                            pluginId,
                            success: false,
                            error: `Failed to activate dependency ${depId}: ${depResult.error}`,
                            activationTimeMs: performance.now() - startTime,
                        };
                    }
                }
            }
        }

        this.updatePluginState(pluginId, 'activating');

        try {
            const context = createPluginContext(
                pluginId,
                this.monaco,
                () => this.workspaceRoot,
                (detector) => this.registerProjectDetector(detector),
            );
            
            this.contexts.set(pluginId, context);

            await registered.instance!.activate(context);

            this.updatePluginState(pluginId, 'active');

            const activationTimeMs = performance.now() - startTime;
            console.log(`[PluginHost] Activated plugin: ${pluginId} (${activationTimeMs.toFixed(2)}ms)`);

            this.emit({
                type: 'plugin:activated',
                pluginId,
                data: { activationTimeMs },
                timestamp: Date.now(),
            });

            return {
                pluginId,
                success: true,
                activationTimeMs,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.updatePluginState(pluginId, 'error', errorMessage);

            console.error(`[PluginHost] Failed to activate plugin ${pluginId}:`, error);

            this.emit({
                type: 'plugin:error',
                pluginId,
                data: { error: errorMessage },
                timestamp: Date.now(),
            });

            return {
                pluginId,
                success: false,
                error: errorMessage,
                activationTimeMs: performance.now() - startTime,
            };
        }
    }

    /**
     * Deactivate a specific plugin
     */
    async deactivatePlugin(pluginId: string): Promise<void> {
        const registered = this.plugins.get(pluginId);
        if (!registered || registered.state !== 'active') {
            return;
        }

        this.updatePluginState(pluginId, 'deactivating');

        try {
            // Call plugin's deactivate if it exists
            if (registered.instance?.deactivate) {
                await registered.instance.deactivate();
            }

            // Dispose context and subscriptions
            const context = this.contexts.get(pluginId);
            if (context) {
                disposePluginContext(context);
                this.contexts.delete(pluginId);
            }

            this.updatePluginState(pluginId, 'inactive');

            console.log(`[PluginHost] Deactivated plugin: ${pluginId}`);

            this.emit({
                type: 'plugin:deactivated',
                pluginId,
                timestamp: Date.now(),
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.updatePluginState(pluginId, 'error', errorMessage);
            console.error(`[PluginHost] Error deactivating plugin ${pluginId}:`, error);
        }
    }

    /**
     * Trigger activation for plugins matching an event
     */
    async triggerActivation(event: ActivationEvent): Promise<void> {
        const matchingPlugins = Array.from(this.plugins.entries())
            .filter(([_, p]) => 
                p.state === 'inactive' && 
                (p.manifest.activationEvents.includes(event) || p.manifest.activationEvents.includes('*'))
            );

        for (const [pluginId] of matchingPlugins) {
            await this.activatePlugin(pluginId);
        }
    }

    /**
     * Register a project detector
     */
    private registerProjectDetector(detector: ProjectDetector): Disposable {
        this.projectDetectors.set(detector.id, detector);
        console.log(`[PluginHost] Registered project detector: ${detector.id}`);

        // Run detection if workspace is already set
        if (this.workspaceRoot) {
            void this.runDetector(detector);
        }

        return {
            dispose: () => {
                this.projectDetectors.delete(detector.id);
                this.detectedProjects.delete(detector.projectType);
            },
        };
    }

    /**
     * Run a specific project detector
     */
    private async runDetector(detector: ProjectDetector): Promise<void> {
        if (!this.workspaceRoot) return;

        try {
            const result = await detector.detect(this.workspaceRoot);
            if (result) {
                this.detectedProjects.set(result.type, result);
                console.log(`[PluginHost] Detected project: ${result.type} (confidence: ${result.confidence})`);

                this.emit({
                    type: 'project:detected',
                    data: result,
                    timestamp: Date.now(),
                });

                // Trigger activation for plugins listening to this project type
                await this.triggerActivation(`onProject:${result.type}`);
            }
        } catch (error) {
            console.error(`[PluginHost] Project detector ${detector.id} failed:`, error);
        }
    }

    /**
     * Run all project detectors
     */
    async detectProjects(): Promise<DetectedProject[]> {
        if (!this.workspaceRoot) return [];

        this.detectedProjects.clear();

        const detectors = Array.from(this.projectDetectors.values());
        await Promise.all(detectors.map(d => this.runDetector(d)));

        return Array.from(this.detectedProjects.values());
    }

    /**
     * Get detected projects
     */
    getDetectedProjects(): DetectedProject[] {
        return Array.from(this.detectedProjects.values());
    }

    /**
     * Update plugin state
     */
    private updatePluginState(pluginId: string, state: PluginState, error?: string): void {
        const registered = this.plugins.get(pluginId);
        if (registered) {
            registered.state = state;
            registered.error = error;
        }
    }

    /**
     * Get all registered plugins
     */
    getPlugins(): RegisteredPlugin[] {
        return Array.from(this.plugins.values());
    }

    /**
     * Get a specific plugin
     */
    getPlugin(pluginId: string): RegisteredPlugin | undefined {
        return this.plugins.get(pluginId);
    }

    /**
     * Check if a plugin is active
     */
    isPluginActive(pluginId: string): boolean {
        const plugin = this.plugins.get(pluginId);
        return plugin?.state === 'active';
    }

    /**
     * Subscribe to plugin events
     */
    on(eventType: PluginEventType, listener: PluginEventListener): Disposable {
        if (!this.eventListeners.has(eventType)) {
            this.eventListeners.set(eventType, new Set());
        }
        this.eventListeners.get(eventType)!.add(listener);

        return {
            dispose: () => {
                this.eventListeners.get(eventType)?.delete(listener);
            },
        };
    }

    /**
     * Emit a plugin event
     */
    private emit(event: PluginEvent): void {
        const listeners = this.eventListeners.get(event.type);
        if (listeners) {
            for (const listener of listeners) {
                try {
                    listener(event);
                } catch (error) {
                    console.error('[PluginHost] Event listener error:', error);
                }
            }
        }
    }

    /**
     * Dispose the plugin host and all plugins
     */
    async dispose(): Promise<void> {
        console.log('[PluginHost] Disposing...');

        // Deactivate all plugins
        const activePlugins = Array.from(this.plugins.entries())
            .filter(([_, p]) => p.state === 'active');

        for (const [pluginId] of activePlugins) {
            await this.deactivatePlugin(pluginId);
        }

        this.plugins.clear();
        this.contexts.clear();
        this.projectDetectors.clear();
        this.detectedProjects.clear();
        this.eventListeners.clear();
        this.initialized = false;

        console.log('[PluginHost] Disposed');
    }
}

/**
 * Get the plugin host singleton
 */
export function getPluginHost(): PluginHost {
    return PluginHost.getInstance();
}

