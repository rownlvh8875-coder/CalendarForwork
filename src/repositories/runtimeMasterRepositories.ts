import { isTauri } from '@tauri-apps/api/core';
import { createMasterSampleData } from '../data/masterSampleData';
import type { ClientRepository } from './ClientRepository';
import type { ProjectRepository } from './ProjectRepository';
import type { ProjectTimelineRepository } from './ProjectTimelineRepository';
import { createMemoryClientRepository } from './memoryClientRepository';
import { createMemoryProjectRepository } from './memoryProjectRepository';
import { createMemoryProjectTimelineRepository } from './memoryProjectTimelineRepository';
import type { MemoryMasterState } from './memoryMasterState';
import { createTauriClientRepository } from './tauriClientRepository';
import { createTauriProjectRepository } from './tauriProjectRepository';
import { createTauriProjectTimelineRepository } from './tauriProjectTimelineRepository';

export interface RuntimeMasterRepositories {
  clients: ClientRepository;
  projects: ProjectRepository;
  timeline: ProjectTimelineRepository;
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
      timeline: createTauriProjectTimelineRepository(),
    };
  }

  const sample = createMasterSampleData(now);
  const state: MemoryMasterState = {
    clients: sample.clients.map((client) => ({ ...client })),
    projects: sample.projects.map((project) => ({ ...project })),
    stages: sample.stages.map((stage) => ({ ...stage })),
    stageHistory: sample.stageHistory.map((history) => ({ ...history })),
  };

  return {
    clients: createMemoryClientRepository(state),
    projects: createMemoryProjectRepository(state),
    timeline: createMemoryProjectTimelineRepository(state),
  };
}
