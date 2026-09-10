import type { CalendarEvent, NewCalendarEvent } from '../domain/calendar';
import { createTauriEventRepository, type InvokeFn } from './tauriEventRepository';

const currentEvent: CalendarEvent = {
  id: 'event-1',
  projectId: 'project-1',
  projectName: '평택지제 차량기지 2공구',
  clientName: '국가철도공단',
  categoryId: 'pq',
  categoryKey: 'pq',
  categoryName: 'PQ',
  title: 'PQ 제출',
  description: null,
  startAt: '2026-09-10T09:00:00+09:00',
  endAt: null,
  deadlineAt: '2026-09-10T17:00:00+09:00',
  allDay: false,
  status: 'in-progress',
  priority: 'critical',
  assignee: '이준호',
  location: null,
  url: null,
  memo: '기존 메모',
  isPinned: true,
  completedAt: null,
  createdAt: '2026-09-01T09:00:00Z',
  updatedAt: '2026-09-01T09:00:00Z',
};

const newEvent: NewCalendarEvent = {
  projectId: null,
  projectName: null,
  clientName: null,
  categoryId: 'meeting',
  categoryKey: 'meeting',
  categoryName: '회의',
  title: '영업회의',
  startAt: '2026-09-11T10:00:00+09:00',
  deadlineAt: null,
  allDay: false,
  status: 'planned',
  priority: 'normal',
  isPinned: false,
};

describe('Tauri event repository', () => {
  test('maps list and create calls to the expected Tauri commands', async () => {
    const calls: Array<[string, Record<string, unknown> | undefined]> = [];
    const invoke: InvokeFn = async <T>(command: string, args?: Record<string, unknown>) => {
      calls.push([command, args]);
      if (command === 'events_list_between') return [currentEvent] as T;
      if (command === 'events_list_upcoming') return [currentEvent] as T;
      if (command === 'events_create') return { ...currentEvent, ...newEvent } as T;
      throw new Error(`unexpected command: ${command}`);
    };
    const repository = createTauriEventRepository(invoke);

    await repository.listBetween('2026-09-01', '2026-09-30');
    await repository.listUpcoming('2026-09-10T18:00:00+09:00', 7);
    await repository.create(newEvent);

    expect(calls[0]).toEqual(['events_list_between', { startIso: '2026-09-01', endIso: '2026-09-30' }]);
    expect(calls[1]).toEqual(['events_list_upcoming', { fromIso: '2026-09-10T18:00:00+09:00', days: 7 }]);
    expect(calls[2]).toEqual(['events_create', { event: newEvent }]);
  });

  test('merges update patches before replacing the full event payload', async () => {
    const calls: Array<[string, Record<string, unknown> | undefined]> = [];
    const invoke: InvokeFn = async <T>(command: string, args?: Record<string, unknown>) => {
      calls.push([command, args]);
      if (command === 'events_get') return currentEvent as T;
      if (command === 'events_replace') return { ...currentEvent, title: '수정된 PQ 제출', memo: '변경 메모' } as T;
      throw new Error(`unexpected command: ${command}`);
    };
    const repository = createTauriEventRepository(invoke);

    const updated = await repository.update('event-1', { title: '수정된 PQ 제출', memo: '변경 메모' });

    expect(updated.title).toBe('수정된 PQ 제출');
    expect(calls[0]).toEqual(['events_get', { id: 'event-1' }]);
    expect(calls[1][0]).toBe('events_replace');
    expect(calls[1][1]?.id).toBe('event-1');
    const payload = calls[1][1]?.event as Record<string, unknown>;
    expect(payload.title).toBe('수정된 PQ 제출');
    expect(payload.memo).toBe('변경 메모');
    expect(payload.id).toBeUndefined();
    expect(payload.createdAt).toBeUndefined();
    expect(payload.updatedAt).toBeUndefined();
  });

  test('throws when updating a missing event and maps remove directly', async () => {
    const calls: Array<[string, Record<string, unknown> | undefined]> = [];
    const invoke: InvokeFn = async <T>(command: string, args?: Record<string, unknown>) => {
      calls.push([command, args]);
      if (command === 'events_get') return null as T;
      if (command === 'events_remove') return undefined as T;
      throw new Error(`unexpected command: ${command}`);
    };
    const repository = createTauriEventRepository(invoke);

    await expect(repository.update('missing', { title: '없음' })).rejects.toThrow('Event not found: missing');
    await repository.remove('event-1');
    expect(calls.at(-1)).toEqual(['events_remove', { id: 'event-1' }]);
  });
});
