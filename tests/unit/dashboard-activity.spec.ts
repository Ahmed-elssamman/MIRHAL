import { describe, expect, it } from 'vitest';
import { buildActivitySeries } from '../../apps/api/src/core/activity-series';

describe('dashboard activity series', () => {
  it('counts each habit log and marks check-in dates across the requested range', () => {
    const series = buildActivitySeries(
      new Date('2026-11-09T00:00:00.000Z'),
      3,
      [
        { logs: [{ date: new Date('2026-11-09T00:00:00.000Z') }] },
        {
          logs: [
            { date: new Date('2026-11-09T00:00:00.000Z') },
            { date: new Date('2026-11-11T00:00:00.000Z') },
          ],
        },
      ],
      [{ date: new Date('2026-11-10T00:00:00.000Z') }],
    );

    expect(series).toEqual([
      { date: '2026-11-09', habits: 2, checkIn: false },
      { date: '2026-11-10', habits: 0, checkIn: true },
      { date: '2026-11-11', habits: 1, checkIn: false },
    ]);
  });
});
