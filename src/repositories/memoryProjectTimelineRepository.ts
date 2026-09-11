import type { ProjectStageHistory } from '../domain/timeline';
import type { ProjectTimelineRepository } from './ProjectTimelineRepository';
import { cloneStageHistory, type MemoryMasterState } from './memoryMasterState';

export function createMemoryProjectTimelineRepository(
  state: MemoryMasterState,
): ProjectTimelineRepository {
  return {
    async listStageHistory(projectId: string): Promise<ProjectStageHistory[]> {
      return state.stageHistory
        .map((history, index) => ({ history, index }))
        .filter(({ history }) => history.projectId === projectId)
        .sort((left, right) => {
          const changedCompare = right.history.changedAt.localeCompare(left.history.changedAt);
          if (changedCompare !== 0) return changedCompare;
          const createdCompare = right.history.createdAt.localeCompare(left.history.createdAt);
          if (createdCompare !== 0) return createdCompare;
          return right.index - left.index;
        })
        .map(({ history }) => cloneStageHistory(history));
    },
  };
}
