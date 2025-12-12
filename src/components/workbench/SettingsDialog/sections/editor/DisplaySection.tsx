import { Hash, Highlighter, Braces, ChevronDownSquare, SidebarOpen } from "lucide-react";
import { useSettingsStore, type LineNumbers, type RenderLineHighlight } from "@/stores";
import { SettingToggle, SettingSelect, SettingGroup } from "../../components/SettingControls";

const lineNumbersOptions: { value: LineNumbers; label: string }[] = [
    { value: "on", label: "On" },
    { value: "off", label: "Off" },
    { value: "relative", label: "Relative" },
    { value: "interval", label: "Interval (every 10)" },
];

const renderLineHighlightOptions: { value: RenderLineHighlight; label: string }[] = [
    { value: "none", label: "None" },
    { value: "gutter", label: "Gutter Only" },
    { value: "line", label: "Line Only" },
    { value: "all", label: "Both" },
];

export function DisplaySection() {
    const settings = useSettingsStore();

    return (
        <div className="space-y-6">
            <SettingGroup title="Line Numbers">
                <SettingToggle
                    icon={<Hash size={16} />}
                    label="Show Line Numbers"
                    checked={settings.showLineNumbers}
                    onChange={settings.setShowLineNumbers}
                />

                {settings.showLineNumbers && (
                    <SettingSelect
                        icon={<Hash size={16} />}
                        label="Line Number Style"
                        description="How line numbers are displayed"
                        value={settings.lineNumbers}
                        options={lineNumbersOptions}
                        onChange={settings.setLineNumbers}
                    />
                )}
            </SettingGroup>

            <SettingGroup title="Line Highlighting">
                <SettingSelect
                    icon={<Highlighter size={16} />}
                    label="Highlight Current Line"
                    description="How to highlight the line with the cursor"
                    value={settings.renderLineHighlight}
                    options={renderLineHighlightOptions}
                    onChange={settings.setRenderLineHighlight}
                />
            </SettingGroup>

            <SettingGroup title="Brackets">
                <SettingToggle
                    icon={<Braces size={16} />}
                    label="Bracket Pair Colorization"
                    description="Color matching brackets for easier identification"
                    checked={settings.bracketPairColorization}
                    onChange={settings.setBracketPairColorization}
                />

                <SettingToggle
                    icon={<Braces size={16} />}
                    label="Bracket Pair Guides"
                    description="Render vertical lines between matching brackets"
                    checked={settings.bracketPairGuides}
                    onChange={settings.setBracketPairGuides}
                />
            </SettingGroup>

            <SettingGroup title="Code Folding">
                <SettingToggle
                    icon={<ChevronDownSquare size={16} />}
                    label="Enable Folding"
                    description="Allow code sections to be collapsed"
                    checked={settings.folding}
                    onChange={settings.setFolding}
                />

                {settings.folding && (
                    <SettingToggle
                        icon={<ChevronDownSquare size={16} />}
                        label="Folding Highlight"
                        description="Highlight folded regions"
                        checked={settings.foldingHighlight}
                        onChange={settings.setFoldingHighlight}
                    />
                )}
            </SettingGroup>

            <SettingGroup title="Gutter">
                <SettingToggle
                    icon={<SidebarOpen size={16} />}
                    label="Show Glyph Margin"
                    description="Show icons for breakpoints and other markers"
                    checked={settings.glyphMargin}
                    onChange={settings.setGlyphMargin}
                />
            </SettingGroup>
        </div>
    );
}
