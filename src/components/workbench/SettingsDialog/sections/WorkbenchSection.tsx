import type { SettingsState, WorkbenchState } from "@/stores";
import { Code, Columns, Maximize2, Monitor, Sidebar } from "lucide-react";

import { EditorModeOption } from "@/components/workbench/SettingsDialog/components/Options";

export function WorkbenchSection({
  settings,
  workbench,
  sidebarSize,
  errors,
  onSidebarSizeChange,
}: {
  settings: SettingsState;
  workbench: WorkbenchState;
  sidebarSize: number;
  errors: Record<string, string>;
  onSidebarSizeChange: (val: number) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Workbench</h3>
        <p className="text-sm text-muted-foreground">
          Configure workbench layout and behavior
        </p>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">
          Default Editor Mode
        </label>
        <div className="grid grid-cols-3 gap-2">
          <EditorModeOption
            value="code"
            current={settings.defaultEditorMode}
            onClick={() => settings.setDefaultEditorMode("code")}
            icon={<Code size={16} />}
            label="Code"
          />
          <EditorModeOption
            value="split"
            current={settings.defaultEditorMode}
            onClick={() => settings.setDefaultEditorMode("split")}
            icon={<Columns size={16} />}
            label="Split"
          />
          <EditorModeOption
            value="visual"
            current={settings.defaultEditorMode}
            onClick={() => settings.setDefaultEditorMode("visual")}
            icon={<Monitor size={16} />}
            label="Visual"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground flex items-center gap-2">
          <Sidebar size={16} />
          Sidebar Open by Default
        </label>
        <button
          onClick={() =>
            workbench.setDefaultSidebarOpen(!workbench.defaultSidebarOpen)
          }
          className={`w-11 h-6 rounded-full transition-colors relative ${
            workbench.defaultSidebarOpen ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
              workbench.defaultSidebarOpen ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <Maximize2 size={16} />
            Sidebar Default Size
          </label>
          <span className="text-sm font-mono">{sidebarSize}%</span>
        </div>
        <input
          type="range"
          min={10}
          max={50}
          value={sidebarSize}
          onChange={(e) => onSidebarSizeChange(parseInt(e.target.value))}
          className="w-full accent-primary h-2 bg-muted rounded-lg appearance-none cursor-pointer"
        />
        {errors.sidebarSize && (
          <p className="text-xs text-destructive">{errors.sidebarSize}</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground flex items-center gap-2">
          <Maximize2 size={16} />
          Enable Panel Snap
        </label>
        <button
          onClick={() => workbench.setEnablePanelSnap(!workbench.enablePanelSnap)}
          className={`w-11 h-6 rounded-full transition-colors relative ${
            workbench.enablePanelSnap ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
              workbench.enablePanelSnap ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
