import type { CalendarDay } from './calendar';

const DAY_MS = 86_400_000;

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateKeyToUtcMs(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

export function buildMonthGrid(year: number, monthIndex: number, today = new Date()): CalendarDay[] {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const gridStart = new Date(year, monthIndex, 1 - firstOfMonth.getDay());
  const todayKey = toDateKey(today);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const dateKey = toDateKey(date);

    return {
      date,
      dateKey,
      dayOfMonth: date.getDate(),
      isCurrentMonth: date.getMonth() === monthIndex && date.getFullYear() === year,
      isToday: dateKey === todayKey,
    };
  });
}

export function getDeadlineLabel(
  deadlineAt: string,
  now: Date,
  completedAt?: string | null,
): string | null {
  if (completedAt) {
    return null;
  }

  const deadlineKey = deadlineAt.slice(0, 10);
  const nowKey = toDateKey(now);
  const dayDifference = Math.round((dateKeyToUtcMs(deadlineKey) - dateKeyToUtcMs(nowKey)) / DAY_MS);

  if (dayDifference === 0) {
    return 'D-Day';
  }

  if (dayDifference > 0) {
    return `D-${dayDifference}`;
  }

  return `D+${Math.abs(dayDifference)}`;
}
