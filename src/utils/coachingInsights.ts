import { differenceInCalendarDays } from 'date-fns';
import type { Goal, WorkoutSession } from '../types';
import { getExerciseTrackingMode, supportsEstimated1RM } from './exerciseModes';
import { getBestSet1RM, type WeightUnit } from './strength';
import {
  STRENGTH_TIER_LABELS,
  type StrengthStandardsSummary,
} from './strengthStandards';

export interface PlateauAlert {
  exerciseName: string;
  recentE1rms: number[];
  latestE1rm: number;
  sessionsStalled: number;
  prescriptionTitle: string;
  prescriptionDetail: string;
}

export interface StrengthGoalForecast {
  id: string;
  label: string;
  exerciseName: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  weeklyGainRate: number;
  weeksToTarget: number;
  estimatedDate: number;
  source: 'goal' | 'tier';
}

interface ExercisePoint {
  date: number;
  e1rm: number;
}

function collectExerciseSeries(
  sessions: WorkoutSession[],
): Map<string, { displayName: string; points: ExercisePoint[] }> {
  const byKey = new Map<string, { displayName: string; points: ExercisePoint[] }>();
  const sorted = [...sessions]
    .filter((s) => s.date && !isNaN(new Date(s.date).getTime()))
    .sort((a, b) => a.date - b.date);

  for (const s of sorted) {
    for (const ex of s.exercisesSnapshot || []) {
      if (!supportsEstimated1RM(getExerciseTrackingMode(ex))) continue;
      const best = getBestSet1RM(ex.sets);
      if (!best || best.e1rm <= 0) continue;

      const key = ex.name.toLowerCase().trim();
      let entry = byKey.get(key);
      if (!entry) {
        entry = { displayName: ex.name, points: [] };
        byKey.set(key, entry);
      } else {
        entry.displayName = ex.name;
      }
      entry.points.push({ date: s.date, e1rm: best.e1rm });
    }
  }

  return byKey;
}

/**
 * Flags exercises that have gone >= 3 weighted sessions without beating the prior 2-session peak e1RM.
 */
export function detectLiftPlateaus(
  sessions: WorkoutSession[],
  options?: { minSessions?: number; unit?: WeightUnit },
): PlateauAlert[] {
  const minSessions = options?.minSessions ?? 3;
  const unit = options?.unit ?? 'kg';
  const seriesMap = collectExerciseSeries(sessions);
  const alerts: PlateauAlert[] = [];

  for (const entry of seriesMap.values()) {
    if (entry.points.length < minSessions) continue;

    // Look at trailing 3-4 sessions
    const tail = entry.points.slice(-4);
    const recent3 = entry.points.slice(-3);
    const earliestInTail = recent3[0].e1rm;
    const latest = recent3[recent3.length - 1].e1rm;
    const priorPeak = Math.max(...recent3.slice(0, -1).map((p) => p.e1rm));

    // Stalled if latest failed to exceed priorPeak * 1.005 AND overall tail didn't climb
    const isFlatOrDown = latest <= priorPeak * 1.005 && latest <= earliestInTail * 1.01;
    if (!isFlatOrDown) continue;

    const sessionsStalled = tail.filter((p) => p.e1rm <= priorPeak * 1.005).length;

    let prescriptionTitle = 'Rep-Range Undulation';
    let prescriptionDetail = `Rotate working sets (+2–3 reps @ -7% load) for 2 weeks before re-testing ${unit} top weight.`;

    if (latest < priorPeak * 0.96) {
      prescriptionTitle = 'Micro-Deload & Fresh Pivot';
      prescriptionDetail =
        'Performance dipped >4% — take 1 light session at 65% load or Smart Swap to a joint-friendly variation.';
    } else if (recent3.every((p) => Math.abs(p.e1rm - latest) <= 1)) {
      prescriptionTitle = 'Add 1 Rep or Smart Swap';
      prescriptionDetail =
        'Exact load/rep lock across 3 sessions — push +1 rep on Set 1 or swap equipment variation for fresh stimulus.';
    }

    alerts.push({
      exerciseName: entry.displayName,
      recentE1rms: recent3.map((p) => p.e1rm),
      latestE1rm: latest,
      sessionsStalled: Math.max(3, sessionsStalled),
      prescriptionTitle,
      prescriptionDetail,
    });
  }

  return alerts.sort((a, b) => b.latestE1rm - a.latestE1rm).slice(0, 4);
}

