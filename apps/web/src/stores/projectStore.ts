import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Project } from "../types/project";

interface ProjectStore {
  projects: Project[];
  selectedProject: Project | null;
  isLoading: boolean;

  // Actions
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  removeProject: (projectId: string) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  setSelectedProject: (project: Project | null) => void;
  setLoading: (loading: boolean) => void;

  // Async actions
  loadProjects: () => Promise<void>;
  selectNewProject: () => Promise<Project | null>;
  deleteProject: (projectId: string) => Promise<void>;
}

export const useProjectStore = create<ProjectStore>()(
  devtools(
    (set, get) => ({
      projects: [],
      selectedProject: null,
      isLoading: false,

      setProjects: (projects) => set({ projects }),

      addProject: (project) =>
        set((state) => ({ projects: [...state.projects, project] })),

      removeProject: (projectId) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== projectId),
          selectedProject:
            state.selectedProject?.id === projectId
              ? null
              : state.selectedProject,
        })),

      setSelectedProject: (project) => set({ selectedProject: project }),

      setLoading: (loading) => set({ isLoading: loading }),

      // Async actions with IPC calls
      loadProjects: async () => {
        set({ isLoading: true });
        try {
          const projects = await window.api.projects.getAll();
          set({ projects, isLoading: false });
        } catch (error) {
          console.error("Failed to load projects:", error);
          set({ isLoading: false });
        }
      },

      selectNewProject: async () => {
        try {
          const project = await window.api.projects.selectFolder();
          if (project) {
            await get().loadProjects();
            return project;
          }
          return null;
        } catch (error) {
          console.error("Failed to select project:", error);
          return null;
        }
      },

      deleteProject: async (projectId) => {
        try {
          await window.api.projects.remove(projectId);
          get().removeProject(projectId);
        } catch (error) {
          console.error("Failed to delete project:", error);
        }
      },
    }),
    { name: "project-store" }
  )
);
