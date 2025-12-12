import { useState, useCallback } from 'react';

interface InputFieldProps {
    label: string;
    value: string | number;
    unit?: string;
    type?: 'number' | 'text';
    min?: number;
    max?: number;
    step?: number;
    onChange: (value: string, unit?: string) => void;
    className?: string;
    placeholder?: string;
}

/**
 * Reusable input field with optional unit selector.
 * Follows 8pt grid spacing from design system.
 */
export default function InputField({
    label,
    value,
    unit = 'px',
    type = 'number',
    min,
    max,
    step = 1,
    onChange,
    className = '',
    placeholder,
}: InputFieldProps) {
    const [localValue, setLocalValue] = useState(String(value));
    const [localUnit, setLocalUnit] = useState(unit);

    const handleValueChange = useCallback((newValue: string) => {
        setLocalValue(newValue);
        onChange(newValue, localUnit);
    }, [onChange, localUnit]);

    const handleUnitChange = useCallback((newUnit: string) => {
        setLocalUnit(newUnit);
        onChange(localValue, newUnit);
    }, [onChange, localValue]);

    const handleBlur = useCallback(() => {
        // Ensure value is valid on blur
        if (type === 'number') {
            const num = parseFloat(localValue);
            if (isNaN(num)) {
                setLocalValue('0');
                onChange('0', localUnit);
            }
        }
    }, [type, localValue, localUnit, onChange]);

    return (
        <div className={`flex flex-col gap-1 ${className}`}>
            {label && (
                <label className="text-xs text-muted-foreground font-medium">
                    {label}
                </label>
            )}
            <div className="flex items-center gap-1">
                <input
                    type={type}
                    value={localValue}
                    min={min}
                    max={max}
                    step={step}
                    placeholder={placeholder}
                    onChange={(e) => handleValueChange(e.target.value)}
                    onBlur={handleBlur}
                    className="
                        flex-1 min-w-0
                        bg-muted border border-border rounded-sm
                        text-xs text-foreground
                        focus:outline-none focus:ring-1 focus:ring-primary
                        px-2 py-1.5
                    "
                    style={{ padding: '6px 8px' }} // 8pt grid
                />
                {unit && (
                    <select
                        value={localUnit}
                        onChange={(e) => handleUnitChange(e.target.value)}
                        className="
                            bg-muted border border-border rounded-sm
                            text-xs text-muted-foreground
                            focus:outline-none focus:ring-1 focus:ring-primary
                            cursor-pointer
                        "
                        style={{ padding: '6px 4px' }}
                    >
                        <option value="px">px</option>
                        <option value="%">%</option>
                        <option value="rem">rem</option>
                        <option value="em">em</option>
                        <option value="vh">vh</option>
                        <option value="vw">vw</option>
                    </select>
                )}
            </div>
        </div>
    );
}

interface QuadInputProps {
    label: string;
    values: { top: string; right: string; bottom: string; left: string };
    unit?: string;
    onChange: (values: { top: string; right: string; bottom: string; left: string }, unit?: string) => void;
    linked?: boolean;
    onLinkToggle?: (linked: boolean) => void;
}

/**
 * Four-value input for padding/margin (top, right, bottom, left).
 * Supports linked mode where all values change together.
 */
export function QuadInput({
    label,
    values,
    unit = 'px',
    onChange,
    linked = false,
    onLinkToggle,
}: QuadInputProps) {
    const handleChange = useCallback((side: keyof typeof values, newValue: string) => {
        if (linked) {
            onChange({ top: newValue, right: newValue, bottom: newValue, left: newValue }, unit);
        } else {
            onChange({ ...values, [side]: newValue }, unit);
        }
    }, [linked, values, unit, onChange]);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">{label}</span>
                {onLinkToggle && (
                    <button
                        onClick={() => onLinkToggle(!linked)}
                        className={`
                            w-5 h-5 flex items-center justify-center rounded-sm
                            text-xs transition-colors
                            ${linked ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}
                        `}
                        title={linked ? 'Unlink values' : 'Link values'}
                    >
                        ⊞
                    </button>
                )}
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground w-4">↑</span>
                    <input
                        type="number"
                        value={values.top}
                        onChange={(e) => handleChange('top', e.target.value)}
                        className="
                            flex-1 min-w-0
                            bg-muted border border-border rounded-sm
                            text-xs text-foreground
                            focus:outline-none focus:ring-1 focus:ring-primary
                        "
                        style={{ padding: '6px 8px' }}
                    />
                    <span className="text-xs text-muted-foreground">{unit}</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground w-4">→</span>
                    <input
                        type="number"
                        value={values.right}
                        onChange={(e) => handleChange('right', e.target.value)}
                        className="
                            flex-1 min-w-0
                            bg-muted border border-border rounded-sm
                            text-xs text-foreground
                            focus:outline-none focus:ring-1 focus:ring-primary
                        "
                        style={{ padding: '6px 8px' }}
                    />
                    <span className="text-xs text-muted-foreground">{unit}</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground w-4">↓</span>
                    <input
                        type="number"
                        value={values.bottom}
                        onChange={(e) => handleChange('bottom', e.target.value)}
                        className="
                            flex-1 min-w-0
                            bg-muted border border-border rounded-sm
                            text-xs text-foreground
                            focus:outline-none focus:ring-1 focus:ring-primary
                        "
                        style={{ padding: '6px 8px' }}
                    />
                    <span className="text-xs text-muted-foreground">{unit}</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground w-4">←</span>
                    <input
                        type="number"
                        value={values.left}
                        onChange={(e) => handleChange('left', e.target.value)}
                        className="
                            flex-1 min-w-0
                            bg-muted border border-border rounded-sm
                            text-xs text-foreground
                            focus:outline-none focus:ring-1 focus:ring-primary
                        "
                        style={{ padding: '6px 8px' }}
                    />
                    <span className="text-xs text-muted-foreground">{unit}</span>
                </div>
            </div>
        </div>
    );
}
