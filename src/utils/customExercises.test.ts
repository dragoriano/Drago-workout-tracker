import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFreestyleExercise,
  buildProgramFromFreestyle,
  mergeExerciseCatalog,
  normalizeCustomExerciseInput,
} from './customExercises.ts';
import type { AppSettings, WorkoutSession } from '../types/index.ts';

const BASE_SETTINGS: AppSettings = {
  theme: 'dark',
  themeColor: 'indigo',
  smartSuggestions: true,
  overloadWarnings: true,
  autoDeload: true,
  soundEnabled: true,
  voiceCountdownEnabled: false,
  syncEnabled: false,
  weightUnit: 'kg',
  effortScale: 'rpe',
};

describe('normalizeCustomExerciseInput', () => {
  it('trims names, deduplicates secondary muscles excluding primary, and clamps rest timer', () => {
    const normalized = normalizeCustomExerciseInput({
      name: '  Pendulum Squat  ',
      primaryMuscle: 'Quads',
      secondaryMuscles: ['Glutes', 'Quads', 'Hamstrings', 'Glutes'],
      equipment: 'Machine',
      defaultRestTimer: 900,
      notes: '  Slow eccentric  ',
    });

    assert.equal(normalized.name, 'Pendulum Squat');
    assert.equal(normalized.primaryMuscle, 'Quads');
    assert.deepEqual(normalized.secondaryMuscles, ['Glutes', 'Hamstrings']);
    assert.deepEqual(normalized.muscleGroups, ['Quads', 'Glutes', 'Hamstrings']);
    assert.equal(normalized.equipment, 'Machine');
    assert.equal(normalized.defaultRestTimer, 600);
    assert.equal(normalized.notes, 'Slow eccentric');
  });
});

describe('mergeExerciseCatalog', () => {
  it('places custom exercises first and deduplicates case-insensitively against built-ins', () => {
    const merged = mergeExerciseCatalog(
      [
        {
          name: 'Barbell Squat',
          primaryMuscle: 'Quads',
          secondaryMuscles: ['Glutes'],
          muscleGroups: ['Quads', 'Glutes'],
        },
        {
          name: 'Bench Press',
          primaryMuscle: 'Mid Chest',
          secondaryMuscles: ['Triceps'],
          muscleGroups: ['Mid Chest', 'Triceps'],
        },
      ],
      [
        {
          id: 'c1',
          name: 'barbell squat',
          primaryMuscle: 'Quads',
          secondaryMuscles: [],
          muscleGroups: ['Quads'],
          equipment: 'Barbell',
          defaultRestTimer: 150,
          createdAt: 1000,
        },
      ],
    );

    assert.equal(merged.length, 2);
    assert.equal(merged[0].name, 'barbell squat');
    assert.equal(merged[0].isCustom, true);
    assert.equal(merged[0].defaultRestTimer, 150);
    assert.equal(merged[1].name, 'Bench Press');
    assert.equal(merged[1].isCustom, undefined);
  });
});

describe('buildFreestyleExercise & buildProgramFromFreestyle', () => {
  it('hydrates history across sessions and applies Smart Coach progression', () => {
    const sessions: WorkoutSession[] = [
      {
        id: 's1',
        programId: 'p1',
        dayId: 'd1',
        date: 1000,
        totalVolume: 2000,
        PRs: [],
        duration: 1800,
        exercisesSnapshot: [
          {
            id: 'e1',
            name: 'Pendulum Squat',
            notes: '',
            restTimerConfig: 120,
            lastUpdated: 1000,
            history: [],
            sets: [
              { id: '1', weight: 100, reps: 8, completed: true, rpe: 8 },
              { id: '2', weight: 100, reps: 8, completed: true, rpe: 8.5 },
            ],
          },
        ],
      },
      {
        id: 's2',
        programId: 'freestyle',
        dayId: 'freestyle',
        workoutName: 'Leg Pump',
        date: 2000,
        totalVolume: 2000,
        PRs: [],
        duration: 1800,
        exercisesSnapshot: [
          {
            id: 'e2',
            name: 'pendulum squat ',
            notes: '',
            restTimerConfig: 120,
            lastUpdated: 2000,
            history: [],
            sets: [
              { id: '3', weight: 100, reps: 8, completed: true, rpe: 8 },
              { id: '4', weight: 100, reps: 8, completed: true, rpe: 8.5 },
            ],
          },
        ],
      },
    ];

    const built = buildFreestyleExercise(
      {
        name: 'Pendulum Squat',
        primaryMuscle: 'Quads',
        secondaryMuscles: ['Glutes'],
        muscleGroups: ['Quads', 'Glutes'],
        defaultRestTimer: 120,
        notes: 'Deep stance',
      },
      sessions,
      BASE_SETTINGS,
      { setsCount: 2, defaultReps: 10 },
    );

    assert.equal(built.history.length, 2);
    assert.equal(built.restTimerConfig, 120);
    assert.equal(built.notes, 'Deep stance');
    assert.deepEqual(built.sets.map((s) => s.weight), [102.5, 102.5]);
    assert.deepEqual(built.sets.map((s) => s.reps), [10, 10]);
    assert.ok(built.sets.every((s) => !s.completed && s.rpe === undefined));

    const program = buildProgramFromFreestyle(
      'My Freestyle Legs',
      [
        {
          ...built,
          sets: [
            { id: 'x1', weight: 102.5, reps: 10, completed: true, setType: 'failure', rpe: 10 },
          ],
        },
      ],
      'paused',
    );

    assert.equal(program.name, 'My Freestyle Legs');
    assert.equal(program.status, 'paused');
    assert.equal(program.days.length, 1);
    assert.equal(program.days[0].exercises[0].sets[0].completed, false);
    assert.equal(program.days[0].exercises[0].sets[0].rpe, undefined);
    assert.equal(program.days[0].exercises[0].sets[0].setType, 'failure');
    assert.equal(program.days[0].exercises[0].history.length, 0);
  });
});
