import type { SettingsState, AccentColor } from "@/stores";
import { Check, Moon, Sun } from "lucide-react";

import {
  DensityOption,
  IconPackOption,
  ThemeOption,
} from "@/components/workbench/SettingsDialog/components/Options";

export function AppearanceSection({ settings }: { settings: SettingsState }) {
  const accentColors: { value: AccentColor; label: string; color: string }[] = [
    { value: "orange", label: "Orange", color: "bg-[#f97316]" },
    { value: "blue", label: "Blue", color: "bg-[#3b82f6]" },
    { value: "green", label: "Green", color: "bg-[#22c55e]" },
    { value: "purple", label: "Purple", color: "bg-[#a855f7]" },
    { value: "red", label: "Red", color: "bg-[#ef4444]" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Appearance</h3>
        <p className="text-sm text-muted-foreground">
          Customize the look and feel of Fluxel
        </p>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Theme</label>
        <div className="grid grid-cols-2 gap-2">
          <ThemeOption
            value="light"
            current={settings.theme}
            onClick={() => settings.setTheme("light")}
            icon={<Sun size={16} />}
            label="Light"
          />
          <ThemeOption
            value="dark"
            current={settings.theme}
            onClick={() => settings.setTheme("dark")}
            icon={<Moon size={16} />}
            label="Dark"
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">
          Accent Color
        </label>
        <div className="grid grid-cols-5 gap-2">
          {accentColors.map((color) => (
            <button
              key={color.value}
              onClick={() => settings.setAccentColor(color.value)}
              className={`relative flex flex-col items-center justify-center gap-2 p-3 rounded-lg border transition-all ${
                settings.accentColor === color.value
                  ? "border-primary bg-primary/10 ring-1 ring-primary"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <div className={`w-6 h-6 rounded-full ${color.color}`} />
              <span className="text-xs font-medium">{color.label}</span>
              {settings.accentColor === color.value && (
                <Check size={12} className="absolute top-1 right-1 text-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Icon Pack</label>
        <div className="grid grid-cols-2 gap-2">
          <IconPackOption
            value="react-icons"
            current={settings.iconPack}
            onClick={() => settings.setIconPack("react-icons")}
            label="React Icons"
          />
          <IconPackOption
            value="lucide"
            current={settings.iconPack}
            onClick={() => settings.setIconPack("lucide")}
            label="Lucide"
          />
          <IconPackOption
            value="react-file-icon"
            current={settings.iconPack}
            onClick={() => settings.setIconPack("react-file-icon")}
            label="React File Icon"
          />
          <IconPackOption
            value="material"
            current={settings.iconPack}
            onClick={() => settings.setIconPack("material")}
            label="Material"
          />
          <IconPackOption
            value="exuanbo"
            current={settings.iconPack}
            onClick={() => settings.setIconPack("exuanbo")}
            label="Exuanbo (JS)"
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">UI Density</label>
        <div className="grid grid-cols-3 gap-2">
          <DensityOption
            value="compact"
            current={settings.uiDensity}
            onClick={() => settings.setUIDensity("compact")}
            label="Compact"
            description="Editor-focused, minimal chrome"
          />
          <DensityOption
            value="comfortable"
            current={settings.uiDensity}
            onClick={() => settings.setUIDensity("comfortable")}
            label="Comfortable"
            description="Balanced layout"
          />
          <DensityOption
            value="spacious"
            current={settings.uiDensity}
            onClick={() => settings.setUIDensity("spacious")}
            label="Spacious"
            description="More room for all panels"
          />
        </div>
      </div>
    </div>
  );
}
