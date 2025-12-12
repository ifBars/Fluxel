import type { ReactNode } from "react";
import { Check } from "lucide-react";

import type { EditorMode, Theme, UIDensity } from "@/stores";

export function ThemeOption({
  value,
  current,
  onClick,
  icon,
  label,
}: {
  value: Theme;
  current: Theme;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  const isActive = value === current;
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${
        isActive
          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
          : "border-border hover:bg-muted/50 text-muted-foreground"
      }`}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
      {isActive && <Check size={14} className="ml-auto" />}
    </button>
  );
}

export function DensityOption({
  value,
  current,
  onClick,
  label,
  description,
}: {
  value: UIDensity;
  current: UIDensity;
  onClick: () => void;
  label: string;
  description: string;
}) {
  const isActive = value === current;
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-start gap-1 p-3 rounded-lg border transition-all text-left ${
        isActive
          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
          : "border-border hover:bg-muted/50 text-muted-foreground"
      }`}
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs opacity-70">{description}</span>
      {isActive && <Check size={14} className="absolute top-1 right-1" />}
    </button>
  );
}

export function EditorModeOption({
  value,
  current,
  onClick,
  icon,
  label,
}: {
  value: EditorMode;
  current: EditorMode;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  const isActive = value === current;
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border transition-all ${
        isActive
          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
          : "border-border hover:bg-muted/50 text-muted-foreground"
      }`}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
      {isActive && <Check size={12} className="absolute top-1 right-1" />}
    </button>
  );
}

export function IconPackOption({
  value,
  current,
  onClick,
  label,
}: {
  value: string;
  current: string;
  onClick: () => void;
  label: string;
}) {
  const isActive = value === current;
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-left ${
        isActive
          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
          : "border-border hover:bg-muted/50 text-muted-foreground"
      }`}
    >
      <span className="text-sm font-medium">{label}</span>
      {isActive && <Check size={14} />}
    </button>
  );
}
