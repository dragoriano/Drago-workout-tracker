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
import type { MesocycleProgressSummary } from './mesocycle';
import { getEstimatedReadyLabel } from './anatomicalRecovery';
import {
  resolveExerciseBroadMuscles,
  type BroadMuscleGroup,
  type MuscleRecoveryStatus,
} from './muscleRecovery';
import { calculateEstimated1RM, isWarmupSet, isWorkingSet } from './strength';
import { computeSupersetMap } from './supersets';
import { generateId } from './uuid';

export type CoachStatus =
  | 'deload_day'
  | 'first_session'
  | 'layoff_ramp'
  | 'auto_deload'
  | 'retry'
  | 'fatigue_hold'
  | 'rpe_hold'
  | 'overload'
  | 'maintain';

export type LiftProgressionClass =
  | 'compound_lower'
  | 'compound_upper'
  | 'dumbbell_isolation';

export type ProgressionKind =
  | 'load'
  | 'double_reps'
  | 'double_weight_reset'
  | 'duration'
  | 'hold'
  | 'deload'
  | 'ramp_in';

export interface SmartCoachContext {
  now?: number;
  mesocycle?: MesocycleProgressSummary | null;
  muscleReadiness?: MuscleRecoveryStatus | null;
  todayReadinessScore?: number | null;
}

export interface CoachEvaluation {
  status: CoachStatus;
  trackingMode: ExerciseTrackingMode;
  liftClass: LiftProgressionClass;
  progressionKind: ProgressionKind;
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
  fastTracked: boolean;
  daysSinceLastSession: number | null;
  rationale: string;
}

export interface LiveSetAutoregulation {
  direction: 'drop' | 'bump';
  nextSetId: string;
  nextSetIndex: number;
  currentWeight: number;
  suggestedWeight: number;
  deltaWeight: number;
  reason: string;
}

export interface DebriefExerciseProjection {
  exerciseName: string;
  trackingMode: ExerciseTrackingMode;
  status: CoachStatus;
  nextTargetSummary: string;
  rationale: string;
}

export interface PostWorkoutCoachDebrief {
  avgSessionRpe: number | null;
  overloadReady: DebriefExerciseProjection[];
  holdOrConsolidate: DebriefExerciseProjection[];
  deloadOrRetry: DebriefExerciseProjection[];
  recoveryNote: string | null;
}

export function classifyLiftForProgression(exerciseName: string): LiftProgressionClass {
  const lower = exerciseName.toLowerCase();
  if (
    /\b(dumbbell|db|cable|curl|raise|fly|flies|pushdown|extension|kickback|face\s*pull|shrug|calf|calves|pec\s*deck|crossover|preacher|hammer)\b/.test(
      lower,
    )
  ) {
    return 'dumbbell_isolation';
  }
  if (
    /\b(barbell.*squat|back\s*squat|front\s*squat|deadlift|sumo\s*deadlift|trap\s*bar\s*deadlift|hack\s*squat|leg\s*press)\b/.test(
      lower,
    )
  ) {
    return 'compound_lower';
  }
  return 'compound_upper';
}

