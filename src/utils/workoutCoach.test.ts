import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeOverloadSpikePercent,
  computeSmartSets,
  detectSessionPRs,
  estimateWorkoutDurationMinutes,
} from './workoutCoach.ts';
import { AppSettings, Exercise, Set, WorkoutDay, WorkoutSession } from '../types/index.ts';

const BASE_SETTINGS: AppSettings = {
  theme: 'dark',
  themeColor: 'indigo',
  smartSuggestions: true,
  overloadWarnings: true,
  autoDeload: true,
  soundEnabled: true,
  vibrateOnComplete: true,
  voiceCountdownEnabled: false,
  syncEnabled: false,
  weightUnit: 'kg',
};

function makeSets(weight: number, reps: number, completed: boolean, count = 3): Set[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `set-${idx}`,
    weight,
    reps,
    completed,
  }));
}

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'ex-1',
    name: 'Barbell Flat Standard Bench Press',
    notes: '',
    sets: makeSets(60, 8, true, 3),
    history: [],
    restTimerConfig: 90,
    lastUpdated: 1_700_000_000_000,
    ...overrides,
  };
}

describe('computeSmartSets', () => {
  it('resets completed status on first session with no history', () => {
    const exercise = makeExercise({ sets: makeSets(50, 10, true, 2), history: [] });

    const result = computeSmartSets(exercise, false, BASE_SETTINGS);

    assert.equal(result.length, 2);
    assert.deepEqual(
      result.map((s) => ({ weight: s.weight, reps: s.reps, completed: s.completed })),
      [
        { weight: 50, reps: 10, completed: false },
        { weight: 50, reps: 10, completed: false },
      ],
    );
  });

  it('scales last session weight to 60% rounded to nearest 0.5 on deload day', () => {
    const exercise = makeExercise({
      sets: makeSets(0, 8, false, 2),
      history: [
        { sessionId: 's1', date: 1000, sets: makeSets(83, 8, true, 2) },
      ],
    });

    const result = computeSmartSets(exercise, true, BASE_SETTINGS);

    // 83 * 0.6 = 49.8 -> nearest 0.5 = 50
    assert.deepEqual(result.map((s) => s.weight), [50, 50]);
    assert.ok(result.every((s) => s.completed === false));
  });

  it('adds +2.5 overload after 2 consecutive completed sessions when smartSuggestions is enabled', () => {
    const exercise = makeExercise({
      sets: makeSets(60, 8, false, 3),
      history: [
        { sessionId: 's1', date: 1000, sets: makeSets(80, 8, true, 3) },
        { sessionId: 's2', date: 2000, sets: makeSets(80, 8, true, 3) },
      ],
    });

    const result = computeSmartSets(exercise, false, BASE_SETTINGS);

    assert.deepEqual(result.map((s) => s.weight), [82.5, 82.5, 82.5]);
  });

  it('holds weight when smartSuggestions is disabled or only 1 consecutive success exists', () => {
    const twoWins = makeExercise({
      sets: makeSets(60, 8, false, 2),
      history: [
        { sessionId: 's1', date: 1000, sets: makeSets(80, 8, true, 2) },
        { sessionId: 's2', date: 2000, sets: makeSets(80, 8, true, 2) },
      ],
    });
    const oneWin = makeExercise({
      sets: makeSets(60, 8, false, 2),
      history: [{ sessionId: 's1', date: 1000, sets: makeSets(80, 8, true, 2) }],
    });

    const disabledResult = computeSmartSets(twoWins, false, {
      ...BASE_SETTINGS,
      smartSuggestions: false,
    });
    const oneWinResult = computeSmartSets(oneWin, false, BASE_SETTINGS);

    assert.deepEqual(disabledResult.map((s) => s.weight), [80, 80]);
    assert.deepEqual(oneWinResult.map((s) => s.weight), [80, 80]);
  });

  it('keeps current weight after 1 failed session', () => {
    const exercise = makeExercise({
      sets: makeSets(0, 8, false, 2),
      history: [
        { sessionId: 's1', date: 1000, sets: makeSets(100, 8, true, 2) },
        {
          sessionId: 's2',
          date: 2000,
          sets: [
            { id: 'a', weight: 100, reps: 8, completed: true },
            { id: 'b', weight: 100, reps: 6, completed: false },
          ],
        },
      ],
    });

    const result = computeSmartSets(exercise, false, BASE_SETTINGS);

    assert.deepEqual(result.map((s) => s.weight), [100, 100]);
  });

  it('auto-deloads -10% after 2 consecutive fails and -15% after 3 fails when autoDeload is enabled', () => {
    const failSets = [
      { id: 'a', weight: 100, reps: 8, completed: true },
      { id: 'b', weight: 100, reps: 5, completed: false },
    ];
    const twoFails = makeExercise({
      sets: makeSets(0, 8, false, 2),
      history: [
        { sessionId: 's1', date: 1000, sets: failSets },
        { sessionId: 's2', date: 2000, sets: failSets },
      ],
    });
    const threeFails = makeExercise({
      sets: makeSets(0, 8, false, 2),
      history: [
        { sessionId: 's1', date: 1000, sets: failSets },
        { sessionId: 's2', date: 2000, sets: failSets },
        { sessionId: 's3', date: 3000, sets: failSets },
      ],
    });

    const resultTwo = computeSmartSets(twoFails, false, BASE_SETTINGS);
    const resultThree = computeSmartSets(threeFails, false, BASE_SETTINGS);
    const resultDisabled = computeSmartSets(threeFails, false, {
      ...BASE_SETTINGS,
      autoDeload: false,
    });

    assert.deepEqual(resultTwo.map((s) => s.weight), [90, 90]);
    assert.deepEqual(resultThree.map((s) => s.weight), [85, 85]);
    assert.deepEqual(resultDisabled.map((s) => s.weight), [100, 100]);
  });
});

