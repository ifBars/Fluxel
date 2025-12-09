/**
 * File system types for Fluxel IDE
 * Centralized type definitions for file/folder operations
 */

export interface FileEntry {
    /** File or folder name */
    name: string;
    /** Absolute path to the entry */
    path: string;
    /** True if this is a directory */
    isDirectory: boolean;
    /** Children entries (only for directories, lazily loaded) */
    children?: FileEntry[];
    /** True if children have been loaded (for lazy loading) */
    isExpanded?: boolean;
    /** True if entry is ignored by gitignore */
    isIgnored?: boolean;
}

export interface Project {
    /** Display name of the project (folder name) */
    name: string;
    /** Absolute path to project root */
    rootPath: string;
    /** Timestamp when project was last opened */
    lastOpened?: Date;
}

/**
 * Get file extension from path
 */
export function getFileExtension(path: string): string {
    const parts = path.split('.');
    return parts.length > 1 ? parts.pop()?.toLowerCase() ?? '' : '';
}

/**
 * Get filename from full path
 */
export function getFileName(path: string): string {
    const normalized = path.replace(/\\/g, '/');
    return normalized.split('/').pop() ?? path;
}

/**
 * Infer Monaco language from file extension
 */
export function getLanguageFromExtension(extension: string): string {
    const languageMap: Record<string, string> = {
        'ts': 'typescript',
        'tsx': 'typescript',
        'js': 'javascript',
        'jsx': 'javascript',
        'json': 'json',
        'html': 'html',
        'css': 'css',
        'scss': 'scss',
        'less': 'less',
        'md': 'markdown',
        'mdx': 'markdown',
        'py': 'python',
        'rs': 'rust',
        'toml': 'toml',
        'yaml': 'yaml',
        'yml': 'yaml',
        'xml': 'xml',
        'svg': 'xml',
        'sh': 'shell',
        'bash': 'shell',
        'zsh': 'shell',
        'sql': 'sql',
        'graphql': 'graphql',
        'gql': 'graphql',
        'vue': 'vue',
        'svelte': 'svelte',
        'go': 'go',
        'java': 'java',
        'kt': 'kotlin',
        'swift': 'swift',
        'c': 'c',
        'cpp': 'cpp',
        'h': 'c',
        'hpp': 'cpp',
        // C# / .NET / Unity (MelonLoader)
        'cs': 'csharp',
        'csx': 'csharp',
        'csproj': 'xml',
        'sln': 'plaintext',
        'props': 'xml',
        'targets': 'xml',
        'nuspec': 'xml',
    };

    return languageMap[extension] ?? 'plaintext';
}
