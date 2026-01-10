/**
 * useProfiler - React hook for component profiling
 * 
 * Provides utilities for profiling React components and effects.
 * All operations are no-ops when profiling is not available.
 */

import { useRef, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { Profiler, type ProfilerProps } from 'react';
import { FrontendProfiler, type SpanHandle } from '@/lib/services';
import type { FrontendCategory } from '@/types/profiling';

// =============================================================================
// Types
// =============================================================================

interface UseProfilerReturn {
    /**
     * Start a manual span for custom timing.
     * Remember to call span.end() when done.
     */
    startSpan: (name: string, category?: FrontendCategory) => SpanHandle;

    /**
     * Record a point-in-time interaction.
     */
    trackInteraction: (name: string, metadata?: Record<string, string>) => void;

    /**
     * A Profiler wrapper component for this component's children.
     * Automatically records render times.
     */
    ProfilerWrapper: React.FC<{ children: ReactNode }>;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for profiling React components.
 * 
 * @param componentName - Name of the component (used in span names)
 * 
 * @example
 * function MyComponent() {
 *   const { ProfilerWrapper, trackInteraction, startSpan } = useProfiler('MyComponent');
 *   
 *   return (
 *     <ProfilerWrapper>
 *       <button onClick={() => trackInteraction('save_clicked')}>
 *         Save
 *       </button>
 *       <ExpensiveChild data={data} />
 *     </ProfilerWrapper>
 *   );
 * }
 */
export function useProfiler(componentName: string): UseProfilerReturn {
    // Track active spans for cleanup
    const activeSpansRef = useRef<Set<SpanHandle>>(new Set());

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Cancel any active spans when component unmounts
            activeSpansRef.current.forEach(span => span.cancel());
            activeSpansRef.current.clear();
        };
    }, []);

    // Start a manual span
    const startSpan = useCallback((
        name: string,
        category: FrontendCategory = 'frontend_render'
    ): SpanHandle => {
        const fullName = `${componentName}:${name}`;
        const span = FrontendProfiler.startSpan(fullName, category);
        activeSpansRef.current.add(span);

        // Wrap end to remove from tracking
        const originalEnd = span.end;
        span.end = async (metadata?: Record<string, string>) => {
            activeSpansRef.current.delete(span);
            await originalEnd(metadata);
        };

        const originalCancel = span.cancel;
        span.cancel = () => {
            activeSpansRef.current.delete(span);
            originalCancel();
        };

        return span;
    }, [componentName]);

    // Track an interaction
    const trackInteraction = useCallback((
        name: string,
        metadata?: Record<string, string>
    ) => {
        const fullName = `${componentName}:${name}`;
        FrontendProfiler.trackInteraction(fullName, metadata);
    }, [componentName]);

    // Create a Profiler wrapper component
    const ProfilerWrapper = useMemo(() => {
        const onRenderCallback = FrontendProfiler.createProfilerCallback(componentName);

        function Wrapper({ children }: { children: ReactNode }) {
            return (
                <Profiler id={componentName} onRender={onRenderCallback as ProfilerProps['onRender']}>
                    {children}
                </Profiler>
            );
        }

        Wrapper.displayName = `Profiler(${componentName})`;
        return Wrapper;
    }, [componentName]);

    return {
        startSpan,
        trackInteraction,
        ProfilerWrapper,
    };
}

// =============================================================================
// Additional Hooks
// =============================================================================

/**
 * Hook to profile a specific effect with automatic span management.
 * 
 * @example
 * useProfiledEffect('MyComponent:loadData', async () => {
 *   const data = await fetchData();
 *   setData(data);
 * }, [userId]);
 */
export function useProfiledEffect(
    name: string,
    effect: () => Promise<void> | void,
    deps: React.DependencyList = []
): void {
    useEffect(() => {
        const run = async () => {
            const result = effect();
            if (result instanceof Promise) {
                await FrontendProfiler.profileAsync(name, 'frontend_render', async () => {
                    await result;
                });
            }
        };

        run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [name, ...deps]);
}

/**
 * Hook to track when a component mounts and unmounts.
 * 
 * @example
 * useProfiledMount('ExpensiveComponent');
 */
export function useProfiledMount(componentName: string): void {
    useEffect(() => {
        FrontendProfiler.trackInteraction(`${componentName}:mount`);

        return () => {
            FrontendProfiler.trackInteraction(`${componentName}:unmount`);
        };
    }, [componentName]);
}

export default useProfiler;
