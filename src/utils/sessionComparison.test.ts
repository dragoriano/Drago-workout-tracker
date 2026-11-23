import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPRTimeline,
  compareSessions,
  findPreviousComparableSession,
  getPRTimelineExercises,
} from './sessionComparison.ts';
import type { WorkoutSession } from '../types/index.ts';

const BASE = 1_700_000_000_000;
const DAY = 86_400_000;

describe('findPreviousComparableSession & compareSessions', () => {
  const prevPush: WorkoutSession = {
    id: 's1',
    programId: 'p1',
    dayId: 'day-push',
    date: BASE,
    totalVolume: 2000,
    PRs: [{ exerciseId: 'e1', exerciseName: 'Bench Press', type: 'weight', value: 100, previousValue: 95 }],
    duration: 2400,
    exercisesSnapshot: [
      {
        id: 'e1',
        name: 'Bench Press',
        notes: '',
        restTimerConfig: 90,
        lastUpdated: BASE,
        history: [],
        sets: [
          { id: 'w1', weight: 150, reps: 5, completed: true, setType: 'warmup' },
          { id: 's1', weight: 100, reps: 5, completed: true, setType: 'working' }, // e1RM 116.7, vol 500
          { id: 's2', weight: 100, reps: 5, completed: true, setType: 'working' }, // vol 500
        ],
      },
      {
        id: 'e2',
        name: 'Overhead Press',
        notes: '',
        restTimerConfig: 90,
        lastUpdated: BASE,
        history: [],
        sets: [{ id: 's3', weight: 60, reps: 8, completed: true, setType: 'working' }], // e1RM 76, vol 480
      },
    ],
  };

  const unrelatedPull: WorkoutSession = {
    id: 's2',
    programId: 'p1',
    dayId: 'day-pull',
    date: BASE + DAY,
    totalVolume: 4000,
    PRs: [],
    duration: 2400,
    exercisesSnapshot: [],
  };

  const currPush: WorkoutSession = {
    id: 's3',
    programId: 'p1',
    dayId: 'day-push',
    date: BASE + 3 * DAY,
    totalVolume: 2300,
    PRs: [{ exerciseId: 'e1', exerciseName: 'Bench Press', type: 'weight', value: 102.5, previousValue: 100 }],
    duration: 2700,
    exercisesSnapshot: [
      {
        id: 'e1',
        name: 'bench press ',
        notes: '',
        restTimerConfig: 90,
        lastUpdated: BASE + 3 * DAY,
        history: [],
        sets: [
          { id: 'w2', weight: 40, reps: 10, completed: true, setType: 'warmup' },
          { id: 's4', weight: 102.5, reps: 5, completed: true, setType: 'working' }, // e1RM 119.6
          { id: 's5', weight: 102.5, reps: 5, completed: true, setType: 'working' },
        ],
      },
      {
        id: 'e2',
        name: 'Overhead Press',
        notes: '',
        restTimerConfig: 90,
        lastUpdated: BASE + 3 * DAY,
        history: [],
        sets: [{ id: 's6', weight: 60, reps: 6, completed: true, setType: 'working' }], // e1RM 72 -> regressed
      },
      {
        id: 'e3',
        name: 'Cable Fly',
        notes: '',
        restTimerConfig: 60,
        lastUpdated: BASE + 3 * DAY,
        history: [],
        sets: [{ id: 's7', weight: 20, reps: 12, completed: true, setType: 'working' }], // new
      },
    ],
  };

  it('finds matching previous program day and computes accurate deltas excluding warmups', () => {
    const found = findPreviousComparableSession(currPush, [prevPush, unrelatedPull, currPush]);
    assert.equal(found?.id, 's1');

    const diff = compareSessions(currPush, found);
    assert.ok(diff !== null);
    assert.equal(diff.volumeDelta, 300);
    assert.equal(diff.volumeDeltaPct, 15);
    assert.equal(diff.workingSetsPrevious, 3);
    assert.equal(diff.workingSetsCurrent, 4);
    assert.equal(diff.setsDelta, 1);
    assert.equal(diff.durationDeltaSec, 300);
    assert.equal(diff.improvedCount, 1);

    const benchDiff = diff.exerciseDiffs[0];
    assert.equal(benchDiff.status, 'improved');
    assert.equal(benchDiff.previousMaxWeight, 100);
    assert.equal(benchDiff.currentMaxWeight, 102.5);
    assert.equal(benchDiff.maxWeightDelta, 2.5);

    assert.equal(diff.exerciseDiffs[1].status, 'regressed');
    assert.equal(diff.exerciseDiffs[2].status, 'new');
  });

  it('matches prior freestyle sessions by workoutName or shared exercise fallback', () => {
    const fsOld: WorkoutSession = {
      id: 'fs1',
      programId: 'freestyle',
      dayId: 'freestyle',
      workoutName: 'Arm Blaster',
      date: BASE,
      totalVolume: 1000,
      PRs: [],
      duration: 1200,
      exercisesSnapshot: [],
    };
    const fsNew: WorkoutSession = {
      id: 'fs2',
      programId: 'freestyle',
      dayId: 'freestyle',
      workoutName: 'arm blaster ',
      date: BASE + DAY,
      totalVolume: 1200,
      PRs: [],
      duration: 1300,
      exercisesSnapshot: [],
    };

    assert.equal(findPreviousComparableSession(fsNew, [fsOld, unrelatedPull, fsNew])?.id, 'fs1');
  });
});

describe('buildPRTimeline & getPRTimelineExercises', () => {
  it('builds reverse-chronological milestones, marks peaks accurately, and supports filters', () => {
    const s1: WorkoutSession = {
      id: 's1',
      programId: 'p1',
      dayId: 'd1',
      date: BASE,
      totalVolume: 1000,
      duration: 1800,
      exercisesSnapshot: [],
      PRs: [
        { exerciseId: 'e1', exerciseName: 'Bench Press', type: 'weight', value: 100, previousValue: 90 },
        { exerciseId: 'e2', exerciseName: 'Squat', type: '1rm', value: 140, previousValue: 130 },
      ],
    };
    const s2: WorkoutSession = {
      id: 's2',
      programId: 'p1',
      dayId: 'd1',
      date: BASE + 2 * DAY,
      totalVolume: 1200,
      duration: 1800,
      exercisesSnapshot: [],
      PRs: [
        { exerciseId: 'e1', exerciseName: 'Bench Press', type: 'weight', value: 105, previousValue: 100 },
      ],
    };

    const all = buildPRTimeline([s2, s1]);
    assert.equal(all.length, 3);
    // Newest first
    assert.equal(all[0].value, 105);
    assert.equal(all[0].gain, 5);
    assert.equal(all[0].gainPct, 5);
    assert.equal(all[0].isLatestForExerciseType, true);

    const bench100 = all.find((e) => e.value === 100)!;
    assert.equal(bench100.isLatestForExerciseType, false);

    const filtered = buildPRTimeline([s1, s2], { exerciseFilter: 'bench press', typeFilter: 'weight' });
    assert.equal(filtered.length, 2);

    assert.deepEqual(getPRTimelineExercises([s1, s2]), ['Bench Press', 'Squat']);
  });
});
