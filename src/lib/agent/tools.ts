import { invoke } from '@tauri-apps/api/core';
import { readTextFile } from '@tauri-apps/plugin-fs';

export interface AgentTool {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    };
    execute: (args: any) => Promise<string>;
}

export const tools: AgentTool[] = [
    {
        type: 'function',
        function: {
            name: 'read_file',
            description: 'Read the contents of a file at the given path. Use this to read code files, config files, or documentation in the workspace.',
            parameters: {
                type: 'object',
                required: ['path'],
                properties: {
                    path: {
                        type: 'string',
                        description: 'The absolute path to the file to read',
                    },
                },
            },
        },
        execute: async ({ path }: { path: string }) => {
            try {
                const content = await readTextFile(path);
                return content;
            } catch (error) {
                return `Error reading file: ${error instanceof Error ? error.message : String(error)}`;
            }
        },
    },
    {
        type: 'function',
        function: {
            name: 'search_files',
            description: 'Search for files in the workspace containing specific text or matching a pattern. Returns a list of matches with context.',
            parameters: {
                type: 'object',
                required: ['query', 'path'],
                properties: {
                    query: {
                        type: 'string',
                        description: 'The text or regex pattern to search for',
                    },
                    path: {
                        type: 'string',
                        description: 'The directory path to search in (usually the workspace root)',
                    },
                },
            },
        },
        execute: async ({ query, path }: { query: string; path: string }) => {
            try {
                // Using the existing search_files command from backend
                // Signature: search_files(query: String, path: String, file_patterns: Option<Vec<String>>, exclude_patterns: Option<Vec<String>>) -> Result<Vec<SearchResult>, String>
                const results = await invoke('search_files', {
                    query,
                    path,
                    filePatterns: [], // Optional: explicit patterns if needed
                    excludePatterns: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
                });
                return JSON.stringify(results, null, 2);
            } catch (error) {
                return `Error searching files: ${error instanceof Error ? error.message : String(error)}`;
            }
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_files',
            description: 'List files and directories in a specific directory.',
            parameters: {
                type: 'object',
                required: ['path'],
                properties: {
                    path: {
                        type: 'string',
                        description: 'The absolute path of the directory to list',
                    },
                },
            },
        },
        execute: async ({ path }: { path: string }) => {
            try {
                // Using the existing list_directory_entries command from backend
                const entries = await invoke('list_directory_entries', { path });
                return JSON.stringify(entries, null, 2);
            } catch (error) {
                return `Error listing files: ${error instanceof Error ? error.message : String(error)}`;
            }
        }
    }
];
