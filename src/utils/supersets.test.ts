import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Exercise } from '../types/index.ts';
import {
  cleanupOrphanSupersets,
  computeSupersetMap,
  getSupersetRoundProgress,
  resolveSupersetSetCompletion,
  toggleSupersetLink,
} from './supersets.ts';

function makeEx(
  id: string,
  overrides: Partial<Exercise> = {},
): Exercise {
  return {
    id,
    name: `Exercise ${id}`,
    notes: '',
    restTimerConfig: 90,
    lastUpdated: 1_700_000_000_000,
    history: [],
    sets: [
      { id: `${id}-s1`, weight: 50, reps: 10, completed: false, setType: 'working' },
      { id: `${id}-s2`, weight: 50, reps: 10, completed: false, setType: 'working' },
    ],
    ...overrides,
  };
}

describe('computeSupersetMap & getSupersetRoundProgress', () => {
  it('assigns A1/A2 for supersets and B1/B2/B3 for giant sets while ignoring singletons', () => {
    const exercises = [
      makeEx('1', { supersetId: 'g1', restTimerConfig: 60 }),
      makeEx('2', { supersetId: 'g1', restTimerConfig: 120 }),
      makeEx('3', { supersetId: 'orphan' }),
      makeEx('4', { supersetId: 'g2', restTimerConfig: 45 }),
      makeEx('5', { supersetId: 'g2', restTimerConfig: 60 }),
      makeEx('6', { supersetId: 'g2', restTimerConfig: 150 }),
    ];

    const map = computeSupersetMap(exercises);

    assert.equal(map.get('1')?.label, 'A1');
    assert.equal(map.get('1')?.kindLabel, 'Superset');
    assert.equal(map.get('1')?.sharedRestSeconds, 120);
    assert.equal(map.get('2')?.label, 'A2');
    assert.equal(map.get('2')?.isLast, true);
    assert.equal(map.get('3'), undefined);
    assert.equal(map.get('4')?.label, 'B1');
    assert.equal(map.get('4')?.kindLabel, 'Giant Set');
    assert.equal(map.get('6')?.label, 'B3');
    assert.equal(map.get('6')?.sharedRestSeconds, 150);
  });

  it('tracks completed and total working-set rounds accurately', () => {
    const g1 = makeEx('1', {
      supersetId: 'g',
      sets: [
        { id: 'w', weight: 20, reps: 10, completed: true, setType: 'warmup' },
        { id: '1a', weight: 50, reps: 10, completed: true },
        { id: '1b', weight: 50, reps: 10, completed: true },
      ],
    });
    const g2 = makeEx('2', {
      supersetId: 'g',
      sets: [
        { id: '2a', weight: 40, reps: 12, completed: true },
        { id: '2b', weight: 40, reps: 12, completed: false },
      ],
    });

    assert.deepEqual(getSupersetRoundProgress([g1, g2]), {
      completedRounds: 1,
      totalRounds: 2,
    });
  });
});

describe('toggleSupersetLink & cleanupOrphanSupersets', () => {
  it('links two exercises, extends to giant set, and splits cleanly on partial unlink', () => {
    let seq = 0;
    const nextId = () => `id-${++seq}`;
    const initial = [makeEx('e1'), makeEx('e2'), makeEx('e3'), makeEx('e4')];

    // Link e1 + e2 + e3 into a 3-exercise giant set
    const linked12 = toggleSupersetLink(initial, 1, nextId);
    const giant = toggleSupersetLink(linked12, 2, nextId);
    const gMap = computeSupersetMap(giant);
    assert.equal(gMap.get('e1')?.label, 'A1');
    assert.equal(gMap.get('e2')?.label, 'A2');
    assert.equal(gMap.get('e3')?.label, 'A3');
    assert.equal(gMap.get('e3')?.kindLabel, 'Giant Set');

    // Unlink between e2 and e3 -> e1+e2 stays Superset A, e3 becomes standalone!
    const splitTail = toggleSupersetLink(giant, 2, nextId);
    const splitMap = computeSupersetMap(splitTail);
    assert.equal(splitMap.get('e1')?.label, 'A1');
    assert.equal(splitMap.get('e2')?.label, 'A2');
    assert.equal(splitMap.get('e3'), undefined);
    assert.equal(splitTail[2].supersetId, undefined);
  });

  it('splits a 4-exercise giant set cleanly into two 2-exercise supersets', () => {
    let seq = 0;
    const nextId = () => `id-${++seq}`;
    const four = [
      makeEx('e1', { supersetId: 'g' }),
      makeEx('e2', { supersetId: 'g' }),
      makeEx('e3', { supersetId: 'g' }),
      makeEx('e4', { supersetId: 'g' }),
    ];

    const splitMid = toggleSupersetLink(four, 2, nextId);
    const map = computeSupersetMap(splitMid);
    assert.equal(map.get('e1')?.label, 'A1');
    assert.equal(map.get('e2')?.label, 'A2');
    assert.equal(map.get('e3')?.label, 'B1');
    assert.equal(map.get('e4')?.label, 'B2');
  });

  it('clears orphan supersets after deletion or reordering', () => {
    const cleaned = cleanupOrphanSupersets([
      makeEx('e1', { supersetId: 'g' }),
      makeEx('e2'),
      makeEx('e3', { supersetId: 'g' }),
    ]);
    assert.equal(cleaned[0].supersetId, undefined);
    assert.equal(cleaned[2].supersetId, undefined);
  });
});

