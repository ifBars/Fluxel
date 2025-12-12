import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface SettingSliderProps {
    icon: ReactNode;
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    description?: string;
    onChange: (value: number) => void;
}

export function SettingSlider({
    icon,
    label,
    value,
    min,
    max,
    step = 1,
    unit = "",
    description,
    onChange,
}: SettingSliderProps) {
    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    {icon}
                    {label}
                </label>
                <span className="text-sm font-mono text-muted-foreground">
                    {value}{unit}
                </span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full accent-primary h-2 bg-muted rounded-lg appearance-none cursor-pointer"
            />
            {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
            )}
        </div>
    );
}

interface SettingToggleProps {
    icon: ReactNode;
    label: string;
    description?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

export function SettingToggle({
    icon,
    label,
    description,
    checked,
    onChange,
}: SettingToggleProps) {
    return (
        <div className="flex items-center justify-between py-1">
            <div className="flex flex-col gap-0.5">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    {icon}
                    {label}
                </label>
                {description && (
                    <p className="text-xs text-muted-foreground ml-6">{description}</p>
                )}
            </div>
            <button
                onClick={() => onChange(!checked)}
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${checked ? "bg-primary" : "bg-muted"
                    }`}
            >
                <span
                    className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? "translate-x-5" : "translate-x-0"
                        }`}
                />
            </button>
        </div>
    );
}

interface SettingSelectOption<T extends string> {
    value: T;
    label: string;
}

interface SettingSelectProps<T extends string> {
    icon: ReactNode;
    label: string;
    description?: string;
    value: T;
    options: SettingSelectOption<T>[];
    onChange: (value: T) => void;
}

export function SettingSelect<T extends string>({
    icon,
    label,
    description,
    value,
    options,
    onChange,
}: SettingSelectProps<T>) {
    return (
        <div className="flex items-center justify-between py-1">
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    {icon}
                    {label}
                </label>
                {description && (
                    <p className="text-xs text-muted-foreground ml-6">{description}</p>
                )}
            </div>
            <div className="relative">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value as T)}
                    className="appearance-none bg-muted border border-border rounded-lg px-3 py-1.5 pr-8 text-sm font-medium text-foreground cursor-pointer hover:bg-muted/80 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <ChevronDown
                    size={14}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
            </div>
        </div>
    );
}

interface SettingGroupProps {
    title: string;
    description?: string;
    children: ReactNode;
}

export function SettingGroup({ title, description, children }: SettingGroupProps) {
    return (
        <div className="space-y-4">
            <div>
                <h4 className="text-sm font-semibold text-foreground">{title}</h4>
                {description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                )}
            </div>
            <div className="space-y-3 pl-1">
                {children}
            </div>
        </div>
    );
}

interface SettingDividerProps {
    className?: string;
}

export function SettingDivider({ className = "" }: SettingDividerProps) {
    return <hr className={`border-border my-4 ${className}`} />;
}
