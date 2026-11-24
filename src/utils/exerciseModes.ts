import type {
  Exercise,
  ExerciseEquipment,
  ExerciseTrackingMode,
  Set,
} from '../types';
import { isWarmupSet } from './strength';

export interface TrackingModeMeta {
  value: ExerciseTrackingMode;
  label: string;
  shortLabel: string;
  description: string;
}

export const EXERCISE_TRACKING_MODES: readonly TrackingModeMeta[] = [
  {
    value: 'weight_reps',
    label: 'Weighted',
    shortLabel: 'Weighted',
    description: 'Weight × Reps (Barbell, Dumbbell, Machine)',
  },
  {
    value: 'bodyweight_reps',
    label: 'Bodyweight',
    shortLabel: 'BW',
    description: 'Reps with optional +added load',
  },
  {
    value: 'assisted_reps',
    label: 'Assisted',
    shortLabel: 'Assist',
    description: 'Counterweight assistance × Reps (less is stronger)',
  },
  {
    value: 'timed',
    label: 'Timed Hold',
    shortLabel: 'Timed',
    description: 'Duration in seconds with optional load',
  },
] as const;

const TIMED_NAME_PATTERN =
  /plank|dead hang|wall sit|hollow hold|l-sit|farmer.?s?\s*(walk|carry)|suitcase carry|isometric|static hold|\bhold\b/i;

const ASSISTED_NAME_PATTERN = /\bassisted\b|band-assisted|machine assisted/i;

const EXTERNAL_LOAD_PREFIX_PATTERN =
  /barbell|dumbbell|cable|machine|smith|weighted|kettlebell/i;

const BODYWEIGHT_NAME_PATTERN =
  /push-?up|pull-?up|chin-?up|\bdips?\b|burpee|crunch|sit-?up|leg raise|mountain climber|air squat|pistol squat|nordic|inverted row|muscle-?up|jumping jack/i;

/**
 * Returns the explicit tracking mode for an exercise, defaulting legacy entries to `'weight_reps'`.
 */
export function getExerciseTrackingMode(
  ex?: Pick<Exercise, 'trackingMode'> | null,
): ExerciseTrackingMode {
  return ex?.trackingMode ?? 'weight_reps';
}

/**
 * Infers an appropriate tracking mode from an exercise name and optional equipment type.
 */
export function inferTrackingModeFromName(
  name: string,
  equipment?: ExerciseEquipment,
): ExerciseTrackingMode {
  const clean = name.trim();
  if (TIMED_NAME_PATTERN.test(clean)) return 'timed';
  if (ASSISTED_NAME_PATTERN.test(clean)) return 'assisted_reps';
  if (equipment === 'Bodyweight') return 'bodyweight_reps';
  if (
    BODYWEIGHT_NAME_PATTERN.test(clean) &&
    !EXTERNAL_LOAD_PREFIX_PATTERN.test(clean)
  ) {
    return 'bodyweight_reps';
  }
  return 'weight_reps';
}

/**
 * Formats seconds into a compact display string (`45s`, `1:00`, `1:35`).
 */
export function formatDurationCompact(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
  const rounded = Math.round(seconds);
  if (rounded < 60) return `${rounded}s`;
  const mins = Math.floor(rounded / 60);
  const rem = rounded % 60;
  return `${mins}:${String(rem).padStart(2, '0')}`;
}

/**
 * Formats a set for compact history/summary badges using the exercise's tracking mode.
 */
export function formatSetSummary(
  set: Pick<Set, 'weight' | 'reps' | 'duration'>,
  mode: ExerciseTrackingMode,
  unit: string,
): string {
  const weight = Number.isFinite(set.weight) ? Math.max(0, set.weight) : 0;
  const reps = Number.isFinite(set.reps) ? Math.max(0, set.reps) : 0;
  const duration = Number.isFinite(set.duration) ? Math.max(0, set.duration ?? 0) : 0;

  switch (mode) {
    case 'bodyweight_reps':
      return weight > 0 ? `BW+${weight}${unit} × ${reps}` : `BW × ${reps}`;
    case 'assisted_reps':
      return weight > 0 ? `-${weight}${unit} × ${reps}` : `BW × ${reps}`;
    case 'timed':
      return weight > 0
        ? `${weight}${unit} · ${formatDurationCompact(duration)}`
        : formatDurationCompact(duration);
    case 'weight_reps':
    default:
      return `${weight}${unit} × ${reps}`;
  }
}

/**
 * Calculates working volume contribution for a single set (returns 0 for warmups, incomplete sets, assisted sets, and timed sets).
 */
export function calculateSetWorkingVolume(
  set: Pick<Set, 'weight' | 'reps' | 'completed' | 'setType'>,
  mode: ExerciseTrackingMode,
): number {
  if (!set.completed || isWarmupSet(set)) return 0;
  if (mode === 'assisted_reps' || mode === 'timed') return 0;

  const weight = Number.isFinite(set.weight) ? Math.max(0, set.weight) : 0;
  const reps = Number.isFinite(set.reps) ? Math.max(0, set.reps) : 0;
  return weight * reps;
}

/**
 * Returns whether estimated 1RM metrics apply to this exercise tracking mode.
 */
export function supportsEstimated1RM(mode: ExerciseTrackingMode): boolean {
  return mode === 'weight_reps';
}

/**
 * Adjusts a set's timed duration in integer seconds, clamped at >= 0.
 */
export function stepSetDuration(current: number, delta: number): number {
  const base = Number.isFinite(current) ? current : 0;
  const step = Number.isFinite(delta) ? delta : 0;
  return Math.max(0, Math.round(base + step));
}
