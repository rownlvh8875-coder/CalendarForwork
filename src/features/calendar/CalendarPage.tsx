import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CalendarEvent } from '../../domain/calendar';
import { buildMonthGrid } from '../../domain/date';
import { EventDetailPanel } from '../events/EventDetailPanel';
import type { EventRepository } from '../../repositories/EventRepository';
import { CalendarToolbar } from './CalendarToolbar';
import { MonthGrid } from './MonthGrid';

export interface CalendarPageProps {
  repository: EventRepository;
  initialDate?: Date;
  now?: Date;
  refreshKey?: number;
  onSelectEvent?: (event: CalendarEvent) => void;
  onSelectDay?: (dateKey: string) => void;
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function CalendarPage({
  repository,
  initialDate = new Date(),
  now = new Date(),
  refreshKey = 0,
  onSelectEvent,
  onSelectDay,
}: CalendarPageProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(initialDate));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const days = useMemo(
    () => buildMonthGrid(visibleMonth.getFullYear(), visibleMonth.getMonth(), now),
    [visibleMonth, now],
  );

  const loadVisibleEvents = useCallback(async () => {
    const firstDay = days[0]?.dateKey;
    const lastDay = days.at(-1)?.dateKey;

    if (!firstDay || !lastDay) {
      setEvents([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const loaded = await repository.listBetween(firstDay, lastDay);
    setEvents(loaded);
    setIsLoading(false);
  }, [days, repository]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const firstDay = days[0]?.dateKey;
      const lastDay = days.at(-1)?.dateKey;
      if (!firstDay || !lastDay) {
        if (!cancelled) {
          setEvents([]);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      const loaded = await repository.listBetween(firstDay, lastDay);
      if (!cancelled) {
        setEvents(loaded);
        setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [days, repository, refreshKey]);

  const changeMonth = (offset: number) => {
    setSelectedEvent(null);
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    onSelectEvent?.(event);
  };

  const handleComplete = async (id: string) => {
    await repository.update(id, {
      status: 'completed',
      completedAt: now.toISOString(),
    });
    setSelectedEvent(null);
    await loadVisibleEvents();
  };

  const handleDelete = async (id: string) => {
    await repository.remove(id);
    setSelectedEvent(null);
    await loadVisibleEvents();
  };

  const monthEventCount = events.filter((event) => {
    const dateKey = event.startAt.slice(0, 10);
    const prefix = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, '0')}`;
    return dateKey.startsWith(prefix);
  }).length;

  const urgentCount = events.filter((event) => event.priority === 'critical' || event.priority === 'high').length;

  return (
    <div className={`calendar-page${selectedEvent ? ' has-detail-panel' : ''}`}>
      <div className="calendar-page-header">
        <CalendarToolbar
          monthDate={visibleMonth}
          onPrevious={() => changeMonth(-1)}
          onToday={() => {
            setSelectedEvent(null);
            setVisibleMonth(monthStart(now));
          }}
          onNext={() => changeMonth(1)}
        />

        <div className="calendar-stats" aria-label="현재 달 일정 요약">
          <span><strong>{monthEventCount}</strong> 이번 달 일정</span>
          <span><strong>{urgentCount}</strong> 중요 일정</span>
          {isLoading ? <span className="loading-label">불러오는 중…</span> : null}
        </div>
      </div>

      <MonthGrid
        days={days}
        events={events}
        now={now}
        onSelectEvent={handleSelectEvent}
        onSelectDay={onSelectDay}
      />

      {selectedEvent ? (
        <EventDetailPanel
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onComplete={handleComplete}
          onDelete={handleDelete}
        />
      ) : null}

      <span className="sr-only" aria-live="polite">
        {isLoading ? '일정을 불러오는 중입니다.' : `일정 ${events.length}건을 불러왔습니다.`}
      </span>

      <button type="button" className="sr-only" onClick={() => void loadVisibleEvents()}>
        일정 새로고침
      </button>
    </div>
  );
}
