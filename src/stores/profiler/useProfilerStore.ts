/**
 * useProfilerStore - Zustand store for profiler state management
 * 
 * Manages profiler panel state, span data, and session tracking.
 */

import { create } from 'zustand';
import { ProfilerService } from '@/lib/services/ProfilerService';
import type {
    ProfilerStatus,
    SpanSummary,
    AttributionReport,
    SessionReport,
} from '@/types/profiling';

// =============================================================================
// Types
// =============================================================================

interface ProfilerStoreState {
    // Availability
    isAvailable: boolean;

    // Status
    isEnabled: boolean;
    isPanelOpen: boolean;
    isLoading: boolean;

    // Data
    status: ProfilerStatus | null;
    recentSpans: SpanSummary[];
    selectedSpan: SpanSummary | null;
    attribution: AttributionReport | null;

    // Session
    activeSession: { id: string; name: string; startTime: number } | null;
    lastSessionReport: SessionReport | null;

    // Panel position (for floating/dockable window)
    panelPosition: { x: number; y: number };
    panelSize: { width: number; height: number };
    isDocked: boolean;

    // Actions
    initialize: () => Promise<void>;
    toggle: () => Promise<void>;
    togglePanel: () => void;
    refresh: () => Promise<void>;
    selectSpan: (span: SpanSummary | null) => void;
    analyzeSpan: (spanId: string) => Promise<void>;
    clear: () => Promise<void>;

    // Session actions
    startSession: (name: string) => Promise<void>;
    endSession: () => Promise<SessionReport | null>;

    // Panel actions
    setPanelPosition: (position: { x: number; y: number }) => void;
    setPanelSize: (size: { width: number; height: number }) => void;
    toggleDocked: () => void;
}

// =============================================================================
// Initial State
// =============================================================================

const initialState = {
    isAvailable: false,
    isEnabled: false,
    isPanelOpen: false,
    isLoading: false,
    status: null,
    recentSpans: [],
    selectedSpan: null,
    attribution: null,
    activeSession: null,
    lastSessionReport: null,
    panelPosition: { x: 100, y: 100 },
    panelSize: { width: 1150, height: 650 },
    isDocked: false,
};

// =============================================================================
// Store
// =============================================================================

export const useProfilerStore = create<ProfilerStoreState>((set, get) => ({
    ...initialState,

    // Initialize - check availability and get initial status
    initialize: async () => {
        const isAvailable = await ProfilerService.isAvailable();

        if (!isAvailable) {
            set({ isAvailable: false });
            return;
        }

        const status = await ProfilerService.getStatus();
        set({
            isAvailable: true,
            isEnabled: status?.enabled ?? false,
            status,
        });
    },

    // Toggle profiling on/off
    toggle: async () => {
        const { isEnabled, isAvailable } = get();
        if (!isAvailable) return;

        const newEnabled = !isEnabled;
        await ProfilerService.setEnabled(newEnabled);
        set({ isEnabled: newEnabled });

        // Refresh status
        const status = await ProfilerService.getStatus();
        set({ status });
    },

    // Toggle panel visibility
    togglePanel: () => {
        set(state => ({ isPanelOpen: !state.isPanelOpen }));
    },

    // Refresh data from backend
    refresh: async () => {
        const { isAvailable } = get();
        if (!isAvailable) return;

        set({ isLoading: true });

        try {
            const [status, spans] = await Promise.all([
                ProfilerService.getStatus(),
                ProfilerService.getRecentSpans(200),
            ]);

            set({
                status,
                isEnabled: status?.enabled ?? false,
                recentSpans: spans,
                isLoading: false,
            });

            // Also update active session if one exists
            if (status?.activeSessionId) {
                const { activeSession } = get();
                if (!activeSession || activeSession.id !== status.activeSessionId) {
                    // Session started elsewhere, sync state
                    set({
                        activeSession: {
                            id: status.activeSessionId,
                            name: 'External Session',
                            startTime: Date.now(),
                        },
                    });
                }
            }
        } catch (error) {
            console.error('[ProfilerStore] Refresh failed:', error);
            set({ isLoading: false });
        }
    },

    // Select a span for detailed view
    selectSpan: (span) => {
        set({ selectedSpan: span, attribution: null });

        // Auto-analyze if span is selected
        if (span) {
            get().analyzeSpan(span.id);
        }
    },

    // Analyze a specific span
    analyzeSpan: async (spanId) => {
        const { isAvailable } = get();
        if (!isAvailable) return;

        set({ isLoading: true });

        try {
            const attribution = await ProfilerService.getAttribution(spanId);
            set({ attribution, isLoading: false });
        } catch (error) {
            console.error('[ProfilerStore] Analysis failed:', error);
            set({ isLoading: false });
        }
    },

    // Clear all spans
    clear: async () => {
        const { isAvailable } = get();
        if (!isAvailable) return;

        await ProfilerService.clear();
        set({
            recentSpans: [],
            selectedSpan: null,
            attribution: null,
        });

        // Refresh status
        const status = await ProfilerService.getStatus();
        set({ status });
    },

    // Start a profiling session
    startSession: async (name) => {
        const { isAvailable, activeSession } = get();
        if (!isAvailable) return;

        // End existing session if any
        if (activeSession) {
            await get().endSession();
        }

        const sessionId = await ProfilerService.startSession(name);
        if (sessionId) {
            set({
                activeSession: {
                    id: sessionId,
                    name,
                    startTime: Date.now(),
                },
            });
        }
    },

    // End the current session
    endSession: async () => {
        const { isAvailable, activeSession } = get();
        if (!isAvailable || !activeSession) return null;

        const report = await ProfilerService.endSession(activeSession.id);
        set({
            activeSession: null,
            lastSessionReport: report,
        });

        // Refresh spans to show session data
        await get().refresh();

        return report;
    },

    // Panel position management
    setPanelPosition: (position) => {
        set({ panelPosition: position });
    },

    setPanelSize: (size) => {
        set({ panelSize: size });
    },

    toggleDocked: () => {
        set(state => ({ isDocked: !state.isDocked }));
    },
}));

export default useProfilerStore;
