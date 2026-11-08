import { describe, expect, it } from 'vitest';
import {
  addDays,
  clamp,
  currentStreak,
  dateOnly,
  goalProgress,
  habitAdherence,
  habitXp,
  isScheduled,
  journeyScore,
  levelProgress,
  localDate,
  percent,
  projectProgress,
  ScoringEngine,
} from '@mirhal/domain';
const goal = { strategy: 'MANUAL', manualProgress: 40, numericValue: 10, numericTarget: 20 };
const schedule = {
  frequency: 'DAILY',
  weeklyTarget: 3,
  scheduleDays: [],
  startDate: dateOnly('2026-09-01'),
};
const engine = new ScoringEngine();
const scoreInput = {
  evidence: [
    { date: '2026-09-01', value: 5, xp: 20 },
    { date: '2026-09-02', value: 5, xp: 20 },
  ],
  expectedDays: 2,
  baseline: 10,
  target: 20,
  dailyCap: 100,
  lowerIsBetter: true,
};
describe('Progress has one source per strategy', () => {
  it('clamps unsafe and out-of-range values', () => {
    expect(clamp(NaN)).toBe(0);
    expect(clamp(150)).toBe(100);
    expect(clamp(-3)).toBe(0);
    expect(percent(10, 0)).toBe(0);
  });
  it('calculates manual, numeric, project, and milestone progress independently', () => {
    expect(goalProgress(goal)).toBe(40);
    expect(goalProgress({ ...goal, strategy: 'NUMERIC' })).toBe(50);
    expect(goalProgress({ ...goal, strategy: 'NUMERIC', numericTarget: null })).toBe(0);
    expect(
      goalProgress({
        ...goal,
        strategy: 'PROJECT',
        projects: [{ tasks: [{ status: 'COMPLETED' }, { status: 'ACTIVE' }] }],
      }),
    ).toBe(50);
    expect(goalProgress({ ...goal, strategy: 'PROJECT' })).toBe(0);
    expect(
      goalProgress({
        ...goal,
        strategy: 'MILESTONE',
        milestones: [{ completed: true }, { completed: false }],
      }),
    ).toBe(50);
    expect(goalProgress({ ...goal, strategy: 'MILESTONE' })).toBe(0);
    expect(projectProgress([{ status: 'ARCHIVED' }])).toBe(0);
  });
  it('shows transparent weighted contributions', () => {
    const result = journeyScore({
      habits: 100,
      goals: 100,
      quests: 100,
      checkIns: 100,
      projects: 100,
      recovery: 100,
    });
    expect(result.score).toBe(100);
    expect(result.contributions.reduce((sum, item) => sum + item.weight, 0)).toBeCloseTo(1);
  });
  it('retains lifetime level independently of spendable balance', () => {
    const levels = [
      { number: 1, minXp: 0, title: 'Start', titleAr: 'بداية' },
      { number: 2, minXp: 100, title: 'Grow', titleAr: 'نمو' },
    ];
    expect(levelProgress(50, levels).remaining).toBe(50);
    expect(levelProgress(150, levels).progress).toBe(100);
    expect(levelProgress(0, []).current).toBeUndefined();
    expect(levelProgress(-1, levels).current?.number).toBe(1);
  });
});
describe('Habits respect real schedules', () => {
  it('uses the user timezone at midnight boundaries', () => {
    expect(localDate(new Date('2026-09-25T23:30:00Z'), 'Africa/Cairo')).toBe('2026-09-26');
  });
  it('allows daily, weekly and selected days after the start date', () => {
    expect(isScheduled(schedule, dateOnly('2026-08-31'))).toBe(false);
    expect(isScheduled(schedule, dateOnly('2026-09-02'))).toBe(true);
    expect(
      isScheduled({ ...schedule, frequency: 'CUSTOM', scheduleDays: [2] }, dateOnly('2026-09-01')),
    ).toBe(true);
    expect(
      isScheduled({ ...schedule, frequency: 'CUSTOM', scheduleDays: [2] }, dateOnly('2026-09-02')),
    ).toBe(false);
  });
  it('calculates daily and weekly adherence without duplicate days', () => {
    const logs = [1, 2, 3].map((day) => ({ date: addDays(schedule.startDate, day - 1) }));
    expect(habitAdherence(schedule, logs, schedule.startDate, addDays(schedule.startDate, 5))).toBe(
      50,
    );
    expect(
      habitAdherence(
        { ...schedule, frequency: 'WEEKLY' },
        logs,
        schedule.startDate,
        addDays(schedule.startDate, 6),
      ),
    ).toBe(100);
    expect(habitAdherence(schedule, [], dateOnly('2026-08-01'), dateOnly('2026-08-02'))).toBe(0);
  });
  it('keeps yesterday’s streak available until today ends', () => {
    const logs = [1, 2, 3].map((day) => ({ date: addDays(schedule.startDate, day - 1) }));
    expect(currentStreak(schedule, logs, dateOnly('2026-09-04'))).toBe(3);
    expect(currentStreak(schedule, logs, dateOnly('2026-09-05'))).toBe(0);
    expect(
      currentStreak(
        { ...schedule, frequency: 'CUSTOM', scheduleDays: [2, 3, 4] },
        logs,
        dateOnly('2026-09-05'),
      ),
    ).toBe(3);
  });
  it('handles weekly streaks and minimum actions', () => {
    expect(currentStreak({ ...schedule, frequency: 'WEEKLY' }, [], dateOnly('2026-09-26'))).toBe(0);
    expect(
      currentStreak(
        { ...schedule, frequency: 'WEEKLY', weeklyTarget: 1 },
        [{ date: dateOnly('2026-09-22') }, { date: dateOnly('2026-09-15') }],
        dateOnly('2026-09-26'),
      ),
    ).toBe(2);
    expect(habitXp('EASY', true)).toBe(10);
    expect(habitXp('MEDIUM', false)).toBe(30);
    expect(habitXp('HARD', false)).toBe(40);
  });
});
describe('Challenge scoring is deterministic and separate from XP', () => {
  it.each([
    ['SCORE', 40],
    ['CONSISTENCY', 100],
    ['IMPROVEMENT', 50],
    ['TARGET', 50],
    ['STREAK', 2],
    ['COOPERATIVE', 50],
  ])('calculates %s', (mode, expected) => {
    expect(engine.calculate(String(mode), scoreInput).score).toBe(expected);
  });
  it('compares percentage improvement across different baselines fairly', () => {
    const a = engine.calculate('IMPROVEMENT', scoreInput);
    const b = engine.calculate('IMPROVEMENT', {
      ...scoreInput,
      baseline: 20,
      evidence: scoreInput.evidence.map((item) => ({ ...item, value: 10 })),
    });
    expect(a.score).toBe(b.score);
  });
  it('supports increasing targets and incomplete baselines safely', () => {
    expect(engine.calculate('IMPROVEMENT', { ...scoreInput, lowerIsBetter: false }).score).toBe(
      -50,
    );
    for (const baseline of [0, null])
      expect(engine.calculate('IMPROVEMENT', { ...scoreInput, baseline }).score).toBe(0);
    expect(engine.calculate('IMPROVEMENT', { ...scoreInput, evidence: [] }).score).toBe(0);
    expect(engine.calculate('IMPROVEMENT', { ...scoreInput, expectedDays: 0 }).score).toBe(0);
  });
  it('never treats missing observations as lower-is-better improvement', () => {
    expect(engine.calculate('IMPROVEMENT', { ...scoreInput, expectedDays: 7 }).score).toBe(0);
    expect(
      engine.calculate('IMPROVEMENT', {
        ...scoreInput,
        evidence: [scoreInput.evidence[0]!, scoreInput.evidence[0]!],
      }).score,
    ).toBe(0);
  });
  it('applies daily caps after aggregation', () => {
    expect(
      engine.calculate('SCORE', {
        ...scoreInput,
        dailyCap: 25,
        evidence: [scoreInput.evidence[0]!, scoreInput.evidence[0]!],
      }).score,
    ).toBe(25);
  });
  it('rejects invalid evidence and unknown algorithms', () => {
    expect(() => engine.calculate('BAD', scoreInput)).toThrow();
    expect(() => engine.calculate('SCORE', { ...scoreInput, target: 0 })).toThrow();
    expect(() =>
      engine.calculate('SCORE', {
        ...scoreInput,
        evidence: [{ date: '2026-01-01', value: -1, xp: 1 }],
      }),
    ).toThrow();
  });
  it('is stable regardless of evidence ordering', () => {
    expect(engine.calculate('STREAK', scoreInput)).toEqual(
      engine.calculate('STREAK', { ...scoreInput, evidence: [...scoreInput.evidence].reverse() }),
    );
  });
});