function estimateWeeklySlope(points: ExercisePoint[]): number | null {
  if (points.length < 2) return null;
  const recent = points.slice(-8);
  const first = recent[0];
  const last = recent[recent.length - 1];
  const spanDays = differenceInCalendarDays(new Date(last.date), new Date(first.date));
  if (spanDays < 7) return null;

  // Simple ordinary least-squares slope in e1RM units per week
  const xs = recent.map((p) => (p.date - first.date) / (7 * 24 * 60 * 60 * 1000));
  const ys = recent.map((p) => p.e1rm);
  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;

  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - meanX;
    num += dx * (ys[i] - meanY);
    den += dx * dx;
  }

  if (den <= 0) return null;
  const slope = num / den;
  return slope > 0.08 ? Math.round(slope * 100) / 100 : null;
}

/**
 * Forecasts estimated arrival dates for active exercise Goals and upcoming Big 5 Strength Tiers
 * based on trailing positive linear progression rate.
 */
export function forecastStrengthGoals(
  sessions: WorkoutSession[],
  goals: Goal[],
  standards: StrengthStandardsSummary,
  options?: { unit?: WeightUnit; now?: number },
): StrengthGoalForecast[] {
  const unit = options?.unit ?? 'kg';
  const now = options?.now ?? Date.now();
  const seriesMap = collectExerciseSeries(sessions);
  const forecasts: StrengthGoalForecast[] = [];

  // 1. User's explicit exercise_e1rm Goals
  for (const g of goals) {
    if (g.completed || g.trackingType !== 'exercise_e1rm' || !g.linkedExerciseName) continue;
    const entry = seriesMap.get(g.linkedExerciseName.toLowerCase().trim());
    if (!entry || entry.points.length < 2) continue;

    const latest = entry.points[entry.points.length - 1].e1rm;
    if (latest >= g.targetValue) continue;

    const slope = estimateWeeklySlope(entry.points);
    if (!slope) continue;

    const weeks = Math.max(1, Math.min(52, Math.ceil((g.targetValue - latest) / slope)));
    forecasts.push({
      id: `goal-${g.id}`,
      label: g.title,
      exerciseName: entry.displayName,
      currentValue: latest,
      targetValue: g.targetValue,
      unit: g.unit || unit,
      weeklyGainRate: Math.round(slope * 10) / 10,
      weeksToTarget: weeks,
      estimatedDate: now + weeks * 7 * 24 * 60 * 60 * 1000,
      source: 'goal',
    });
  }

  // 2. Next Big 5 Strength Tier ETAs
  for (const lift of standards.lifts) {
    if (
      !lift.matchedExerciseName ||
      lift.e1rm === null ||
      !lift.nextTier ||
      !lift.nextTierTarget ||
      lift.e1rm >= lift.nextTierTarget
    ) {
      continue;
    }

    const entry = seriesMap.get(lift.matchedExerciseName.toLowerCase().trim());
    if (!entry || entry.points.length < 2) continue;
    const slope = estimateWeeklySlope(entry.points);
    if (!slope) continue;

    const weeks = Math.max(1, Math.min(52, Math.ceil((lift.nextTierTarget - lift.e1rm) / slope)));
    forecasts.push({
      id: `tier-${lift.key}`,
      label: `${lift.shortLabel} → ${STRENGTH_TIER_LABELS[lift.nextTier]}`,
      exerciseName: lift.matchedExerciseName,
      currentValue: lift.e1rm,
      targetValue: lift.nextTierTarget,
      unit,
      weeklyGainRate: Math.round(slope * 10) / 10,
      weeksToTarget: weeks,
      estimatedDate: now + weeks * 7 * 24 * 60 * 60 * 1000,
      source: 'tier',
    });
  }

  return forecasts.sort((a, b) => a.weeksToTarget - b.weeksToTarget).slice(0, 5);
}
