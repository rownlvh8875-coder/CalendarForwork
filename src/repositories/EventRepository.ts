import type { CalendarEvent, NewCalendarEvent } from '../domain/calendar';

export interface EventRepository {
  listBetween(startIso: string, endIso: string): Promise<CalendarEvent[]>;
  listUpcoming(fromIso: string, days: number): Promise<CalendarEvent[]>;
  create(input: NewCalendarEvent): Promise<CalendarEvent>;
  update(id: string, patch: Partial<NewCalendarEvent>): Promise<CalendarEvent>;
  remove(id: string): Promise<void>;
}
