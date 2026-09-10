import type { NewProject, Project, ProjectStage } from '../domain/projects';

export interface ProjectRepository {
  list(includeArchived?: boolean): Promise<Project[]>;
  listStages(): Promise<ProjectStage[]>;
  get(id: string): Promise<Project | null>;
  create(input: NewProject): Promise<Project>;
  update(id: string, patch: Partial<NewProject>): Promise<Project>;
  setArchived(id: string, archived: boolean): Promise<Project>;
}
