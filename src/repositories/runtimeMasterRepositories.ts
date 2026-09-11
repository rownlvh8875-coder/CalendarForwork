import { isTauri } from '@tauri-apps/api/core';
import { createMasterSampleData } from '../data/masterSampleData';
import type { ClientRepository } from './ClientRepository';
import type { ProjectRepository } from './ProjectRepository';
import { createMemoryClientRepository } from './memoryClientRepository';
import { createMemoryProjectRepository } from './memoryProjectRepository';
import type { MemoryMasterState } from './memoryMasterState';
import { createTauriClientRepository } from './tauriClientRepository';
import { createTauriProjectRepository } from './tauriProjectRepository';

export interface RuntimeMasterRepositories {
  clients: ClientRepository;
  projects: ProjectRepository;
}

export function createRuntimeMasterRepositories(
  now: Date,
  tauriRuntime?: boolean,
): RuntimeMasterRepositories {
  const runningInTauri = tauriRuntime ?? isTauri();

  if (runningInTauri) {
    return {
      clients: createTauriClientRepository(),
      projects: createTauriProjectRepository(),
    };
  }

  const sample = createMasterSampleData(now);
  const state: MemoryMasterState = {
    clients: sample.clients.map((client) => ({ ...client })),
    projects: sample.projects.map((project) => ({ ...project })),
    stages: sample.stages.map((stage) => ({ ...stage })),
  };

  return {
    clients: createMemoryClientRepository(state),
    projects: createMemoryProjectRepository(state),
  };
}
