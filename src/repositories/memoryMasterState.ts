import type { Client } from '../domain/clients';
import type { Project, ProjectStage } from '../domain/projects';

export interface MemoryMasterState {
  clients: Client[];
  projects: Project[];
  stages: ProjectStage[];
}

export function cloneClient(client: Client): Client {
  return { ...client };
}

export function cloneProject(project: Project): Project {
  return { ...project };
}

export function cloneStage(stage: ProjectStage): ProjectStage {
  return { ...stage };
}
