import { useCallback } from 'react';
import InputField from './InputField';

interface AppearanceControlsProps {
    styles: Record<string, string>;
    onStyleChange: (property: string, value: string, unit?: string) => void;
}

/**
 * Appearance controls for opacity, border radius, background, and shadows.
 * Follows 8pt grid spacing from design system.
 */
export default function AppearanceControls({ styles, onStyleChange }: AppearanceControlsProps) {
    const parseValue = useCallback((value: string): { num: string; unit: string } => {
        if (!value || value === 'none' || value === 'auto' || value === 'initial' || value === 'inherit') {
            return { num: '', unit: 'px' };
        }
        const match = value.match(/^(-?\d*\.?\d+)(px|%|rem|em)?$/);
        if (match) {
            return { num: match[1], unit: match[2] || 'px' };
        }
        return { num: '', unit: 'px' };
    }, []);

    // Parse opacity safely - always return a valid number between 0 and 1
    const getOpacity = (): number => {
        const opacityStr = styles.opacity;
        if (!opacityStr || opacityStr === 'initial' || opacityStr === 'inherit') {
            return 1;
        }
        const parsed = parseFloat(opacityStr);
        if (isNaN(parsed)) return 1;
        // Clamp between 0 and 1
        return Math.max(0, Math.min(1, parsed));
    };

    const opacity = getOpacity();
    const borderRadius = parseValue(styles['border-radius']);
    const backgroundColor = styles['background-color'] || 'transparent';

    // Parse rgba/rgb to hex for color input
    const getColorHex = (color: string): string => {
        if (!color || color === 'transparent' || color === 'none' || color === 'initial' || color === 'inherit') {
            return '#000000';
        }
        if (color.startsWith('#')) return color;
        if (color.startsWith('rgb')) {
            const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (match) {
                const r = parseInt(match[1]).toString(16).padStart(2, '0');
                const g = parseInt(match[2]).toString(16).padStart(2, '0');
                const b = parseInt(match[3]).toString(16).padStart(2, '0');
                return `#${r}${g}${b}`;
            }
        }
        // Fallback for other color formats
        return '#000000';
    };

    return (
        <div className="space-y-4">
            {/* Section header */}
            <h3 className="text-xs font-semibold text-foreground">Appearance</h3>

            {/* Opacity and Corner Radius */}
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Opacity</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={Math.round(opacity * 100)}
                            onChange={(e) => onStyleChange('opacity', String(parseInt(e.target.value) / 100))}
                            className="flex-1 h-1.5 bg-muted rounded-full appearance-none cursor-pointer"
                        />
                        <span className="text-xs text-muted-foreground w-8 text-right">
                            {Math.round(opacity * 100)}%
                        </span>
                    </div>
                </div>
                <InputField
                    label="Corner Radius"
                    value={borderRadius.num}
                    unit={borderRadius.unit || 'px'}
                    min={0}
                    onChange={(val, unit) => onStyleChange('border-radius', val || '0', unit)}
                />
            </div>

            {/* Background Color */}
            <div className="space-y-2">
                <span className="text-xs text-muted-foreground">Background</span>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <input
                            type="color"
                            value={getColorHex(backgroundColor)}
                            onChange={(e) => onStyleChange('background-color', e.target.value)}
                            className="w-8 h-8 rounded-sm border border-border cursor-pointer"
                            style={{ padding: 0 }}
                        />
                    </div>
                    <input
                        type="text"
                        value={backgroundColor}
                        onChange={(e) => onStyleChange('background-color', e.target.value)}
                        placeholder="transparent"
                        className="
                            flex-1 min-w-0
                            bg-muted border border-border rounded-sm
                            text-xs text-foreground font-mono
                            focus:outline-none focus:ring-1 focus:ring-primary
                        "
                        style={{ padding: '6px 8px' }}
                    />
                </div>
            </div>

            {/* Box Shadow - simplified preset options */}
            <div className="space-y-2">
                <span className="text-xs text-muted-foreground">Shadow</span>
                <div className="flex gap-1">
                    {[
                        { label: 'None', value: 'none' },
                        { label: 'SM', value: '0 1px 2px rgba(0,0,0,0.05)', altValue: 'rgba(0, 0, 0, 0.05) 0px 1px 2px 0px' },
                        { label: 'MD', value: '0 4px 12px rgba(0,0,0,0.08)', altValue: 'rgba(0, 0, 0, 0.08) 0px 4px 12px 0px' },
                        { label: 'LG', value: '0 12px 32px rgba(0,0,0,0.12)', altValue: 'rgba(0, 0, 0, 0.12) 0px 12px 32px 0px' },
                    ].map(({ label, value, altValue }) => {
                        const currentShadow = (styles['box-shadow'] || 'none').trim();
                        // Normalize for comparison - remove extra spaces
                        const normalizedCurrent = currentShadow.replace(/\s+/g, ' ');
                        const normalizedValue = value.replace(/\s+/g, ' ');
                        const normalizedAlt = altValue?.replace(/\s+/g, ' ');

                        const isActive = value === 'none'
                            ? currentShadow === 'none' || !currentShadow || currentShadow === 'initial'
                            : normalizedCurrent === normalizedValue || normalizedCurrent === normalizedAlt;

                        return (
                            <button
                                key={label}
                                onClick={() => onStyleChange('box-shadow', value)}
                                className={`
                                    flex-1 py-1.5 text-xs rounded-sm transition-colors
                                    ${isActive
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                    }
                                `}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
