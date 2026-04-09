import type { EffectCallback } from "react";
import { useReactiveEffect } from "@/hooks/useReactiveEffect";

export function useMountEffect(effect: EffectCallback): void {
  useReactiveEffect(effect, []);
}
