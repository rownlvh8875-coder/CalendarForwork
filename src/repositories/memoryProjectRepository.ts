import type { NewProject, Project, ProjectStage } from '../domain/projects';
import type { ProjectRepository } from './ProjectRepository';
import { cloneProject, cloneStage, type MemoryMasterState } from './memoryMasterState';

function enrich(project: Project, state: MemoryMasterState): Project {
  const client = project.clientId ? state.clients.find((item) => item.id === project.clientId) : null;
  return { ...project, clientName: client?.name ?? null };
}

export function createMemoryProjectRepository(state: MemoryMasterState): ProjectRepository {
  return {
    async list(includeArchived = false): Promise<Project[]> {
      return state.projects
        .filter((project) => includeArchived || !project.archived)
        .map((project) => cloneProject(enrich(project, state)));
    },

    async listStages(): Promise<ProjectStage[]> {
      return state.stages.map(cloneStage);
    },

    async get(id: string): Promise<Project | null> {
      const project = state.projects.find((item) => item.id === id);
      return project ? cloneProject(enrich(project, state)) : null;
    },

    async create(input: NewProject): Promise<Project> {
      const now = new Date().toISOString();
      const project: Project = {
        ...input,
        id: crypto.randomUUID(),
        clientName: null,
        createdAt: now,
        updatedAt: now,
      };
      state.projects = [...state.projects, project];
      return cloneProject(enrich(project, state));
    },

    async update(id: string, patch: Partial<NewProject>): Promise<Project> {
      const index = state.projects.findIndex((item) => item.id === id);
      if (index < 0) throw new Error(`Project not found: ${id}`);

      const current = state.projects[index];
      const updated: Project = {
        ...current,
        ...patch,
        id: current.id,
        clientName: current.clientName,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      };
      state.projects = state.projects.map((item) => (item.id === id ? updated : item));
      return cloneProject(enrich(updated, state));
    },

    async setArchived(id: string, archived: boolean): Promise<Project> {
      return this.update(id, { archived });
    },
  };
}
