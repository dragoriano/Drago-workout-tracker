import type {
  AppSettings,
  Exercise,
  ExerciseTrackingMode,
  PR,
  Set,
  WorkoutDay,
  WorkoutSession,
} from '../types';
import {
  calculateSetWorkingVolume,
  getExerciseTrackingMode,
} from './exerciseModes';
import { calculateEstimated1RM, isWarmupSet, isWorkingSet } from './strength';
import { computeSupersetMap } from './supersets';
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
  trackingMode: ExerciseTrackingMode;
  targetWeight: number;
  targetReps: number;
  targetDuration: number;
  weightMultiplier: number;
  weightModifier: number;
  repsModifier: number;
  durationModifier: number;
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

function roundToHalf(value: number): number {
  return Math.max(0, Math.round(value * 2) / 2);
}

function roundDurationSeconds(value: number): number {
  return Math.max(5, Math.round(value / 5) * 5);
}

export function evaluateExerciseCoach(
  ex: Exercise,
  isDeload: boolean,
  settings: AppSettings | null,
): CoachEvaluation {
  const trackingMode = getExerciseTrackingMode(ex);
  const targetSet = ex.sets.find(isWorkingSet) ?? ex.sets[0];
  const targetWeight = targetSet?.weight || 0;
  const targetReps = targetSet?.reps || 8;
  const targetDuration = targetSet?.duration ?? 45;
  const history = ex.history;
  const lastSession = history[history.length - 1];
  const secondLastSession = history[history.length - 2];

  const baseFields = {
    trackingMode,
    targetWeight,
    targetReps,
    targetDuration,
    repsModifier: 0,
    durationModifier: 0,
  };

  if (isDeload) {
    return {
      ...baseFields,
      status: 'deload_day',
      weightMultiplier: trackingMode === 'assisted_reps' ? 1.2 : 0.6,
      weightModifier: 0,
      consecutiveFails: 0,
      deloadReductionPct: 40,
      avgRecentRpe: null,
    };
  }

  if (!lastSession || lastSession.sets.length === 0) {
    return {
      ...baseFields,
      status: 'first_session',
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
      const reductionPct = consecutiveFails >= 3 ? 15 : 10;
      const weightMultiplier =
        trackingMode === 'assisted_reps'
          ? consecutiveFails >= 3
            ? 1.15
            : 1.1
          : consecutiveFails >= 3
            ? 0.85
            : 0.9;
      return {
        ...baseFields,
        status: 'auto_deload',
        weightMultiplier,
        weightModifier: 0,
        consecutiveFails,
        deloadReductionPct: reductionPct,
        avgRecentRpe,
      };
    }

    return {
      ...baseFields,
      status: 'retry',
      weightMultiplier: 1,
      weightModifier: 0,
      consecutiveFails,
      deloadReductionPct: 0,
      avgRecentRpe,
    };
  }

  if (!lastAllCompleted) {
    return {
      ...baseFields,
      status: 'retry',
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
        ...baseFields,
        status: 'rpe_hold',
        weightMultiplier: 1,
        weightModifier: 0,
        consecutiveFails: 0,
        deloadReductionPct: 0,
        avgRecentRpe,
      };
    }

    if (trackingMode === 'timed') {
      return {
        ...baseFields,
        status: 'overload',
        weightMultiplier: 1,
        weightModifier: 0,
        durationModifier: 5,
        consecutiveFails: 0,
        deloadReductionPct: 0,
        avgRecentRpe,
      };
    }

    if (trackingMode === 'assisted_reps') {
      return {
        ...baseFields,
        status: 'overload',
        weightMultiplier: 1,
        weightModifier: -2.5,
        consecutiveFails: 0,
        deloadReductionPct: 0,
        avgRecentRpe,
      };
    }

    if (trackingMode === 'bodyweight_reps') {
      const lastWorking = getRelevantSetsForCoach(lastSession.sets);
      const usesAddedLoad = lastWorking.some((s) => (s.weight || 0) > 0);
      return {
        ...baseFields,
        status: 'overload',
        weightMultiplier: 1,
        weightModifier: usesAddedLoad ? 2.5 : 0,
        repsModifier: usesAddedLoad ? 0 : 1,
        consecutiveFails: 0,
        deloadReductionPct: 0,
        avgRecentRpe,
      };
    }

    return {
      ...baseFields,
      status: 'overload',
      weightMultiplier: 1,
      weightModifier: 2.5,
      consecutiveFails: 0,
      deloadReductionPct: 0,
      avgRecentRpe,
    };
  }

  return {
    ...baseFields,
    status: 'maintain',
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
  const mode = evaluation.trackingMode;

  if (isDeload) {
    const baseSession = lastSession || null;
    if (baseSession && baseSession.sets.length > 0) {
      newSets = newSets.map((s, i) => {
        const ls = baseSession.sets[i] || baseSession.sets[baseSession.sets.length - 1];
        if (mode === 'timed') {
          const baseDuration = ls.duration ?? s.duration ?? 45;
          return {
            ...s,
            id: s.id || generateId(),
            weight: roundToHalf((ls.weight || 0) * 0.6),
            reps: s.reps,
            duration: roundDurationSeconds(baseDuration * 0.6),
            completed: false,
            rpe: undefined,
          };
        }
        return {
          ...s,
          id: s.id || generateId(),
          weight: roundToHalf(ls.weight * evaluation.weightMultiplier),
          reps: s.reps,
          completed: false,
          rpe: undefined,
        };
      });
    } else {
      newSets = newSets.map((s) => ({
        ...s,
        weight: roundToHalf(s.weight * evaluation.weightMultiplier),
        ...(mode === 'timed'
          ? { duration: roundDurationSeconds((s.duration ?? 45) * 0.6) }
          : {}),
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
          ...(mode === 'timed'
            ? { duration: prevWarmup?.duration ?? s.duration ?? 30 }
            : {}),
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

      if (mode === 'timed') {
        const baseDuration = ls.duration ?? s.duration ?? 45;
        let nextDuration = baseDuration;
        if (evaluation.status === 'auto_deload') {
          const factor = evaluation.deloadReductionPct >= 15 ? 0.85 : 0.9;
          nextDuration = roundDurationSeconds(baseDuration * factor);
        } else {
          nextDuration = Math.max(5, Math.round(baseDuration + evaluation.durationModifier));
        }

        return {
          ...s,
          id: s.id || generateId(),
          weight: ls.weight ?? s.weight,
          reps: s.reps,
          duration: nextDuration,
          completed: false,
          rpe: undefined,
        };
      }

      const newWeight = Math.max(
        0,
        roundToHalf(ls.weight * evaluation.weightMultiplier) + evaluation.weightModifier,
      );
      const nextReps =
        evaluation.repsModifier !== 0
          ? Math.max(1, (ls.reps || s.reps || 8) + evaluation.repsModifier)
          : s.reps;

      return {
        ...s,
        id: s.id || generateId(),
        weight: newWeight,
        reps: nextReps,
        completed: false,
        rpe: undefined,
      };
    });
  } else {
    newSets = newSets.map((set) => ({
      ...set,
      ...(mode === 'timed' ? { duration: set.duration ?? 45 } : {}),
      completed: false,
      rpe: undefined,
    }));
  }

  return newSets;
}

export function estimateWorkoutDurationMinutes(
  day: WorkoutDay | null,
): { min: number; max: number } | null {
  if (!day || day.exercises.length === 0) return null;

  let minSec = 300;
  let maxSec = 300;
  const supersetMap = computeSupersetMap(day.exercises);
  const processedGroupIds = new Set<string>();

  for (const ex of day.exercises) {
    const setsCount = Math.max(ex.sets.length, 1);
    const meta = supersetMap.get(ex.id);

    if (meta) {
      minSec += setsCount * 35 + 40;
      maxSec += setsCount * 50 + 60;
      if (!processedGroupIds.has(meta.groupId)) {
        processedGroupIds.add(meta.groupId);
        const members = day.exercises.filter((m) => meta.memberIds.includes(m.id));
        const maxSetsInBlock = Math.max(1, ...members.map((m) => Math.max(m.sets.length, 1)));
        const sharedRest = meta.sharedRestSeconds || 90;
        const totalRestSec = Math.max(maxSetsInBlock - 1, 0) * sharedRest;
        minSec += totalRestSec;
        maxSec += totalRestSec;
      }
      continue;
    }

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
    const mode = getExerciseTrackingMode(ex);
    let maxWeightThisSession = 0;
    let maxE1RMThisSession = 0;
    let maxRepsThisSession = 0;
    let maxDurationThisSession = 0;

    for (const set of ex.sets) {
      if (!set.completed || isWarmupSet(set)) continue;
      totalVolume += calculateSetWorkingVolume(set, mode);

      if (set.weight > maxWeightThisSession) {
        maxWeightThisSession = set.weight;
      }
      if (set.reps > maxRepsThisSession) {
        maxRepsThisSession = set.reps;
      }
      const dur = set.duration ?? 0;
      if (dur > maxDurationThisSession) {
        maxDurationThisSession = dur;
      }
      if (mode === 'weight_reps') {
        const e1rm = calculateEstimated1RM(set.weight, set.reps);
        if (e1rm > maxE1RMThisSession) {
          maxE1RMThisSession = e1rm;
        }
      }
    }

    let previousMaxWeight = 0;
    let previousMaxE1RM = 0;
    let previousMaxReps = 0;
    let previousMaxDuration = 0;

    for (const hist of ex.history) {
      for (const set of hist.sets) {
        if (!set.completed || isWarmupSet(set)) continue;
        if (set.weight > previousMaxWeight) {
          previousMaxWeight = set.weight;
        }
        if (set.reps > previousMaxReps) {
          previousMaxReps = set.reps;
        }
        const dur = set.duration ?? 0;
        if (dur > previousMaxDuration) {
          previousMaxDuration = dur;
        }
        if (mode === 'weight_reps') {
          const e1rm = calculateEstimated1RM(set.weight, set.reps);
          if (e1rm > previousMaxE1RM) {
            previousMaxE1RM = e1rm;
          }
        }
      }
    }

    if (mode === 'timed') {
      if (maxDurationThisSession > previousMaxDuration && maxDurationThisSession > 0) {
        detectedPRs.push({
          exerciseId: ex.id,
          exerciseName: ex.name,
          type: 'duration',
          value: maxDurationThisSession,
          previousValue: previousMaxDuration,
        });
      }
      continue;
    }

    if (mode === 'assisted_reps') {
      if (maxRepsThisSession > previousMaxReps && maxRepsThisSession > 0) {
        detectedPRs.push({
          exerciseId: ex.id,
          exerciseName: ex.name,
          type: 'reps',
          value: maxRepsThisSession,
          previousValue: previousMaxReps,
        });
      }
      continue;
    }

    if (mode === 'bodyweight_reps') {
      if (maxWeightThisSession > previousMaxWeight && maxWeightThisSession > 0) {
        detectedPRs.push({
          exerciseId: ex.id,
          exerciseName: ex.name,
          type: 'weight',
          value: maxWeightThisSession,
          previousValue: previousMaxWeight,
        });
      }
      if (maxRepsThisSession > previousMaxReps && maxRepsThisSession > 0) {
        detectedPRs.push({
          exerciseId: ex.id,
          exerciseName: ex.name,
          type: 'reps',
          value: maxRepsThisSession,
          previousValue: previousMaxReps,
        });
      }
      continue;
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
