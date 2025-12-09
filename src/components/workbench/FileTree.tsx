import type { LucideIcon } from 'lucide-react';
import {
    ChevronRight,
    ChevronDown,
    File,
    FileArchive,
    FileAudio2,
    FileCode2,
    FileCog,
    FileImage,
    FileJson,
    FileText,
    FileVideo2,
    Folder,
    FolderOpen,
    Lock,
    Package,
    Palette,
    Shield,
    Terminal,
} from 'lucide-react';
import { useFileSystemStore } from '@/stores/useFileSystemStore';
import { useEditorStore } from '@/stores/useEditorStore';
import type { FileEntry } from '@/types/fs';
import { getFileExtension } from '@/types/fs';

/**
 * Get icon for file based on extension
 */
function getFileIcon(name: string, extension: string): React.ReactNode {
    const normalizedName = name.toLowerCase();

    const specialFiles: Record<string, { icon: LucideIcon; className: string }> = {
        'package.json': { icon: Package, className: 'text-amber-400' },
        'package-lock.json': { icon: Package, className: 'text-amber-400' },
        'bun.lock': { icon: Package, className: 'text-amber-400' },
        'bun.lockb': { icon: Package, className: 'text-amber-400' },
        'pnpm-lock.yaml': { icon: Package, className: 'text-amber-400' },
        'yarn.lock': { icon: Package, className: 'text-amber-400' },
        'tsconfig.json': { icon: FileCog, className: 'text-sky-400' },
        'vite.config.ts': { icon: FileCog, className: 'text-purple-400' },
        'vite.config.js': { icon: FileCog, className: 'text-purple-400' },
        'next.config.js': { icon: FileCog, className: 'text-purple-400' },
        '.env': { icon: Shield, className: 'text-emerald-400' },
        '.env.local': { icon: Shield, className: 'text-emerald-400' },
        '.gitignore': { icon: FileCog, className: 'text-gray-400' },
    };

    if (specialFiles[normalizedName]) {
        const { icon: Icon, className } = specialFiles[normalizedName];
        return <Icon className={`w-4 h-4 shrink-0 ${className}`} />;
    }

    const iconMap: Record<string, { icon: LucideIcon; className: string }> = {
        // Web
        'ts': { icon: FileCode2, className: 'text-sky-400' },
        'tsx': { icon: FileCode2, className: 'text-sky-400' },
        'js': { icon: FileCode2, className: 'text-yellow-400' },
        'jsx': { icon: FileCode2, className: 'text-yellow-400' },
        'json': { icon: FileJson, className: 'text-amber-400' },
        'css': { icon: Palette, className: 'text-pink-400' },
        'scss': { icon: Palette, className: 'text-pink-400' },
        'html': { icon: FileCode2, className: 'text-orange-400' },
        'md': { icon: FileText, className: 'text-slate-400' },
        'mdx': { icon: FileText, className: 'text-slate-400' },
        'svg': { icon: FileImage, className: 'text-violet-400' },

        // Backend / scripting
        'cs': { icon: FileCode2, className: 'text-purple-400' },
        'csx': { icon: FileCode2, className: 'text-purple-400' },
        'csproj': { icon: FileCode2, className: 'text-purple-300' },
        'sln': { icon: FileCode2, className: 'text-purple-500' },
        'rs': { icon: FileCode2, className: 'text-orange-500' },
        'go': { icon: FileCode2, className: 'text-cyan-400' },
        'py': { icon: FileCode2, className: 'text-yellow-300' },
        'sh': { icon: Terminal, className: 'text-emerald-400' },
        'bash': { icon: Terminal, className: 'text-emerald-400' },

        // Config
        'toml': { icon: FileCog, className: 'text-gray-400' },
        'yaml': { icon: FileJson, className: 'text-amber-400' },
        'yml': { icon: FileJson, className: 'text-amber-400' },
        'lock': { icon: Lock, className: 'text-gray-400' },

        // Assets
        'png': { icon: FileImage, className: 'text-indigo-400' },
        'jpg': { icon: FileImage, className: 'text-indigo-400' },
        'jpeg': { icon: FileImage, className: 'text-indigo-400' },
        'gif': { icon: FileImage, className: 'text-indigo-400' },
        'webp': { icon: FileImage, className: 'text-indigo-400' },
        'mp4': { icon: FileVideo2, className: 'text-blue-400' },
        'mov': { icon: FileVideo2, className: 'text-blue-400' },
        'mp3': { icon: FileAudio2, className: 'text-rose-400' },
        'wav': { icon: FileAudio2, className: 'text-rose-400' },
        'ogg': { icon: FileAudio2, className: 'text-rose-400' },
        'zip': { icon: FileArchive, className: 'text-amber-500' },
        'tar': { icon: FileArchive, className: 'text-amber-500' },
        'gz': { icon: FileArchive, className: 'text-amber-500' },
    };

    const iconEntry = iconMap[extension];

    if (iconEntry) {
        const { icon: Icon, className } = iconEntry;
        return <Icon className={`w-4 h-4 shrink-0 ${className}`} />;
    }

    return <File className="w-4 h-4 shrink-0 text-muted-foreground" />;
}

