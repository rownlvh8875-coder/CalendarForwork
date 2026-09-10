import type { CalendarEvent, NewCalendarEvent } from '../domain/calendar';
import { createMemoryEventRepository } from './memoryEventRepository';

const baseEvent: CalendarEvent = {
  id: 'event-1',
  projectId: 'project-1',
  projectName: '평택지제 차량기지 2공구',
  clientName: '국가철도공단',
  categoryId: 'pq',
  categoryKey: 'pq',
  categoryName: 'PQ',
  title: 'PQ 제출',
  startAt: '2026-09-10T09:00:00+09:00',
  deadlineAt: '2026-09-10T17:00:00+09:00',
  allDay: false,
  status: 'in-progress',
  priority: 'critical',
  assignee: '이준호',
  isPinned: true,
  createdAt: '2026-09-01T09:00:00+09:00',
  updatedAt: '2026-09-01T09:00:00+09:00',
};

describe('memory event repository', () => {
  test('lists events in a date range and returns defensive copies', async () => {
    const repository = createMemoryEventRepository([baseEvent]);
    const first = await repository.listBetween('2026-09-01', '2026-09-30');

    expect(first).toHaveLength(1);
    first[0].title = '변경됨';

    const second = await repository.listBetween('2026-09-01', '2026-09-30');
    expect(second[0].title).toBe('PQ 제출');
  });

  test('creates, updates and removes an event', async () => {
    const repository = createMemoryEventRepository([]);
    const input: NewCalendarEvent = {
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

    const created = await repository.create(input);
    expect(created.id).toBeTruthy();

    const updated = await repository.update(created.id, { title: '주간 영업회의' });
    expect(updated.title).toBe('주간 영업회의');

    await repository.remove(created.id);
    expect(await repository.listBetween('2026-09-01', '2026-09-30')).toHaveLength(0);
  });
});
