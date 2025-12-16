import { create } from 'zustand';
import type { BuildDiagnostic } from '@/lib/languages/csharp';

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
    
    // BuildResult data from Rust backend
    buildDiagnostics: BuildDiagnostic[];
    buildDurationMs: number | null;

    // Actions
    openPanel: () => void;
    closePanel: () => void;
    togglePanel: () => void;

    startBuild: () => void;
    finishBuild: (status: 'success' | 'error', diagnostics?: BuildDiagnostic[], durationMs?: number) => void;

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
    buildDiagnostics: [],
    buildDurationMs: null,

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
        buildDiagnostics: [],
        buildDurationMs: null,
    }),

    finishBuild: (status, diagnostics = [], durationMs) => set({
        isBuilding: false,
        buildStatus: status,
        buildEndTime: Date.now(),
        buildDiagnostics: diagnostics,
        buildDurationMs: durationMs ?? null,
    }),

    // Output actions
    appendOutput: (line) => set((state) => ({
        buildOutput: [...state.buildOutput, line],
    })),

    setOutput: (lines) => set({ buildOutput: lines }),

    clearOutput: () => set({ buildOutput: [], buildDiagnostics: [], buildDurationMs: null }),
}));
