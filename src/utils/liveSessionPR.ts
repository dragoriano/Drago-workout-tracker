import type { Exercise, Set } from '../types';
import {
  calculateSetWorkingVolume,
  formatDurationCompact,
  formatSetSummary,
  getExerciseTrackingMode,
  supportsEstimated1RM,
} from './exerciseModes';
import { calculateEstimated1RM, isWarmupSet, type WeightUnit } from './strength';

export type LivePRKind = 'weight' | '1rm' | 'volume' | 'reps' | 'duration';

export interface LivePRHit {
  kind: LivePRKind;
  shortTag: string;
  headline: string;
  valueLabel: string;
  deltaLabel: string | null;
  secondaryTags: string[];
}

export interface ExerciseBenchmarks {
  hasHistory: boolean;
  bestWeight: number;
  best1RM: number;
  bestSetVolume: number;
  bestReps: number;
  bestDuration: number;
  bestWeightSetLabel: string | null;
}

export interface RecentExerciseSessionSummary {
  sessionId: string;
  date: number;
  workingSets: Set[];
  totalVolume: number;
  best1RM: number | null;
  bestWeight: number;
  topSetSummary: string;
  volumeDeltaPct: number | null;
}

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

/**
 * Computes best historical benchmarks across completed non-warmup sets for an exercise.
 */
export function computeExerciseHistoricalBenchmarks(exercise: Exercise): ExerciseBenchmarks {
  const mode = getExerciseTrackingMode(exercise);
  const canE1RM = supportsEstimated1RM(mode);
  let hasHistory = false;
  let bestWeight = 0;
  let best1RM = 0;
  let bestSetVolume = 0;
  let bestReps = 0;
  let bestDuration = 0;
  let bestWeightSetLabel: string | null = null;

  for (const hist of exercise.history || []) {
    for (const s of hist.sets || []) {
      if (!s.completed || isWarmupSet(s)) continue;
      hasHistory = true;

      const dur = s.duration ?? 0;
      if (dur > bestDuration) {
        bestDuration = dur;
      }

      if ((s.reps || 0) > bestReps) {
        bestReps = s.reps || 0;
      }

      if ((s.weight || 0) > bestWeight) {
        bestWeight = s.weight || 0;
        bestWeightSetLabel = `${s.weight}×${s.reps}`;
      }

      if (canE1RM && s.weight > 0 && s.reps > 0) {
        const e1rm = calculateEstimated1RM(s.weight, s.reps);
        if (e1rm > best1RM) best1RM = e1rm;
      }

      const setVol = calculateSetWorkingVolume(s, mode);
      if (setVol > bestSetVolume) {
        bestSetVolume = setVol;
      }
    }
  }

  return {
    hasHistory,
    bestWeight,
    best1RM,
    bestSetVolume,
    bestReps,
    bestDuration,
    bestWeightSetLabel,
  };
}

/**
 * Evaluates whether completing `targetSet` breaks an all-time or earlier-in-session PR.
 */
