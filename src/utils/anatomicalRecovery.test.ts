import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getEstimatedReadyLabel,
  getMuscleRecentExercises,
  getRegionVisualStyle,
  getSuggestedFreestyleTitle,
  pickRecommendedExercisesForMuscles,
} from './anatomicalRecovery';
import type { CustomExercise, Exercise, WorkoutSession } from '../types';
import type { CatalogExerciseItem } from './customExercises';
import type { MuscleRecoveryStatus } from './muscleRecovery';

function makeExercise(
  overrides: Partial<Exercise> & Pick<Exercise, 'id' | 'name' | 'sets'>,
): Exercise {
  return {
    notes: '',
    history: [],
    restTimerConfig: 90,
    lastUpdated: 0,
    ...overrides,
  };
}

function makeStatus(overrides: Partial<MuscleRecoveryStatus> = {}): MuscleRecoveryStatus {
  return {
    muscle: 'Chest',
    color: '#ef4444',
    directSets: 8,
    effectiveSets: 8,
    minTarget: 10,
    maxTarget: 20,
    volumeZone: 'under',
    weeklyVolume: 4800,
    lastTrainedAt: Date.now() - 12 * 3_600_000,
    hoursSinceTrained: 12,
    neededRecoveryHours: 48,
    recoveryPercent: 25,
    readiness: 'fatigued',
    ...overrides,
  };
}

describe('getMuscleRecentExercises', () => {
  const now = 1_750_000_000_000;
  const hour = 3_600_000;

  const customExercises: CustomExercise[] = [
    {
      id: 'c1',
      name: 'My Cable Chest Squeeze',
      primaryMuscle: 'Chest',
      secondaryMuscles: ['Triceps'],
      muscleGroups: ['Chest', 'Triceps'],
      equipment: 'Cable',
      createdAt: now - 20 * 24 * hour,
    },
  ];

  const sessions: WorkoutSession[] = [
    {
      id: 'old-session',
      programId: 'p1',
      dayId: 'd1',
      date: now - 9 * 24 * hour,
      duration: 3600,
      totalVolume: 2000,
      PRs: [],
      exercisesSnapshot: [
        makeExercise({
          id: 'e-old',
          name: 'Barbell Flat Standard Bench Press',
          sets: [{ id: 's1', weight: 100, reps: 5, completed: true }],
        }),
      ],
    },
    {
      id: 'recent-1',
      programId: 'p1',
      dayId: 'd1',
      date: now - 30 * hour,
      duration: 3000,
      totalVolume: 3000,
      PRs: [],
      exercisesSnapshot: [
        makeExercise({
          id: 'e1',
          name: 'Dumbbell Incline Press',
          primaryMuscle: 'Upper Chest',
          secondaryMuscles: ['Front Delt', 'Triceps'],
          sets: [
            { id: 'w1', weight: 20, reps: 10, completed: true, setType: 'warmup' },
            { id: 's1', weight: 32, reps: 8, completed: true },
            { id: 's2', weight: 32, reps: 8, completed: true },
            { id: 's3', weight: 32, reps: 8, completed: false },
          ],
        }),
        makeExercise({
          id: 'e2',
          name: 'Shoulder Press',
          primaryMuscle: 'Front Delt',
          secondaryMuscles: ['Triceps'],
          sets: [{ id: 's4', weight: 50, reps: 8, completed: true }],
        }),
      ],
    },
    {
      id: 'recent-2',
      programId: 'p1',
      dayId: 'd2',
      date: now - 6 * hour,
      duration: 2400,
      totalVolume: 2200,
      PRs: [],
      exercisesSnapshot: [
        makeExercise({
          id: 'e3',
          name: 'My Cable Chest Squeeze',
          sets: [
            { id: 's5', weight: 25, reps: 12, completed: true },
            { id: 's6', weight: 25, reps: 12, completed: true },
          ],
        }),
        makeExercise({
          id: 'e4',
          name: 'Overhead Dumbbell Press',
          primaryMuscle: 'Front Delt',
          secondaryMuscles: ['Upper Chest'],
          sets: [{ id: 's7', weight: 26, reps: 10, completed: true }],
        }),
      ],
    },
  ];

  it('excludes out-of-window sessions & warmups, resolves custom exercises, and prioritizes primary matches', () => {
    const chestRecent = getMuscleRecentExercises(sessions, 'Chest', {
      now,
      customExercises,
    });

    assert.equal(chestRecent.length, 3);
    assert.equal(chestRecent[0].name, 'My Cable Chest Squeeze');
    assert.equal(chestRecent[0].role, 'primary');
    assert.equal(chestRecent[0].setsCount, 2);

    assert.equal(chestRecent[1].name, 'Dumbbell Incline Press');
    assert.equal(chestRecent[1].role, 'primary');
    assert.equal(chestRecent[1].setsCount, 2); // excludes warmup & incomplete

    assert.equal(chestRecent[2].name, 'Overhead Dumbbell Press');
    assert.equal(chestRecent[2].role, 'secondary');
  });
});

