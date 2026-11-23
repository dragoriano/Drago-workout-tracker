import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeStreaks, flattenPRs } from './analytics.ts';
import { PR, WorkoutSession } from '../types/index.ts';

function makeSession(daysAgo: number, prs: PR[] = [], idSuffix = '1'): WorkoutSession {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return {
    id: `sess-${daysAgo}-${idSuffix}`,
    programId: 'prog-1',
    dayId: 'day-1',
    date: d.getTime(),
    totalVolume: 1000,
    PRs: prs,
    duration: 1800,
    exercisesSnapshot: [],
  };
}

describe('computeStreaks', () => {
  it('returns zeroes for empty sessions', () => {
    assert.deepEqual(computeStreaks([]), { current: 0, longest: 0 });
  });

  it('counts current streak when latest session is today or yesterday', () => {
    assert.deepEqual(computeStreaks([makeSession(0)]), { current: 1, longest: 1 });
    assert.deepEqual(computeStreaks([makeSession(1)]), { current: 1, longest: 1 });
  });

  it('breaks current streak when latest session is 3+ days ago while preserving longest', () => {
    const sessions = [makeSession(3), makeSession(4), makeSession(5)];

    assert.deepEqual(computeStreaks(sessions), { current: 0, longest: 3 });
  });

  it('deduplicates multiple sessions on the same calendar day and tracks longest vs current', () => {
    const sessions = [
      makeSession(0, [], 'am'),
      makeSession(0, [], 'pm'),
      makeSession(1),
      // gap at day 2
      makeSession(4),
      makeSession(5),
      makeSession(6),
      makeSession(7),
    ];

    assert.deepEqual(computeStreaks(sessions), { current: 2, longest: 4 });
  });
});

describe('flattenPRs', () => {
  it('keeps only the highest PR per exercise and type, breaking ties by most recent date', () => {
    const olderLower = makeSession(5, [
      { exerciseId: 'e1', exerciseName: 'Squat', type: 'weight', value: 120, previousValue: 110 },
    ]);
    const olderTie = makeSession(3, [
      { exerciseId: 'e1', exerciseName: 'Squat', type: 'weight', value: 140, previousValue: 120 },
      { exerciseId: 'e2', exerciseName: 'Deadlift', type: 'weight', value: 180, previousValue: 170 },
    ]);
    const newerTie = makeSession(1, [
      { exerciseId: 'e1', exerciseName: 'Squat', type: 'weight', value: 140, previousValue: 140 },
    ]);

    const result = flattenPRs([olderLower, olderTie, newerTie]);

    assert.equal(result.length, 2);
    assert.equal(result[0].exerciseName, 'Squat');
    assert.equal(result[0].value, 140);
    assert.equal(result[0].date, newerTie.date);
    assert.equal(result[1].exerciseName, 'Deadlift');
    assert.equal(result[1].value, 180);
  });
});
