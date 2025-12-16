import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface GitFileStatus {
    path: string;
    status: string;
}

export interface GitStatusResult {
    branch: string;
    files: GitFileStatus[];
}

interface GitState {
    files: GitFileStatus[];
    branch: string;
    isLoading: boolean;
    error: string | null;
    commitMessage: string;

    // Actions
    setCommitMessage: (message: string) => void;
    refreshStatus: (rootPath: string) => Promise<void>;
    commit: (rootPath: string, message: string, files: string[]) => Promise<void>;
    push: (rootPath: string, token: string) => Promise<void>;
    pull: (rootPath: string, token: string) => Promise<void>;
    getFileAtHead: (rootPath: string, filePath: string) => Promise<string>;
    discardChanges: (rootPath: string, filePath: string) => Promise<void>;
    reset: () => void;
}

// Cache for git status results (2 second TTL)
interface CachedStatus {
    result: GitStatusResult;
    timestamp: number;
}

const statusCache = new Map<string, CachedStatus>();
const CACHE_TTL = 2000; // 2 seconds
const DEBOUNCE_DELAY = 200; // 200ms

// Debounce map for pending refresh calls
const pendingRefreshes = new Map<string, NodeJS.Timeout>();

export const useGitStore = create<GitState>((set, get) => ({
    files: [],
    branch: '',
    isLoading: false,
    error: null,
    commitMessage: '',

    setCommitMessage: (message) => set({ commitMessage: message }),

    refreshStatus: async (rootPath) => {
        // Clear any pending debounced call for this path
        const pendingTimeout = pendingRefreshes.get(rootPath);
        if (pendingTimeout) {
            clearTimeout(pendingTimeout);
            pendingRefreshes.delete(rootPath);
        }

        // Check cache first
        const cached = statusCache.get(rootPath);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            set({
                files: cached.result.files,
                branch: cached.result.branch,
                isLoading: false,
                error: null
            });
            return;
        }

        // Debounce the actual refresh call
        return new Promise<void>((resolve, reject) => {
            const timeoutId = setTimeout(async () => {
                pendingRefreshes.delete(rootPath);
                set({ isLoading: true, error: null });
                
                try {
                    const result = await invoke<GitStatusResult>('git_status', { rootPath });
                    
                    // Update cache
                    statusCache.set(rootPath, {
                        result,
                        timestamp: Date.now()
                    });
                    
                    set({
                        files: result.files,
                        branch: result.branch,
                        isLoading: false
                    });
                    resolve();
                } catch (error) {
                    set({
                        error: error instanceof Error ? error.message : String(error),
                        isLoading: false,
                        files: [], // Clear files on error (e.g. not a git repo)
                        branch: ''
                    });
                    reject(error);
                }
            }, DEBOUNCE_DELAY);
            
            pendingRefreshes.set(rootPath, timeoutId);
        });
    },

    commit: async (rootPath, message, files) => {
        set({ isLoading: true, error: null });
        try {
            await invoke('git_commit', { rootPath, message, files });
            // Refresh status after commit
            await get().refreshStatus(rootPath);
            set({ commitMessage: '' }); // Clear message on success
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : String(error),
                isLoading: false
            });
            throw error;
        }
    },

    push: async (rootPath, token) => {
        set({ isLoading: true, error: null });
        try {
            await invoke('git_push', { rootPath, token });
            set({ isLoading: false });
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : String(error),
                isLoading: false
            });
            throw error;
        }
    },

    pull: async (rootPath, token) => {
        set({ isLoading: true, error: null });
        try {
            await invoke('git_pull', { rootPath, token });
            // Refresh status after pull (files might change)
            await get().refreshStatus(rootPath);
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : String(error),
                isLoading: false
            });
            throw error;
        }
    },

    getFileAtHead: async (rootPath: string, filePath: string) => {
        try {
            return await invoke<string>('git_read_file_at_head', { rootPath, filePath });
        } catch (error) {
            console.error('Failed to read file at HEAD:', error);
            throw error;
        }
    },

    discardChanges: async (rootPath: string, filePath: string) => {
        set({ isLoading: true, error: null });
        try {
            await invoke('git_discard_changes', { rootPath, filePath });
            await get().refreshStatus(rootPath);
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : String(error),
                isLoading: false
            });
            throw error;
        }
    },

    reset: () => set({ files: [], branch: '', error: null, commitMessage: '', isLoading: false }),
}));