export function computeSmartWeightIncrement(
  exerciseName: string,
  settings: AppSettings | null,
  currentWeight = 0,
): number {
  const unit = settings?.weightUnit === 'lbs' ? 'lbs' : 'kg';
  const liftClass = classifyLiftForProgression(exerciseName);

  if (liftClass === 'compound_lower') {
    return unit === 'lbs' ? 10 : 5;
  }
  if (liftClass === 'dumbbell_isolation') {
    if (unit === 'lbs') {
      return currentWeight > 0 && currentWeight < 25 ? 2.5 : 5;
    }
    return currentWeight > 0 && currentWeight < 15 ? 1 : 2;
  }
  return unit === 'lbs' ? 5 : 2.5;
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

function getMedianWorkingReps(sets: Set[]): number {
  const working = getRelevantSetsForCoach(sets)
    .map((s) => s.reps)
    .filter((r) => Number.isFinite(r) && r > 0)
    .sort((a, b) => a - b);
  if (working.length === 0) return 8;
  return working[Math.floor(working.length / 2)];
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
  context?: SmartCoachContext,
): CoachEvaluation {
  const trackingMode = getExerciseTrackingMode(ex);
  const liftClass = classifyLiftForProgression(ex.name);
  const unitLabel = settings?.weightUnit === 'lbs' ? 'lbs' : 'kg';
  const targetSet = ex.sets.find(isWorkingSet) ?? ex.sets[0];
  const targetWeight = targetSet?.weight || 0;
  const targetReps = targetSet?.reps || 8;
  const targetDuration = targetSet?.duration ?? 45;
  const history = ex.history;
  const lastSession = history[history.length - 1];
  const secondLastSession = history[history.length - 2];

  const mesocycleDeload = Boolean(
    context?.mesocycle &&
      !context.mesocycle.isCompleted &&
      context.mesocycle.currentWeekSpec.isDeload,
  );
  const effectiveDeload = isDeload || mesocycleDeload;

  const now = context?.now ?? Date.now();
  const daysSinceLastSession =
    lastSession && lastSession.date > 1_000_000_000_000 && now >= lastSession.date
      ? Math.floor((now - lastSession.date) / (24 * 60 * 60 * 1000))
      : null;

  const baseFields = {
    trackingMode,
    liftClass,
    targetWeight,
    targetReps,
    targetDuration,
    repsModifier: 0,
    durationModifier: 0,
    fastTracked: false,
    daysSinceLastSession,
  };

  if (effectiveDeload) {
    return {
      ...baseFields,
      status: 'deload_day',
      progressionKind: 'deload',
      weightMultiplier: trackingMode === 'assisted_reps' ? 1.2 : 0.6,
      weightModifier: 0,
      consecutiveFails: 0,
      deloadReductionPct: 40,
      avgRecentRpe: null,
      rationale: mesocycleDeload
        ? `Week ${context!.mesocycle!.currentWeek} Deload — submaximal recovery loads.`
        : 'Scheduled deload day — 60% load to clear accumulated fatigue.',
    };
  }

  if (!lastSession || lastSession.sets.length === 0) {
    return {
      ...baseFields,
      status: 'first_session',
      progressionKind: 'hold',
      weightMultiplier: 1,
      weightModifier: 0,
      consecutiveFails: 0,
      deloadReductionPct: 0,
      avgRecentRpe: null,
      rationale: 'No prior logs yet — build a clean technical baseline.',
    };
  }

  // Layoff / Detraining Guard (3+ weeks away on real epoch timestamps)
  if (
    daysSinceLastSession !== null &&
    daysSinceLastSession >= 21 &&
    trackingMode === 'weight_reps'
  ) {
    const pct = daysSinceLastSession >= 42 ? 15 : 10;
    const multiplier = daysSinceLastSession >= 42 ? 0.85 : 0.9;
    return {
      ...baseFields,
      status: 'layoff_ramp',
      progressionKind: 'ramp_in',
      weightMultiplier: multiplier,
      weightModifier: 0,
      consecutiveFails: 0,
      deloadReductionPct: pct,
      avgRecentRpe: getAverageWorkingRpe(lastSession.sets),
      rationale: `${daysSinceLastSession}d since last logged — -${pct}% welcome-back ramp to guard joints & DOMS.`,
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
        progressionKind: 'deload',
        weightMultiplier,
        weightModifier: 0,
        consecutiveFails,
        deloadReductionPct: reductionPct,
        avgRecentRpe,
        rationale: `${consecutiveFails} consecutive misses — Auto-Deload ${reductionPct}% to rebuild momentum.`,
      };
    }

    return {
      ...baseFields,
      status: 'retry',
      progressionKind: 'hold',
      weightMultiplier: 1,
      weightModifier: 0,
      consecutiveFails,
      deloadReductionPct: 0,
      avgRecentRpe,
      rationale: `${consecutiveFails} consecutive misses — hold target until every working set lands.`,
    };
  }

  if (!lastAllCompleted) {
    return {
      ...baseFields,
      status: 'retry',
      progressionKind: 'hold',
      weightMultiplier: 1,
      weightModifier: 0,
      consecutiveFails,
      deloadReductionPct: 0,
      avgRecentRpe,
      rationale: 'Missed reps last session — repeat load & finish every working set cleanly.',
    };
  }

  // Easy-Session Fast-Track: RPE <= 7.0 unlocks progression after 1 clean session
  const fastTracked = Boolean(
    lastAllCompleted &&
      !prevAllCompleted &&
      avgRecentRpe !== null &&
      avgRecentRpe <= 7.0,
  );
  const eligibleToOverload = Boolean(
    settings?.smartSuggestions && lastAllCompleted && (prevAllCompleted || fastTracked),
  );

  if (eligibleToOverload) {
    if (avgRecentRpe !== null && avgRecentRpe >= 9.5) {
      return {
        ...baseFields,
        status: 'rpe_hold',
        progressionKind: 'hold',
        weightMultiplier: 1,
        weightModifier: 0,
        consecutiveFails: 0,
        deloadReductionPct: 0,
        avgRecentRpe,
        rationale: `Last session averaged RPE ${avgRecentRpe} — consolidate load before jumping weight.`,
      };
    }

    if (
      context?.mesocycle &&
      !context.mesocycle.isCompleted &&
      context.mesocycle.currentWeekSpec.phase === 'accumulation' &&
      avgRecentRpe !== null &&
      avgRecentRpe >= 9.0
    ) {
      return {
        ...baseFields,
        status: 'rpe_hold',
        progressionKind: 'hold',
        weightMultiplier: 1,
        weightModifier: 0,
        consecutiveFails: 0,
        deloadReductionPct: 0,
        avgRecentRpe,
        rationale: `Accumulation cap (${context.mesocycle.currentWeekSpec.targetRpeRange}) reached at RPE ${avgRecentRpe} — hold load.`,
      };
    }

    if (context?.muscleReadiness?.readiness === 'fatigued') {
      return {
        ...baseFields,
        status: 'fatigue_hold',
        progressionKind: 'hold',
        weightMultiplier: 1,
        weightModifier: 0,
        consecutiveFails: 0,
        deloadReductionPct: 0,
        avgRecentRpe,
        rationale: `${context.muscleReadiness.muscle} still fatigued (${context.muscleReadiness.recoveryPercent}% ready) — holding target to protect recovery.`,
      };
    }

    if (trackingMode === 'timed') {
      return {
        ...baseFields,
        status: 'overload',
        progressionKind: 'duration',
        weightMultiplier: 1,
        weightModifier: 0,
        durationModifier: 5,
        consecutiveFails: 0,
        deloadReductionPct: 0,
        avgRecentRpe,
        fastTracked,
        rationale: fastTracked
          ? 'Easy timed hold (low RPE) — fast-tracked +5s target.'
          : '2 clean hold sessions — adding +5s duration overload.',
      };
    }

    if (trackingMode === 'assisted_reps') {
      return {
        ...baseFields,
        status: 'overload',
        progressionKind: 'load',
        weightMultiplier: 1,
        weightModifier: -2.5,
        consecutiveFails: 0,
        deloadReductionPct: 0,
        avgRecentRpe,
        fastTracked,
        rationale: fastTracked
          ? `Low RPE ${avgRecentRpe} — fast-tracked -2.5 ${unitLabel} less assistance.`
          : `2 clean sessions — reducing assistance by 2.5 ${unitLabel}.`,
      };
    }

    if (trackingMode === 'bodyweight_reps') {
      const lastWorking = getRelevantSetsForCoach(lastSession.sets);
      const usesAddedLoad = lastWorking.some((s) => (s.weight || 0) > 0);
      return {
        ...baseFields,
        status: 'overload',
        progressionKind: usesAddedLoad ? 'load' : 'double_reps',
        weightMultiplier: 1,
        weightModifier: usesAddedLoad ? 2.5 : 0,
        repsModifier: usesAddedLoad ? 0 : 1,
        consecutiveFails: 0,
        deloadReductionPct: 0,
        avgRecentRpe,
        fastTracked,
        rationale: usesAddedLoad
          ? `Clean weighted bodyweight work — adding +2.5 ${unitLabel}.`
          : 'Clean bodyweight sets — +1 rep progression across working sets.',
      };
    }

    // Standard weighted lift: Equipment-Aware Double Progression
    const lastWeightRef =
      getRelevantSetsForCoach(lastSession.sets)[0]?.weight ?? targetWeight;
    const inc = computeSmartWeightIncrement(ex.name, settings, lastWeightRef);
    const lastMedianReps = getMedianWorkingReps(lastSession.sets);

    if (liftClass === 'dumbbell_isolation' && lastMedianReps >= 5) {
      if (lastMedianReps < 12) {
        const nextRepGoal = lastMedianReps + 1;
        return {
          ...baseFields,
          status: 'overload',
          progressionKind: 'double_reps',
          weightMultiplier: 1,
          weightModifier: 0,
          repsModifier: 1,
          consecutiveFails: 0,
          deloadReductionPct: 0,
          avgRecentRpe,
          fastTracked,
          rationale: `Double progression: keep ${lastWeightRef} ${unitLabel} and climb ${lastMedianReps} → ${nextRepGoal} reps (bump weight at 12).`,
        };
      }

      // Hit top of 12-rep range -> bump load + reset toward 8 reps
      const resetDelta = -Math.min(4, Math.max(2, lastMedianReps - 8));
      return {
        ...baseFields,
        status: 'overload',
        progressionKind: 'double_weight_reset',
        weightMultiplier: 1,
        weightModifier: inc,
        repsModifier: resetDelta,
        consecutiveFails: 0,
        deloadReductionPct: 0,
        avgRecentRpe,
        fastTracked,
        rationale: `Hit ${lastMedianReps} reps top-of-range! Bumping +${inc} ${unitLabel} and resetting to ${lastMedianReps + resetDelta} reps.`,
      };
    }

    const rpeText = avgRecentRpe !== null ? ` at avg RPE ${avgRecentRpe}` : '';
    return {
      ...baseFields,
      status: 'overload',
      progressionKind: 'load',
      weightMultiplier: 1,
      weightModifier: inc,
      consecutiveFails: 0,
      deloadReductionPct: 0,
      avgRecentRpe,
      fastTracked,
      rationale: fastTracked
        ? `Fast-tracked (RPE ${avgRecentRpe} ≤ 7.0) — stepping +${inc} ${unitLabel}.`
        : `2 clean sessions${rpeText} — +${inc} ${unitLabel} progressive overload.`,
    };
  }

  return {
    ...baseFields,
    status: 'maintain',
    progressionKind: 'hold',
    weightMultiplier: 1,
    weightModifier: 0,
    consecutiveFails: 0,
    deloadReductionPct: 0,
    avgRecentRpe,
    rationale: '1 clean session banked — repeat load once more (or hit RPE ≤ 7) to unlock overload.',
  };
}

