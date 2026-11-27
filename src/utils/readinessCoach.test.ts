import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeReadiness7dAverage,
  computeReadinessScore,
  evaluateReadinessPrescription,
  getTodayReadinessCheckin,
  scaleExerciseSetsForReadiness,
} from './readinessCoach.ts';
import type { Exercise, ReadinessCheckin } from '../types/index.ts';

const NOW = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;

describe('computeReadinessScore & evaluateReadinessPrescription', () => {
  it('computes 0-100 weighted readiness scores and classifies tiers cleanly', () => {
    assert.equal(computeReadinessScore({ sleep: 5, energy: 5, soreness: 5, stress: 5 }), 100);
    assert.equal(computeReadinessScore({ sleep: 1, energy: 1, soreness: 1, stress: 1 }), 0);

    const mid = computeReadinessScore({ sleep: 3, energy: 3, soreness: 3, stress: 3 });
    assert.equal(mid, 50);

    const low = evaluateReadinessPrescription({ score: 30 });
    assert.equal(low?.tier, 'low');
    assert.equal(low?.loadAdjustmentPct, -10);
    assert.equal(low?.setAdjustment, -1);

    const prime = evaluateReadinessPrescription({ score: 90 });
    assert.equal(prime?.tier, 'prime');
    assert.equal(prime?.loadAdjustmentPct, 2.5);
  });

  it('finds today checkin and computes 7-day average', () => {
    const checkins: ReadinessCheckin[] = [
      { id: 'c1', date: NOW - 10 * DAY_MS, sleep: 1, energy: 1, soreness: 1, stress: 1, score: 10 },
      { id: 'c2', date: NOW - 2 * DAY_MS, sleep: 4, energy: 4, soreness: 4, stress: 4, score: 75 },
      { id: 'c3', date: NOW - 1000, sleep: 5, energy: 5, soreness: 4, stress: 4, score: 89 },
    ];

    const today = getTodayReadinessCheckin(checkins, NOW);
    assert.equal(today?.id, 'c3');
    assert.equal(computeReadiness7dAverage(checkins, NOW), 82);
  });
});

describe('scaleExerciseSetsForReadiness', () => {
  it('scales uncompleted working sets to nearest 0.5 while preserving warmups and completed sets', () => {
    const exercises: Exercise[] = [
      {
        id: 'ex1',
        name: 'Barbell Squat',
        notes: '',
        history: [],
        restTimerConfig: 120,
        lastUpdated: NOW,
        sets: [
          { id: 'w1', weight: 60, reps: 5, completed: false, setType: 'warmup' },
          { id: 's1', weight: 100, reps: 5, completed: true, setType: 'working' },
          { id: 's2', weight: 100, reps: 5, completed: false, setType: 'working' },
          { id: 's3', weight: 100, reps: 5, completed: false, setType: 'working' },
        ],
      },
    ];

    const scaled = scaleExerciseSetsForReadiness(exercises, -10, -1);
    assert.equal(scaled[0].sets.length, 3); // 1 working set trimmed
    assert.equal(scaled[0].sets[0].weight, 60); // warmup untouched
    assert.equal(scaled[0].sets[1].weight, 100); // completed untouched
    assert.equal(scaled[0].sets[2].weight, 90); // -10% on uncompleted working set
  });
});
