/**
 * FrontendProfiler - Utilities for profiling frontend code
 * 
 * Provides easy-to-use utilities for profiling React components,
 * async operations, and user interactions. All functions are no-ops
 * when profiling is not available (production builds).
 */

import { ProfilerService } from './ProfilerService';
import type { FrontendCategory, SpanCategory } from '@/types/profiling';

// =============================================================================
// Span Handle
// =============================================================================

/**
 * Handle returned by startSpan for ending the span.
 */
export interface SpanHandle {
    /** End the span and record it */
    end: (metadata?: Record<string, string>) => Promise<void>;
    /** Cancel the span without recording it */
    cancel: () => void;
}

// =============================================================================
// Span Timing
// =============================================================================

/**
 * Start a new span for manual timing.
 * 
 * @example
 * const span = startSpan('loadData', 'frontend_network');
 * try {
 *   await fetchData();
 * } finally {
 *   await span.end();
 * }
 */
export function startSpan(name: string, category: FrontendCategory | SpanCategory): SpanHandle {
    const startTime = performance.now();
    let cancelled = false;

    return {
        end: async (metadata?: Record<string, string>) => {
            if (cancelled) return;

            const durationMs = performance.now() - startTime;
            const metadataEntries = metadata
                ? Object.entries(metadata) as [string, string][]
                : undefined;

            await ProfilerService.recordFrontendSpan({
                name,
                category,
                durationMs,
                metadata: metadataEntries,
            });
        },
        cancel: () => {
            cancelled = true;
        },
    };
}

// =============================================================================
// Higher-Order Functions
// =============================================================================

/**
 * Profile an async operation.
 * 
 * @example
 * const result = await profileAsync('fetchUserData', 'frontend_network', async () => {
 *   return await fetch('/api/user').then(r => r.json());
 * });
 */
export async function profileAsync<T>(
    name: string,
    category: FrontendCategory | SpanCategory,
    fn: () => Promise<T>,
    metadata?: Record<string, string>
): Promise<T> {
    const span = startSpan(name, category);
    try {
        return await fn();
    } finally {
        await span.end(metadata);
    }
}

/**
 * Profile a synchronous operation.
 * 
 * @example
 * const result = profileSync('parseData', 'frontend_render', () => {
 *   return JSON.parse(largeJsonString);
 * });
 */
export function profileSync<T>(
    name: string,
    category: FrontendCategory | SpanCategory,
    fn: () => T,
    metadata?: Record<string, string>
): T {
    const startTime = performance.now();
    try {
        return fn();
    } finally {
        const durationMs = performance.now() - startTime;
        // Fire and forget - don't await in sync context
        ProfilerService.recordFrontendSpan({
            name,
            category,
            durationMs,
            metadata: metadata ? Object.entries(metadata) as [string, string][] : undefined,
        }).catch(() => {
            // Ignore errors in production
        });
    }
}

// =============================================================================
// React Profiler Integration
// =============================================================================

/**
 * Callback type for React's <Profiler> component.
 */
export type ProfilerOnRender = (
    id: string,
    phase: 'mount' | 'update' | 'nested-update',
    actualDuration: number,
    baseDuration: number,
    startTime: number,
    commitTime: number
) => void;

/**
 * Create a callback for React's <Profiler> component.
 * 
 * Filters out frequent "update" and "nested-update" phases to reduce profiling noise,
 * but keeps "mount" phases which are useful for understanding initial render performance.
 * 
 * @example
 * import { Profiler } from 'react';
 * 
 * function MyComponent() {
 *   return (
 *     <Profiler id="MyComponent" onRender={createProfilerCallback('MyComponent')}>
 *       <ExpensiveChild />
 *     </Profiler>
 *   );
 * }
 */
export function createProfilerCallback(componentName: string): ProfilerOnRender {
    return (
        id: string,
        phase: 'mount' | 'update' | 'nested-update',
        actualDuration: number,
        baseDuration: number,
        _startTime: number,
        _commitTime: number
    ) => {
        // Skip frequent update phases to reduce profiling noise
        // Only record mount phases which are useful for understanding initial render performance
        if (phase === 'update' || phase === 'nested-update') {
            return;
        }

        // Fire and forget
        ProfilerService.recordFrontendSpan({
            name: `${componentName}:${phase}`,
            category: 'frontend_render',
            durationMs: actualDuration,
            metadata: [
                ['phase', phase],
                ['baseDuration', baseDuration.toFixed(2)],
                ['id', id],
            ],
        }).catch(() => {
            // Ignore errors
        });
    };
}

// =============================================================================
// Interaction Tracking
// =============================================================================

/**
 * Record a user interaction.
 * 
 * @example
 * function handleClick(e: MouseEvent) {
 *   trackInteraction('button_click', { buttonId: 'submit-form' });
 *   // ... handle click
 * }
 */
export function trackInteraction(
    name: string,
    metadata?: Record<string, string>
): void {
    ProfilerService.recordFrontendSpan({
        name,
        category: 'frontend_interaction',
        durationMs: 0, // Interactions are point-in-time events
        metadata: metadata ? Object.entries(metadata) as [string, string][] : undefined,
    }).catch(() => {
        // Ignore errors
    });
}

/**
 * Create a wrapped event handler that tracks interactions.
 * 
 * @example
 * <button onClick={withInteractionTracking('save_button', handleSave)}>
 *   Save
 * </button>
 */
export function withInteractionTracking<E extends Event>(
    name: string,
    handler: (event: E) => void | Promise<void>,
    metadata?: Record<string, string>
): (event: E) => void | Promise<void> {
    return (event: E) => {
        trackInteraction(name, metadata);
        return handler(event);
    };
}

// =============================================================================
// Session Helpers
// =============================================================================

/**
 * Run a function within a profiling session.
 * Automatically starts and ends the session.
 * 
 * @example
 * const report = await withSession('user-flow-test', async () => {
 *   await openFile('src/main.ts');
 *   await searchFiles('TODO');
 *   await runBuild();
 * });
 * console.log('Session captured', report.session.spanCount, 'spans');
 */
export async function withSession<T>(
    sessionName: string,
    fn: () => Promise<T>
): Promise<{ result: T; report: Awaited<ReturnType<typeof ProfilerService.endSession>> }> {
    const sessionId = await ProfilerService.startSession(sessionName);

    try {
        const result = await fn();
        const report = sessionId
            ? await ProfilerService.endSession(sessionId)
            : null;
        return { result, report };
    } catch (error) {
        // Still try to end the session on error
        if (sessionId) {
            await ProfilerService.endSession(sessionId).catch(() => { });
        }
        throw error;
    }
}

// =============================================================================
// Default Export
// =============================================================================

export const FrontendProfiler = {
    // Span timing
    startSpan,
    profileAsync,
    profileSync,

    // React integration
    createProfilerCallback,

    // Interaction tracking
    trackInteraction,
    withInteractionTracking,

    // Sessions
    withSession,
};

export default FrontendProfiler;
