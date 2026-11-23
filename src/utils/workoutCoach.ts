import { AppSettings, Exercise, PR, Set, WorkoutDay, WorkoutSession } from '../types';
import { generateId } from './uuid';

export function computeSmartSets(
  ex: Exercise,
  isDeload: boolean,
  settings: AppSettings | null,
): Set[] {
  let newSets = [...ex.sets];
  const history = ex.history;
  const lastSession = history[history.length - 1];
  const secondLastSession = history[history.length - 2];

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
        };
      });
    } else {
      newSets = newSets.map((s) => ({
        ...s,
        weight: Math.max(0, Math.round(s.weight * 0.6 * 2) / 2),
        completed: false,
      }));
    }
  } else if (lastSession && lastSession.sets.length > 0) {
    let consecutiveFails = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      const allCompleted = history[i].sets.every((s) => s.completed);
      if (!allCompleted) consecutiveFails++;
      else break;
    }

    const lastAllCompleted = lastSession.sets.every((s) => s.completed);
    const prevAllCompleted = secondLastSession
      ? secondLastSession.sets.every((s) => s.completed)
      : false;

    let weightModifier = 0;
    let weightMultiplier = 1;

    if (consecutiveFails >= 2 && settings?.autoDeload) {
      weightMultiplier = consecutiveFails >= 3 ? 0.85 : 0.9;
    } else if (lastAllCompleted && prevAllCompleted && settings?.smartSuggestions) {
      weightModifier = 2.5;
    }

    newSets = newSets.map((s, i) => {
      const ls = lastSession.sets[i] || lastSession.sets[lastSession.sets.length - 1];
      const newWeight = Math.max(0, Math.round(ls.weight * weightMultiplier * 2) / 2) + weightModifier;

      return {
        ...s,
        id: s.id || generateId(),
        weight: newWeight,
        reps: s.reps,
        completed: false,
      };
    });
  } else {
    newSets = newSets.map((set) => ({ ...set, completed: false }));
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
    for (const set of ex.sets) {
      if (set.completed) {
        totalVolume += set.weight * set.reps;
        if (set.weight > maxWeightThisSession) {
          maxWeightThisSession = set.weight;
        }
      }
    }

    let previousMaxWeight = 0;
    for (const hist of ex.history) {
      for (const set of hist.sets) {
        if (set.completed && set.weight > previousMaxWeight) {
          previousMaxWeight = set.weight;
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
