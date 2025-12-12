import { WrapText, Scroll, Pin, Save, Braces, Quote, ClipboardPaste } from "lucide-react";
import { useSettingsStore, type WordWrapMode, type AutoClosingBehavior } from "@/stores";
import { SettingSlider, SettingToggle, SettingSelect, SettingGroup } from "../../components/SettingControls";

const wordWrapOptions: { value: WordWrapMode; label: string }[] = [
    { value: "off", label: "Off" },
    { value: "on", label: "On" },
    { value: "wordWrapColumn", label: "At Column" },
    { value: "bounded", label: "Bounded" },
];

const autoClosingOptions: { value: AutoClosingBehavior; label: string }[] = [
    { value: "always", label: "Always" },
    { value: "languageDefined", label: "Language Defined" },
    { value: "beforeWhitespace", label: "Before Whitespace" },
    { value: "never", label: "Never" },
];

export function BehaviorSection() {
    const settings = useSettingsStore();

    return (
        <div className="space-y-6">
            <SettingGroup title="Word Wrap">
                <SettingSelect
                    icon={<WrapText size={16} />}
                    label="Word Wrap"
                    description="How lines should wrap in the editor"
                    value={settings.wordWrap}
                    options={wordWrapOptions}
                    onChange={settings.setWordWrap}
                />

                {(settings.wordWrap === "wordWrapColumn" || settings.wordWrap === "bounded") && (
                    <SettingSlider
                        icon={<WrapText size={16} />}
                        label="Wrap Column"
                        value={settings.wordWrapColumn}
                        min={40}
                        max={200}
                        description="Column at which lines should wrap"
                        onChange={settings.setWordWrapColumn}
                    />
                )}
            </SettingGroup>

            <SettingGroup title="Scrolling">
                <SettingToggle
                    icon={<Scroll size={16} />}
                    label="Smooth Scrolling"
                    description="Animate scrolling in the editor"
                    checked={settings.smoothScrolling}
                    onChange={settings.setSmoothScrolling}
                />

                <SettingToggle
                    icon={<Scroll size={16} />}
                    label="Scroll Beyond Last Line"
                    description="Allow scrolling past the last line"
                    checked={settings.scrollBeyondLastLine}
                    onChange={settings.setScrollBeyondLastLine}
                />

                <SettingToggle
                    icon={<Pin size={16} />}
                    label="Sticky Scroll"
                    description="Show parent scopes while scrolling"
                    checked={settings.stickyScroll}
                    onChange={settings.setStickyScroll}
                />
            </SettingGroup>

            <SettingGroup title="Auto Save">
                <SettingSlider
                    icon={<Save size={16} />}
                    label="Autosave Delay"
                    value={settings.autosaveDelay}
                    min={0}
                    max={10000}
                    step={100}
                    unit="ms"
                    description={settings.autosaveDelay === 0
                        ? "Autosave disabled"
                        : `Files save after ${settings.autosaveDelay}ms of inactivity`}
                    onChange={settings.setAutosaveDelay}
                />
            </SettingGroup>

            <SettingGroup title="Auto Closing">
                <SettingSelect
                    icon={<Braces size={16} />}
                    label="Auto Closing Brackets"
                    description="When to automatically close brackets"
                    value={settings.autoClosingBrackets}
                    options={autoClosingOptions}
                    onChange={settings.setAutoClosingBrackets}
                />

                <SettingSelect
                    icon={<Quote size={16} />}
                    label="Auto Closing Quotes"
                    description="When to automatically close quotes"
                    value={settings.autoClosingQuotes}
                    options={autoClosingOptions}
                    onChange={settings.setAutoClosingQuotes}
                />
            </SettingGroup>

            <SettingGroup title="Formatting">
                <SettingToggle
                    icon={<ClipboardPaste size={16} />}
                    label="Format on Paste"
                    description="Automatically format pasted content"
                    checked={settings.formatOnPaste}
                    onChange={settings.setFormatOnPaste}
                />
            </SettingGroup>
        </div>
    );
}
