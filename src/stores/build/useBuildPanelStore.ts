import { create } from 'zustand';

export type BuildStatus = 'idle' | 'running' | 'success' | 'error';

export interface BuildPanelState {
    // Panel visibility
    isOpen: boolean;

    // Build state
    isBuilding: boolean;
    buildStatus: BuildStatus;
    buildOutput: string[];
    buildStartTime: number | null;
    buildEndTime: number | null;

    // Actions
    openPanel: () => void;
    closePanel: () => void;
    togglePanel: () => void;

    startBuild: () => void;
    finishBuild: (status: 'success' | 'error') => void;

    appendOutput: (line: string) => void;
    setOutput: (lines: string[]) => void;
    clearOutput: () => void;
}

export const useBuildPanelStore = create<BuildPanelState>()((set) => ({
    // Initial state
    isOpen: false,
    isBuilding: false,
    buildStatus: 'idle',
    buildOutput: [],
    buildStartTime: null,
    buildEndTime: null,

    // Panel actions
    openPanel: () => set({ isOpen: true }),
    closePanel: () => set({ isOpen: false }),
    togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),

    // Build actions
    startBuild: () => set({
        isOpen: true,
        isBuilding: true,
        buildStatus: 'running',
        buildOutput: [],
        buildStartTime: Date.now(),
        buildEndTime: null,
    }),

    finishBuild: (status) => set({
        isBuilding: false,
        buildStatus: status,
        buildEndTime: Date.now(),
    }),

    // Output actions
    appendOutput: (line) => set((state) => ({
        buildOutput: [...state.buildOutput, line],
    })),

    setOutput: (lines) => set({ buildOutput: lines }),

    clearOutput: () => set({ buildOutput: [] }),
}));
