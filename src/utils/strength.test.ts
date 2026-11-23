import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBarbellPlates,
  calculateEstimated1RM,
  DEFAULT_PLATES,
  getBestSet1RM,
  getTrainingPercentages,
} from './strength.ts';
import type { Set } from '../types/index.ts';

describe('calculateEstimated1RM', () => {
  it('returns 0 for invalid, zero, or negative weight/reps', () => {
    assert.equal(calculateEstimated1RM(0, 5), 0);
    assert.equal(calculateEstimated1RM(100, 0), 0);
    assert.equal(calculateEstimated1RM(-40, 8), 0);
    assert.equal(calculateEstimated1RM(Number.NaN, 5), 0);
  });

  it('returns exact weight for 1 rep and Epley 1RM rounded to 1 decimal for multi-rep sets', () => {
    assert.equal(calculateEstimated1RM(140, 1), 140);
    assert.equal(calculateEstimated1RM(100, 5), 116.7);
    assert.equal(calculateEstimated1RM(100, 10), 133.3);
  });
});

describe('getBestSet1RM', () => {
  it('ignores incomplete sets by default and finds highest e1RM when includeIncomplete is true', () => {
    const sets: Set[] = [
      { id: '1', weight: 100, reps: 5, completed: true },
      { id: '2', weight: 110, reps: 8, completed: false },
      { id: '3', weight: 90, reps: 10, completed: true },
    ];

    const completedBest = getBestSet1RM(sets);
    const anyBest = getBestSet1RM(sets, true);

    assert.deepEqual(completedBest, { e1rm: 120, weight: 90, reps: 10 });
    assert.deepEqual(anyBest, { e1rm: 139.3, weight: 110, reps: 8 });
  });
});

describe('getTrainingPercentages', () => {
  it('returns empty array for non-positive 1RM and 6 rounded percentage tiers otherwise', () => {
    assert.deepEqual(getTrainingPercentages(0), []);
    const tiers = getTrainingPercentages(100);
    assert.equal(tiers.length, 6);
    assert.deepEqual(tiers[0], { percent: 95, weight: 95, repsHint: '~2 reps' });
    assert.deepEqual(tiers[5], { percent: 70, weight: 70, repsHint: '~12 reps' });
  });
});

describe('calculateBarbellPlates', () => {
  it('computes exact kg plates per side including fractional 1.25 kg plates', () => {
    const res100 = calculateBarbellPlates(100, 20, DEFAULT_PLATES.kg);
    assert.equal(res100.isExact, true);
    assert.equal(res100.achievableWeight, 100);
    assert.equal(res100.perSideWeight, 40);
    assert.deepEqual(res100.platesPerSide, [
      { weight: 25, count: 1 },
      { weight: 15, count: 1 },
    ]);

    const res625 = calculateBarbellPlates(62.5, 20, DEFAULT_PLATES.kg);
    assert.equal(res625.isExact, true);
    assert.equal(res625.achievableWeight, 62.5);
    assert.deepEqual(res625.platesPerSide, [
      { weight: 20, count: 1 },
      { weight: 1.25, count: 1 },
    ]);
  });

  it('computes exact lbs load (225 lbs on 45 lb bar)', () => {
    const res = calculateBarbellPlates(225, 45, DEFAULT_PLATES.lbs);
    assert.equal(res.isExact, true);
    assert.equal(res.perSideWeight, 90);
    assert.deepEqual(res.platesPerSide, [{ weight: 45, count: 2 }]);
  });

  it('reports closest achievable load when target cannot be built exactly', () => {
    const res = calculateBarbellPlates(63, 20, DEFAULT_PLATES.kg);
    assert.equal(res.isExact, false);
    assert.equal(res.achievableWeight, 62.5);
    assert.equal(res.remainderPerSide, 0.25);
  });

  it('handles target equal to or below barbell weight', () => {
    const exactBar = calculateBarbellPlates(20, 20, DEFAULT_PLATES.kg);
    const belowBar = calculateBarbellPlates(15, 20, DEFAULT_PLATES.kg);

    assert.equal(exactBar.isExact, true);
    assert.deepEqual(exactBar.platesPerSide, []);
    assert.equal(belowBar.isExact, false);
    assert.equal(belowBar.achievableWeight, 20);
  });

  it('adapts when custom gym inventory excludes heavy plates', () => {
    const without25s = DEFAULT_PLATES.kg.filter((p) => p !== 25);
    const res = calculateBarbellPlates(100, 20, without25s);
    assert.equal(res.isExact, true);
    assert.deepEqual(res.platesPerSide, [{ weight: 20, count: 2 }]);
  });
});
