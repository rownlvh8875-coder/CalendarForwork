import { render, screen, within } from '@testing-library/react';
import type { CalendarEvent } from '../../domain/calendar';
import { createMemoryEventRepository } from '../../repositories/memoryEventRepository';
import { TodayPage } from './TodayPage';

function event(overrides: Partial<CalendarEvent> & Pick<CalendarEvent, 'id' | 'title' | 'startAt'>): CalendarEvent {
  return {
    categoryId: 'other',
    categoryKey: 'other',
    categoryName: '기타',
    allDay: false,
    status: 'planned',
    priority: 'normal',
    isPinned: false,
    createdAt: '2026-09-01T09:00:00+09:00',
    updatedAt: '2026-09-01T09:00:00+09:00',
    ...overrides,
  };
}

const fixtures: CalendarEvent[] = [
  event({
    id: 'overdue',
    title: '전일 제출 마감',
    startAt: '2026-09-09T09:00:00+09:00',
    deadlineAt: '2026-09-09T17:00:00+09:00',
    categoryId: 'submission',
    categoryKey: 'submission',
    categoryName: '제출마감',
    priority: 'high',
  }),
  event({
    id: 'urgent',
    title: '오늘 PQ 제출',
    startAt: '2026-09-10T09:00:00+09:00',
    deadlineAt: '2026-09-10T17:00:00+09:00',
    categoryId: 'pq',
    categoryKey: 'pq',
    categoryName: 'PQ',
    priority: 'critical',
  }),
  event({
    id: 'week',
    title: '이번 주 현장설명',
    startAt: '2026-09-13T14:00:00+09:00',
    categoryId: 'site-briefing',
    categoryKey: 'site-briefing',
    categoryName: '현장설명',
  }),
  event({
    id: 'planned-order',
    title: '발주예정 확인',
    startAt: '2026-09-15T09:00:00+09:00',
    categoryId: 'planned-order',
    categoryKey: 'planned-order',
    categoryName: '발주예정',
  }),
  event({
    id: 'done',
    title: '완료된 업무',
    startAt: '2026-09-10T08:00:00+09:00',
    status: 'completed',
    completedAt: '2026-09-10T08:30:00+09:00',
  }),
];

describe('TodayPage', () => {
  test('groups actionable work without duplicating completed items', async () => {
    render(
      <TodayPage
        repository={createMemoryEventRepository(fixtures)}
        now={new Date('2026-09-10T09:00:00+09:00')}
      />,
    );

    expect(await screen.findByRole('heading', { name: '오늘의 업무' })).toBeInTheDocument();

    const overdue = screen.getByRole('region', { name: '마감 초과' });
    const urgent = screen.getByRole('region', { name: '긴급' });
    const week = screen.getByRole('region', { name: '이번 주' });
    const planned = screen.getByRole('region', { name: '발주예정' });

    expect(within(overdue).getByText('전일 제출 마감')).toBeInTheDocument();
    expect(within(urgent).getByText('오늘 PQ 제출')).toBeInTheDocument();
    expect(within(week).getByText('이번 주 현장설명')).toBeInTheDocument();
    expect(within(planned).getByText('발주예정 확인')).toBeInTheDocument();
    expect(screen.queryByText('완료된 업무')).not.toBeInTheDocument();
  });
});
