import { MousePointer2, Sparkles } from "lucide-react";
import { useSettingsStore, type CursorStyle, type CursorBlinking, type CursorSmoothCaretAnimation } from "@/stores";
import { SettingSlider, SettingSelect, SettingGroup } from "../../components/SettingControls";

const cursorStyleOptions: { value: CursorStyle; label: string }[] = [
    { value: "line", label: "Line" },
    { value: "line-thin", label: "Line (Thin)" },
    { value: "block", label: "Block" },
    { value: "block-outline", label: "Block (Outline)" },
    { value: "underline", label: "Underline" },
    { value: "underline-thin", label: "Underline (Thin)" },
];

const cursorBlinkingOptions: { value: CursorBlinking; label: string }[] = [
    { value: "blink", label: "Blink" },
    { value: "smooth", label: "Smooth" },
    { value: "phase", label: "Phase" },
    { value: "expand", label: "Expand" },
    { value: "solid", label: "Solid (No Blink)" },
];

const cursorAnimationOptions: { value: CursorSmoothCaretAnimation; label: string }[] = [
    { value: "off", label: "Off" },
    { value: "explicit", label: "Explicit" },
    { value: "on", label: "On" },
];

export function CursorSection() {
    const settings = useSettingsStore();

    return (
        <div className="space-y-6">
            <SettingGroup title="Cursor Appearance">
                <SettingSelect
                    icon={<MousePointer2 size={16} />}
                    label="Cursor Style"
                    description="Shape of the cursor in the editor"
                    value={settings.cursorStyle}
                    options={cursorStyleOptions}
                    onChange={settings.setCursorStyle}
                />

                <SettingSlider
                    icon={<MousePointer2 size={16} />}
                    label="Cursor Width"
                    value={settings.cursorWidth}
                    min={1}
                    max={10}
                    unit="px"
                    description="Width of the cursor when using line style"
                    onChange={settings.setCursorWidth}
                />
            </SettingGroup>

            <SettingGroup title="Cursor Animation">
                <SettingSelect
                    icon={<Sparkles size={16} />}
                    label="Cursor Blinking"
                    description="Controls how the cursor blinks"
                    value={settings.cursorBlinking}
                    options={cursorBlinkingOptions}
                    onChange={settings.setCursorBlinking}
                />

                <SettingSelect
                    icon={<Sparkles size={16} />}
                    label="Smooth Caret Animation"
                    description="Animate cursor movement smoothly"
                    value={settings.cursorSmoothCaretAnimation}
                    options={cursorAnimationOptions}
                    onChange={settings.setCursorSmoothCaretAnimation}
                />
            </SettingGroup>
        </div>
    );
}
