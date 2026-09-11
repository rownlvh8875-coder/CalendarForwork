import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import type { CalendarEvent, NewCalendarEvent } from '../domain/calendar';
import type { EventRepository } from './EventRepository';

export type InvokeFn = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

function withoutMetadata(event: CalendarEvent): NewCalendarEvent {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = event;
  return input;
}

export function createTauriEventRepository(invokeFn: InvokeFn = tauriInvoke): EventRepository {
  return {
    listBetween(startIso: string, endIso: string): Promise<CalendarEvent[]> {
      return invokeFn<CalendarEvent[]>('events_list_between', { startIso, endIso });
    },

    listUpcoming(fromIso: string, days: number): Promise<CalendarEvent[]> {
      return invokeFn<CalendarEvent[]>('events_list_upcoming', { fromIso, days });
    },

    listByProject(projectId: string): Promise<CalendarEvent[]> {
      return invokeFn<CalendarEvent[]>('events_list_by_project', { projectId });
    },

    create(event: NewCalendarEvent): Promise<CalendarEvent> {
      return invokeFn<CalendarEvent>('events_create', { event });
    },

    async update(id: string, patch: Partial<NewCalendarEvent>): Promise<CalendarEvent> {
      const current = await invokeFn<CalendarEvent | null>('events_get', { id });
      if (!current) {
        throw new Error(`Event not found: ${id}`);
      }

      const event: NewCalendarEvent = {
        ...withoutMetadata(current),
        ...patch,
      };
      return invokeFn<CalendarEvent>('events_replace', { id, event });
    },

    remove(id: string): Promise<void> {
      return invokeFn<void>('events_remove', { id });
    },
  };
}
