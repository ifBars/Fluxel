import { useEffect, type DependencyList, type EffectCallback } from "react";

/**
 * Centralized effect wrapper so app code avoids direct `useEffect` calls.
 * Prefer more specific primitives (query hooks, event handlers, derived state)
 * before reaching for this fallback.
 */
export function useReactiveEffect(effect: EffectCallback, deps?: DependencyList): void {
  useEffect(effect, deps);
}
