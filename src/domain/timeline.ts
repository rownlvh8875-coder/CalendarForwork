export type StageHistorySource = 'project-create' | 'project-edit' | 'migration-baseline';

export interface ProjectStageHistory {
  id: string;
  projectId: string;
  fromStage?: string | null;
  toStage: string;
  changedAt: string;
  source: StageHistorySource;
  note?: string | null;
  createdAt: string;
}
