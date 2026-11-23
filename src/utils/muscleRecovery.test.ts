import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMuscleRecovery,
  evaluateDayReadiness,
  inferBroadMusclesFromName,
  resolveExerciseBroadMuscles,
} from './muscleRecovery.ts';
import type { CustomExercise, Exercise, WorkoutSession } from '../types/index.ts';

const NOW = 1_700_000_000_000;
const HOUR = 3_600_000;

function makeSession(hoursAgo: number, exercisesSnapshot: Exercise[], id = 's1'): WorkoutSession {
  return {
    id,
    programId: 'p1',
    dayId: 'd1',
    date: NOW - hoursAgo * HOUR,
    totalVolume: 0,
    PRs: [],
    duration: 2400,
    exercisesSnapshot,
  };
}

describe('resolveExerciseBroadMuscles', () => {
  it('resolves custom exercise metadata by name when exercise snapshot lacks muscle tags', () => {
    const customList: CustomExercise[] = [
      {
        id: 'ce-1',
        name: 'Pendulum Squat',
        primaryMuscle: 'Quads',
        secondaryMuscles: ['Glutes'],
        muscleGroups: ['Quads', 'Glutes'],
        createdAt: NOW,
      },
    ];

    const resolved = resolveExerciseBroadMuscles(
      { name: 'pendulum squat ', primaryMuscle: '', secondaryMuscles: [], muscleGroup: [] },
      customList,
    );

    assert.deepEqual(resolved, { primary: 'Legs', secondary: ['Glutes'] });
  });

  it('infers broad muscles from exercise name as a fallback', () => {
    assert.deepEqual(inferBroadMusclesFromName('Incline Dumbbell Bench Press'), ['Chest']);
    assert.deepEqual(inferBroadMusclesFromName('Hanging Leg Raise'), ['Legs', 'Core']);
  });
});

