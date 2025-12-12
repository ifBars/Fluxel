/**
 * Type Loading Store
 * 
 * Manages the state of TypeScript type loading for status bar display.
 * Tracks loading progress for user feedback.
 */

import { create } from 'zustand';

export interface TypeLoadingState {
    /** Whether types are currently being loaded */
    isLoading: boolean;
    /** Current loading message for status bar */
    loadingMessage: string | null;
    /** Number of packages being processed */
    packagesLoading: number;
    /** Number of packages completed */
    packagesLoaded: number;
    /** Total packages to load (for progress) */
    totalPackages: number;

    // Actions
    startLoading: (message: string, totalPackages?: number) => void;
    updateProgress: (loaded: number, message?: string) => void;
    finishLoading: () => void;
}

export const useTypeLoadingStore = create<TypeLoadingState>((set) => ({
    isLoading: false,
    loadingMessage: null,
    packagesLoading: 0,
    packagesLoaded: 0,
    totalPackages: 0,

    startLoading: (message: string, totalPackages = 0) => set({
        isLoading: true,
        loadingMessage: message,
        packagesLoading: totalPackages,
        packagesLoaded: 0,
        totalPackages,
    }),

    updateProgress: (loaded: number, message?: string) => set((state) => ({
        packagesLoaded: loaded,
        loadingMessage: message ?? state.loadingMessage,
    })),

    finishLoading: () => set({
        isLoading: false,
        loadingMessage: null,
        packagesLoading: 0,
        packagesLoaded: 0,
        totalPackages: 0,
    }),
}));