interface FileTreeNodeProps {
    entry: FileEntry;
    depth: number;
}

function FileTreeNode({ entry, depth }: FileTreeNodeProps) {
    const { expandedPaths, toggleFolder, loadFolderChildren } = useFileSystemStore();
    const { openFile } = useEditorStore();

    const isExpanded = expandedPaths.has(entry.path);
    const paddingLeft = 8 + depth * 16; // Base padding + indentation
    const isIgnored = entry.isIgnored;

    const handleClick = async () => {
        if (entry.isDirectory) {
            // Load children if not already loaded
            if (!entry.children && !isExpanded) {
                await loadFolderChildren(entry.path);
            }
            toggleFolder(entry.path);
        } else {
            // Open file in editor
            await openFile(entry.path);
        }
    };

    return (
        <div>
            <button
                onClick={handleClick}
                className={`w-full flex items-center gap-1.5 py-1 px-2 text-sm text-left hover:bg-muted/50 rounded-sm transition-colors group ${isIgnored ? 'opacity-60' : ''}`}
                style={{ paddingLeft }}
            >
                {/* Chevron for directories */}
                {entry.isDirectory ? (
                    <span className="w-4 h-4 flex items-center justify-center shrink-0">
                        {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                    </span>
                ) : (
                    <span className="w-4 h-4" /> // Spacer for alignment
                )}

                {/* Icon */}
                <span className="shrink-0">
                    {entry.isDirectory ? (
                        isExpanded ? (
                            <FolderOpen className="w-4 h-4 text-primary" />
                        ) : (
                            <Folder className="w-4 h-4 text-primary/70" />
                        )
                    ) : (
                        getFileIcon(entry.name, getFileExtension(entry.name))
                    )}
                </span>

                {/* Name */}
                <span
                    className={`truncate group-hover:text-foreground ${isIgnored ? 'text-muted-foreground/80' : 'text-foreground/90'}`}
                >
                    {entry.name}
                </span>
            </button>

            {/* Children */}
            {entry.isDirectory && isExpanded && entry.children && (
                <div>
                    {entry.children.map((child) => (
                        <FileTreeNode key={child.path} entry={child} depth={depth + 1} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function FileTree() {
    const { rootEntry, isLoading, error } = useFileSystemStore();

    if (isLoading) {
        return (
            <div className="p-4 text-sm text-muted-foreground">
                Loading...
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-sm text-destructive">
                Error: {error}
            </div>
        );
    }

    if (!rootEntry) {
        return (
            <div className="p-4 text-sm text-muted-foreground text-center">
                <p>No folder open</p>
                <p className="text-xs mt-2 opacity-70">
                    Use File → Open Folder to get started
                </p>
            </div>
        );
    }

    return (
        <div className="py-1">
            {rootEntry.children?.map((entry) => (
                <FileTreeNode key={entry.path} entry={entry} depth={0} />
            ))}
        </div>
    );
}
