import { describe, expect, it, vi } from 'vitest';
import type { NewProject, Project, ProjectStage } from '../domain/projects';
import { createTauriProjectRepository } from './tauriProjectRepository';

const project: Project = {
  id: 'project-1',
  projectCode: 'DEMO-001',
  name: '가상 차량기지 건설공사',
  clientId: 'client-1',
  clientName: '가상 발주처',
  projectType: '철도',
  region: '서울',
  contractType: '기술형입찰',
  estimatedCost: 100000000000,
  currentStage: 'planned-order',
  priority: 'high',
  assignee: '담당자',
  expectedBidDate: '2027-03-15',
  description: null,
  memo: null,
  url: null,
  archived: false,
  createdAt: '2026-09-11T00:00:00Z',
  updatedAt: '2026-09-11T00:00:00Z',
};

const stages: ProjectStage[] = [{ key: 'interest', name: '관심사업', sortOrder: 10, isActive: true }];

describe('createTauriProjectRepository', () => {
  it('maps list, stages, create and archive to Tauri commands', async () => {
    const invoke = vi.fn(async (command: string) => {
      if (command === 'projects_list') return [project];
      if (command === 'project_stages_list') return stages;
      if (command === 'projects_create') return project;
      if (command === 'projects_set_archived') return { ...project, archived: true };
      return undefined;
    });
    const repository = createTauriProjectRepository(invoke);
    const { id: _id, clientName: _clientName, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = project;

    await expect(repository.list(false)).resolves.toEqual([project]);
    await expect(repository.listStages()).resolves.toEqual(stages);
    await expect(repository.create(input as NewProject)).resolves.toEqual(project);
    await expect(repository.setArchived(project.id, true)).resolves.toMatchObject({ archived: true });

    expect(invoke).toHaveBeenCalledWith('projects_list', { includeArchived: false });
    expect(invoke).toHaveBeenCalledWith('project_stages_list');
    expect(invoke).toHaveBeenCalledWith('projects_create', { project: input });
    expect(invoke).toHaveBeenCalledWith('projects_set_archived', { id: project.id, archived: true });
  });

  it('updates by loading, merging and stripping read-only fields', async () => {
    const invoke = vi.fn(async (command: string) => {
      if (command === 'projects_get') return project;
      if (command === 'projects_replace') return { ...project, memo: '변경' };
      return undefined;
    });
    const repository = createTauriProjectRepository(invoke);

    await repository.update(project.id, { memo: '변경' });

    expect(invoke).toHaveBeenNthCalledWith(1, 'projects_get', { id: project.id });
    expect(invoke).toHaveBeenNthCalledWith(2, 'projects_replace', {
      id: project.id,
      project: expect.not.objectContaining({
        id: expect.anything(), clientName: expect.anything(), createdAt: expect.anything(), updatedAt: expect.anything(),
      }),
    });
  });

  it('throws the repository-level not-found error', async () => {
    const repository = createTauriProjectRepository(async () => null as never);
    await expect(repository.update('missing', { memo: 'x' })).rejects.toThrow('Project not found: missing');
  });
});
