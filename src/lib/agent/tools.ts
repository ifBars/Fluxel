import { invoke } from '@tauri-apps/api/core';
import { readTextFile } from '@tauri-apps/plugin-fs';
import type { ToolDefinition } from './providers/types';

export interface ExecutableTool extends ToolDefinition {
    execute: (args: Record<string, unknown>) => Promise<string>;
}

export type AgentTool = ExecutableTool;

export const tools: ExecutableTool[] = [
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
        execute: async (args: Record<string, unknown>) => {
            // Accept multiple possible parameter names
            const path = (args.path || args.filePath || args.file_path || args.file) as string;
            if (!path) {
                return 'Error: path parameter is required';
            }
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
        execute: async (args: Record<string, unknown>) => {
            // Accept multiple possible parameter names
            const query = (args.query || args.search_query || args.searchQuery || args.pattern || args.text) as string;
            const path = (args.path || args.rootPath || args.root_path || args.directory || args.dir) as string;

            if (!query) {
                return 'Error: query parameter is required';
            }
            if (!path) {
                return 'Error: path parameter is required';
            }

            try {
                // Using the existing search_files command from backend
                const results = await invoke('search_files', {
                    query,
                    path,
                    filePatterns: [],
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
        execute: async (args: Record<string, unknown>) => {
            // Accept multiple possible parameter names
            const path = (args.path || args.directory || args.dir || args.rootPath || args.root_path) as string;

            if (!path) {
                return 'Error: path parameter is required';
            }

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

