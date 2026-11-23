import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeMeasurementTrend } from './bodyTrends.ts';
import type { Measurement } from '../types/index.ts';

const NOW = new Date(2026, 10, 23, 12, 0, 0, 0).getTime();
const DAY = 86_400_000;

describe('computeMeasurementTrend', () => {
  it('returns null summary fields and empty series when no matching measurements exist', () => {
    const empty = computeMeasurementTrend([], 'weight', NOW);
    assert.deepEqual(empty, {
      latest: null,
      previous: null,
      deltaFromPrevious: null,
      delta30d: null,
      movingAvg7d: null,
      weeklyRate: null,
      series: [],
    });
  });

  it('computes trailing 7-day moving average, previous delta, 30d delta, and weekly rate', () => {
    const list: Measurement[] = [
      { id: '1', type: 'weight', value: 84, unit: 'kg', date: NOW - 14 * DAY },
      { id: '2', type: 'weight', value: 83, unit: 'kg', date: NOW - 7 * DAY },
      { id: '3', type: 'weight', value: 83.2, unit: 'kg', date: NOW - 3 * DAY },
      { id: '4', type: 'weight', value: 82, unit: 'kg', date: NOW },
      { id: '5', type: 'waist', value: 80, unit: 'cm', date: NOW },
    ];

    const res = computeMeasurementTrend(list, 'weight', NOW);

    assert.equal(res.series.length, 4);
    assert.equal(res.latest?.value, 82);
    assert.equal(res.previous?.value, 83.2);
    assert.equal(res.deltaFromPrevious, -1.2);
    assert.equal(res.delta30d, -2);
    // Trailing 7d points at NOW: 83 (at -7d), 83.2 (at -3d), 82 (at 0d) -> avg = 248.2 / 3 = 82.733 -> 82.7
    assert.equal(res.movingAvg7d, 82.7);
    // 14 days elapsed from 84 -> 82: (-2 / 14) * 7 = -1 kg/week
    assert.equal(res.weeklyRate, -1);
  });
});
