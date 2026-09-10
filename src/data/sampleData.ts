import type { CalendarEvent } from '../domain/calendar';
import { toDateKey } from '../domain/date';

function dateKeyOffset(anchor: Date, days: number): string {
  const date = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + days);
  return toDateKey(date);
}

function at(dateKey: string, time: string): string {
  return `${dateKey}T${time}:00`;
}

export function createSampleEvents(anchor = new Date()): CalendarEvent[] {
  const today = dateKeyOffset(anchor, 0);
  const plus2 = dateKeyOffset(anchor, 2);
  const plus5 = dateKeyOffset(anchor, 5);
  const plus8 = dateKeyOffset(anchor, 8);
  const stamp = new Date(anchor).toISOString();

  return [
    {
      id: 'demo-pq-review',
      projectId: 'demo-project-a',
      projectName: 'A철도 차량기지 건설공사',
      clientName: '공공 발주처 A',
      categoryId: 'pq',
      categoryKey: 'pq',
      categoryName: 'PQ',
      title: 'PQ 제출서류 검토',
      startAt: at(today, '10:00'),
      deadlineAt: at(today, '17:00'),
      allDay: false,
      status: 'in-progress',
      priority: 'critical',
      assignee: '담당자',
      memo: 'UI 확인용 예시 일정입니다.',
      isPinned: true,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: 'demo-site-briefing',
      projectId: 'demo-project-b',
      projectName: 'B광역도로 건설공사',
      clientName: '공공 발주처 B',
      categoryId: 'site-briefing',
      categoryKey: 'site-briefing',
      categoryName: '현장설명',
      title: '현장설명회',
      startAt: at(plus2, '14:00'),
      deadlineAt: null,
      allDay: false,
      status: 'planned',
      priority: 'normal',
      assignee: '담당자',
      isPinned: false,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: 'demo-design-review',
      projectId: 'demo-project-c',
      projectName: 'C하천 정비사업',
      clientName: '공공 발주처 C',
      categoryId: 'design-review',
      categoryKey: 'design-review',
      categoryName: '설계심의',
      title: '설계심의 자료 점검',
      startAt: at(plus5, '09:30'),
      deadlineAt: at(plus5, '18:00'),
      allDay: false,
      status: 'planned',
      priority: 'high',
      assignee: '담당자',
      isPinned: true,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: 'demo-planned-order',
      projectId: 'demo-project-d',
      projectName: 'D항만 개발사업',
      clientName: '공공 발주처 D',
      categoryId: 'planned-order',
      categoryKey: 'planned-order',
      categoryName: '발주예정',
      title: '입찰공고 예정일 확인',
      startAt: at(plus8, '09:00'),
      deadlineAt: null,
      allDay: true,
      status: 'planned',
      priority: 'normal',
      assignee: '담당자',
      isPinned: false,
      createdAt: stamp,
      updatedAt: stamp,
    },
  ];
}
