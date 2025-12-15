import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption {
    value: string;
    label: string;
    description?: string;
    icon?: React.ReactNode;
}

interface TitlebarDropdownProps {
    value: string | null;
    options: DropdownOption[];
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    width?: 'auto' | 'sm' | 'md' | 'lg';
    align?: 'left' | 'right' | 'center';
    disabled?: boolean;
    direction?: 'up' | 'down';
}

const widthClasses = {
    auto: 'w-auto min-w-[120px]',
    sm: 'w-48',
    md: 'w-64',
    lg: 'w-80',
};

export function TitlebarDropdown({
    value,
    options,
    onChange,
    placeholder = 'Select...',
    className = '',
    width = 'auto',
    align = 'left',
    disabled = false,
    direction = 'down',
}: TitlebarDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const selectedOption = options.find((opt) => opt.value === value);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSelectedIndex(-1);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            switch (e.key) {
                case 'Escape':
                    setIsOpen(false);
                    setSelectedIndex(-1);
                    buttonRef.current?.focus();
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (selectedIndex >= 0 && selectedIndex < options.length) {
                        onChange(options[selectedIndex].value);
                        setIsOpen(false);
                        setSelectedIndex(-1);
                    }
                    break;
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, selectedIndex, options, onChange]);

    const handleToggle = () => {
        if (!disabled) {
            setIsOpen(!isOpen);
            if (!isOpen) {
                // Reset selected index to current value when opening
                const currentIndex = options.findIndex((opt) => opt.value === value);
                setSelectedIndex(currentIndex);
            }
        }
    };

    const handleSelect = (option: DropdownOption) => {
        onChange(option.value);
        setIsOpen(false);
        setSelectedIndex(-1);
    };

    const alignmentClasses = {
        left: 'left-0',
        right: 'right-0',
        center: 'left-1/2 -translate-x-1/2',
    };

    return (
        <div ref={dropdownRef} className={`relative ${className}`}>
            {/* Trigger Button */}
            <button
                ref={buttonRef}
                onClick={handleToggle}
                disabled={disabled}
                className={`
          flex items-center gap-2 px-3 py-1 text-xs
          bg-muted/50 border border-border/50 rounded
          hover:bg-muted transition-colors
          focus:outline-none focus:ring-1 focus:ring-primary
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${isOpen ? 'bg-muted' : ''}
        `}
            >
                <span className="flex items-center gap-2">
                    {selectedOption?.icon}
                    {selectedOption?.label || placeholder}
                </span>
                <ChevronDown
                    className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div
                    className={`
            absolute ${direction === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'} 
            ${alignmentClasses[align]} ${widthClasses[width]}
            bg-card/100 border border-border/50 rounded-md shadow-xl py-1 z-[80]
            backdrop-blur-none
          `}
                >
                    {options.map((option, index) => (
                        <button
                            key={option.value}
                            onClick={() => handleSelect(option)}
                            onMouseEnter={() => setSelectedIndex(index)}
                            className={`
                w-full px-3 py-1.5 text-xs text-left flex items-center justify-between
                transition-colors
                ${selectedIndex === index || option.value === value
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-foreground hover:bg-primary/10 hover:text-primary'
                                }
              `}
                        >
                            <div className="flex items-center gap-2">
                                {option.icon && <span className="flex items-center">{option.icon}</span>}
                                <div className="flex flex-col">
                                    <span>{option.label}</span>
                                    {option.description && (
                                        <span className="text-[10px] text-muted-foreground">
                                            {option.description}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {option.value === value && (
                                <Check className="w-3 h-3 ml-2 flex-shrink-0" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
