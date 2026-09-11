import type { CalendarEvent } from '../../domain/calendar';
import type { ProjectStageHistory } from '../../domain/timeline';
import {
  buildProjectTimeline,
  formatStageTransition,
  formatTimelineDday,
} from './projectTimelineModel';

const baseEvent: CalendarEvent = {
  id: 'event-old',
  projectId: 'project-1',
  projectName: '가상 사업',
  clientName: '가상 발주처',
  categoryId: 'meeting',
  categoryKey: 'meeting',
  categoryName: '회의',
  title: '과거 회의',
  description: null,
  startAt: '2026-09-09T09:00:00+09:00',
  endAt: null,
  deadlineAt: null,
  allDay: false,
  status: 'completed',
  priority: 'normal',
  assignee: null,
  location: null,
  url: null,
  memo: null,
  isPinned: false,
  completedAt: '2026-09-09T10:00:00+09:00',
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-09T01:00:00Z',
};

const baseline: ProjectStageHistory = {
  id: 'history-baseline',
  projectId: 'project-1',
  fromStage: null,
  toStage: 'planned-order',
  changedAt: '2026-09-10T02:00:00Z',
  source: 'migration-baseline',
  note: null,
  createdAt: '2026-09-10T02:00:00Z',
};

const changed: ProjectStageHistory = {
  id: 'history-change',
  projectId: 'project-1',
  fromStage: 'planned-order',
  toStage: 'pq',
  changedAt: '2026-09-12T00:00:00Z',
  source: 'project-edit',
  note: null,
  createdAt: '2026-09-12T00:00:00Z',
};

describe('project timeline read model', () => {
  test('merges stage history and events using actionable event deadline ordering', () => {
    const dueEvent: CalendarEvent = {
      ...baseEvent,
      id: 'event-due',
      title: 'PQ 제출',
      categoryId: 'pq',
      categoryKey: 'pq',
      categoryName: 'PQ',
      startAt: '2026-09-11T09:00:00+09:00',
      deadlineAt: '2026-09-15T17:00:00+09:00',
      status: 'planned',
      completedAt: null,
    };

    const result = buildProjectTimeline([baseline, changed], [baseEvent, dueEvent]);

    expect(result.map((item) => `${item.kind}:${item.id}`)).toEqual([
      'event:event-due',
      'stage:history-change',
      'stage:history-baseline',
      'event:event-old',
    ]);
    expect(result[0].at).toBe(dueEvent.deadlineAt);
  });

  test('uses kind and id as deterministic tie-breakers without mutating inputs', () => {
    const tiedEvent: CalendarEvent = {
      ...baseEvent,
      id: 'event-a',
      startAt: '2026-09-12T00:00:00Z',
      completedAt: null,
    };
    const history = [{ ...changed }];
    const events = [{ ...tiedEvent }];

    const result = buildProjectTimeline(history, events);

    expect(result.map((item) => item.kind)).toEqual(['event', 'stage']);
    expect(history).toEqual([changed]);
    expect(events).toEqual([tiedEvent]);
  });

  test('formats baseline, project start and stage transitions using stage names', () => {
    const stageMap = new Map([
      ['interest', '관심사업'],
      ['planned-order', '발주예정'],
      ['pq', 'PQ'],
    ]);

    expect(formatStageTransition(baseline, stageMap)).toEqual({
      eyebrow: '현재단계 기준선',
      title: '발주예정',
    });
    expect(formatStageTransition({
      ...baseline,
      id: 'created',
      toStage: 'interest',
      source: 'project-create',
    }, stageMap)).toEqual({
      eyebrow: '사업 시작',
      title: '관심사업',
    });
    expect(formatStageTransition(changed, stageMap)).toEqual({
      eyebrow: '단계변경',
      title: '발주예정 → PQ',
    });
  });

  test('shows D-DAY and future D-N only for non-past timeline times', () => {
    const now = new Date('2026-09-11T13:00:00+09:00');

    expect(formatTimelineDday('2026-09-11T17:00:00+09:00', now)).toBe('D-DAY');
    expect(formatTimelineDday('2026-09-12T09:00:00+09:00', now)).toBe('D-1');
    expect(formatTimelineDday('2026-09-10T17:00:00+09:00', now)).toBeNull();
  });
});