export function computeSmartSets(
  ex: Exercise,
  isDeload: boolean,
  settings: AppSettings | null,
  context?: SmartCoachContext,
): Set[] {
  let newSets = [...ex.sets];
  const history = ex.history;
  const lastSession = history[history.length - 1];
  const evaluation = evaluateExerciseCoach(ex, isDeload, settings, context);
  const mode = evaluation.trackingMode;

  if (evaluation.status === 'deload_day') {
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
          ? Math.max(6, (ls.reps || s.reps || 8) + evaluation.repsModifier)
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

/**
 * Evaluates the most recently completed working set vs the next pending working set
 * to suggest real-time mid-session autoregulation (-5% when near failure, +5% when easy).
 */
export function evaluateLiveSetAutoregulation(
  exercise: Exercise,
  settings: AppSettings | null,
): LiveSetAutoregulation | null {
  const mode = getExerciseTrackingMode(exercise);
  if (mode !== 'weight_reps' || !settings?.smartSuggestions) return null;

  const workingPairs = exercise.sets
    .map((set, index) => ({ set, index }))
    .filter(({ set }) => !isWarmupSet(set));

  let lastDoneIdx = -1;
  for (let i = 0; i < workingPairs.length; i++) {
    if (workingPairs[i].set.completed) lastDoneIdx = i;
  }
  if (lastDoneIdx === -1) return null;

  const nextPending = workingPairs.slice(lastDoneIdx + 1).find(({ set }) => !set.completed);
  if (!nextPending || nextPending.set.weight <= 0) return null;

  const lastDone = workingPairs[lastDoneIdx].set;
  const currentWeight = nextPending.set.weight;
  const rpe = typeof lastDone.rpe === 'number' && Number.isFinite(lastDone.rpe) ? lastDone.rpe : null;

  let factor = 1;
  let direction: 'drop' | 'bump' | null = null;
  let reason = '';

  if (rpe !== null && rpe >= 9.5) {
    factor = 0.95;
    direction = 'drop';
    reason = `Set ${lastDoneIdx + 1} hit RPE ${rpe} — trim -5% to stay in target reps cleanly.`;
  } else if (lastDone.reps > 0 && lastDone.reps <= nextPending.set.reps - 2) {
    factor = 0.95;
    direction = 'drop';
    reason = `Reps dipped on Set ${lastDoneIdx + 1} — drop -5% on next set for quality volume.`;
  } else if (rpe !== null && rpe <= 6.5) {
    factor = 1.05;
    direction = 'bump';
    reason = `Set ${lastDoneIdx + 1} felt light (RPE ${rpe}) — bump +5% on next set.`;
  } else if (lastDone.reps >= nextPending.set.reps + 3) {
    factor = 1.05;
    direction = 'bump';
    reason = `Crushed +${lastDone.reps - nextPending.set.reps} extra reps — nudge +5% on next set.`;
  }

  if (!direction) return null;
  const suggestedWeight = roundToHalf(currentWeight * factor);
  const deltaWeight = Math.round((suggestedWeight - currentWeight) * 10) / 10;
  if (deltaWeight === 0) return null;

  return {
    direction,
    nextSetId: nextPending.set.id,
    nextSetIndex: nextPending.index,
    currentWeight,
    suggestedWeight,
    deltaWeight,
    reason,
  };
}

/**
 * Generates a post-workout debrief projecting next-session targets across every exercise trained.
 */
export function buildPostWorkoutCoachDebrief(
  session: WorkoutSession,
  settings: AppSettings | null,
  muscleRecovery: MuscleRecoveryStatus[] = [],
): PostWorkoutCoachDebrief {
  const unitLabel = settings?.weightUnit === 'lbs' ? 'lbs' : 'kg';
  const overloadReady: DebriefExerciseProjection[] = [];
  const holdOrConsolidate: DebriefExerciseProjection[] = [];
  const deloadOrRetry: DebriefExerciseProjection[] = [];

  let rpeSum = 0;
  let rpeCount = 0;
  const trainedMuscles = new Set<BroadMuscleGroup>();

  for (const ex of session.exercisesSnapshot || []) {
    const mode = getExerciseTrackingMode(ex);
    const { primary } = resolveExerciseBroadMuscles(ex);
    if (primary) trainedMuscles.add(primary);

    for (const s of ex.sets || []) {
      if (s.completed && !isWarmupSet(s) && typeof s.rpe === 'number' && s.rpe > 0) {
        rpeSum += s.rpe;
        rpeCount++;
      }
    }

    // Append current session into exercise history to evaluate NEXT session's recommendation
    const simulatedEx: Exercise = {
      ...ex,
      history: [
        ...(ex.history || []),
        { sessionId: session.id, date: session.date, sets: ex.sets },
      ],
    };

    const nextEval = evaluateExerciseCoach(simulatedEx, false, settings, {
      now: session.date,
    });
    const nextSets = computeSmartSets(simulatedEx, false, settings, {
      now: session.date,
    });
    const nextWorking = nextSets.find(isWorkingSet) ?? nextSets[0];

    let nextTargetSummary = 'Keep building';
    if (nextWorking) {
      if (mode === 'timed') {
        nextTargetSummary = `${nextWorking.duration ?? 45}s`;
      } else if (mode === 'assisted_reps') {
        nextTargetSummary = `-${nextWorking.weight}${unitLabel} × ${nextWorking.reps}`;
      } else if (mode === 'bodyweight_reps' && nextWorking.weight === 0) {
        nextTargetSummary = `BW × ${nextWorking.reps}`;
      } else {
        nextTargetSummary = `${nextWorking.weight} ${unitLabel} × ${nextWorking.reps}`;
      }
    }

    const projection: DebriefExerciseProjection = {
      exerciseName: ex.name,
      trackingMode: mode,
      status: nextEval.status,
      nextTargetSummary,
      rationale: nextEval.rationale,
    };

    if (nextEval.status === 'overload') {
      overloadReady.push(projection);
    } else if (nextEval.status === 'auto_deload' || nextEval.status === 'retry') {
      deloadOrRetry.push(projection);
    } else {
      holdOrConsolidate.push(projection);
    }
  }

  let recoveryNote: string | null = null;
  if (muscleRecovery.length > 0 && trainedMuscles.size > 0) {
    const lowest = muscleRecovery
      .filter((m) => trainedMuscles.has(m.muscle))
      .sort((a, b) => a.recoveryPercent - b.recoveryPercent)[0];
    if (lowest) {
      recoveryNote = `${lowest.muscle} (${lowest.recoveryPercent}%) — ${getEstimatedReadyLabel(lowest)}`;
    }
  }

  return {
    avgSessionRpe: rpeCount > 0 ? Math.round((rpeSum / rpeCount) * 10) / 10 : null,
    overloadReady,
    holdOrConsolidate,
    deloadOrRetry,
    recoveryNote,
  };
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