describe('resolveSupersetSetCompletion', () => {
  it('auto-advances A1 -> A2 -> A3 without rest, then starts shared rest at round end', () => {
    const base = [
      makeEx('e1', {
        supersetId: 'g1',
        restTimerConfig: 45,
        sets: [
          { id: '1a', weight: 60, reps: 10, completed: true },
          { id: '1b', weight: 60, reps: 10, completed: false },
        ],
      }),
      makeEx('e2', {
        supersetId: 'g1',
        restTimerConfig: 60,
        sets: [
          { id: '2a', weight: 40, reps: 12, completed: false },
          { id: '2b', weight: 40, reps: 12, completed: false },
        ],
      }),
      makeEx('e3', {
        supersetId: 'g1',
        restTimerConfig: 120,
        sets: [
          { id: '3a', weight: 20, reps: 15, completed: false },
          { id: '3b', weight: 20, reps: 15, completed: false },
        ],
      }),
    ];

    // Finished A1 round 1 -> advance to A2, no rest
    const step1 = resolveSupersetSetCompletion(base, 'e1', '1a');
    assert.equal(step1.shouldStartRest, false);
    assert.equal(step1.nextExerciseId, 'e2');
    assert.equal(step1.nextLabel, 'A2');
    assert.equal(step1.roundCompleted, false);

    // Finished A2 round 1 -> advance to A3, no rest
    const after2 = base.map((ex) =>
      ex.id === 'e2'
        ? { ...ex, sets: ex.sets.map((s) => (s.id === '2a' ? { ...s, completed: true } : s)) }
        : ex,
    );
    const step2 = resolveSupersetSetCompletion(after2, 'e2', '2a');
    assert.equal(step2.shouldStartRest, false);
    assert.equal(step2.nextExerciseId, 'e3');
    assert.equal(step2.nextLabel, 'A3');

    // Finished A3 round 1 -> round complete, start shared rest (120s), queue A1 for round 2
    const after3 = after2.map((ex) =>
      ex.id === 'e3'
        ? { ...ex, sets: ex.sets.map((s) => (s.id === '3a' ? { ...s, completed: true } : s)) }
        : ex,
    );
    const step3 = resolveSupersetSetCompletion(after3, 'e3', '3a');
    assert.equal(step3.shouldStartRest, true);
    assert.equal(step3.restSeconds, 120);
    assert.equal(step3.roundCompleted, true);
    assert.equal(step3.roundNumber, 1);
    assert.equal(step3.totalRounds, 2);
    assert.equal(step3.nextExerciseId, 'e1');
    assert.equal(step3.nextLabel, 'A1');
  });

  it('handles out-of-order completion and warmup sets inside supersets', () => {
    const outOfOrder = [
      makeEx('e1', {
        supersetId: 'g1',
        restTimerConfig: 90,
        sets: [
          { id: 'w1', weight: 30, reps: 8, completed: true, setType: 'warmup' },
          { id: '1a', weight: 60, reps: 10, completed: false },
        ],
      }),
      makeEx('e2', {
        supersetId: 'g1',
        restTimerConfig: 120,
        sets: [{ id: '2a', weight: 40, reps: 10, completed: true }],
      }),
    ];

    const warmupOutcome = resolveSupersetSetCompletion(outOfOrder, 'e1', 'w1');
    assert.equal(warmupOutcome.shouldStartRest, true);
    assert.equal(warmupOutcome.restSeconds, 60);

    // Completed A2 before A1 -> cycles back to pending A1 without starting rest
    const jumpBack = resolveSupersetSetCompletion(outOfOrder, 'e2', '2a');
    assert.equal(jumpBack.shouldStartRest, false);
    assert.equal(jumpBack.nextExerciseId, 'e1');
    assert.equal(jumpBack.nextLabel, 'A1');
  });
});
