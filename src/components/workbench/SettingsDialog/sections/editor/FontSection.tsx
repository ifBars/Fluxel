import { Type, ALargeSmall, Baseline, Scaling } from "lucide-react";
import { useSettingsStore, type EditorFontFamily, type EditorFontWeight } from "@/stores";
import { SettingSlider, SettingToggle, SettingSelect, SettingGroup } from "../../components/SettingControls";

const fontFamilyOptions: { value: EditorFontFamily; label: string }[] = [
    { value: "JetBrains Mono", label: "JetBrains Mono" },
    { value: "Fira Code", label: "Fira Code" },
    { value: "Cascadia Code", label: "Cascadia Code" },
    { value: "Source Code Pro", label: "Source Code Pro" },
    { value: "Consolas", label: "Consolas" },
    { value: "Monaco", label: "Monaco" },
];

const fontWeightOptions: { value: EditorFontWeight; label: string }[] = [
    { value: "normal", label: "Normal" },
    { value: "bold", label: "Bold" },
];

export function FontSection() {
    const settings = useSettingsStore();

    return (
        <div className="space-y-6">
            <SettingGroup title="Font Family & Size">
                <SettingSelect
                    icon={<Type size={16} />}
                    label="Font Family"
                    value={settings.fontFamily}
                    options={fontFamilyOptions}
                    onChange={settings.setFontFamily}
                />

                <SettingSlider
                    icon={<ALargeSmall size={16} />}
                    label="Font Size"
                    value={settings.fontSize}
                    min={10}
                    max={32}
                    unit="px"
                    onChange={settings.setFontSize}
                />

                <SettingSelect
                    icon={<Type size={16} />}
                    label="Font Weight"
                    value={settings.fontWeight}
                    options={fontWeightOptions}
                    onChange={settings.setFontWeight}
                />
            </SettingGroup>

            <SettingGroup title="Typography">
                <SettingSlider
                    icon={<Baseline size={16} />}
                    label="Line Height"
                    value={settings.lineHeight}
                    min={1.0}
                    max={3.0}
                    step={0.1}
                    onChange={settings.setLineHeight}
                />

                <SettingSlider
                    icon={<Scaling size={16} />}
                    label="Letter Spacing"
                    value={settings.letterSpacing}
                    min={-1}
                    max={2}
                    step={0.1}
                    unit="px"
                    onChange={settings.setLetterSpacing}
                />

                <SettingToggle
                    icon={<Type size={16} />}
                    label="Font Ligatures"
                    description="Enable ligatures like => and !== to merge into special characters"
                    checked={settings.fontLigatures}
                    onChange={settings.setFontLigatures}
                />
            </SettingGroup>
        </div>
    );
}