describe('estimateWorkoutDurationMinutes', () => {
  it('returns null for null or empty workout day', () => {
    assert.equal(estimateWorkoutDurationMinutes(null), null);
    assert.equal(
      estimateWorkoutDurationMinutes({ id: 'd1', name: 'Empty', order: 0, exercises: [] }),
      null,
    );
  });

  it('computes scaled duration range rounded to 5 minutes', () => {
    const shortDay: WorkoutDay = {
      id: 'd1',
      name: 'HIT',
      order: 0,
      exercises: [makeExercise({ sets: makeSets(60, 8, false, 1), restTimerConfig: 60 })],
    };
    const longDay: WorkoutDay = {
      id: 'd2',
      name: 'Volume',
      order: 0,
      exercises: Array.from({ length: 6 }, (_, i) =>
        makeExercise({ id: `e${i}`, sets: makeSets(60, 10, false, 4), restTimerConfig: 120 }),
      ),
    };

    const shortEst = estimateWorkoutDurationMinutes(shortDay);
    const longEst = estimateWorkoutDurationMinutes(longDay);

    assert.ok(shortEst !== null);
    assert.ok(longEst !== null);
    assert.equal(shortEst.min % 5, 0);
    assert.equal(shortEst.max % 5, 0);
    assert.ok(shortEst.min >= 10 && shortEst.max >= shortEst.min + 5);
    assert.ok(longEst.min > shortEst.max);
  });
});

describe('detectSessionPRs', () => {
  it('sums only completed sets and detects weight PRs and 1RM PRs independently', () => {
    const exercises: Exercise[] = [
      makeExercise({
        id: 'bench',
        name: 'Bench Press',
        sets: [
          { id: '1', weight: 100, reps: 5, completed: true },
          { id: '2', weight: 105, reps: 3, completed: true }, // Weight PR (105 > 100), e1RM 115.5 < 116.7
          { id: '3', weight: 110, reps: 1, completed: false },
        ],
        history: [{ sessionId: 'prev', date: 1000, sets: makeSets(100, 5, true, 3) }],
      }),
      makeExercise({
        id: 'squat',
        name: 'Barbell Squat',
        sets: [{ id: '4', weight: 100, reps: 8, completed: true }], // e1RM PR 126.7 > 116.7 without weight PR
        history: [{ sessionId: 'prev', date: 1000, sets: makeSets(100, 5, true, 3) }],
      }),
      makeExercise({
        id: 'row',
        name: 'Barbell Row',
        sets: [{ id: '5', weight: 80, reps: 8, completed: true }],
        history: [{ sessionId: 'prev', date: 1000, sets: makeSets(90, 8, true, 3) }],
      }),
    ];

    const { totalVolume, detectedPRs } = detectSessionPRs(exercises);

    assert.equal(totalVolume, 100 * 5 + 105 * 3 + 100 * 8 + 80 * 8);
    assert.deepEqual(detectedPRs, [
      {
        exerciseId: 'bench',
        exerciseName: 'Bench Press',
        type: 'weight',
        value: 105,
        previousValue: 100,
      },
      {
        exerciseId: 'squat',
        exerciseName: 'Barbell Squat',
        type: '1rm',
        value: 126.7,
        previousValue: 116.7,
      },
    ]);
  });
});

describe('computeOverloadSpikePercent', () => {
  it('returns 0 when no prior sessions exist and averages top 3 most recent sessions', () => {
    assert.equal(computeOverloadSpikePercent(5000, []), 0);

    const sessions: WorkoutSession[] = [
      { id: 'old', programId: 'p', dayId: 'd', date: 1000, totalVolume: 1000, PRs: [], duration: 60, exercisesSnapshot: [] },
      { id: 'r1', programId: 'p', dayId: 'd', date: 2000, totalVolume: 4000, PRs: [], duration: 60, exercisesSnapshot: [] },
      { id: 'r2', programId: 'p', dayId: 'd', date: 3000, totalVolume: 4000, PRs: [], duration: 60, exercisesSnapshot: [] },
      { id: 'r3', programId: 'p', dayId: 'd', date: 4000, totalVolume: 4000, PRs: [], duration: 60, exercisesSnapshot: [] },
    ];

    // Most recent 3 average = 4000; 5200 is +30%
    assert.equal(computeOverloadSpikePercent(5200, sessions), 30);
  });
});
