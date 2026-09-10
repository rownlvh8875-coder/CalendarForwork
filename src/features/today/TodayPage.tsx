import { useEffect, useMemo, useState } from 'react';
import { CategoryBadge } from '../../components/CategoryBadge';
import type { CalendarEvent } from '../../domain/calendar';
import { getDeadlineLabel, toDateKey } from '../../domain/date';
import type { EventRepository } from '../../repositories/EventRepository';

interface TodayPageProps {
  repository: EventRepository;
  now?: Date;
}

type WorkGroupKey = 'overdue' | 'urgent' | 'week' | 'planned-order';

type WorkGroup = {
  key: WorkGroupKey;
  title: string;
  description: string;
  events: CalendarEvent[];
};

function offsetDateKey(anchor: Date, days: number): string {
  const date = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + days);
  return toDateKey(date);
}

function eventDateKey(event: CalendarEvent): string {
  return event.startAt.slice(0, 10);
}

function deadlineDateKey(event: CalendarEvent): string | null {
  return event.deadlineAt?.slice(0, 10) ?? null;
}

function formatSchedule(event: CalendarEvent): string {
  const date = new Date(event.startAt);
  if (Number.isNaN(date.getTime())) {
    return event.startAt;
  }

  if (event.allDay) {
    return new Intl.DateTimeFormat('ko-KR', {
      month: 'numeric',
      day: 'numeric',
    }).format(date);
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function groupWork(events: CalendarEvent[], now: Date): WorkGroup[] {
  const todayKey = toDateKey(now);
  const weekEndKey = offsetDateKey(now, 7);
  const actionable = events
    .filter((event) => event.status !== 'completed' && event.status !== 'cancelled')
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  const groups: Record<WorkGroupKey, CalendarEvent[]> = {
    overdue: [],
    urgent: [],
    week: [],
    'planned-order': [],
  };

  for (const event of actionable) {
    const deadlineKey = deadlineDateKey(event);
    const startKey = eventDateKey(event);

    if (deadlineKey && deadlineKey < todayKey) {
      groups.overdue.push(event);
      continue;
    }

    if (event.categoryKey === 'planned-order') {
      groups['planned-order'].push(event);
      continue;
    }

    const urgentByPriority = event.priority === 'critical' || event.priority === 'high';
    const urgentByDeadline = deadlineKey !== null && deadlineKey <= offsetDateKey(now, 2);
    if (urgentByPriority || urgentByDeadline) {
      groups.urgent.push(event);
      continue;
    }

    if (startKey >= todayKey && startKey <= weekEndKey) {
      groups.week.push(event);
    }
  }

  return [
    {
      key: 'overdue',
      title: '마감 초과',
      description: '마감일이 지났지만 완료되지 않은 업무',
      events: groups.overdue,
    },
    {
      key: 'urgent',
      title: '긴급',
      description: '중요도가 높거나 마감이 임박한 업무',
      events: groups.urgent,
    },
    {
      key: 'week',
      title: '이번 주',
      description: '7일 이내 예정된 일반 업무',
      events: groups.week,
    },
    {
      key: 'planned-order',
      title: '발주예정',
      description: '확인해야 할 예정 발주 일정',
      events: groups['planned-order'],
    },
  ];
}

function WorkGroupCard({ group, now }: { group: WorkGroup; now: Date }) {
  return (
    <section className={`today-group today-group-${group.key}`} role="region" aria-label={group.title}>
      <header className="today-group-header">
        <div>
          <h2>{group.title}</h2>
          <p>{group.description}</p>
        </div>
        <span className="today-group-count">{group.events.length}</span>
      </header>

      <div className="today-work-list">
        {group.events.length === 0 ? (
          <div className="today-empty-row">해당 일정이 없습니다.</div>
        ) : (
          group.events.map((event) => {
            const dday = event.deadlineAt ? getDeadlineLabel(event.deadlineAt, now, event.completedAt) : null;
            return (
              <article className="today-work-row" key={event.id}>
                <div className="today-work-main">
                  <div className="today-work-meta">
                    <CategoryBadge categoryKey={event.categoryKey} label={event.categoryName} />
                    {dday ? <span className="today-dday">{dday}</span> : null}
                  </div>
                  <strong>{event.title}</strong>
                  <span className="today-project-line">
                    {event.projectName ?? '일반 일정'}
                    {event.clientName ? ` · ${event.clientName}` : ''}
                  </span>
                </div>
                <time className="today-work-time" dateTime={event.startAt}>{formatSchedule(event)}</time>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

export function TodayPage({ repository, now = new Date() }: TodayPageProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const rangeStart = useMemo(() => offsetDateKey(now, -30), [now]);
  const rangeEnd = useMemo(() => offsetDateKey(now, 14), [now]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      const loaded = await repository.listBetween(rangeStart, rangeEnd);
      if (!cancelled) {
        setEvents(loaded);
        setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [rangeEnd, rangeStart, repository]);

  const groups = groupWork(events, now);
  const actionableCount = groups.reduce((total, group) => total + group.events.length, 0);
  const urgentCount = groups.find((group) => group.key === 'urgent')?.events.length ?? 0;
  const overdueCount = groups.find((group) => group.key === 'overdue')?.events.length ?? 0;

  return (
    <div className="today-page">
      <header className="today-page-heading">
        <div>
          <span className="today-date-label">
            {new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(now)}
          </span>
          <h1>오늘의 업무</h1>
          <p>마감과 우선순위가 높은 일정부터 확인합니다.</p>
        </div>

        <div className="today-summary" aria-label="업무 요약">
          <div><strong>{actionableCount}</strong><span>확인할 일정</span></div>
          <div><strong>{urgentCount}</strong><span>긴급</span></div>
          <div><strong>{overdueCount}</strong><span>마감 초과</span></div>
        </div>
      </header>

      {isLoading ? <div className="today-loading">일정을 불러오는 중입니다.</div> : null}

      <div className="today-group-grid">
        {groups.map((group) => <WorkGroupCard key={group.key} group={group} now={now} />)}
      </div>
    </div>
  );
}
