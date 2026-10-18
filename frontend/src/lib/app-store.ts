import { apiFetch as fetch } from "@/lib/api";
"use client";

import { create } from "zustand";
import { Operation, Project, RestEndpoint, RestProject } from "./types";
import type { FeatureAccess } from "./access";

interface BootstrapData {
  apiKey: string;
  testerCapability: string | null;
  features: FeatureAccess;
  projects: Project[];
  restProjects: RestProject[];
}

interface AppState {
  apiKey: string | null;
  testerCapability: string | null;
  features: FeatureAccess | null;
  projects: Project[];
  restProjects: RestProject[];
  loaded: boolean;
  loading: boolean;
  loadError: string | null;
  load: () => Promise<void>;
  setApiKey: (apiKey: string) => void;
  addProject: (project: Project) => void;
  addRestProject: (project: RestProject) => void;
  removeProject: (id: string) => void;
  removeRestProject: (id: string) => void;
  patchProject: (id: string, updates: Partial<Project>) => void;
  patchRestProject: (id: string, updates: Partial<RestProject>) => void;
  replaceOperation: (projectId: string, previousName: string, operation: Operation) => void;
  addRestEndpoint: (projectId: string, endpoint: RestEndpoint) => void;
  replaceRestEndpoint: (projectId: string, endpoint: RestEndpoint) => void;
  removeRestEndpoint: (projectId: string, endpointId: string) => void;
  clear: () => void;
}

let activeLoad: Promise<void> | null = null;

export const useAppStore = create<AppState>((set, get) => ({
  apiKey: null,
  testerCapability: null,
  features: null,
  projects: [],
  restProjects: [],
  loaded: false,
  loading: false,
  loadError: null,

  load: async () => {
    if (get().loaded) return;
    if (activeLoad) return activeLoad;

    set({ loading: true, loadError: null });
    activeLoad = (async () => {
      try {
        const response = await fetch("/api/bootstrap");
        if (!response.ok) throw new Error("Unable to load application data");
        const data = (await response.json()) as BootstrapData;
        set({
          apiKey: data.apiKey,
          testerCapability: data.testerCapability,
          features: data.features,
          projects: data.projects,
          restProjects: data.restProjects,
          loaded: true,
          loading: false,
        });
      } catch (error) {
        set({
          loading: false,
          loadError: error instanceof Error ? error.message : "Unable to load application data",
        });
      } finally {
        activeLoad = null;
      }
    })();
    return activeLoad;
  },

  setApiKey: (apiKey) => set({ apiKey }),
  addProject: (project) => set((state) => ({ projects: [...state.projects, project] })),
  addRestProject: (project) => set((state) => ({ restProjects: [...state.restProjects, project] })),
  removeProject: (id) => set((state) => ({ projects: state.projects.filter((item) => item.id !== id) })),
  removeRestProject: (id) => set((state) => ({ restProjects: state.restProjects.filter((item) => item.id !== id) })),
  patchProject: (id, updates) => set((state) => ({
    projects: state.projects.map((item) => item.id === id ? { ...item, ...updates } : item),
  })),
  patchRestProject: (id, updates) => set((state) => ({
    restProjects: state.restProjects.map((item) => item.id === id ? { ...item, ...updates } : item),
  })),
  replaceOperation: (projectId, previousName, operation) => set((state) => ({
    projects: state.projects.map((project) => project.id === projectId
      ? { ...project, operations: project.operations.map((item) => item.name === previousName ? operation : item) }
      : project),
  })),
  addRestEndpoint: (projectId, endpoint) => set((state) => ({
    restProjects: state.restProjects.map((project) => project.id === projectId
      ? { ...project, endpoints: [...project.endpoints, endpoint] }
      : project),
  })),
  replaceRestEndpoint: (projectId, endpoint) => set((state) => ({
    restProjects: state.restProjects.map((project) => project.id === projectId
      ? { ...project, endpoints: project.endpoints.map((item) => item.id === endpoint.id ? endpoint : item) }
      : project),
  })),
  removeRestEndpoint: (projectId, endpointId) => set((state) => ({
    restProjects: state.restProjects.map((project) => project.id === projectId
      ? { ...project, endpoints: project.endpoints.filter((item) => item.id !== endpointId) }
      : project),
  })),
  clear: () => set({
    apiKey: null,
    testerCapability: null,
    features: null,
    projects: [],
    restProjects: [],
    loaded: false,
    loading: false,
    loadError: null,
  }),
}));
