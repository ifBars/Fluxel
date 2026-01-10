/**
 * FrontendProfiler - Utilities for profiling frontend code
 * 
 * Provides easy-to-use utilities for profiling React components,
 * async operations, and user interactions. All functions are no-ops
 * when profiling is not available (production builds).
 * 
 * ## Parent-Child Relationship Tracking
 * 
 * Supports automatic parent-child span relationships through a call stack.
 * Parent IDs are captured at span START time, ensuring correct hierarchy
 * even when spans complete in different orders.
 * 
 * ### Limitation: Fire-and-Forget Async Operations
 * 
 * The stack-based approach has a limitation with "fire-and-forget" patterns:
 * 
 * ```typescript
 * // ❌ INCORRECT - loadData won't have parent as its parent
 * profileSync('parent', 'workspace', () => {
 *   loadData();  // fire-and-forget, doesn't await
 * });
 * 
 * // ✅ CORRECT - loadData will have parent as its parent
 * await profileAsync('parent', 'workspace', async () => {
 *   await loadData();  // properly awaited
 * });
 * ```
 * 
 * When an async operation is started but not awaited, the parent span
 * may have already been popped from the stack by the time the child
 * operation captures its parent ID. For accurate hierarchies, ensure
 * profiled operations are properly awaited.
 */

import { ProfilerService } from './ProfilerService';
import type { FrontendCategory, SpanCategory } from '@/types/profiling';

// =============================================================================
// Span Context Stack (for parent-child relationships)
// =============================================================================

/**
 * Stack of active span IDs for tracking parent-child relationships.
 * Uses a simple array since JS is single-threaded.
 * 
 * Note: This tracks the "current" span in the synchronous call stack.
 * For async operations, we capture the parent at span start time.
 */
let spanIdCounter = 1000000; // Start high to avoid conflicts with backend IDs
const activeSpanStack: string[] = [];

function generateSpanId(): string {
    // Use simple incrementing counter that can be parsed as u64 in Rust
    return (spanIdCounter++).toString();
}

export function getCurrentParentId(): string | undefined {
    return activeSpanStack.length > 0
        ? activeSpanStack[activeSpanStack.length - 1]
        : undefined;
}

function pushSpan(spanId: string): void {
    activeSpanStack.push(spanId);
}

function popSpan(): void {
    activeSpanStack.pop();
}

// =============================================================================
// Span Handle
// =============================================================================

/**
 * Handle returned by startSpan for ending the span.
 */
export interface SpanHandle {
    /** Unique ID of this span */
    id: string;
    /** End the span and record it */
    end: (metadata?: Record<string, string>) => Promise<void>;
    /** Cancel the span without recording it */
    cancel: () => void;
}

export interface ProfilerOptions {
    metadata?: Record<string, string>;
    parentId?: string;
}

// =============================================================================
// Span Timing
// =============================================================================

/**
 * Start a new span for manual timing.
 * Automatically tracks parent-child relationships through the call stack.
 * 
 * @example
 * const span = startSpan('loadData', 'frontend_network');
 * try {
 *   await fetchData();
 * } finally {
 *   await span.end();
 * }
 */
