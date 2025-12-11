import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project } from '@/types/fs';

interface ProjectState {
    /** Currently open project */
    currentProject: Project | null;
    /** List of recently opened projects */
    recentProjects: Project[];

    /** Open a project by path */
    openProject: (rootPath: string) => void;
    /** Close the current project */
    closeProject: () => void;
    /** Clear recent projects list */
    clearRecentProjects: () => void;
}

const MAX_RECENT_PROJECTS = 10;

export const useProjectStore = create<ProjectState>()(
    persist(
        (set, get) => ({
            currentProject: null,
            recentProjects: [],

            openProject: (rootPath: string) => {
                // Extract project name from path
                const name = rootPath.split(/[\\/]/).pop() ?? 'Unknown';
                const project: Project = {
                    name,
                    rootPath,
                    lastOpened: new Date(),
                };

                // Update recent projects (remove if exists, add to front)
                const recentProjects = get().recentProjects.filter(
                    (p) => p.rootPath !== rootPath
                );
                recentProjects.unshift(project);

                // Keep only MAX_RECENT_PROJECTS
                if (recentProjects.length > MAX_RECENT_PROJECTS) {
                    recentProjects.pop();
                }

                set({ currentProject: project, recentProjects });
            },

            closeProject: () => {
                set({ currentProject: null });
            },

            clearRecentProjects: () => {
                set({ recentProjects: [] });
            },
        }),
        {
            name: 'fluxel-project-store',
            // Only persist recentProjects, not currentProject
            partialize: (state) => ({ recentProjects: state.recentProjects }),
        }
    )
);
