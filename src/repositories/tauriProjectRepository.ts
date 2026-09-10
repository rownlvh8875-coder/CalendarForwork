import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import type { NewProject, Project, ProjectStage } from '../domain/projects';
import type { ProjectRepository } from './ProjectRepository';
import type { InvokeFn } from './tauriEventRepository';

function withoutReadOnlyFields(project: Project): NewProject {
  const {
    id: _id,
    clientName: _clientName,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...input
  } = project;
  return input;
}

export function createTauriProjectRepository(
  invokeFn: InvokeFn = tauriInvoke,
): ProjectRepository {
  return {
    list(includeArchived = false): Promise<Project[]> {
      return invokeFn<Project[]>('projects_list', { includeArchived });
    },

    listStages(): Promise<ProjectStage[]> {
      return invokeFn<ProjectStage[]>('project_stages_list');
    },

    get(id: string): Promise<Project | null> {
      return invokeFn<Project | null>('projects_get', { id });
    },

    create(project: NewProject): Promise<Project> {
      return invokeFn<Project>('projects_create', { project });
    },

    async update(id: string, patch: Partial<NewProject>): Promise<Project> {
      const current = await invokeFn<Project | null>('projects_get', { id });
      if (!current) {
        throw new Error(`Project not found: ${id}`);
      }

      const project: NewProject = {
        ...withoutReadOnlyFields(current),
        ...patch,
      };
      return invokeFn<Project>('projects_replace', { id, project });
    },

    setArchived(id: string, archived: boolean): Promise<Project> {
      return invokeFn<Project>('projects_set_archived', { id, archived });
    },
  };
}
