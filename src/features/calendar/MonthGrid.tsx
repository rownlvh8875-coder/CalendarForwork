import type { CalendarDay, CalendarEvent, EventPriority } from '../../domain/calendar';
import { getDeadlineLabel } from '../../domain/date';

const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
const priorityWeight: Record<EventPriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
};

interface MonthGridProps {
  days: CalendarDay[];
  events: CalendarEvent[];
  now: Date;
  onSelectEvent?: (event: CalendarEvent) => void;
  onSelectDay?: (dateKey: string) => void;
  onShowMore?: (dateKey: string) => void;
}

function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1;
    }

    const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return a.startAt.localeCompare(b.startAt);
  });
}

export function MonthGrid({ days, events, now, onSelectEvent, onSelectDay, onShowMore }: MonthGridProps) {
  const eventsByDate = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const dateKey = event.startAt.slice(0, 10);
    const existing = eventsByDate.get(dateKey) ?? [];
    existing.push(event);
    eventsByDate.set(dateKey, existing);
  }

  return (
    <div className="month-grid-shell">
      <div className="weekday-row" aria-hidden="true">
        {weekdays.map((weekday, index) => (
          <span key={weekday} className={index === 0 ? 'is-sunday' : index === 6 ? 'is-saturday' : ''}>
            {weekday}
          </span>
        ))}
      </div>

      <div className="month-grid" role="grid" aria-label="월간 일정">
        {days.map((day) => {
          const dayEvents = sortEvents(eventsByDate.get(day.dateKey) ?? []);
          const visibleEvents = dayEvents.slice(0, 3);
          const hiddenCount = Math.max(0, dayEvents.length - visibleEvents.length);

          return (
            <div
              key={day.dateKey}
              className={`month-day${day.isCurrentMonth ? '' : ' is-outside'}${day.isToday ? ' is-today' : ''}`}
              role="gridcell"
              aria-label={day.dateKey}
              onDoubleClick={() => onSelectDay?.(day.dateKey)}
            >
              <div className="day-header">
                <span className="day-number">{day.dayOfMonth}</span>
                {day.isToday ? <span className="today-label">오늘</span> : null}
              </div>

              <div className="day-events">
                {visibleEvents.map((event) => {
                  const deadlineLabel = event.deadlineAt
                    ? getDeadlineLabel(event.deadlineAt, now, event.completedAt)
                    : null;

                  return (
                    <button
                      key={event.id}
                      type="button"
                      className={`event-chip priority-${event.priority}`}
                      data-category={event.categoryKey}
                      aria-label={`일정: ${event.title}`}
                      onClick={() => onSelectEvent?.(event)}
                    >
                      <span className="event-color" aria-hidden="true" />
                      <span className="event-title">{event.title}</span>
                      {deadlineLabel ? <span className="deadline-chip">{deadlineLabel}</span> : null}
                    </button>
                  );
                })}

                {hiddenCount > 0 ? (
                  <button
                    type="button"
                    className="more-events-button"
                    aria-label={`${hiddenCount}개 일정 더보기`}
                    onClick={() => onShowMore?.(day.dateKey)}
                  >
                    +{hiddenCount}개 더보기
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
