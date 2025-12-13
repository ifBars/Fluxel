import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ActivityItem = 'files' | 'search' | 'git' | 'settings';
export type EditorMode = 'code' | 'visual' | 'split';

export interface WorkbenchState {
    isSidebarOpen: boolean;
    activeActivity: ActivityItem;
    editorMode: EditorMode;
    
    // Layout settings
    defaultSidebarOpen: boolean;
    sidebarDefaultSize: number; // percentage
    enablePanelSnap: boolean;

    toggleSidebar: () => void;
    setSidebarOpen: (isOpen: boolean) => void;
    setActiveActivity: (activity: ActivityItem) => void;
    setEditorMode: (mode: EditorMode) => void;
    setDefaultSidebarOpen: (isOpen: boolean) => void;
    setSidebarDefaultSize: (size: number) => void;
    setEnablePanelSnap: (enable: boolean) => void;
    initEditorMode: () => void;
}

export const useWorkbenchStore = create<WorkbenchState>()(
    persist(
        (set, _get) => ({
            isSidebarOpen: true,
            activeActivity: 'files',
            editorMode: 'visual',
            
            // Layout defaults
            defaultSidebarOpen: true,
            sidebarDefaultSize: 20, // percentage
            enablePanelSnap: true,

            toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
            setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
            setActiveActivity: (activity) => set({ activeActivity: activity }),
            setEditorMode: (mode) => set({ editorMode: mode }),
            setDefaultSidebarOpen: (defaultSidebarOpen) => set({ defaultSidebarOpen }),
            setSidebarDefaultSize: (sidebarDefaultSize) => set({ sidebarDefaultSize }),
            setEnablePanelSnap: (enablePanelSnap) => set({ enablePanelSnap }),
            initEditorMode: () => {
                // This will be called from the component to sync with settings
                // if needed in the future
            },
        }),
        {
            name: 'fluxel-workbench',
            partialize: (state) => ({
                isSidebarOpen: state.isSidebarOpen,
                activeActivity: state.activeActivity,
                editorMode: state.editorMode,
                defaultSidebarOpen: state.defaultSidebarOpen,
                sidebarDefaultSize: state.sidebarDefaultSize,
                enablePanelSnap: state.enablePanelSnap,
            }),
            merge: (persistedState, currentState) => {
                if (!persistedState || typeof persistedState !== 'object') {
                    return currentState;
                }
                
                // Safely merge persisted state with current state
                return {
                    ...currentState,
                    ...(persistedState as Partial<WorkbenchState>),
                    // Ensure functions are preserved from currentState
                    toggleSidebar: currentState.toggleSidebar,
                    setSidebarOpen: currentState.setSidebarOpen,
                    setActiveActivity: currentState.setActiveActivity,
                    setEditorMode: currentState.setEditorMode,
                    setDefaultSidebarOpen: currentState.setDefaultSidebarOpen,
                    setSidebarDefaultSize: currentState.setSidebarDefaultSize,
                    setEnablePanelSnap: currentState.setEnablePanelSnap,
                    initEditorMode: currentState.initEditorMode,
                };
            },
            onRehydrateStorage: () => (_state, error) => {
                if (error) {
                    console.error('[useWorkbenchStore] Rehydration error:', error);
                }
            },
        }
    )
);
