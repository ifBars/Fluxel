import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores';

interface ScrollableAreaProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
}

const ScrollableArea = forwardRef<HTMLDivElement, ScrollableAreaProps>(
    ({ children, className, ...props }, ref) => {
        // Subscribe to density changes to ensure scrollbar styling updates
        const uiDensity = useSettingsStore((state) => state.uiDensity);

        return (
            <div
                ref={ref}
                className={cn('overflow-auto custom-scrollbar', className)}
                data-density={uiDensity}
                {...props}
            >
                {children}
            </div>
        );
    }
);

ScrollableArea.displayName = 'ScrollableArea';

export default ScrollableArea;

