import { describe, expect, it } from 'vitest';
import { dateOnly, needsRecovery, repeatedMisses } from '@mirhal/domain';

const schedule = {
  frequency: 'DAILY',
  weeklyTarget: 3,
  scheduleDays: [],
  startDate: dateOnly('2026-09-01'),
};
const logs = (...days: string[]) => days.map((day) => ({ date: dateOnly(day) }));
describe('Recovery respects the commitment a person actually made', () => {
  it('does not call a new habit, future habit, or completed day a missed commitment', () => {
    expect(needsRecovery(schedule, [], dateOnly('2026-09-01'))).toBe(false);
    expect(needsRecovery(schedule, [], dateOnly('2026-08-31'))).toBe(false);
    expect(needsRecovery(schedule, logs('2026-09-26'), dateOnly('2026-09-26'))).toBe(false);
  });
  it('offers a fresh start after a missed scheduled day', () => {
    expect(needsRecovery(schedule, [], dateOnly('2026-09-26'))).toBe(true);
    expect(needsRecovery(schedule, logs('2026-09-25'), dateOnly('2026-09-26'))).toBe(false);
  });
  it('skips custom rest days and checks the previous selected day', () => {
    const custom = { ...schedule, frequency: 'CUSTOM', scheduleDays: [1, 5] };
    expect(needsRecovery(custom, [], dateOnly('2026-09-26'))).toBe(false);
    expect(needsRecovery(custom, logs('2026-09-21'), dateOnly('2026-09-25'))).toBe(false);
    expect(needsRecovery(custom, [], dateOnly('2026-09-25'))).toBe(true);
    expect(
      needsRecovery({ ...custom, startDate: dateOnly('2026-09-24') }, [], dateOnly('2026-09-25')),
    ).toBe(false);
  });
  it('judges a weekly commitment after a full week and deduplicates dates', () => {
    const weekly = { ...schedule, frequency: 'WEEKLY' };
    expect(needsRecovery(weekly, [], dateOnly('2026-09-07'))).toBe(false);
    expect(
      needsRecovery(weekly, logs('2026-09-14', '2026-09-16', '2026-09-19'), dateOnly('2026-09-26')),
    ).toBe(false);
    expect(
      needsRecovery(weekly, logs('2026-09-14', '2026-09-14', '2026-09-16'), dateOnly('2026-09-26')),
    ).toBe(true);
  });
  it('notices two misses among three previous scheduled days but respects rest days', () => {
    const today = dateOnly('2026-09-26');
    expect(repeatedMisses(schedule, logs('2026-09-25'), today)).toBe(true);
    expect(repeatedMisses(schedule, logs('2026-09-25', '2026-09-24'), today)).toBe(false);
    expect(repeatedMisses({ ...schedule, startDate: dateOnly('2026-09-25') }, [], today)).toBe(
      false,
    );
    const custom = { ...schedule, frequency: 'CUSTOM', scheduleDays: [1, 5] };
    expect(repeatedMisses(custom, logs('2026-09-25'), today)).toBe(true);
  });
  it('notices repeated missed full weeks and leaves a new weekly habit alone', () => {
    const weekly = { ...schedule, frequency: 'WEEKLY', weeklyTarget: 3 };
    expect(
      repeatedMisses(
        weekly,
        logs('2026-09-14', '2026-09-15', '2026-09-16'),
        dateOnly('2026-09-28'),
      ),
    ).toBe(true);
    expect(
      repeatedMisses({ ...weekly, startDate: dateOnly('2026-09-15') }, [], dateOnly('2026-09-28')),
    ).toBe(false);
  });
});