describe('getEstimatedReadyLabel', () => {
  it('formats rested, ready, hours remaining, and multi-day labels accurately', () => {
    assert.equal(
      getEstimatedReadyLabel(makeStatus({ lastTrainedAt: null, recoveryPercent: 100, readiness: 'ready' })),
      'Fully recovered',
    );
    assert.equal(
      getEstimatedReadyLabel(makeStatus({ recoveryPercent: 88, readiness: 'ready' })),
      'Ready to train',
    );
    assert.equal(
      getEstimatedReadyLabel(
        makeStatus({
          neededRecoveryHours: 48,
          hoursSinceTrained: 28,
          recoveryPercent: 58,
          readiness: 'recovering',
        }),
      ),
      'Ready in ~13h',
    );
    assert.equal(
      getEstimatedReadyLabel(
        makeStatus({
          neededRecoveryHours: 72,
          hoursSinceTrained: 6,
          recoveryPercent: 8,
          readiness: 'fatigued',
        }),
      ),
      'Ready in ~2.3d',
    );
  });
});

describe('getRegionVisualStyle', () => {
  it('handles all readiness and volume states, boosts selection, dims others, and obeys Purple Ban', () => {
    const fatigued = getRegionVisualStyle(
      makeStatus({ readiness: 'fatigued', volumeZone: 'over' }),
      'readiness',
      false,
      false,
    );
    assert.equal(fatigued.fill, '#ef4444');
    assert.equal(fatigued.showGlow, true);

    const selected = getRegionVisualStyle(
      makeStatus({ readiness: 'ready', effectiveSets: 0, lastTrainedAt: null }),
      'readiness',
      true,
      false,
    );
    assert.equal(selected.fillOpacity, 0.94);
    assert.equal(selected.strokeOpacity, 1);
    assert.equal(selected.showGlow, true);

    const dimmed = getRegionVisualStyle(
      makeStatus({ readiness: 'recovering' }),
      'readiness',
      false,
      true,
    );
    assert.ok(dimmed.fillOpacity < 0.4);
    assert.equal(dimmed.showGlow, false);

    const zones: Array<MuscleRecoveryStatus['volumeZone']> = ['untrained', 'under', 'optimal', 'over'];
    for (const zone of zones) {
      const s = getRegionVisualStyle(makeStatus({ volumeZone: zone }), 'volume', false, false);
      assert.doesNotMatch(s.fill + s.stroke + s.glowColor, /purple|violet|indigo|#[789a-f]?[0-5][0-9a-f][0-4][0-9a-f][9a-f]/i);
    }
  });
});

describe('getSuggestedFreestyleTitle & pickRecommendedExercisesForMuscles', () => {
  const catalog: CatalogExerciseItem[] = [
    { name: 'Barbell Flat Standard Bench Press', primaryMuscle: 'Mid Chest', secondaryMuscles: ['Triceps'], muscleGroups: ['Mid Chest'] },
    { name: 'Dumbbell Incline Press', primaryMuscle: 'Upper Chest', secondaryMuscles: ['Triceps'], muscleGroups: ['Upper Chest'] },
    { name: 'Barbell Squat', primaryMuscle: 'Quads', secondaryMuscles: ['Glutes'], muscleGroups: ['Quads'] },
    { name: 'Barbell Row', primaryMuscle: 'Mid Back', secondaryMuscles: ['Biceps'], muscleGroups: ['Mid Back'] },
  ];

  it('builds descriptive titles based on muscle count', () => {
    assert.equal(getSuggestedFreestyleTitle([]), 'Quick Workout');
    assert.equal(getSuggestedFreestyleTitle(['Chest']), 'Chest Focus');
    assert.equal(getSuggestedFreestyleTitle(['Chest', 'Back']), 'Chest & Back Focus');
    assert.equal(getSuggestedFreestyleTitle(['Chest', 'Back', 'Legs']), 'Recovered Muscles Freestyle');
  });

  it('selects unique primary-matched exercises up to perMuscle and total cap', () => {
    const custom: CustomExercise[] = [
      {
        id: 'c1',
        name: 'Incline Ring Push-Up',
        primaryMuscle: 'Chest',
        secondaryMuscles: [],
        muscleGroups: ['Chest'],
        equipment: 'Bodyweight',
        createdAt: 1,
      },
    ];
    const picked = pickRecommendedExercisesForMuscles(['Chest', 'Legs'], catalog, custom, 2);
    assert.equal(picked.length, 3); // 2 chest (custom staple prioritized + catalog bench/incline), 1 legs
    const names = picked.map((p) => p.name);
    assert.equal(new Set(names).size, names.length);
    assert.ok(names.includes('Barbell Squat'));
  });
});
