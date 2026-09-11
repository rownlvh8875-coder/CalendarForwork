import type { ProjectStageHistory } from '../domain/timeline';

export interface ProjectTimelineRepository {
  listStageHistory(projectId: string): Promise<ProjectStageHistory[]>;
}
