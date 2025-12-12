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
    commit: (rootPath: string, message: string) => Promise<void>;
    push: (rootPath: string, token: string) => Promise<void>;
    pull: (rootPath: string, token: string) => Promise<void>;
    getFileAtHead: (rootPath: string, filePath: string) => Promise<string>;
    discardChanges: (rootPath: string, filePath: string) => Promise<void>;
    reset: () => void;
}

export const useGitStore = create<GitState>((set, get) => ({
    files: [],
    branch: '',
    isLoading: false,
    error: null,
    commitMessage: '',

    setCommitMessage: (message) => set({ commitMessage: message }),

    refreshStatus: async (rootPath) => {
        set({ isLoading: true, error: null });
        try {
            const result = await invoke<GitStatusResult>('git_status', { rootPath });
            set({
                files: result.files,
                branch: result.branch,
                isLoading: false
            });
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : String(error),
                isLoading: false,
                files: [], // Clear files on error (e.g. not a git repo)
                branch: ''
            });
        }
    },

    commit: async (rootPath, message) => {
        set({ isLoading: true, error: null });
        try {
            await invoke('git_commit', { rootPath, message });
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
