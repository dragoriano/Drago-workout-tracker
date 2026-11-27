import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeExerciseHistoricalBenchmarks,
  evaluateLiveSetPR,
  getExerciseLivePRSetMap,
  getRecentExerciseSessions,
} from './liveSessionPR';
import type { Exercise, Set } from '../types';

function makeSet(overrides: Partial<Set> & Pick<Set, 'id'>): Set {
  return {
    weight: 0,
    reps: 0,
    completed: true,
    ...overrides,
  };
}

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'ex-1',
    name: 'Barbell Flat Standard Bench Press',
    notes: '',
    sets: [],
    history: [],
    restTimerConfig: 90,
    lastUpdated: 0,
    ...overrides,
  };
}

describe('evaluateLiveSetPR & computeExerciseHistoricalBenchmarks', () => {
  it('returns null when history is empty, set is incomplete, or set is warmup', () => {
    const noHistory = makeExercise({
      sets: [makeSet({ id: 's1', weight: 100, reps: 5, completed: true })],
    });
    assert.equal(evaluateLiveSetPR(noHistory, noHistory.sets[0], 'kg'), null);

    const withHistory = makeExercise({
      history: [
        {
          sessionId: 'h1',
          date: 1000,
          sets: [makeSet({ id: 'hs1', weight: 80, reps: 8, completed: true })],
        },
      ],
      sets: [
        makeSet({ id: 'w1', weight: 120, reps: 5, setType: 'warmup', completed: true }),
        makeSet({ id: 'inc1', weight: 120, reps: 5, completed: false }),
      ],
    });
    assert.equal(evaluateLiveSetPR(withHistory, withHistory.sets[0], 'kg'), null);
    assert.equal(evaluateLiveSetPR(withHistory, withHistory.sets[1], 'kg'), null);
  });

  it('detects weight PR alongside simultaneous Est. 1RM and Volume secondary tags', () => {
    const ex = makeExercise({
      history: [
        {
          sessionId: 'h1',
          date: 1000,
          sets: [makeSet({ id: 'hs1', weight: 85, reps: 8, completed: true })],
        },
      ],
      sets: [makeSet({ id: 's1', weight: 90, reps: 8, completed: true })],
    });

    const hit = evaluateLiveSetPR(ex, ex.sets[0], 'kg');
    assert.ok(hit);
    assert.equal(hit.kind, 'weight');
    assert.equal(hit.shortTag, 'WT PR');
    assert.equal(hit.valueLabel, '90 kg');
    assert.equal(hit.deltaLabel, '+5 kg');
    assert.ok(hit.secondaryTags.includes('Est. 1RM PR'));
    assert.ok(hit.secondaryTags.includes('Set Volume PR'));
  });

  it('detects pure Est. 1RM PR when matching previous weight for more reps', () => {
    const ex = makeExercise({
      history: [
        {
          sessionId: 'h1',
          date: 1000,
          sets: [makeSet({ id: 'hs1', weight: 85, reps: 8, completed: true })],
        },
      ],
      sets: [makeSet({ id: 's1', weight: 85, reps: 10, completed: true })],
    });

    const hit = evaluateLiveSetPR(ex, ex.sets[0], 'kg');
    assert.ok(hit);
    assert.equal(hit.kind, '1rm');
    assert.equal(hit.shortTag, '1RM PR');
    assert.ok(hit.secondaryTags.includes('Set Volume PR'));
  });

  it('supports bodyweight reps PRs and timed hold PRs', () => {
    const bw = makeExercise({
      name: 'Pull-Up',
      trackingMode: 'bodyweight_reps',
      history: [
        {
          sessionId: 'h1',
          date: 1000,
          sets: [makeSet({ id: 'hs1', weight: 0, reps: 10, completed: true })],
        },
      ],
      sets: [makeSet({ id: 's1', weight: 0, reps: 13, completed: true })],
    });
    const bwHit = evaluateLiveSetPR(bw, bw.sets[0], 'kg');
    assert.equal(bwHit?.kind, 'reps');
    assert.equal(bwHit?.deltaLabel, '+3 reps');

    const plank = makeExercise({
      name: 'Forearm Plank',
      trackingMode: 'timed',
      history: [
        {
          sessionId: 'h1',
          date: 1000,
          sets: [makeSet({ id: 'hs1', weight: 0, reps: 1, duration: 60, completed: true })],
        },
      ],
      sets: [makeSet({ id: 's1', weight: 0, reps: 1, duration: 75, completed: true })],
    });
    const plankHit = evaluateLiveSetPR(plank, plank.sets[0], 'kg');
    assert.equal(plankHit?.kind, 'duration');
    assert.equal(plankHit?.shortTag, 'HOLD PR');
    assert.equal(plankHit?.deltaLabel, '+15s');
  });

  it('handles sequential sets cleanly: progressive Set 2 upgrades PR while lighter Set 3 does not', () => {
    const ex = makeExercise({
      history: [
        {
          sessionId: 'h1',
          date: 1000,
          sets: [makeSet({ id: 'hs1', weight: 80, reps: 8, completed: true })],
        },
      ],
      sets: [
        makeSet({ id: 's1', weight: 85, reps: 8, completed: true }),
        makeSet({ id: 's2', weight: 90, reps: 8, completed: true }),
        makeSet({ id: 's3', weight: 85, reps: 6, completed: true }),
      ],
    });

    const prMap = getExerciseLivePRSetMap(ex, 'kg');
    assert.equal(prMap.get('s1')?.valueLabel, '85 kg');
    assert.equal(prMap.get('s2')?.valueLabel, '90 kg');
    assert.equal(prMap.has('s3'), false);

    const bench = computeExerciseHistoricalBenchmarks(ex);
    assert.equal(bench.bestWeight, 80);
  });
});

describe('getRecentExerciseSessions', () => {
  it('returns newest-first up to 3 sessions with accurate working sets and volume delta', () => {
    const ex = makeExercise({
      history: [
        { sessionId: 's1', date: 1000, sets: [makeSet({ id: 'a1', weight: 70, reps: 10 })] }, // 700
        { sessionId: 's2', date: 2000, sets: [makeSet({ id: 'a2', weight: 80, reps: 10 })] }, // 800
        { sessionId: 's3', date: 3000, sets: [makeSet({ id: 'a3', weight: 85, reps: 10 })] }, // 850
        { sessionId: 's4', date: 4000, sets: [makeSet({ id: 'a4', weight: 100, reps: 10 })] }, // 1000
      ],
    });

    const recent = getRecentExerciseSessions(ex, 'kg', 3);
    assert.equal(recent.length, 3);
    assert.equal(recent[0].sessionId, 's4');
    assert.equal(recent[0].totalVolume, 1000);
    assert.equal(recent[0].volumeDeltaPct, 18); // (1000 - 850) / 850 ≈ 17.6%
    assert.equal(recent[2].sessionId, 's2');
    assert.equal(recent[2].volumeDeltaPct, 14); // (800 - 700) / 700 ≈ 14.3%
  });
});
