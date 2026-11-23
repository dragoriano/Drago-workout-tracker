import type { Set } from '../types';

export type WeightUnit = 'kg' | 'lbs';

export const DEFAULT_BARBELL_WEIGHT: Record<WeightUnit, number> = {
  kg: 20,
  lbs: 45,
};

export const BARBELL_PRESETS: Record<WeightUnit, number[]> = {
  kg: [20, 15, 10, 7.5],
  lbs: [45, 35, 25, 15],
};

export const DEFAULT_PLATES: Record<WeightUnit, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lbs: [45, 35, 25, 10, 5, 2.5],
};

export function calculateEstimated1RM(weight: number, reps: number): number {
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps <= 0) {
    return 0;
  }
  if (reps === 1) {
    return Math.round(weight * 10) / 10;
  }
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function getBestSet1RM(
  sets: Set[],
  includeIncomplete = false,
): { e1rm: number; weight: number; reps: number } | null {
  let best: { e1rm: number; weight: number; reps: number } | null = null;

  for (const s of sets) {
    if ((!includeIncomplete && !s.completed) || s.weight <= 0 || s.reps <= 0) {
      continue;
    }
    const e1rm = calculateEstimated1RM(s.weight, s.reps);
    if (
      !best ||
      e1rm > best.e1rm ||
      (e1rm === best.e1rm && s.weight > best.weight)
    ) {
      best = { e1rm, weight: s.weight, reps: s.reps };
    }
  }

  return best;
}

const PERCENT_TIERS: Array<{ percent: number; repsHint: string }> = [
  { percent: 95, repsHint: '~2 reps' },
  { percent: 90, repsHint: '~4 reps' },
  { percent: 85, repsHint: '~6 reps' },
  { percent: 80, repsHint: '~8 reps' },
  { percent: 75, repsHint: '~10 reps' },
  { percent: 70, repsHint: '~12 reps' },
];

export function getTrainingPercentages(
  e1rm: number,
): Array<{ percent: number; weight: number; repsHint: string }> {
  if (!Number.isFinite(e1rm) || e1rm <= 0) return [];
  return PERCENT_TIERS.map(({ percent, repsHint }) => ({
    percent,
    weight: Math.round(e1rm * (percent / 100) * 2) / 2,
    repsHint,
  }));
}

export interface PlateBreakdown {
  targetWeight: number;
  barbellWeight: number;
  achievableWeight: number;
  perSideWeight: number;
  platesPerSide: Array<{ weight: number; count: number }>;
  remainderPerSide: number;
  isExact: boolean;
}

export function calculateBarbellPlates(
  targetWeight: number,
  barbellWeight: number,
  availablePlates: number[],
): PlateBreakdown {
  const safeBar = Number.isFinite(barbellWeight) ? Math.max(0, barbellWeight) : 0;
  const safeTarget = Number.isFinite(targetWeight) ? Math.max(0, targetWeight) : 0;

  if (safeTarget <= safeBar) {
    return {
      targetWeight: safeTarget,
      barbellWeight: safeBar,
      achievableWeight: safeBar,
      perSideWeight: 0,
      platesPerSide: [],
      remainderPerSide: 0,
      isExact: Math.round(safeTarget * 100) === Math.round(safeBar * 100),
    };
  }

  const sortedPlates = Array.from(
    new Set(availablePlates.filter((p) => Number.isFinite(p) && p > 0)),
  ).sort((a, b) => b - a);

  let remainingScaled = Math.round(((safeTarget - safeBar) / 2) * 100);
  let loadedPerSideScaled = 0;
  const platesPerSide: Array<{ weight: number; count: number }> = [];

  for (const plate of sortedPlates) {
    const plateScaled = Math.round(plate * 100);
    if (plateScaled <= 0) continue;
    const count = Math.floor(remainingScaled / plateScaled);
    if (count > 0) {
      platesPerSide.push({ weight: plate, count });
      remainingScaled -= count * plateScaled;
      loadedPerSideScaled += count * plateScaled;
    }
  }

  const perSideWeight = loadedPerSideScaled / 100;
  const achievableWeight = Math.round((safeBar + perSideWeight * 2) * 100) / 100;
  const remainderPerSide = remainingScaled / 100;

  return {
    targetWeight: safeTarget,
    barbellWeight: safeBar,
    achievableWeight,
    perSideWeight,
    platesPerSide,
    remainderPerSide,
    isExact: remainingScaled === 0,
  };
}

export function getPlateVisualSpec(
  weight: number,
  unit: WeightUnit,
): { heightClass: string; colorClass: string; textClass: string } {
  if (unit === 'kg') {
    if (weight >= 25) return { heightClass: 'h-24', colorClass: 'bg-red-600', textClass: 'text-white' };
    if (weight >= 20) return { heightClass: 'h-24', colorClass: 'bg-blue-600', textClass: 'text-white' };
    if (weight >= 15) return { heightClass: 'h-20', colorClass: 'bg-amber-400', textClass: 'text-zinc-950' };
    if (weight >= 10) return { heightClass: 'h-16', colorClass: 'bg-emerald-500', textClass: 'text-white' };
    if (weight >= 5) return { heightClass: 'h-14', colorClass: 'bg-zinc-200', textClass: 'text-zinc-950' };
    if (weight >= 2.5) return { heightClass: 'h-11', colorClass: 'bg-zinc-600', textClass: 'text-white' };
    return { heightClass: 'h-9', colorClass: 'bg-zinc-400', textClass: 'text-zinc-950' };
  }

  if (weight >= 45) return { heightClass: 'h-24', colorClass: 'bg-red-600', textClass: 'text-white' };
  if (weight >= 35) return { heightClass: 'h-24', colorClass: 'bg-blue-600', textClass: 'text-white' };
  if (weight >= 25) return { heightClass: 'h-20', colorClass: 'bg-amber-400', textClass: 'text-zinc-950' };
  if (weight >= 10) return { heightClass: 'h-16', colorClass: 'bg-emerald-500', textClass: 'text-white' };
  if (weight >= 5) return { heightClass: 'h-14', colorClass: 'bg-zinc-200', textClass: 'text-zinc-950' };
  return { heightClass: 'h-11', colorClass: 'bg-zinc-600', textClass: 'text-white' };
}
