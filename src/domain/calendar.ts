export type EventStatus = 'planned' | 'in-progress' | 'completed' | 'cancelled';
export type EventPriority = 'low' | 'normal' | 'high' | 'critical';

export type CategoryKey =
  | 'notice'
  | 'pq'
  | 'soq'
  | 'site-briefing'
  | 'design'
  | 'design-review'
  | 'price-bid'
  | 'opening'
  | 'planned-order'
  | 'meeting'
  | 'report'
  | 'submission'
  | 'other';

export interface EventCategory {
  id: string;
  key: CategoryKey;
  name: string;
  colorToken: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  clientName: string;
  estimatedCost?: number | null;
  currentStage?: string | null;
}

export interface CalendarEvent {
  id: string;
  projectId?: string | null;
  projectName?: string | null;
  clientName?: string | null;
  categoryId: string;
  categoryKey: CategoryKey;
  categoryName: string;
  title: string;
  description?: string | null;
  startAt: string;
  endAt?: string | null;
  deadlineAt?: string | null;
  allDay: boolean;
  status: EventStatus;
  priority: EventPriority;
  assignee?: string | null;
  location?: string | null;
  url?: string | null;
  memo?: string | null;
  isPinned: boolean;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NewCalendarEvent = Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>;

export interface CalendarDay {
  date: Date;
  dateKey: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}
