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

export const CSHARP_SOURCE_EXTENSIONS = ['cs', 'csx', 'cake'] as const;
export const DOTNET_WORKSPACE_EXTENSIONS = ['csproj', 'sln', 'slnx', 'props', 'targets', 'nuspec'] as const;
export const CSHARP_TEMPLATE_EXTENSIONS = ['razor', 'cshtml'] as const;

export function isCSharpSourceExtension(extension: string): boolean {
    return CSHARP_SOURCE_EXTENSIONS.includes(extension as (typeof CSHARP_SOURCE_EXTENSIONS)[number]);
}

export function isDotNetWorkspaceExtension(extension: string): boolean {
    return DOTNET_WORKSPACE_EXTENSIONS.includes(extension as (typeof DOTNET_WORKSPACE_EXTENSIONS)[number]);
}

export function isCSharpRelatedExtension(extension: string): boolean {
    return isCSharpSourceExtension(extension)
        || isDotNetWorkspaceExtension(extension)
        || CSHARP_TEMPLATE_EXTENSIONS.includes(extension as (typeof CSHARP_TEMPLATE_EXTENSIONS)[number]);
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
    if (isCSharpSourceExtension(extension)) {
        return 'csharp';
    }

    if (CSHARP_TEMPLATE_EXTENSIONS.includes(extension as (typeof CSHARP_TEMPLATE_EXTENSIONS)[number])) {
        return 'html';
    }

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
        'csproj': 'xml',
        'sln': 'plaintext',
        'slnx': 'plaintext',
        'props': 'xml',
        'targets': 'xml',
        'nuspec': 'xml',
    };

    return languageMap[extension] ?? 'plaintext';
}
