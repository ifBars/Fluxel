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
        }
    )
);
