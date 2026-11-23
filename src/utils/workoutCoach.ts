import { AppSettings, Exercise, PR, Set, WorkoutDay, WorkoutSession } from '../types';
import { calculateEstimated1RM, isWarmupSet, isWorkingSet } from './strength';
import { generateId } from './uuid';

export type CoachStatus =
  | 'deload_day'
  | 'first_session'
  | 'auto_deload'
  | 'retry'
  | 'rpe_hold'
  | 'overload'
  | 'maintain';

export interface CoachEvaluation {
  status: CoachStatus;
  targetWeight: number;
  targetReps: number;
  weightMultiplier: number;
  weightModifier: number;
  consecutiveFails: number;
  deloadReductionPct: number;
  avgRecentRpe: number | null;
}

function getRelevantSetsForCoach(sets: Set[]): Set[] {
  const working = sets.filter(isWorkingSet);
  return working.length > 0 ? working : sets;
}

function getAverageWorkingRpe(sets: Set[]): number | null {
  let sum = 0;
  let count = 0;
  for (const s of sets) {
    if (!s.completed || isWarmupSet(s)) continue;
    if (typeof s.rpe === 'number' && Number.isFinite(s.rpe) && s.rpe > 0) {
      sum += s.rpe;
      count++;
    }
  }
  return count > 0 ? Math.round((sum / count) * 10) / 10 : null;
}

export function evaluateExerciseCoach(
  ex: Exercise,
  isDeload: boolean,
  settings: AppSettings | null,
): CoachEvaluation {
  const targetSet = ex.sets.find(isWorkingSet) ?? ex.sets[0];
  const targetWeight = targetSet?.weight || 0;
  const targetReps = targetSet?.reps || 8;
  const history = ex.history;
  const lastSession = history[history.length - 1];
  const secondLastSession = history[history.length - 2];

  if (isDeload) {
    return {
      status: 'deload_day',
      targetWeight,
      targetReps,
      weightMultiplier: 0.6,
      weightModifier: 0,
      consecutiveFails: 0,
      deloadReductionPct: 40,
      avgRecentRpe: null,
    };
  }

  if (!lastSession || lastSession.sets.length === 0) {
    return {
      status: 'first_session',
      targetWeight,
      targetReps,
      weightMultiplier: 1,
      weightModifier: 0,
      consecutiveFails: 0,
      deloadReductionPct: 0,
      avgRecentRpe: null,
    };
  }

  let consecutiveFails = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const relevant = getRelevantSetsForCoach(history[i].sets);
    const allCompleted = relevant.length > 0 && relevant.every((s) => s.completed);
    if (!allCompleted) consecutiveFails++;
    else break;
  }

  const lastRelevant = getRelevantSetsForCoach(lastSession.sets);
  const lastAllCompleted = lastRelevant.length > 0 && lastRelevant.every((s) => s.completed);
  const prevRelevant = secondLastSession ? getRelevantSetsForCoach(secondLastSession.sets) : [];
  const prevAllCompleted = prevRelevant.length > 0 && prevRelevant.every((s) => s.completed);
  const avgRecentRpe = getAverageWorkingRpe(lastSession.sets);

  if (consecutiveFails >= 2) {
    if (settings?.autoDeload) {
      const weightMultiplier = consecutiveFails >= 3 ? 0.85 : 0.9;
      return {
        status: 'auto_deload',
        targetWeight,
        targetReps,
        weightMultiplier,
        weightModifier: 0,
        consecutiveFails,
        deloadReductionPct: consecutiveFails >= 3 ? 15 : 10,
        avgRecentRpe,
      };
    }

    return {
      status: 'retry',
      targetWeight,
      targetReps,
      weightMultiplier: 1,
      weightModifier: 0,
      consecutiveFails,
      deloadReductionPct: 0,
      avgRecentRpe,
    };
  }

  if (!lastAllCompleted) {
    return {
      status: 'retry',
      targetWeight,
      targetReps,
      weightMultiplier: 1,
      weightModifier: 0,
      consecutiveFails,
      deloadReductionPct: 0,
      avgRecentRpe,
    };
  }

  if (lastAllCompleted && prevAllCompleted && settings?.smartSuggestions) {
    if (avgRecentRpe !== null && avgRecentRpe >= 9.5) {
      return {
        status: 'rpe_hold',
        targetWeight,
        targetReps,
        weightMultiplier: 1,
        weightModifier: 0,
        consecutiveFails: 0,
        deloadReductionPct: 0,
        avgRecentRpe,
      };
    }

    return {
      status: 'overload',
      targetWeight,
      targetReps,
      weightMultiplier: 1,
      weightModifier: 2.5,
      consecutiveFails: 0,
      deloadReductionPct: 0,
      avgRecentRpe,
    };
  }

  return {
    status: 'maintain',
    targetWeight,
    targetReps,
    weightMultiplier: 1,
    weightModifier: 0,
    consecutiveFails: 0,
    deloadReductionPct: 0,
    avgRecentRpe,
  };
}

