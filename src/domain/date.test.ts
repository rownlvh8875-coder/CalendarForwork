import { buildMonthGrid, getDeadlineLabel, toDateKey } from './date';

describe('calendar date rules', () => {
  test('builds a fixed six-week grid for September 2026', () => {
    const days = buildMonthGrid(2026, 8);

    expect(days).toHaveLength(42);
    expect(days[0].dateKey).toBe('2026-08-30');
    expect(days[2].dateKey).toBe('2026-09-01');
    expect(days[41].dateKey).toBe('2026-10-10');
    expect(days[2].isCurrentMonth).toBe(true);
    expect(days[0].isCurrentMonth).toBe(false);
  });

  test('uses local calendar dates for D-Day labels', () => {
    const now = new Date('2026-09-10T09:00:00+09:00');

    expect(getDeadlineLabel('2026-09-10T17:00:00+09:00', now)).toBe('D-Day');
    expect(getDeadlineLabel('2026-09-13T17:00:00+09:00', now)).toBe('D-3');
    expect(getDeadlineLabel('2026-09-09T17:00:00+09:00', now)).toBe('D+1');
    expect(getDeadlineLabel('2026-09-10T17:00:00+09:00', now, '2026-09-10T08:30:00+09:00')).toBeNull();
  });

  test('formats a date as a stable local date key', () => {
    expect(toDateKey(new Date(2026, 8, 3))).toBe('2026-09-03');
  });
});