export function evaluateLiveSetPR(
  exercise: Exercise,
  targetSet: Set,
  unit: WeightUnit,
): LivePRHit | null {
  if (!targetSet.completed || isWarmupSet(targetSet)) return null;

  const mode = getExerciseTrackingMode(exercise);
  if (mode === 'assisted_reps') return null;

  const benchmarks = computeExerciseHistoricalBenchmarks(exercise);
  if (!benchmarks.hasHistory) return null;

  let prevWeight = benchmarks.bestWeight;
  let prev1RM = benchmarks.best1RM;
  let prevSetVol = benchmarks.bestSetVolume;
  let prevReps = benchmarks.bestReps;
  let prevDuration = benchmarks.bestDuration;

  const canE1RM = supportsEstimated1RM(mode);

  for (const s of exercise.sets || []) {
    if (s.id === targetSet.id) break;
    if (!s.completed || isWarmupSet(s)) continue;
    if ((s.duration ?? 0) > prevDuration) prevDuration = s.duration ?? 0;
    if ((s.reps || 0) > prevReps) prevReps = s.reps || 0;
    if ((s.weight || 0) > prevWeight) prevWeight = s.weight || 0;
    if (canE1RM && s.weight > 0 && s.reps > 0) {
      const e1 = calculateEstimated1RM(s.weight, s.reps);
      if (e1 > prev1RM) prev1RM = e1;
    }
    const sv = calculateSetWorkingVolume(s, mode);
    if (sv > prevSetVol) prevSetVol = sv;
  }

  if (mode === 'timed') {
    const curDur = targetSet.duration ?? 0;
    if (curDur > prevDuration && curDur > 0) {
      const delta = Math.max(1, Math.round(curDur - prevDuration));
      return {
        kind: 'duration',
        shortTag: 'HOLD PR',
        headline: 'Hold Duration PR',
        valueLabel: formatDurationCompact(curDur),
        deltaLabel: `+${formatDurationCompact(delta)}`,
        secondaryTags: [],
      };
    }
    return null;
  }

  if (mode === 'bodyweight_reps' && (targetSet.weight || 0) <= 0) {
    const curReps = targetSet.reps || 0;
    if (curReps > prevReps && curReps > 0) {
      const delta = curReps - prevReps;
      return {
        kind: 'reps',
        shortTag: 'REP PR',
        headline: 'Max Reps PR',
        valueLabel: `${curReps} reps`,
        deltaLabel: `+${delta} ${delta === 1 ? 'rep' : 'reps'}`,
        secondaryTags: [],
      };
    }
    return null;
  }

  const curWeight = targetSet.weight || 0;
  const curReps = targetSet.reps || 0;
  if (curWeight <= 0) return null;

  const weightBroken = curWeight > prevWeight;
  const cur1RM = canE1RM && curReps > 0 ? calculateEstimated1RM(curWeight, curReps) : 0;
  const e1rmBroken = canE1RM && cur1RM > prev1RM + 0.05 && prev1RM > 0;
  const curVol = calculateSetWorkingVolume(targetSet, mode);
  const volBroken = curVol > prevSetVol && prevSetVol > 0;

  if (!weightBroken && !e1rmBroken && !volBroken) return null;

  const secondaryTags: string[] = [];
  if (weightBroken) {
    if (e1rmBroken) secondaryTags.push('Est. 1RM PR');
    if (volBroken) secondaryTags.push('Set Volume PR');
    const deltaW = round1(curWeight - prevWeight);
    return {
      kind: 'weight',
      shortTag: 'WT PR',
      headline: 'Weight PR',
      valueLabel: `${curWeight} ${unit}`,
      deltaLabel: prevWeight > 0 ? `+${deltaW} ${unit}` : null,
      secondaryTags,
    };
  }

  if (e1rmBroken) {
    if (volBroken) secondaryTags.push('Set Volume PR');
    const delta1RM = round1(cur1RM - prev1RM);
    return {
      kind: '1rm',
      shortTag: '1RM PR',
      headline: 'Est. 1RM PR',
      valueLabel: `${cur1RM} ${unit} e1RM`,
      deltaLabel: `+${delta1RM} ${unit}`,
      secondaryTags,
    };
  }

  const deltaVol = Math.round(curVol - prevSetVol);
  return {
    kind: 'volume',
    shortTag: 'VOL PR',
    headline: 'Set Volume PR',
    valueLabel: `${Math.round(curVol).toLocaleString()} ${unit} vol`,
    deltaLabel: `+${deltaVol.toLocaleString()} ${unit}`,
    secondaryTags: [],
  };
}

/**
 * Evaluates all completed sets in sequence to return per-set LivePRHit badges.
 */
export function getExerciseLivePRSetMap(
  exercise: Exercise,
  unit: WeightUnit,
): Map<string, LivePRHit> {
  const result = new Map<string, LivePRHit>();
  for (const s of exercise.sets || []) {
    if (!s.completed || isWarmupSet(s)) continue;
    const hit = evaluateLiveSetPR(exercise, s, unit);
    if (hit) {
      result.set(s.id, hit);
    }
  }
  return result;
}

/**
 * Returns up to `limit` recent historical sessions for an exercise, newest first.
 */
export function getRecentExerciseSessions(
  exercise: Exercise,
  unit: WeightUnit,
  limit = 3,
): RecentExerciseSessionSummary[] {
  const mode = getExerciseTrackingMode(exercise);
  const canE1RM = supportsEstimated1RM(mode);

  const nonEmpty = [...(exercise.history || [])]
    .filter((h) => Array.isArray(h.sets) && h.sets.length > 0)
    .sort((a, b) => b.date - a.date);

  const summaries = nonEmpty.slice(0, limit + 1).map((hist) => {
    const working = hist.sets.filter((s) => !isWarmupSet(s));
    const displaySets = working.length > 0 ? working : hist.sets;
    let totalVolume = 0;
    let best1RM: number | null = null;
    let bestWeight = 0;
    let bestScore = -1;
    let topSet: Set = displaySets[0];

    for (const s of displaySets) {
      const vol = calculateSetWorkingVolume(s, mode);
      if (s.completed) totalVolume += vol;
      if ((s.weight || 0) > bestWeight) bestWeight = s.weight || 0;
      if (canE1RM && s.completed && s.weight > 0 && s.reps > 0) {
        const e1 = calculateEstimated1RM(s.weight, s.reps);
        if (best1RM === null || e1 > best1RM) best1RM = e1;
      }
      const score = mode === 'timed' ? (s.duration ?? 0) : (s.weight || 0) * 100 + (s.reps || 0);
      if (score > bestScore) {
        bestScore = score;
        topSet = s;
      }
    }

    return {
      sessionId: hist.sessionId,
      date: hist.date,
      workingSets: displaySets,
      totalVolume: Math.round(totalVolume),
      best1RM,
      bestWeight,
      topSetSummary: formatSetSummary(topSet, mode, unit),
      volumeDeltaPct: null as number | null,
    };
  });

  for (let i = 0; i < Math.min(limit, summaries.length); i++) {
    const prevOlder = summaries[i + 1];
    if (prevOlder && prevOlder.totalVolume > 0) {
      summaries[i].volumeDeltaPct = Math.round(
        ((summaries[i].totalVolume - prevOlder.totalVolume) / prevOlder.totalVolume) * 100,
      );
    }
  }

  return summaries.slice(0, limit);
}
