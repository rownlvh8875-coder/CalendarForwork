import { fireEvent, render, screen, within } from '@testing-library/react';
import type { CalendarEvent } from '../../domain/calendar';
import { createMemoryEventRepository } from '../../repositories/memoryEventRepository';
import { CalendarPage } from './CalendarPage';

const makeEvent = (
  id: string,
  title: string,
  categoryName: string,
  categoryKey: CalendarEvent['categoryKey'],
): CalendarEvent => ({
  id,
  projectId: id === '1' ? 'project-1' : null,
  projectName: id === '1' ? 'A철도 차량기지 건설공사' : null,
  clientName: id === '1' ? '국가철도공단' : null,
  categoryId: categoryKey,
  categoryKey,
  categoryName,
  title,
  startAt: '2026-09-10T09:00:00+09:00',
  deadlineAt: id === '1' ? '2026-09-10T17:00:00+09:00' : null,
  allDay: false,
  status: 'planned',
  priority: id === '1' ? 'critical' : 'normal',
  assignee: id === '1' ? '담당자' : null,
  memo: id === '1' ? '제출서류 최종 검토' : null,
  isPinned: id === '1',
  createdAt: '2026-09-01T09:00:00+09:00',
  updatedAt: '2026-09-01T09:00:00+09:00',
});

const events = [
  makeEvent('1', 'PQ 제출', 'PQ', 'pq'),
  makeEvent('2', '현장설명', '현장설명', 'site-briefing'),
  makeEvent('3', '설계검토회의', '회의', 'meeting'),
  makeEvent('4', '가격입찰', '가격입찰', 'price-bid'),
];

describe('CalendarPage', () => {
  test('renders September 2026 as a six-week business calendar', async () => {
    render(
      <CalendarPage
        repository={createMemoryEventRepository(events)}
        initialDate={new Date(2026, 8, 10)}
        now={new Date('2026-09-10T09:00:00+09:00')}
      />,
    );

    expect(screen.getByRole('heading', { name: '2026년 9월' })).toBeInTheDocument();
    expect(screen.getByText('일')).toBeInTheDocument();
    expect(screen.getByText('월')).toBeInTheDocument();
    expect(screen.getByText('화')).toBeInTheDocument();
    expect(screen.getByText('수')).toBeInTheDocument();
    expect(screen.getByText('목')).toBeInTheDocument();
    expect(screen.getByText('금')).toBeInTheDocument();
    expect(screen.getByText('토')).toBeInTheDocument();

    const day = await screen.findByLabelText('2026-09-10');
    expect(within(day).getByText('PQ 제출')).toBeInTheDocument();
    expect(within(day).getByText('D-Day')).toBeInTheDocument();
    expect(within(day).getAllByRole('button', { name: /일정:/ })).toHaveLength(3);
    expect(within(day).getByRole('button', { name: '1개 일정 더보기' })).toHaveTextContent('+1개 더보기');
  });

  test('moves to the next month from the calendar toolbar', async () => {
    render(
      <CalendarPage
        repository={createMemoryEventRepository([])}
        initialDate={new Date(2026, 8, 10)}
        now={new Date('2026-09-10T09:00:00+09:00')}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '다음 달' }));
    expect(await screen.findByRole('heading', { name: '2026년 10월' })).toBeInTheDocument();
  });

  test('opens event details in a side panel while keeping the month calendar visible', async () => {
    render(
      <CalendarPage
        repository={createMemoryEventRepository(events)}
        initialDate={new Date(2026, 8, 10)}
        now={new Date('2026-09-10T09:00:00+09:00')}
      />,
    );

    const day = await screen.findByLabelText('2026-09-10');
    fireEvent.click(within(day).getByRole('button', { name: '일정: PQ 제출' }));

    const panel = await screen.findByRole('complementary', { name: '일정 상세' });
    expect(within(panel).getByText('PQ 제출')).toBeInTheDocument();
    expect(within(panel).getByText('A철도 차량기지 건설공사')).toBeInTheDocument();
    expect(within(panel).getByText('국가철도공단')).toBeInTheDocument();
    expect(within(panel).getByText('제출서류 최종 검토')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2026년 9월' })).toBeInTheDocument();

    fireEvent.click(within(panel).getByRole('button', { name: '상세 닫기' }));
    expect(screen.queryByRole('complementary', { name: '일정 상세' })).not.toBeInTheDocument();
  });
});
