export type ProjectPriority = 'low' | 'normal' | 'high' | 'critical';

export interface ProjectStage {
  key: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Project {
  id: string;
  projectCode?: string | null;
  name: string;
  clientId?: string | null;
  clientName?: string | null;
  projectType?: string | null;
  region?: string | null;
  contractType?: string | null;
  estimatedCost?: number | null;
  currentStage: string;
  priority: ProjectPriority;
  assignee?: string | null;
  expectedBidDate?: string | null;
  description?: string | null;
  memo?: string | null;
  url?: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type NewProject = Omit<Project, 'id' | 'clientName' | 'createdAt' | 'updatedAt'>;
