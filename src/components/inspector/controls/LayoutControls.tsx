import { useCallback, useState } from 'react';
import InputField, { QuadInput } from './InputField';

interface LayoutControlsProps {
    styles: Record<string, string>;
    onStyleChange: (property: string, value: string, unit?: string) => void;
}

type FlowType = 'block' | 'flex' | 'grid' | 'inline';
type FlexDirection = 'row' | 'column' | 'row-reverse' | 'column-reverse';

const FLOW_TYPES: { value: FlowType; icon: string; label: string }[] = [
    { value: 'block', icon: '▭', label: 'Block' },
    { value: 'flex', icon: '⋯', label: 'Flex' },
    { value: 'grid', icon: '⊞', label: 'Grid' },
    { value: 'inline', icon: '─', label: 'Inline' },
];

const FLEX_DIRECTIONS: { value: FlexDirection; icon: string }[] = [
    { value: 'row', icon: '→' },
    { value: 'column', icon: '↓' },
    { value: 'row-reverse', icon: '←' },
    { value: 'column-reverse', icon: '↑' },
];

/**
 * Layout controls for display, dimensions, padding, and margin.
 * Follows 8pt grid spacing from design system.
 */
export default function LayoutControls({ styles, onStyleChange }: LayoutControlsProps) {
    const [paddingLinked, setPaddingLinked] = useState(false);
    const [marginLinked, setMarginLinked] = useState(false);

    const display = styles.display || 'block';
    const flexDirection = (styles['flex-direction'] || 'row') as FlexDirection;

    // Parse dimensions
    const parseValue = useCallback((value: string): { num: string; unit: string } => {
        if (!value || value === 'auto' || value === 'none' || value === 'initial' || value === 'inherit') {
            return { num: '', unit: 'px' };
        }
        const match = value.match(/^(-?\d*\.?\d+)(px|%|rem|em|vh|vw)?$/);
        if (match) {
            return { num: match[1], unit: match[2] || 'px' };
        }
        return { num: '', unit: 'px' };
    }, []);

    const width = parseValue(styles.width);
    const height = parseValue(styles.height);

    // Parse padding/margin
    const getPaddingValues = () => ({
        top: parseValue(styles['padding-top']).num || '0',
        right: parseValue(styles['padding-right']).num || '0',
        bottom: parseValue(styles['padding-bottom']).num || '0',
        left: parseValue(styles['padding-left']).num || '0',
    });

    const getMarginValues = () => ({
        top: parseValue(styles['margin-top']).num || '0',
        right: parseValue(styles['margin-right']).num || '0',
        bottom: parseValue(styles['margin-bottom']).num || '0',
        left: parseValue(styles['margin-left']).num || '0',
    });

    const handlePaddingChange = (values: { top: string; right: string; bottom: string; left: string }, unit = 'px') => {
        onStyleChange('padding-top', values.top, unit);
        onStyleChange('padding-right', values.right, unit);
        onStyleChange('padding-bottom', values.bottom, unit);
        onStyleChange('padding-left', values.left, unit);
    };

    const handleMarginChange = (values: { top: string; right: string; bottom: string; left: string }, unit = 'px') => {
        onStyleChange('margin-top', values.top, unit);
        onStyleChange('margin-right', values.right, unit);
        onStyleChange('margin-bottom', values.bottom, unit);
        onStyleChange('margin-left', values.left, unit);
    };

    const getFlowType = (): FlowType => {
        if (display === 'flex' || display === 'inline-flex') return 'flex';
        if (display === 'grid' || display === 'inline-grid') return 'grid';
        if (display === 'inline' || display === 'inline-block') return 'inline';
        return 'block';
    };

    const handleFlowChange = (flow: FlowType) => {
        const displayMap: Record<FlowType, string> = {
            block: 'block',
            flex: 'flex',
            grid: 'grid',
            inline: 'inline-block',
        };
        onStyleChange('display', displayMap[flow]);
    };

    return (
        <div className="space-y-4">
            {/* Section header */}
            <h3 className="text-xs font-semibold text-foreground">Layout</h3>

            {/* Flow type */}
            <div className="space-y-2">
                <span className="text-xs text-muted-foreground">Flow</span>
                <div className="flex gap-1">
                    {FLOW_TYPES.map(({ value, icon, label }) => (
                        <button
                            key={value}
                            onClick={() => handleFlowChange(value)}
                            title={label}
                            className={`
                                flex-1 py-2 text-sm rounded-sm transition-colors
                                ${getFlowType() === value
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                }
                            `}
                        >
                            {icon}
                        </button>
                    ))}
                </div>
            </div>

            {/* Flex direction - only show for flex */}
            {getFlowType() === 'flex' && (
                <div className="space-y-2">
                    <span className="text-xs text-muted-foreground">Direction</span>
                    <div className="flex gap-1">
                        {FLEX_DIRECTIONS.map(({ value, icon }) => (
                            <button
                                key={value}
                                onClick={() => onStyleChange('flex-direction', value)}
                                title={value}
                                className={`
                                    flex-1 py-2 text-sm rounded-sm transition-colors
                                    ${flexDirection === value
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                    }
                                `}
                            >
                                {icon}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Dimensions */}
            <div className="space-y-2">
                <span className="text-xs text-muted-foreground">Dimensions</span>
                <div className="grid grid-cols-2 gap-3">
                    <InputField
                        label="W"
                        value={width.num}
                        unit={width.unit || 'px'}
                        placeholder="auto"
                        onChange={(val, unit) => onStyleChange('width', val || 'auto', unit)}
                    />
                    <InputField
                        label="H"
                        value={height.num}
                        unit={height.unit || 'px'}
                        placeholder="auto"
                        onChange={(val, unit) => onStyleChange('height', val || 'auto', unit)}
                    />
                </div>
            </div>

            {/* Padding */}
            <QuadInput
                label="Padding"
                values={getPaddingValues()}
                onChange={handlePaddingChange}
                linked={paddingLinked}
                onLinkToggle={setPaddingLinked}
            />

            {/* Margin */}
            <QuadInput
                label="Margin"
                values={getMarginValues()}
                onChange={handleMarginChange}
                linked={marginLinked}
                onLinkToggle={setMarginLinked}
            />
        </div>
    );
}
