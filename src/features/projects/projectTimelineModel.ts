import type { CalendarEvent } from '../../domain/calendar';
import { toDateKey } from '../../domain/date';
import type { ProjectStageHistory } from '../../domain/timeline';

export type ProjectTimelineItem =
  | {
      kind: 'stage';
      id: string;
      at: string;
      history: ProjectStageHistory;
    }
  | {
      kind: 'event';
      id: string;
      at: string;
      event: CalendarEvent;
    };

const DAY_MS = 86_400_000;

function dateKeyToUtcMs(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

export function buildProjectTimeline(
  history: ProjectStageHistory[],
  events: CalendarEvent[],
): ProjectTimelineItem[] {
  const items: ProjectTimelineItem[] = [
    ...history.map((entry): ProjectTimelineItem => ({
      kind: 'stage',
      id: entry.id,
      at: entry.changedAt,
      history: entry,
    })),
    ...events.map((event): ProjectTimelineItem => ({
      kind: 'event',
      id: event.id,
      at: event.deadlineAt ?? event.startAt,
      event,
    })),
  ];

  return items.sort((left, right) => {
    const atCompare = right.at.localeCompare(left.at);
    if (atCompare !== 0) return atCompare;

    const kindCompare = left.kind.localeCompare(right.kind);
    if (kindCompare !== 0) return kindCompare;

    return left.id.localeCompare(right.id);
  });
}

function stageName(key: string | null | undefined, stageMap: Map<string, string>): string {
  if (!key) return '-';
  return stageMap.get(key) ?? key;
}

export function formatStageTransition(
  history: ProjectStageHistory,
  stageMap: Map<string, string>,
): { eyebrow: string; title: string } {
  if (history.source === 'migration-baseline') {
    return {
      eyebrow: '현재단계 기준선',
      title: stageName(history.toStage, stageMap),
    };
  }

  if (history.source === 'project-create') {
    return {
      eyebrow: '사업 시작',
      title: stageName(history.toStage, stageMap),
    };
  }

  return {
    eyebrow: '단계변경',
    title: `${stageName(history.fromStage, stageMap)} → ${stageName(history.toStage, stageMap)}`,
  };
}

export function formatTimelineDday(at: string, now: Date): string | null {
  const atKey = at.slice(0, 10);
  const nowKey = toDateKey(now);
  const days = Math.round((dateKeyToUtcMs(atKey) - dateKeyToUtcMs(nowKey)) / DAY_MS);

  if (days < 0) return null;
  if (days === 0) return 'D-DAY';
  return `D-${days}`;
}
