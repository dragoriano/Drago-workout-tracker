import type { Set } from '../types';
import { isWarmupSet } from './strength';
import type { WeightUnit } from './strength';
import { generateId } from './uuid';

export const REST_TIMER_PRESETS = [45, 60, 90, 120, 150, 180] as const;

const WARMUP_TIERS: ReadonlyArray<{ pct: number; reps: number }> = [
  { pct: 0.4, reps: 8 },
  { pct: 0.6, reps: 5 },
  { pct: 0.8, reps: 2 },
];

/**
 * Computes the smallest bilateral plate increment (`2 * minPositivePlate`),
 * falling back to `5` lbs or `2.5` kg when no valid plates are provided.
 */
export function getSmallestWeightIncrement(
  availablePlates: number[],
  unit: WeightUnit,
): number {
  const positivePlates = availablePlates.filter(
    (plate) => Number.isFinite(plate) && plate > 0,
  );
  if (positivePlates.length === 0) {
    return unit === 'lbs' ? 5 : 2.5;
  }
  const minPlate = Math.min(...positivePlates);
  return Math.round(minPlate * 2 * 1000) / 1000;
}

/**
 * Rounds `weight` to the nearest multiple of `increment` without float noise,
 * clamping the result to at least `minWeight`.
 */
export function roundToIncrement(
  weight: number,
  increment: number,
  minWeight = 0,
): number {
  const safeMin = Number.isFinite(minWeight) ? Math.max(0, minWeight) : 0;
  if (!Number.isFinite(weight)) {
    return safeMin;
  }
  if (!Number.isFinite(increment) || increment <= 0) {
    return Math.max(safeMin, Math.round(weight * 1000) / 1000);
  }
  const rounded = Math.round(weight / increment + 1e-9) * increment;
  const clean = Math.round(rounded * 1000) / 1000;
  return Math.max(safeMin, clean);
}

/**
 * Generates ramped warm-up sets from the target working weight and gym equipment settings.
 */
export function generateWarmupSets(
  workingWeight: number,
  options: { barbellWeight: number; availablePlates: number[]; unit: WeightUnit },
): Set[] {
  if (!Number.isFinite(workingWeight) || workingWeight <= 0) {
    return [];
  }

  const safeBarWeight = Number.isFinite(options.barbellWeight)
    ? Math.max(0, options.barbellWeight)
    : 0;
  const increment = getSmallestWeightIncrement(
    options.availablePlates,
    options.unit,
  );

  if (workingWeight <= safeBarWeight) {
    const lightWeight = roundToIncrement(workingWeight * 0.5, increment, 0);
    if (lightWeight > 0 && lightWeight < workingWeight) {
      return [
        {
          id: generateId(),
          weight: lightWeight,
          reps: 8,
          completed: false,
          setType: 'warmup',
        },
      ];
    }
    return [];
  }

  const barFloorThreshold = Math.round(safeBarWeight * 1.15 * 10000) / 10000;
  const tierFloor = workingWeight > barFloorThreshold ? safeBarWeight : 0;
  const seenWeights = new Set<number>();
  const warmups: Set[] = [];

  for (const tier of WARMUP_TIERS) {
    const rounded = roundToIncrement(
      workingWeight * tier.pct,
      increment,
      tierFloor,
    );
    if (rounded <= 0 || rounded >= workingWeight || seenWeights.has(rounded)) {
      continue;
    }
    seenWeights.add(rounded);
    warmups.push({
      id: generateId(),
      weight: rounded,
      reps: tier.reps,
      completed: false,
      setType: 'warmup',
    });
  }

  return warmups;
}

/**
 * Replaces uncompleted warm-up sets at the top or prepends warm-ups before working sets.
 */
export function applyWarmupSets(existingSets: Set[], warmupSets: Set[]): Set[] {
  if (warmupSets.length === 0) {
    return existingSets;
  }

  const firstWorkingIndex = existingSets.findIndex((s) => !isWarmupSet(s));
  if (firstWorkingIndex === -1) {
    const completedWarmups = existingSets.filter((s) => s.completed);
    return [...completedWarmups, ...warmupSets];
  }

  const leadingCompletedWarmups = existingSets
    .slice(0, firstWorkingIndex)
    .filter((s) => s.completed);

  return [
    ...leadingCompletedWarmups,
    ...warmupSets,
    ...existingSets.slice(firstWorkingIndex),
  ];
}

/**
 * Adjusts a set's weight by `delta`, clamped >= 0 and rounded to 2 decimals.
 */
export function stepSetWeight(current: number, delta: number): number {
  const base = Number.isFinite(current) ? current : 0;
  const step = Number.isFinite(delta) ? delta : 0;
  return Math.max(0, Math.round((base + step) * 100) / 100);
}

/**
 * Adjusts a set's reps by `delta`, clamped >= 0 as an integer.
 */
export function stepSetReps(current: number, delta: number): number {
  const base = Number.isFinite(current) ? current : 0;
  const step = Number.isFinite(delta) ? delta : 0;
  return Math.max(0, Math.round(base + step));
}
