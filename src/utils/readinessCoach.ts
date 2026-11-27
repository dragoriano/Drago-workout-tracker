import { differenceInCalendarDays, isSameDay } from 'date-fns';
import type { Exercise, ReadinessCheckin } from '../types';
import type { MesocycleProgressSummary } from './mesocycle';
import { isWarmupSet } from './strength';

export type ReadinessTier = 'prime' | 'ready' | 'moderate' | 'low';

export interface ReadinessPrescription {
  tier: ReadinessTier;
  label: string;
  headline: string;
  guidance: string;
  loadAdjustmentPct: number;
  setAdjustment: number;
}

export function clampRating(value: number): number {
  if (!Number.isFinite(value)) return 3;
  return Math.max(1, Math.min(5, Math.round(value)));
}

/**
 * Computes weighted 0-100 readiness score from 1-5 ratings:
 * Sleep (30%), Energy (30%), Freshness/low soreness (25%), Calmness/low stress (15%).
 */
export function computeReadinessScore(input: {
  sleep: number;
  energy: number;
  soreness: number;
  stress: number;
}): number {
  const sleepNorm = (clampRating(input.sleep) - 1) / 4;
  const energyNorm = (clampRating(input.energy) - 1) / 4;
  const sorenessNorm = (clampRating(input.soreness) - 1) / 4;
  const stressNorm = (clampRating(input.stress) - 1) / 4;

  const weighted =
    sleepNorm * 0.3 +
    energyNorm * 0.3 +
    sorenessNorm * 0.25 +
    stressNorm * 0.15;

  return Math.max(0, Math.min(100, Math.round(weighted * 100)));
}

export function evaluateReadinessPrescription(
  checkin: Pick<ReadinessCheckin, 'score'> | null | undefined,
  mesocycle?: MesocycleProgressSummary | null,
): ReadinessPrescription | null {
  if (!checkin) return null;
  const score = Math.max(0, Math.min(100, checkin.score));
  const isDeloadWeek = Boolean(mesocycle && !mesocycle.isCompleted && mesocycle.currentWeekSpec.isDeload);

  if (score >= 80) {
    return {
      tier: 'prime',
      label: 'Peak Ready',
      headline: isDeloadWeek ? 'Fresh on Deload Week' : 'Green Light to Push (+2.5%)',
      guidance: isDeloadWeek
        ? 'Energy is high — channel it into explosive bar speed while keeping deload caps.'
        : 'Recovery & nervous system readiness are dialed in. Push top sets cleanly.',
      loadAdjustmentPct: isDeloadWeek ? 0 : 2.5,
      setAdjustment: 0,
    };
  }

  if (score >= 60) {
    return {
      tier: 'ready',
      label: 'Ready',
      headline: 'Normal Plan & Progression',
      guidance: 'Balanced readiness — execute programmed loads and Smart Coach targets as written.',
      loadAdjustmentPct: 0,
      setAdjustment: 0,
    };
  }

  if (score >= 40) {
    return {
      tier: 'moderate',
      label: 'Moderate Fatigue',
      headline: 'Autoregulate (-5% Load)',
      guidance: 'Trim top-set load ~5% or stop 1–2 reps short of failure to protect technique.',
      loadAdjustmentPct: -5,
      setAdjustment: 0,
    };
  }

  return {
    tier: 'low',
    label: 'Recovery Needed',
    headline: 'Fatigue Guard (-10% · -1 Set)',
    guidance: 'High accumulated fatigue detected. Drop working weights ~10% and cut 1 accessory set.',
    loadAdjustmentPct: -10,
    setAdjustment: -1,
  };
}

export function getTodayReadinessCheckin(
  checkins: ReadinessCheckin[],
  now = Date.now(),
): ReadinessCheckin | null {
  const today = new Date(now);
  const matching = checkins
    .filter((c) => c.date && !isNaN(new Date(c.date).getTime()) && isSameDay(new Date(c.date), today))
    .sort((a, b) => b.date - a.date);
  return matching[0] || null;
}

export function computeReadiness7dAverage(
  checkins: ReadinessCheckin[],
  now = Date.now(),
): number | null {
  const recent = checkins.filter((c) => {
    if (!c.date || isNaN(new Date(c.date).getTime())) return false;
    const daysDiff = differenceInCalendarDays(new Date(now), new Date(c.date));
    return daysDiff >= 0 && daysDiff < 7;
  });
  if (recent.length === 0) return null;
  const total = recent.reduce((sum, c) => sum + c.score, 0);
  return Math.round(total / recent.length);
}

/**
 * Applies auto-regulated load (%) and optional set reduction to uncompleted working sets
 * while preserving completed sets and warmups cleanly.
 */
export function scaleExerciseSetsForReadiness(
  exercises: Exercise[],
  loadAdjustmentPct: number,
  setAdjustment = 0,
): Exercise[] {
  const factor = 1 + loadAdjustmentPct / 100;

  return exercises.map((ex) => {
    const nextSets = ex.sets.map((s) => {
      if (s.completed || isWarmupSet(s) || s.weight <= 0 || loadAdjustmentPct === 0) {
        return s;
      }
      const scaled = Math.max(0, Math.round(s.weight * factor * 2) / 2);
      return { ...s, weight: scaled };
    });

    if (setAdjustment < 0) {
      const workingCount = nextSets.filter((s) => !isWarmupSet(s)).length;
      if (workingCount > 2) {
        // Remove the last uncompleted working set
        for (let i = nextSets.length - 1; i >= 0; i--) {
          if (!nextSets[i].completed && !isWarmupSet(nextSets[i])) {
            nextSets.splice(i, 1);
            break;
          }
        }
      }
    }

    return { ...ex, sets: nextSets };
  });
}
