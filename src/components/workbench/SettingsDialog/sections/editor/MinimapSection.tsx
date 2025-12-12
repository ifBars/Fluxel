import { Map, PanelRightClose, ZoomIn, Columns, MousePointer } from "lucide-react";
import { useSettingsStore, type MinimapSide, type MinimapShowSlider } from "@/stores";
import { SettingSlider, SettingToggle, SettingSelect, SettingGroup } from "../../components/SettingControls";

const minimapSideOptions: { value: MinimapSide; label: string }[] = [
    { value: "left", label: "Left" },
    { value: "right", label: "Right" },
];

const minimapShowSliderOptions: { value: MinimapShowSlider; label: string }[] = [
    { value: "always", label: "Always" },
    { value: "mouseover", label: "On Mouse Over" },
];

export function MinimapSection() {
    const settings = useSettingsStore();

    return (
        <div className="space-y-6">
            <SettingGroup title="Minimap">
                <SettingToggle
                    icon={<Map size={16} />}
                    label="Show Minimap"
                    description="Display a miniature preview of the code"
                    checked={settings.showMinimap}
                    onChange={settings.setShowMinimap}
                />
            </SettingGroup>

            {settings.showMinimap && (
                <>
                    <SettingGroup title="Position & Size">
                        <SettingSelect
                            icon={<PanelRightClose size={16} />}
                            label="Minimap Side"
                            description="Which side to show the minimap"
                            value={settings.minimapSide}
                            options={minimapSideOptions}
                            onChange={settings.setMinimapSide}
                        />

                        <SettingSlider
                            icon={<ZoomIn size={16} />}
                            label="Minimap Scale"
                            value={settings.minimapScale}
                            min={1}
                            max={3}
                            description="Size multiplier for the minimap"
                            onChange={settings.setMinimapScale}
                        />

                        <SettingSlider
                            icon={<Columns size={16} />}
                            label="Max Column"
                            value={settings.minimapMaxColumn}
                            min={40}
                            max={240}
                            step={10}
                            description="Maximum number of columns to render"
                            onChange={settings.setMinimapMaxColumn}
                        />
                    </SettingGroup>

                    <SettingGroup title="Interaction">
                        <SettingSelect
                            icon={<MousePointer size={16} />}
                            label="Show Slider"
                            description="When to show the position indicator"
                            value={settings.minimapShowSlider}
                            options={minimapShowSliderOptions}
                            onChange={settings.setMinimapShowSlider}
                        />
                    </SettingGroup>
                </>
            )}
        </div>
    );
}
