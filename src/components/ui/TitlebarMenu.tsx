import { useState, useRef, useEffect, ReactNode } from 'react';

interface MenuButtonProps {
    label: string;
    isOpen: boolean;
    onClick: () => void;
    onMouseEnter?: () => void;
}

export function TitlebarMenuButton({ label, isOpen, onClick, onMouseEnter }: MenuButtonProps) {
    return (
        <button
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            className={`h-full px-3 flex items-center gap-1 text-xs hover:bg-muted/50 transition-colors ${isOpen ? 'bg-muted/50' : ''
                }`}
        >
            {label}
        </button>
    );
}

interface MenuDropdownProps {
    children: ReactNode;
}

export function TitlebarMenuDropdown({ children }: MenuDropdownProps) {
    return (
        <div className="absolute top-full left-0 mt-0 w-64 bg-card/100 border border-border/50 rounded-b-md shadow-xl py-1 z-[80] backdrop-blur-none">
            {children}
        </div>
    );
}

interface MenuItemProps {
    label: string;
    shortcut?: string;
    onClick: () => void;
    disabled?: boolean;
    checked?: boolean;
    icon?: ReactNode;
}

export function TitlebarMenuItem({
    label,
    shortcut,
    onClick,
    disabled,
    checked,
    icon,
}: MenuItemProps) {
    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                if (!disabled) onClick();
            }}
            disabled={disabled}
            className={`w-full px-3 py-1.5 text-xs text-left flex items-center justify-between transition-colors ${disabled
                    ? 'text-muted-foreground/50 cursor-not-allowed'
                    : 'hover:bg-primary/10 text-foreground hover:text-primary'
                }`}
        >
            <div className="flex items-center gap-2">
                {/* Checkbox/Icon placeholder */}
                <span className={`w-4 flex items-center justify-center ${checked ? 'opacity-100' : 'opacity-0'}`}>
                    {icon || '✓'}
                </span>
                <span>{label}</span>
            </div>
            {shortcut && <span className="text-[10px] text-muted-foreground ml-4">{shortcut}</span>}
        </button>
    );
}

export function TitlebarMenuDivider() {
    return <div className="my-1 border-t border-border/50" />;
}

// Hook for managing menu state and click-outside behavior
export function useTitlebarMenu() {
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setActiveMenu(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleMenu = (menu: string) => {
        setActiveMenu(activeMenu === menu ? null : menu);
    };

    const openMenuOnHover = (menu: string) => {
        if (activeMenu) {
            setActiveMenu(menu);
        }
    };

    const closeMenu = () => setActiveMenu(null);

    return {
        activeMenu,
        menuRef,
        toggleMenu,
        openMenuOnHover,
        closeMenu,
    };
}
