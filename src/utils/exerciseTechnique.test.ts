import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  findSmartEquipmentSwaps,
  getExerciseTechniqueProfile,
  inferExerciseEquipment,
  inferMovementPattern,
} from './exerciseTechnique.ts';
import type { CatalogExerciseItem } from './customExercises.ts';
import type { WorkoutSession } from '../types/index.ts';

const MOCK_CATALOG: CatalogExerciseItem[] = [
  {
    name: 'Barbell Flat Standard Bench Press',
    primaryMuscle: 'Mid Chest',
    secondaryMuscles: ['Triceps', 'Front Delt'],
    muscleGroups: ['Mid Chest', 'Triceps', 'Shoulders', 'Front Delt'],
  },
  {
    name: 'Dumbbell Flat Bench Press',
    primaryMuscle: 'Mid Chest',
    secondaryMuscles: ['Triceps', 'Front Delt'],
    muscleGroups: ['Mid Chest', 'Triceps', 'Shoulders'],
  },
  {
    name: 'Machine Chest Press',
    primaryMuscle: 'Mid Chest',
    secondaryMuscles: ['Triceps'],
    muscleGroups: ['Mid Chest', 'Triceps'],
  },
  {
    name: 'Cable Chest Fly',
    primaryMuscle: 'Mid Chest',
    secondaryMuscles: ['Front Delt'],
    muscleGroups: ['Mid Chest', 'Shoulders'],
  },
  {
    name: 'Barbell Back Squat',
    primaryMuscle: 'Quads',
    secondaryMuscles: ['Glutes'],
    muscleGroups: ['Quads', 'Glutes', 'Legs'],
  },
];

describe('inferExerciseEquipment & inferMovementPattern', () => {
  it('classifies equipment accurately from standard exercise names', () => {
    assert.equal(inferExerciseEquipment('Barbell Flat Standard Bench Press'), 'Barbell');
    assert.equal(inferExerciseEquipment('Dumbbell Incline Press'), 'Dumbbell');
    assert.equal(inferExerciseEquipment('Cable Triceps Pushdown'), 'Cable');
    assert.equal(inferExerciseEquipment('Machine Leg Press'), 'Machine');
    assert.equal(inferExerciseEquipment('Weighted Pull-Up'), 'Bodyweight');
    assert.equal(inferExerciseEquipment('Kettlebell Swing'), 'Kettlebell');
  });

  it('detects movement patterns across compound and isolation movements', () => {
    assert.equal(inferMovementPattern('Dumbbell Bench Press'), 'horizontal_press');
    assert.equal(inferMovementPattern('Seated Overhead Press'), 'vertical_press');
    assert.equal(inferMovementPattern('Lat Pulldown'), 'vertical_pull');
    assert.equal(inferMovementPattern('Bent-Over Barbell Row'), 'horizontal_pull');
    assert.equal(inferMovementPattern('Romanian Deadlift'), 'hinge');
    assert.equal(inferMovementPattern('Barbell Back Squat'), 'squat');
  });
});

describe('findSmartEquipmentSwaps', () => {
  it('ranks same-muscle + same-pattern equipment equivalents above flies and unrelated lifts', () => {
    const swaps = findSmartEquipmentSwaps(
      {
        name: 'Barbell Flat Standard Bench Press',
        primaryMuscle: 'Mid Chest',
        secondaryMuscles: ['Triceps', 'Front Delt'],
        muscleGroups: ['Mid Chest', 'Triceps', 'Shoulders'],
      },
      MOCK_CATALOG,
    );

    assert.equal(swaps.some((s) => s.name === 'Barbell Back Squat'), false);
    assert.equal(swaps[0].name, 'Dumbbell Flat Bench Press');
    assert.equal(swaps[0].matchReason, 'Exact Match');
    const flyIdx = swaps.findIndex((s) => s.name === 'Cable Chest Fly');
    const machineIdx = swaps.findIndex((s) => s.name === 'Machine Chest Press');
    assert.ok(machineIdx !== -1 && flyIdx !== -1 && machineIdx < flyIdx);
  });

  it('filters by equipment and attaches last logged performance label from sessions', () => {
    const sessions: WorkoutSession[] = [
      {
        id: 's1',
        programId: 'p1',
        dayId: 'd1',
        date: Date.now() - 86_400_000,
        totalVolume: 1200,
        PRs: [],
        duration: 1800,
        exercisesSnapshot: [
          {
            id: 'e1',
            name: 'Dumbbell Flat Bench Press',
            notes: '',
            history: [],
            restTimerConfig: 90,
            lastUpdated: Date.now(),
            sets: [{ id: 'st1', weight: 32.5, reps: 10, completed: true, setType: 'working' }],
          },
        ],
      },
    ];

    const dbOnly = findSmartEquipmentSwaps(
      {
        name: 'Barbell Flat Standard Bench Press',
        primaryMuscle: 'Mid Chest',
        muscleGroups: ['Mid Chest', 'Triceps'],
      },
      MOCK_CATALOG,
      { equipmentFilter: 'Dumbbell', sessions, weightUnit: 'kg' },
    );

    assert.equal(dbOnly.length, 1);
    assert.equal(dbOnly[0].equipment, 'Dumbbell');
    assert.equal(dbOnly[0].lastBestLabel, '32.5 kg × 10');
  });
});

describe('getExerciseTechniqueProfile', () => {
  it('builds structured form cues and anatomical muscle highlights', () => {
    const profile = getExerciseTechniqueProfile(
      'Barbell Flat Standard Bench Press',
      'Mid Chest',
      ['Triceps', 'Front Delt'],
    );

    assert.equal(profile.equipment, 'Barbell');
    assert.equal(profile.movementPattern, 'horizontal_press');
    assert.equal(profile.primaryBroad, 'Chest');
    assert.ok(profile.secondaryBroad.includes('Arms'));
    assert.ok(profile.secondaryBroad.includes('Shoulders'));
    assert.ok(profile.setupCues.length >= 2);
    assert.ok(profile.executionCues.length >= 2);
    assert.equal(profile.previewRecoveryItems.length, 7);
    const chest = profile.previewRecoveryItems.find((m) => m.muscle === 'Chest');
    assert.equal(chest?.readiness, 'fatigued');
  });
});
