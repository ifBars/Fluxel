import { useState } from "react";
import { Type, MousePointer2, Space, Eye, Settings2, Map } from "lucide-react";
import { FontSection } from "./editor/FontSection";
import { CursorSection } from "./editor/CursorSection";
import { WhitespaceSection } from "./editor/WhitespaceSection";
import { DisplaySection } from "./editor/DisplaySection";
import { BehaviorSection } from "./editor/BehaviorSection";
import { MinimapSection } from "./editor/MinimapSection";

type EditorTab = "font" | "cursor" | "whitespace" | "display" | "behavior" | "minimap";

const tabs: { id: EditorTab; label: string; icon: React.ReactNode }[] = [
  { id: "font", label: "Font", icon: <Type size={14} /> },
  { id: "cursor", label: "Cursor", icon: <MousePointer2 size={14} /> },
  { id: "whitespace", label: "Whitespace", icon: <Space size={14} /> },
  { id: "display", label: "Display", icon: <Eye size={14} /> },
  { id: "behavior", label: "Behavior", icon: <Settings2 size={14} /> },
  { id: "minimap", label: "Minimap", icon: <Map size={14} /> },
];

export function EditorSection() {
  const [activeTab, setActiveTab] = useState<EditorTab>("font");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold mb-1">Editor</h3>
        <p className="text-sm text-muted-foreground">
          Configure editor behavior and appearance
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-lg overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="pt-2">
        {activeTab === "font" && <FontSection />}
        {activeTab === "cursor" && <CursorSection />}
        {activeTab === "whitespace" && <WhitespaceSection />}
        {activeTab === "display" && <DisplaySection />}
        {activeTab === "behavior" && <BehaviorSection />}
        {activeTab === "minimap" && <MinimapSection />}
      </div>
    </div>
  );
}