export function startSpan(name: string, category: FrontendCategory | SpanCategory, options?: ProfilerOptions | Record<string, string>): SpanHandle {
    // Backwards compatibility handling
    let metadata: Record<string, string> | undefined;
    let explicitParentId: string | undefined;
    let hasExplicitParentId = false;

    if (options) {
        if ('metadata' in options || 'parentId' in options) {
            const opts = options as ProfilerOptions;
            metadata = opts.metadata;
            explicitParentId = opts.parentId;
            hasExplicitParentId = 'parentId' in opts; // Check if parentId was explicitly provided (even if undefined)
        } else {
            metadata = options as Record<string, string>;
        }
    }

    const spanId = generateSpanId();
    // If parentId was explicitly provided (even if undefined), use it; otherwise use call stack
    const parentId = hasExplicitParentId ? explicitParentId : getCurrentParentId();
    const startTime = performance.now();
    let cancelled = false;

    // Push this span onto the stack so nested spans can find it
    pushSpan(spanId);

    return {
        id: spanId,
        end: async (metadataOverride?: Record<string, string>) => {
            // Pop this span from the stack
            popSpan();

            if (cancelled) return;

            const durationMs = performance.now() - startTime;

            // Merge initial metadata with end metadata
            const finalMetadata: Record<string, string> = {};
            if (metadata) Object.assign(finalMetadata, metadata);
            if (metadataOverride) Object.assign(finalMetadata, metadataOverride);

            const metadataEntries = Object.keys(finalMetadata).length > 0
                ? Object.entries(finalMetadata) as [string, string][]
                : undefined;

            await ProfilerService.recordFrontendSpan({
                id: spanId,
                name,
                category,
                durationMs,
                parentId,
                metadata: metadataEntries,
            });
        },
        cancel: () => {
            popSpan();
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
    options?: ProfilerOptions | Record<string, string>
): Promise<T> {
    const span = startSpan(name, category, options);
    try {
        return await fn();
    } finally {
        // Backwards compatibility for when options was just metadata
        let metadata: Record<string, string> | undefined;
        if (options) {
            if ('metadata' in options || 'parentId' in options) {
                metadata = (options as ProfilerOptions).metadata;
            } else {
                metadata = options as Record<string, string>;
            }
        }
        await span.end(metadata);
    }
}

/**
 * Profile a synchronous operation.
 * Automatically tracks parent-child relationships through the call stack.
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
    options?: ProfilerOptions | Record<string, string>
): T {
    // Backwards compatibility handling
    let metadata: Record<string, string> | undefined;
    let explicitParentId: string | undefined;
    let hasExplicitParentId = false;

    if (options) {
        if ('metadata' in options || 'parentId' in options) {
            const opts = options as ProfilerOptions;
            metadata = opts.metadata;
            explicitParentId = opts.parentId;
            hasExplicitParentId = 'parentId' in opts; // Check if parentId was explicitly provided (even if undefined)
        } else {
            metadata = options as Record<string, string>;
        }
    }

    const spanId = generateSpanId();
    // If parentId was explicitly provided (even if undefined), use it; otherwise use call stack
    const parentId = hasExplicitParentId ? explicitParentId : getCurrentParentId();
    const startTime = performance.now();

    // Push this span onto the stack so nested spans can find it
    pushSpan(spanId);

    try {
        return fn();
    } finally {
        // Pop this span from the stack
        popSpan();

        const durationMs = performance.now() - startTime;

        // Fire and forget - don't await in sync context
        ProfilerService.recordFrontendSpan({
            id: spanId,
            name,
            category,
            durationMs,
            parentId,
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
        startTime: number,
        commitTime: number
    ) => {
        // Skip frequent update phases to reduce profiling noise
        // Only record mount phases which are useful for understanding initial render performance
        if (phase === 'update' || phase === 'nested-update') {
            return;
        }

        // Get current parent from stack (if rendering inside a profiled operation)
        const parentId = getCurrentParentId();
        // Generate a unique ID for this render span
        const spanId = generateSpanId();

        // Calculate render phases timing
        const renderTime = commitTime - startTime;
        const commitOverhead = actualDuration - renderTime;

        // Fire and forget
        ProfilerService.recordFrontendSpan({
            id: spanId,
            name: `${componentName}:${phase}`,
            category: 'frontend_render',
            durationMs: actualDuration,
            parentId,
            metadata: [
                ['phase', phase],
                ['baseDuration', baseDuration.toFixed(2)],
                ['id', id],
                ['renderTime', renderTime.toFixed(2)],
                ['commitOverhead', commitOverhead.toFixed(2)],
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
    const parentId = getCurrentParentId();
    const spanId = generateSpanId();

    ProfilerService.recordFrontendSpan({
        id: spanId,
        name,
        category: 'frontend_interaction',
        durationMs: 0, // Interactions are point-in-time events
        parentId,
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
    getCurrentParentId,

    // React integration
    createProfilerCallback,

    // Interaction tracking
    trackInteraction,
    withInteractionTracking,

    // Sessions
    withSession,
};

export default FrontendProfiler;
