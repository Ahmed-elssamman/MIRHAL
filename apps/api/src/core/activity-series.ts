import { addDays } from '@mirhal/domain';

export function buildActivitySeries(
  start: Date,
  periodDays: number,
  habits: { logs: { date: Date }[] }[],
  checkIns: { date: Date }[],
) {
  const habitCounts = new Map<string, number>();
  for (const habit of habits) {
    for (const log of habit.logs) {
      const date = log.date.toISOString().slice(0, 10);
      habitCounts.set(date, (habitCounts.get(date) ?? 0) + 1);
    }
  }
  const checkInDates = new Set(checkIns.map((checkIn) => checkIn.date.toISOString().slice(0, 10)));
  return Array.from({ length: periodDays }, (_, i) => {
    const date = addDays(start, i).toISOString().slice(0, 10);
    return { date, habits: habitCounts.get(date) ?? 0, checkIn: checkInDates.has(date) };
  });
}
