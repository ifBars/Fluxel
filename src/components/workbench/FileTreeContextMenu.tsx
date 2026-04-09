import { memo, useRef, useCallback } from 'react';
import { useReactiveEffect } from "@/hooks/useReactiveEffect";
import {
    FilePlus,
    FolderPlus,
    Pencil,
    Trash2,
    Copy,
    Clipboard,
    FolderOpen,
    FileCode,
    RefreshCw,
} from 'lucide-react';

export interface ContextMenuPosition {
    x: number;
    y: number;
}

export interface ContextMenuTarget {
    path: string;
    name: string;
    isDirectory: boolean;
    isRoot?: boolean;
}

interface FileTreeContextMenuProps {
    position: ContextMenuPosition | null;
    target: ContextMenuTarget | null;
    onClose: () => void;
    onNewFile: (parentPath: string) => void;
    onNewFolder: (parentPath: string) => void;
    onRename: (path: string, isDirectory: boolean) => void;
    onDelete: (path: string, isDirectory: boolean) => void;
    onCopy: (path: string) => void;
    onPaste: (targetPath: string) => void;
    onOpenInExplorer: (path: string) => void;
    onCopyPath: (path: string) => void;
    onRefresh: () => void;
    clipboardPath: string | null;
}

interface MenuItemProps {
    icon: React.ReactNode;
    label: string;
    shortcut?: string;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
}

const MenuItem = memo(function MenuItem({
    icon,
    label,
    shortcut,
    onClick,
    disabled = false,
    danger = false,
}: MenuItemProps) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`
                w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left
                transition-colors
                ${disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : danger
                        ? 'hover:bg-destructive/10 hover:text-destructive'
                        : 'hover:bg-primary/10 hover:text-primary'
                }
            `}
        >
            <span className="w-4 h-4 flex items-center justify-center shrink-0">
                {icon}
            </span>
            <span className="flex-1">{label}</span>
            {shortcut && (
                <span className="text-[10px] text-muted-foreground ml-4">
                    {shortcut}
                </span>
            )}
        </button>
    );
});

const MenuSeparator = memo(function MenuSeparator() {
    return <div className="h-px bg-border/50 my-1" />;
});

const FileTreeContextMenu = memo(function FileTreeContextMenu({
    position,
    target,
    onClose,
    onNewFile,
    onNewFolder,
    onRename,
    onDelete,
    onCopy,
    onPaste,
    onOpenInExplorer,
    onCopyPath,
    onRefresh,
    clipboardPath,
}: FileTreeContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useReactiveEffect(() => {
        if (!position) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        // Use mousedown for faster response
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [position, onClose]);

    // Adjust position to keep menu in viewport
    const adjustedPosition = useCallback(() => {
        if (!position || !menuRef.current) return position;

        const menuRect = menuRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let x = position.x;
        let y = position.y;

        // Adjust horizontal position
        if (x + menuRect.width > viewportWidth - 10) {
            x = viewportWidth - menuRect.width - 10;
        }

        // Adjust vertical position
        if (y + menuRect.height > viewportHeight - 10) {
            y = viewportHeight - menuRect.height - 10;
        }

        return { x: Math.max(10, x), y: Math.max(10, y) };
    }, [position]);

    if (!position || !target) return null;

    const isDirectory = target.isDirectory;
    const isRoot = target.isRoot;
    const parentPath = isDirectory ? target.path : target.path.substring(0, target.path.lastIndexOf('/'));

    const pos = adjustedPosition() || position;

    return (
        <div
            ref={menuRef}
            className="fixed z-[100] min-w-[200px] bg-card border border-border/50 rounded-lg shadow-xl py-1 backdrop-blur-sm"
            style={{
                left: pos.x,
                top: pos.y,
            }}
        >
            {/* New File/Folder */}
            <MenuItem
                icon={<FilePlus size={14} />}
                label="New File"
                shortcut="Ctrl+N"
                onClick={() => {
                    onNewFile(isDirectory ? target.path : parentPath);
                    onClose();
                }}
            />
            <MenuItem
                icon={<FolderPlus size={14} />}
                label="New Folder"
                shortcut="Ctrl+Shift+N"
                onClick={() => {
                    onNewFolder(isDirectory ? target.path : parentPath);
                    onClose();
                }}
            />

            <MenuSeparator />

            {/* Edit operations (not for root) */}
            {!isRoot && (
                <>
                    <MenuItem
                        icon={<Pencil size={14} />}
                        label="Rename"
                        shortcut="F2"
                        onClick={() => {
                            onRename(target.path, isDirectory);
                            onClose();
                        }}
                    />
                    <MenuItem
                        icon={<Copy size={14} />}
                        label="Copy"
                        shortcut="Ctrl+C"
                        onClick={() => {
                            onCopy(target.path);
                            onClose();
                        }}
                    />
                </>
            )}

            <MenuItem
                icon={<Clipboard size={14} />}
                label="Paste"
                shortcut="Ctrl+V"
                disabled={!clipboardPath}
                onClick={() => {
                    if (clipboardPath) {
                        onPaste(isDirectory ? target.path : parentPath);
                        onClose();
                    }
                }}
            />

            {!isRoot && (
                <>
                    <MenuSeparator />
                    <MenuItem
                        icon={<Trash2 size={14} />}
                        label="Delete"
                        shortcut="Del"
                        danger
                        onClick={() => {
                            onDelete(target.path, isDirectory);
                            onClose();
                        }}
                    />
                </>
            )}

            <MenuSeparator />

            {/* Utility operations */}
            <MenuItem
                icon={<FileCode size={14} />}
                label="Copy Path"
                onClick={() => {
                    onCopyPath(target.path);
                    onClose();
                }}
            />
            <MenuItem
                icon={<FolderOpen size={14} />}
                label="Open in Explorer"
                onClick={() => {
                    onOpenInExplorer(isDirectory ? target.path : parentPath);
                    onClose();
                }}
            />

            <MenuSeparator />

            <MenuItem
                icon={<RefreshCw size={14} />}
                label="Refresh"
                onClick={() => {
                    onRefresh();
                    onClose();
                }}
            />
        </div>
    );
});

export default FileTreeContextMenu;
