import { useCallback } from 'react';
import InputField from './InputField';

interface PositionControlsProps {
    styles: Record<string, string>;
    onStyleChange: (property: string, value: string, unit?: string) => void;
}

type PositionType = 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky';

const POSITION_TYPES: { value: PositionType; label: string }[] = [
    { value: 'static', label: 'Static' },
    { value: 'relative', label: 'Relative' },
    { value: 'absolute', label: 'Absolute' },
    { value: 'fixed', label: 'Fixed' },
    { value: 'sticky', label: 'Sticky' },
];

/**
 * Position controls for element positioning.
 * Follows 8pt grid spacing from design system.
 */
export default function PositionControls({ styles, onStyleChange }: PositionControlsProps) {
    const position = (styles.position || 'static') as PositionType;
    const showOffsets = position !== 'static';

    const parseValue = useCallback((value: string): { num: string; unit: string } => {
        // Handle auto, none, and invalid values
        if (!value || value === 'auto' || value === 'none' || value === 'initial' || value === 'inherit') {
            return { num: '', unit: 'px' };
        }
        const match = value.match(/^(-?\d*\.?\d+)(px|%|rem|em|vh|vw)?$/);
        if (match) {
            return { num: match[1], unit: match[2] || 'px' };
        }
        return { num: '', unit: 'px' };
    }, []);

    const left = parseValue(styles.left);
    const top = parseValue(styles.top);
    const zIndex = styles['z-index'] || 'auto';

    return (
        <div className="space-y-4">
            {/* Section header */}
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-foreground">Position</h3>
            </div>

            {/* Position type selector */}
            <div className="flex gap-1">
                {POSITION_TYPES.map(({ value, label }) => (
                    <button
                        key={value}
                        onClick={() => onStyleChange('position', value)}
                        className={`
                            flex-1 py-1.5 px-2
                            text-xs rounded-sm transition-colors
                            ${position === value
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }
                        `}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Offset inputs - only show for non-static */}
            {showOffsets && (
                <div className="grid grid-cols-2 gap-3">
                    <InputField
                        label="X"
                        value={left.num}
                        unit={left.unit}
                        placeholder="auto"
                        onChange={(val, unit) => onStyleChange('left', val || 'auto', unit)}
                    />
                    <InputField
                        label="Y"
                        value={top.num}
                        unit={top.unit}
                        placeholder="auto"
                        onChange={(val, unit) => onStyleChange('top', val || 'auto', unit)}
                    />
                </div>
            )}

            {/* Z-Index */}
            <div className="grid grid-cols-2 gap-3">
                <InputField
                    label="Z-Index"
                    value={zIndex === 'auto' ? '' : zIndex}
                    type="number"
                    placeholder="auto"
                    onChange={(val) => onStyleChange('z-index', val || 'auto')}
                />
            </div>
        </div>
    );
}
