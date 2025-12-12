import { Indent, Space, Eye } from "lucide-react";
import { useSettingsStore, type RenderWhitespace } from "@/stores";
import { SettingSlider, SettingToggle, SettingSelect, SettingGroup } from "../../components/SettingControls";

const renderWhitespaceOptions: { value: RenderWhitespace; label: string }[] = [
    { value: "none", label: "None" },
    { value: "boundary", label: "Boundary" },
    { value: "selection", label: "Selection" },
    { value: "trailing", label: "Trailing" },
    { value: "all", label: "All" },
];

export function WhitespaceSection() {
    const settings = useSettingsStore();

    return (
        <div className="space-y-6">
            <SettingGroup title="Indentation">
                <SettingSlider
                    icon={<Indent size={16} />}
                    label="Tab Size"
                    value={settings.tabSize}
                    min={1}
                    max={8}
                    unit=" spaces"
                    onChange={settings.setTabSize}
                />

                <SettingToggle
                    icon={<Space size={16} />}
                    label="Insert Spaces"
                    description="Use spaces instead of tabs for indentation"
                    checked={settings.insertSpaces}
                    onChange={settings.setInsertSpaces}
                />
            </SettingGroup>

            <SettingGroup title="Whitespace Rendering">
                <SettingSelect
                    icon={<Eye size={16} />}
                    label="Render Whitespace"
                    description="When to render whitespace characters"
                    value={settings.renderWhitespace}
                    options={renderWhitespaceOptions}
                    onChange={settings.setRenderWhitespace}
                />
            </SettingGroup>

            <SettingGroup title="Indentation Guides">
                <SettingToggle
                    icon={<Indent size={16} />}
                    label="Show Indentation Guides"
                    description="Render vertical lines at each indentation level"
                    checked={settings.renderIndentGuides}
                    onChange={settings.setRenderIndentGuides}
                />

                <SettingToggle
                    icon={<Indent size={16} />}
                    label="Highlight Active Guide"
                    description="Highlight the indentation guide at the cursor position"
                    checked={settings.highlightActiveIndentGuide}
                    onChange={settings.setHighlightActiveIndentGuide}
                />
            </SettingGroup>
        </div>
    );
}