export function computeSmartSets(
  ex: Exercise,
  isDeload: boolean,
  settings: AppSettings | null,
): Set[] {
  let newSets = [...ex.sets];
  const history = ex.history;
  const lastSession = history[history.length - 1];
  const evaluation = evaluateExerciseCoach(ex, isDeload, settings);

  if (isDeload) {
    const baseSession = lastSession || null;
    if (baseSession && baseSession.sets.length > 0) {
      newSets = newSets.map((s, i) => {
        const ls = baseSession.sets[i] || baseSession.sets[baseSession.sets.length - 1];
        return {
          ...s,
          id: s.id || generateId(),
          weight: Math.max(0, Math.round(ls.weight * 0.6 * 2) / 2),
          reps: s.reps,
          completed: false,
          rpe: undefined,
        };
      });
    } else {
      newSets = newSets.map((s) => ({
        ...s,
        weight: Math.max(0, Math.round(s.weight * 0.6 * 2) / 2),
        completed: false,
        rpe: undefined,
      }));
    }
  } else if (lastSession && lastSession.sets.length > 0) {
    const lastWarmups = lastSession.sets.filter(isWarmupSet);
    const lastWorking = lastSession.sets.filter(isWorkingSet);
    let warmupIdx = 0;
    let workingIdx = 0;

    newSets = newSets.map((s, i) => {
      if (isWarmupSet(s)) {
        const prevWarmup = lastWarmups[warmupIdx];
        warmupIdx++;
        return {
          ...s,
          id: s.id || generateId(),
          weight: prevWarmup?.weight ?? s.weight,
          reps: s.reps,
          completed: false,
          setType: 'warmup',
          rpe: undefined,
        };
      }

      const ls =
        lastWorking[workingIdx] ||
        lastWorking[lastWorking.length - 1] ||
        lastSession.sets[i] ||
        lastSession.sets[lastSession.sets.length - 1];
      workingIdx++;
      const newWeight =
        Math.max(0, Math.round(ls.weight * evaluation.weightMultiplier * 2) / 2) +
        evaluation.weightModifier;

      return {
        ...s,
        id: s.id || generateId(),
        weight: newWeight,
        reps: s.reps,
        completed: false,
        rpe: undefined,
      };
    });
  } else {
    newSets = newSets.map((set) => ({ ...set, completed: false, rpe: undefined }));
  }

  return newSets;
}

export function estimateWorkoutDurationMinutes(
  day: WorkoutDay | null,
): { min: number; max: number } | null {
  if (!day || day.exercises.length === 0) return null;

  let minSec = 300;
  let maxSec = 300;

  for (const ex of day.exercises) {
    const setsCount = Math.max(ex.sets.length, 1);
    const restSec = ex.restTimerConfig || 90;
    const totalRestSec = Math.max(setsCount - 1, 0) * restSec;
    minSec += setsCount * 35 + totalRestSec + 60;
    maxSec += setsCount * 50 + totalRestSec + 90;
  }

  const roundTo5 = (sec: number) => Math.round(sec / 60 / 5) * 5;
  const min = Math.max(10, roundTo5(minSec));
  const max = Math.max(min + 5, roundTo5(maxSec));

  return { min, max };
}

export function detectSessionPRs(exercises: Exercise[]): {
  totalVolume: number;
  detectedPRs: PR[];
} {
  let totalVolume = 0;
  const detectedPRs: PR[] = [];

  for (const ex of exercises) {
    let maxWeightThisSession = 0;
    let maxE1RMThisSession = 0;
    for (const set of ex.sets) {
      if (!set.completed || isWarmupSet(set)) continue;
      totalVolume += set.weight * set.reps;
      if (set.weight > maxWeightThisSession) {
        maxWeightThisSession = set.weight;
      }
      const e1rm = calculateEstimated1RM(set.weight, set.reps);
      if (e1rm > maxE1RMThisSession) {
        maxE1RMThisSession = e1rm;
      }
    }

    let previousMaxWeight = 0;
    let previousMaxE1RM = 0;
    for (const hist of ex.history) {
      for (const set of hist.sets) {
        if (!set.completed || isWarmupSet(set)) continue;
        if (set.weight > previousMaxWeight) {
          previousMaxWeight = set.weight;
        }
        const e1rm = calculateEstimated1RM(set.weight, set.reps);
        if (e1rm > previousMaxE1RM) {
          previousMaxE1RM = e1rm;
        }
      }
    }

    if (maxWeightThisSession > previousMaxWeight && maxWeightThisSession > 0) {
      detectedPRs.push({
        exerciseId: ex.id,
        exerciseName: ex.name,
        type: 'weight',
        value: maxWeightThisSession,
        previousValue: previousMaxWeight,
      });
    }

    if (maxE1RMThisSession > previousMaxE1RM && maxE1RMThisSession > 0) {
      detectedPRs.push({
        exerciseId: ex.id,
        exerciseName: ex.name,
        type: '1rm',
        value: maxE1RMThisSession,
        previousValue: previousMaxE1RM,
      });
    }
  }

  return { totalVolume, detectedPRs };
}

export function computeOverloadSpikePercent(
  totalVolume: number,
  sameDaySessions: WorkoutSession[],
): number {
  const recent = [...sameDaySessions].sort((a, b) => b.date - a.date).slice(0, 3);
  if (recent.length === 0) return 0;

  const avgVolume = recent.reduce((sum, s) => sum + s.totalVolume, 0) / recent.length;
  return avgVolume > 0 ? Math.round(((totalVolume - avgVolume) / avgVolume) * 100) : 0;
}
