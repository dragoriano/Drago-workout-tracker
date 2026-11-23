import type { Goal, Measurement, WorkoutSession } from '../types';
import { computeStreaks } from './analytics';
import { getBestSet1RM, isWarmupSet } from './strength';

export function computeGoalMetricValue(
  goal: Pick<Goal, 'trackingType' | 'linkedExerciseName'>,
  sessions: WorkoutSession[],
  measurements: Measurement[],
  now = Date.now(),
): number | null {
  const mode = goal.trackingType;
  if (!mode || mode === 'manual') return null;

  if (mode === 'exercise_e1rm') {
    const targetName = goal.linkedExerciseName?.trim().toLowerCase();
    if (!targetName) return null;
    let best = 0;
    for (const session of sessions) {
      for (const ex of session.exercisesSnapshot || []) {
        if (ex.name.trim().toLowerCase() !== targetName) continue;
        const bestSet = getBestSet1RM(ex.sets);
        if (bestSet && bestSet.e1rm > best) {
          best = bestSet.e1rm;
        }
      }
    }
    return best;
  }

  if (mode === 'exercise_weight') {
    const targetName = goal.linkedExerciseName?.trim().toLowerCase();
    if (!targetName) return null;
    let maxWeight = 0;
    for (const session of sessions) {
      for (const ex of session.exercisesSnapshot || []) {
        if (ex.name.trim().toLowerCase() !== targetName) continue;
        for (const set of ex.sets || []) {
          if (!set.completed || isWarmupSet(set)) continue;
          if (set.weight > maxWeight) {
            maxWeight = set.weight;
          }
        }
      }
    }
    return maxWeight;
  }

  if (mode === 'monthly_workouts') {
    const ref = new Date(now);
    const year = ref.getFullYear();
    const month = ref.getMonth();
    let count = 0;
    for (const session of sessions) {
      if (!session.date) continue;
      const d = new Date(session.date);
      if (isNaN(d.getTime())) continue;
      if (d.getFullYear() === year && d.getMonth() === month) {
        count++;
      }
    }
    return count;
  }

  if (mode === 'weekly_volume') {
    const cutoff = now - 7 * 86_400_000;
    let total = 0;
    for (const session of sessions) {
      if (!session.date || isNaN(new Date(session.date).getTime())) continue;
      if (session.date >= cutoff && session.date <= now + 60_000) {
        total += session.totalVolume || 0;
      }
    }
    return Math.round(total);
  }

  if (mode === 'streak_days') {
    return computeStreaks(sessions).current;
  }

  if (mode === 'body_weight') {
    const weightLogs = measurements
      .filter(
        (m) =>
          m.type === 'weight' &&
          Number.isFinite(m.value) &&
          m.value > 0 &&
          m.date &&
          !isNaN(new Date(m.date).getTime()),
      )
      .sort((a, b) => b.date - a.date);
    return weightLogs.length > 0 ? weightLogs[0].value : null;
  }

  return null;
}

export function isGoalAchieved(
  goal: Pick<Goal, 'targetValue' | 'direction'>,
  currentValue: number,
): boolean {
  if (goal.direction === 'decrease') {
    return currentValue > 0 && currentValue <= goal.targetValue;
  }
  return goal.targetValue > 0 && currentValue >= goal.targetValue;
}

export function computeGoalProgressPercent(
  goal: Pick<Goal, 'currentValue' | 'targetValue' | 'startValue' | 'direction'>,
): number {
  if (goal.direction === 'decrease') {
    if (goal.currentValue > 0 && goal.currentValue <= goal.targetValue) {
      return 100;
    }
    if (
      typeof goal.startValue === 'number' &&
      Number.isFinite(goal.startValue) &&
      goal.startValue > goal.targetValue
    ) {
      const pct =
        ((goal.startValue - goal.currentValue) / (goal.startValue - goal.targetValue)) * 100;
      return Math.max(0, Math.min(100, Math.round(pct)));
    }
    return 0;
  }

  if (!Number.isFinite(goal.targetValue) || goal.targetValue <= 0) return 0;
  const pct = (goal.currentValue / goal.targetValue) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export function reconcileAutoGoals(
  goals: Goal[],
  sessions: WorkoutSession[],
  measurements: Measurement[],
  now = Date.now(),
): {
  updatedGoals: Goal[];
  changedGoals: Goal[];
  newlyCompleted: Goal[];
} {
  const updatedGoals: Goal[] = [];
  const changedGoals: Goal[] = [];
  const newlyCompleted: Goal[] = [];

  for (const goal of goals) {
    if (!goal.trackingType || goal.trackingType === 'manual') {
      updatedGoals.push(goal);
      continue;
    }

    const rawMetric = computeGoalMetricValue(goal, sessions, measurements, now);
    if (rawMetric === null || !Number.isFinite(rawMetric)) {
      updatedGoals.push(goal);
      continue;
    }

    const nextValue = Math.round(rawMetric * 10) / 10;
    const nextCompleted = goal.completed || isGoalAchieved(goal, nextValue);

    if (nextValue !== goal.currentValue || nextCompleted !== goal.completed) {
      const nextGoal: Goal = {
        ...goal,
        currentValue: nextValue,
        completed: nextCompleted,
      };
      updatedGoals.push(nextGoal);
      changedGoals.push(nextGoal);
      if (!goal.completed && nextCompleted) {
        newlyCompleted.push(nextGoal);
      }
    } else {
      updatedGoals.push(goal);
    }
  }

  return { updatedGoals, changedGoals, newlyCompleted };
}
