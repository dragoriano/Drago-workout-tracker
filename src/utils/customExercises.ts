import type {
  AppSettings,
  CustomExercise,
  Exercise,
  ExerciseEquipment,
  WorkoutProgram,
  WorkoutSession,
} from '../types';
import { computeSmartSets } from './workoutCoach';
import { generateId } from './uuid';

export const FREESTYLE_PROGRAM_ID = 'freestyle';

export const EXERCISE_EQUIPMENT_OPTIONS: readonly ExerciseEquipment[] = [
  'Barbell',
  'Dumbbell',
  'Machine',
  'Cable',
  'Bodyweight',
  'Kettlebell',
  'Other',
] as const;

export interface CatalogExerciseItem {
  name: string;
  muscleGroups: string[];
  primaryMuscle: string;
  secondaryMuscles: string[];
  isCustom?: boolean;
  customId?: string;
  equipment?: ExerciseEquipment;
  defaultRestTimer?: number;
  notes?: string;
}

export function normalizeCustomExerciseInput(input: {
  id?: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles?: string[];
  equipment?: ExerciseEquipment;
  defaultRestTimer?: number;
  notes?: string;
  createdAt?: number;
}): CustomExercise {
  const cleanName = input.name.trim();
  const cleanPrimary = input.primaryMuscle.trim();
  const cleanSecondary: string[] = [];

  for (const m of input.secondaryMuscles || []) {
    const trimmed = m.trim();
    if (trimmed && trimmed !== cleanPrimary && !cleanSecondary.includes(trimmed)) {
      cleanSecondary.push(trimmed);
    }
  }

  const muscleGroups = [cleanPrimary, ...cleanSecondary].filter(Boolean);
  const rawRest = input.defaultRestTimer ?? 90;
  const defaultRestTimer = Math.max(
    15,
    Math.min(600, Number.isFinite(rawRest) ? Math.round(rawRest) : 90),
  );

  return {
    id: input.id || generateId(),
    name: cleanName,
    primaryMuscle: cleanPrimary,
    secondaryMuscles: cleanSecondary,
    muscleGroups,
    equipment: input.equipment || 'Other',
    defaultRestTimer,
    notes: input.notes?.trim() || undefined,
    createdAt: input.createdAt ?? Date.now(),
  };
}

export function mergeExerciseCatalog(
  builtIn: CatalogExerciseItem[],
  customExercises: CustomExercise[],
): CatalogExerciseItem[] {
  const seen = new Set<string>();
  const merged: CatalogExerciseItem[] = [];

  for (const ce of customExercises) {
    const key = ce.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push({
      name: ce.name.trim(),
      primaryMuscle: ce.primaryMuscle,
      secondaryMuscles: ce.secondaryMuscles || [],
      muscleGroups:
        ce.muscleGroups && ce.muscleGroups.length > 0
          ? ce.muscleGroups
          : [ce.primaryMuscle, ...(ce.secondaryMuscles || [])].filter(Boolean),
      isCustom: true,
      customId: ce.id,
      equipment: ce.equipment,
      defaultRestTimer: ce.defaultRestTimer,
      notes: ce.notes,
    });
  }

  for (const item of builtIn) {
    const key = item.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

export function buildFreestyleExercise(
  meta: CatalogExerciseItem,
  sessions: WorkoutSession[],
  settings: AppSettings | null,
  options: { setsCount?: number; defaultReps?: number; isDeload?: boolean } = {},
): Exercise {
  const setsCount = Math.max(1, Math.min(12, Math.round(options.setsCount ?? 3)));
  const defaultReps = Math.max(1, Math.min(100, Math.round(options.defaultReps ?? 10)));
  const normalizedTarget = meta.name.toLowerCase().trim();

  const globalHistory = sessions
    .filter((s) =>
      s.exercisesSnapshot?.some((e) => e.name.toLowerCase().trim() === normalizedTarget),
    )
    .map((s) => {
      const matchingEx = s.exercisesSnapshot.find(
        (e) => e.name.toLowerCase().trim() === normalizedTarget,
      );
      return {
        sessionId: s.id,
        date: s.date,
        sets: matchingEx?.sets || [],
      };
    })
    .sort((a, b) => a.date - b.date);

  const templateSets = Array.from({ length: setsCount }, () => ({
    id: generateId(),
    weight: 0,
    reps: defaultReps,
    completed: false,
    setType: 'working' as const,
  }));

  const baseEx: Exercise = {
    id: generateId(),
    name: meta.name.trim(),
    muscleGroup:
      meta.muscleGroups.length > 0
        ? meta.muscleGroups
        : [meta.primaryMuscle, ...(meta.secondaryMuscles || [])].filter(Boolean),
    primaryMuscle: meta.primaryMuscle,
    secondaryMuscles: meta.secondaryMuscles || [],
    notes: meta.notes || '',
    sets: templateSets,
    history: globalHistory,
    restTimerConfig: meta.defaultRestTimer || 90,
    lastUpdated: Date.now(),
  };

  return {
    ...baseEx,
    sets: computeSmartSets(baseEx, !!options.isDeload, settings),
  };
}

export function buildProgramFromFreestyle(
  name: string,
  exercises: Exercise[],
  status: 'active' | 'paused' = 'paused',
): WorkoutProgram {
  const now = Date.now();
  const cleanName = name.trim() || 'Freestyle Workout';

  return {
    id: generateId(),
    name: cleanName,
    goal: 'Custom',
    theme: 'from-primary-500 to-primary-700',
    status,
    createdAt: now,
    updatedAt: now,
    days: [
      {
        id: generateId(),
        name: cleanName,
        order: 0,
        exercises: exercises.map((ex) => ({
          ...ex,
          id: generateId(),
          history: [],
          lastUpdated: now,
          sets: ex.sets.map((s) => ({
            id: generateId(),
            weight: s.weight,
            reps: s.reps,
            completed: false,
            ...(s.setType && s.setType !== 'working' ? { setType: s.setType } : {}),
          })),
        })),
      },
    ],
  };
}
