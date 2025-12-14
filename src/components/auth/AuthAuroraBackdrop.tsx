import { useMemo } from "react";
import { useSettingsStore, type AccentColor, type Theme } from "@/stores";

// Map accent colors to RGB values (0-255 range for CSS)
const accentColorMap: Record<AccentColor, [number, number, number]> = {
    orange: [249, 115, 22],   // #f97316
    blue: [59, 130, 246],     // #3b82f6
    green: [34, 197, 94],      // #22c55e
    purple: [168, 85, 247],   // #a855f7
    red: [239, 68, 68],       // #ef4444
};

const backgroundColorMap: Record<Theme, string> = {
    dark: "#050506",
    light: "#f4f5f7",
};

export const AuthAuroraBackdrop = () => {
    const accentColor = useSettingsStore((state) => state.accentColor);
    const theme = useSettingsStore((state) => state.theme);

    const backgroundColor = backgroundColorMap[theme];
    const accentRGB = accentColorMap[accentColor];

    // Compute rgba color strings for gradients
    const accentColors = useMemo(
        () => ({
            rgba40: `rgba(${accentRGB[0]}, ${accentRGB[1]}, ${accentRGB[2]}, 0.4)`,
            rgba30: `rgba(${accentRGB[0]}, ${accentRGB[1]}, ${accentRGB[2]}, 0.3)`,
            rgba20: `rgba(${accentRGB[0]}, ${accentRGB[1]}, ${accentRGB[2]}, 0.2)`,
            rgba15: `rgba(${accentRGB[0]}, ${accentRGB[1]}, ${accentRGB[2]}, 0.15)`,
            rgba50: `rgba(${accentRGB[0]}, ${accentRGB[1]}, ${accentRGB[2]}, 0.5)`,
        }),
        [accentRGB]
    );

    return (
        <div
            className="auth-aurora-backdrop w-full h-full relative overflow-hidden"
            style={{ backgroundColor }}
        >
            {/* Layer 1 */}
            <div
                className="auth-aurora-layer auth-aurora-layer--one"
                style={{
                    background: `radial-gradient(
                        circle at 30% 40%,
                        ${accentColors.rgba40} 0%,
                        transparent 50%
                    )`,
                }}
            />

            {/* Layer 2 */}
            <div
                className="auth-aurora-layer auth-aurora-layer--two"
                style={{
                    background: `radial-gradient(
                        circle at 70% 60%,
                        ${accentColors.rgba30} 0%,
                        transparent 45%
                    )`,
                }}
            />

            {/* Layer 3 */}
            <div
                className="auth-aurora-layer auth-aurora-layer--three"
                style={{
                    background: `conic-gradient(
                        from 0deg at 50% 50%,
                        transparent 0deg,
                        ${accentColors.rgba20} 90deg,
                        transparent 180deg,
                        ${accentColors.rgba15} 270deg,
                        transparent 360deg
                    )`,
                }}
            />

            {/* Layer 4 */}
            <div
                className="auth-aurora-layer auth-aurora-layer--four"
                style={{
                    background: `radial-gradient(
                        circle at 50% 50%,
                        ${accentColors.rgba50} 0%,
                        transparent 30%
                    )`,
                }}
            />

            {/* Vignette overlay */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: `radial-gradient(
                        circle at center,
                        transparent 0%,
                        ${backgroundColor} 100%
                    )`,
                    opacity: theme === "dark" ? 0.6 : 0.4,
                }}
            />
        </div>
    );
};