describe('computeMuscleRecovery', () => {
  it('counts primary +1.0 and secondary +0.5 completed working sets and excludes warmups & incomplete sets', () => {
    const bench: Exercise = {
      id: 'ex-1',
      name: 'Barbell Flat Standard Bench Press',
      primaryMuscle: 'Mid Chest',
      secondaryMuscles: ['Triceps', 'Front Delt', 'Shoulders'],
      muscleGroup: ['Mid Chest', 'Triceps', 'Shoulders', 'Front Delt'],
      notes: '',
      restTimerConfig: 90,
      lastUpdated: NOW,
      history: [],
      sets: [
        { id: 'w1', weight: 40, reps: 10, completed: true, setType: 'warmup' },
        { id: 's1', weight: 100, reps: 8, completed: true, setType: 'working' },
        { id: 's2', weight: 100, reps: 8, completed: true, setType: 'working' },
        { id: 's3', weight: 100, reps: 8, completed: true, setType: 'working' },
        { id: 's4', weight: 100, reps: 8, completed: false, setType: 'working' },
      ],
    };

    const res = computeMuscleRecovery([makeSession(24, [bench])], { now: NOW });
    const chest = res.find((r) => r.muscle === 'Chest')!;
    const arms = res.find((r) => r.muscle === 'Arms')!;
    const shoulders = res.find((r) => r.muscle === 'Shoulders')!;
    const back = res.find((r) => r.muscle === 'Back')!;

    assert.equal(chest.directSets, 3);
    assert.equal(chest.effectiveSets, 3);
    assert.equal(chest.weeklyVolume, 2400);
    assert.equal(chest.volumeZone, 'under');
    // 24h elapsed / 48h base -> 50% recovering
    assert.equal(chest.neededRecoveryHours, 48);
    assert.equal(chest.recoveryPercent, 50);
    assert.equal(chest.readiness, 'recovering');

    // Secondary muscles get +0.5 per working set -> 1.5 effective sets, deduplicated (Front Delt + Shoulders once)
    assert.equal(arms.directSets, 0);
    assert.equal(arms.effectiveSets, 1.5);
    assert.equal(shoulders.effectiveSets, 1.5);

    // Untrained muscle defaults to 100% ready
    assert.equal(back.volumeZone, 'untrained');
    assert.equal(back.recoveryPercent, 100);
    assert.equal(back.readiness, 'ready');
  });

  it('extends needed recovery hours for high volume + failure/high RPE and marks fatigued', () => {
    const intenseChest: Exercise = {
      id: 'ex-1',
      name: 'Barbell Bench Press',
      primaryMuscle: 'Mid Chest',
      secondaryMuscles: [],
      muscleGroup: ['Mid Chest'],
      notes: '',
      restTimerConfig: 90,
      lastUpdated: NOW,
      history: [],
      sets: Array.from({ length: 6 }, (_, i) => ({
        id: `s-${i}`,
        weight: 80,
        reps: 10,
        completed: true,
        setType: i === 5 ? ('failure' as const) : ('working' as const),
        rpe: 9.5,
      })),
    };

    // Chest base 48h + 12h (>=6 sets) + 12h (failure/RPE>=9) = 72h needed; at 24h elapsed -> 33% fatigued
    const res = computeMuscleRecovery([makeSession(24, [intenseChest])], { now: NOW });
    const chest = res.find((r) => r.muscle === 'Chest')!;

    assert.equal(chest.neededRecoveryHours, 72);
    assert.equal(chest.recoveryPercent, 33);
    assert.equal(chest.readiness, 'fatigued');
  });

  it('classifies optimal and over volume zones accurately', () => {
    const chestSets = (count: number): Exercise => ({
      id: `ex-${count}`,
      name: 'Bench Press',
      primaryMuscle: 'Mid Chest',
      secondaryMuscles: [],
      muscleGroup: ['Mid Chest'],
      notes: '',
      restTimerConfig: 90,
      lastUpdated: NOW,
      history: [],
      sets: Array.from({ length: count }, (_, i) => ({
        id: `s-${i}`,
        weight: 60,
        reps: 10,
        completed: true,
      })),
    });

    const optimal = computeMuscleRecovery([makeSession(50, [chestSets(12)])], { now: NOW }).find(
      (r) => r.muscle === 'Chest',
    )!;
    const over = computeMuscleRecovery([makeSession(50, [chestSets(22)])], { now: NOW }).find(
      (r) => r.muscle === 'Chest',
    )!;

    assert.equal(optimal.volumeZone, 'optimal');
    assert.equal(over.volumeZone, 'over');
  });
});

describe('evaluateDayReadiness', () => {
  it('flags fatigued target muscles while reporting ready when rested', () => {
    const legEx: Exercise = {
      id: 'leg-1',
      name: 'Barbell Back Squat',
      primaryMuscle: 'Quads',
      secondaryMuscles: ['Glutes'],
      muscleGroup: ['Quads', 'Glutes'],
      notes: '',
      restTimerConfig: 120,
      lastUpdated: NOW,
      history: [],
      sets: Array.from({ length: 4 }, (_, i) => ({
        id: `s-${i}`,
        weight: 100,
        reps: 8,
        completed: true,
      })),
    };

    const recoveryFatigued = computeMuscleRecovery([makeSession(12, [legEx])], { now: NOW });
    const fatiguedEval = evaluateDayReadiness([legEx], recoveryFatigued);
    assert.equal(fatiguedEval.allReady, false);
    assert.deepEqual(fatiguedEval.fatiguedMuscles.map((m) => m.muscle), ['Legs']);

    const recoveryFresh = computeMuscleRecovery([makeSession(90, [legEx])], { now: NOW });
    const freshEval = evaluateDayReadiness([legEx], recoveryFresh);
    assert.equal(freshEval.allReady, true);
    assert.equal(freshEval.fatiguedMuscles.length, 0);
  });
});
