import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import type { ProjectStageHistory } from '../domain/timeline';
import type { ProjectTimelineRepository } from './ProjectTimelineRepository';

export type TimelineInvokeFn = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export function createTauriProjectTimelineRepository(
  invokeFn: TimelineInvokeFn = tauriInvoke,
): ProjectTimelineRepository {
  return {
    listStageHistory(projectId: string): Promise<ProjectStageHistory[]> {
      return invokeFn<ProjectStageHistory[]>('project_stage_history_list', { projectId });
    },
  };
}
