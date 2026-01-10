import { useEffect, useState, type ReactNode } from "react";
import { z } from "zod";
import {
  Code,
  GitBranch,
  Hammer,
  Keyboard,
  Layout,
  Palette,
  Sparkles,
  X,
} from "lucide-react";

import {
  useSettingsStore,
  useWorkbenchStore,
} from "@/stores";
import { AppearanceSection } from "@/components/workbench/SettingsDialog/sections/AppearanceSection";
import { AutocompleteSection } from "@/components/workbench/SettingsDialog/sections/AutocompleteSection";
import { BuildSection } from "@/components/workbench/SettingsDialog/sections/BuildSection";
import { EditorSection } from "@/components/workbench/SettingsDialog/sections/EditorSection";
import { ShortcutsSection } from "@/components/workbench/SettingsDialog/sections/ShortcutsSection";
import { VersionControlSection } from "@/components/workbench/SettingsDialog/sections/VersionControlSection";
import { WorkbenchSection } from "@/components/workbench/SettingsDialog/sections/WorkbenchSection";
import ScrollableArea from "@/components/ui/scrollable-area";
import { AgentSection } from "@/components/workbench/SettingsDialog/sections/AgentSection";

type SettingsSection =
  | "appearance"
  | "editor"
  | "autocomplete"
  | "workbench"
  | "build"
  | "versionControl"
  | "agent"
  | "shortcuts";

const settingsSchema = z.object({
  fontSize: z.number().min(10).max(32),
  tabSize: z.number().min(1).max(8),
  autosaveDelay: z.number().min(0).max(10000),
  sidebarDefaultSize: z.number().min(10).max(50),
  showMinimap: z.boolean(),
  theme: z.enum(["light", "dark"]),
  defaultEditorMode: z.enum(["code", "visual", "split"]),
});

export default function SettingsDialog({
  isOpen,
  onClose,
  initialSection,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: string;
}) {
  const settings = useSettingsStore();
  const workbench = useWorkbenchStore();
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("appearance");
  const [sidebarSize, setSidebarSize] = useState(workbench.sidebarDefaultSize);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setSidebarSize(workbench.sidebarDefaultSize);
      setErrors({});
      // Set initial section if provided and valid
      const validSections: SettingsSection[] = ['appearance', 'editor', 'autocomplete', 'workbench', 'build', 'versionControl', 'agent', 'shortcuts'];
      if (initialSection && validSections.includes(initialSection as SettingsSection)) {
        setActiveSection(initialSection as SettingsSection);
      }
    }
  }, [
    workbench.sidebarDefaultSize,
    isOpen,
    initialSection,
  ]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    isOpen,
    onClose,
  ]);

  if (!isOpen) return null;

  const handleSidebarSizeChange = (val: number) => {
    const parsed = settingsSchema
      .pick({ sidebarDefaultSize: true })
      .safeParse({ sidebarDefaultSize: val });
    if (parsed.success) {
      workbench.setSidebarDefaultSize(val);
      setSidebarSize(val);
      setErrors((prev) => ({ ...prev, sidebarSize: "" }));
    } else {
      setErrors((prev) => ({
        ...prev,
        sidebarSize: "Sidebar size must be between 10% and 50%",
      }));
    }
  };

  const sections: { id: SettingsSection; label: string; icon: ReactNode }[] = [
    { id: "appearance", label: "Appearance", icon: <Palette size={16} /> },
    { id: "editor", label: "Editor", icon: <Code size={16} /> },
    { id: "autocomplete", label: "Autocomplete", icon: <Sparkles size={16} /> },
    { id: "workbench", label: "Workbench", icon: <Layout size={16} /> },
    { id: "build", label: "Build", icon: <Hammer size={16} /> },
    {
      id: "versionControl",
      label: "Version Control",
      icon: <GitBranch size={16} />,
    },
    { id: "agent", label: "Agent", icon: <Sparkles size={16} /> },
    { id: "shortcuts", label: "Shortcuts", icon: <Keyboard size={16} /> },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-card text-card-foreground w-full max-w-4xl h-[80vh] max-h-[700px] rounded-xl border border-border shadow-2xl flex flex-col relative animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <ScrollableArea className="w-48 border-r border-border bg-muted/20 p-4">
            <nav className="space-y-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeSection === section.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                >
                  {section.icon}
                  {section.label}
                </button>
              ))}
            </nav>
          </ScrollableArea>

          <ScrollableArea className="flex-1 p-6">
            {activeSection === "appearance" && (
              <AppearanceSection settings={settings} />
            )}
            {activeSection === "editor" && <EditorSection />}
            {activeSection === "autocomplete" && (
              <AutocompleteSection settings={settings} />
            )}
            {activeSection === "workbench" && (
              <WorkbenchSection
                settings={settings}
                workbench={workbench}
                sidebarSize={sidebarSize}
                errors={errors}
                onSidebarSizeChange={handleSidebarSizeChange}
              />
            )}
            {activeSection === "build" && <BuildSection settings={settings} />}
            {activeSection === "versionControl" && (
              <VersionControlSection settings={settings} />
            )}
            {activeSection === "agent" && <AgentSection />}
            {activeSection === "shortcuts" && <ShortcutsSection />}
          </ScrollableArea>
        </div>
      </div>
    </div>
  );
}
