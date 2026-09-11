import type { CalendarEvent, NewCalendarEvent } from '../domain/calendar';
import type { EventRepository } from './EventRepository';

function cloneEvent(event: CalendarEvent): CalendarEvent {
  return { ...event };
}

function toDateKey(value: string): string {
  return value.slice(0, 10);
}

function addCalendarDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function createMemoryEventRepository(initialEvents: CalendarEvent[]): EventRepository {
  let events = initialEvents.map(cloneEvent);

  const listBetween = async (startIso: string, endIso: string): Promise<CalendarEvent[]> => {
    const startKey = toDateKey(startIso);
    const endKey = toDateKey(endIso);

    return events
      .filter((event) => {
        const eventKey = toDateKey(event.startAt);
        return eventKey >= startKey && eventKey <= endKey;
      })
      .map(cloneEvent);
  };

  return {
    listBetween,

    async listUpcoming(fromIso: string, days: number): Promise<CalendarEvent[]> {
      const fromKey = toDateKey(fromIso);
      const endKey = addCalendarDays(fromKey, Math.max(0, days));
      return listBetween(fromKey, endKey);
    },

    async listByProject(projectId: string): Promise<CalendarEvent[]> {
      return events
        .filter((event) => event.projectId === projectId)
        .sort((left, right) => {
          const startCompare = left.startAt.localeCompare(right.startAt);
          if (startCompare !== 0) return startCompare;
          const createdCompare = left.createdAt.localeCompare(right.createdAt);
          if (createdCompare !== 0) return createdCompare;
          return left.id.localeCompare(right.id);
        })
        .map(cloneEvent);
    },

    async create(input: NewCalendarEvent): Promise<CalendarEvent> {
      const now = new Date().toISOString();
      const event: CalendarEvent = {
        ...input,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      };

      events = [...events, event];
      return cloneEvent(event);
    },

    async update(id: string, patch: Partial<NewCalendarEvent>): Promise<CalendarEvent> {
      const index = events.findIndex((event) => event.id === id);
      if (index < 0) {
        throw new Error(`Event not found: ${id}`);
      }

      const current = events[index];
      const updated: CalendarEvent = {
        ...current,
        ...patch,
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      };

      events = events.map((event) => (event.id === id ? updated : event));
      return cloneEvent(updated);
    },

    async remove(id: string): Promise<void> {
      events = events.filter((event) => event.id !== id);
    },
  };
}
