import type { BuildSystem, SettingsState } from "@/stores";
import { Check } from "lucide-react";

export function BuildSection({ settings }: { settings: SettingsState }) {
  const buildSystems: {
    value: BuildSystem;
    label: string;
    description: string;
  }[] = [
    { value: "auto", label: "Auto-Detect", description: "Automatically detect project type" },
    { value: "dotnet", label: ".NET", description: "Build with dotnet build" },
    { value: "bun", label: "Bun", description: "Build with bun run build" },
    { value: "npm", label: "NPM", description: "Build with npm run build" },
    { value: "manual", label: "Custom", description: "Use a custom build command" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Build</h3>
        <p className="text-sm text-muted-foreground">
          Configure build system and commands
        </p>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Build System</label>
        <div className="space-y-2">
          {buildSystems.map((system) => (
            <button
              key={system.value}
              onClick={() => settings.setBuildSystem(system.value)}
              className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
                settings.buildSystem === system.value
                  ? "border-primary bg-primary/10 ring-1 ring-primary"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">{system.label}</span>
                <span className="text-xs text-muted-foreground">
                  {system.description}
                </span>
              </div>
              {settings.buildSystem === system.value && (
                <Check size={14} className="text-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">
          Custom Build Command
        </label>
        <input
          type="text"
          value={settings.customBuildCommand}
          onChange={(e) => settings.setCustomBuildCommand(e.target.value)}
          placeholder="e.g. npm run build:prod"
          className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary font-mono"
          disabled={settings.buildSystem !== "manual"}
        />
      </div>
    </div>
  );
}
