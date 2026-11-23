import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeEffortSummary, computeStreaks, computeTopEstimated1RMs, flattenPRs } from './analytics.ts';
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

describe('computeTopEstimated1RMs', () => {
  it('aggregates top Epley 1RM per exercise across completed sets and sorts descending', () => {
    const oldSession: WorkoutSession = {
      ...makeSession(5, [], 'old'),
      exercisesSnapshot: [
        {
          id: 'e1',
          name: 'Barbell Squat',
          notes: '',
          sets: [
            { id: 's1', weight: 100, reps: 5, completed: true }, // 116.7
            { id: 's2', weight: 200, reps: 5, completed: false }, // ignored incomplete
          ],
          history: [],
          restTimerConfig: 120,
          lastUpdated: 1000,
        },
      ],
    };

    const newSession: WorkoutSession = {
      ...makeSession(1, [], 'new'),
      exercisesSnapshot: [
        {
          id: 'e1b',
          name: 'barbell squat ',
          notes: '',
          sets: [{ id: 's3', weight: 100, reps: 8, completed: true }], // 126.7
          history: [],
          restTimerConfig: 120,
          lastUpdated: 2000,
        },
        {
          id: 'e2',
          name: 'Deadlift',
          notes: '',
          sets: [{ id: 's4', weight: 150, reps: 5, completed: true }], // 175
          history: [],
          restTimerConfig: 180,
          lastUpdated: 2000,
        },
      ],
    };

    const benchmarks = computeTopEstimated1RMs([oldSession, newSession]);

    assert.equal(benchmarks.length, 2);
    assert.equal(benchmarks[0].exerciseName, 'Deadlift');
    assert.equal(benchmarks[0].e1rm, 175);
    assert.equal(benchmarks[1].exerciseName, 'barbell squat ');
    assert.equal(benchmarks[1].e1rm, 126.7);
    assert.equal(benchmarks[1].weight, 100);
    assert.equal(benchmarks[1].reps, 8);
  });

  it('ignores warmup sets when computing 1RM benchmarks', () => {
    const session: WorkoutSession = {
      ...makeSession(0, [], 'warm'),
      exercisesSnapshot: [
        {
          id: 'e1',
          name: 'Overhead Press',
          notes: '',
          sets: [
            { id: 'w1', weight: 90, reps: 5, completed: true, setType: 'warmup' },
            { id: 's1', weight: 60, reps: 5, completed: true, setType: 'working' },
          ],
          history: [],
          restTimerConfig: 90,
          lastUpdated: 1000,
        },
      ],
    };

    const benchmarks = computeTopEstimated1RMs([session]);
    assert.equal(benchmarks.length, 1);
    assert.equal(benchmarks[0].weight, 60);
    assert.equal(benchmarks[0].e1rm, 70);
  });
});

describe('computeEffortSummary', () => {
  it('returns null avgRpe and zeroes when empty', () => {
    assert.deepEqual(computeEffortSummary([]), {
      avgRpe: null,
      ratedSetsCount: 0,
      hardSetsCount: 0,
      failureSetsCount: 0,
      dropSetsCount: 0,
      warmupSetsCount: 0,
      workingSetsCount: 0,
    });
  });

  it('aggregates 7-day working effort stats and excludes warmups & stale sessions', () => {
    const recentSession: WorkoutSession = {
      ...makeSession(2, [], 'recent'),
      exercisesSnapshot: [
        {
          id: 'e1',
          name: 'Squat',
          notes: '',
          sets: [
            { id: 'w1', weight: 60, reps: 8, completed: true, setType: 'warmup', rpe: 6 },
            { id: 's1', weight: 100, reps: 5, completed: true, setType: 'working', rpe: 8 },
            { id: 's2', weight: 100, reps: 5, completed: true, setType: 'failure', rpe: 9.5 },
            { id: 's3', weight: 80, reps: 10, completed: true, setType: 'drop', rpe: 7.5 },
            { id: 's4', weight: 80, reps: 10, completed: false, setType: 'failure', rpe: 10 },
          ],
          history: [],
          restTimerConfig: 90,
          lastUpdated: 1000,
        },
      ],
    };

    const oldSession: WorkoutSession = {
      ...makeSession(10, [], 'old'),
      exercisesSnapshot: [
        {
          id: 'e2',
          name: 'Bench',
          notes: '',
          sets: [{ id: 'o1', weight: 90, reps: 5, completed: true, setType: 'failure', rpe: 10 }],
          history: [],
          restTimerConfig: 90,
          lastUpdated: 1000,
        },
      ],
    };

    const summary = computeEffortSummary([recentSession, oldSession], 7);
    // Completed non-warmup RPEs: 8, 9.5, 7.5 -> avg = 25 / 3 = 8.333 -> 8.3
    assert.deepEqual(summary, {
      avgRpe: 8.3,
      ratedSetsCount: 3,
      hardSetsCount: 2,
      failureSetsCount: 1,
      dropSetsCount: 1,
      warmupSetsCount: 1,
      workingSetsCount: 3,
    });
  });
});
