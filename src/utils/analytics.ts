import { differenceInCalendarDays, startOfDay, subDays } from 'date-fns';
import { PR, WorkoutSession } from '../types';
import { getExerciseTrackingMode, supportsEstimated1RM } from './exerciseModes';
import { getBestSet1RM, isWarmupSet } from './strength';

export function computeStreaks(sessions: WorkoutSession[]): { current: number; longest: number } {
  if (sessions.length === 0) return { current: 0, longest: 0 };

  const days = Array.from(
    new Set(
      sessions
        .filter((s) => s.date && !isNaN(new Date(s.date).getTime()))
        .map((s) => startOfDay(new Date(s.date)).getTime()),
    ),
  ).sort((a, b) => b - a);

  if (days.length === 0) return { current: 0, longest: 0 };

  const todayTs = startOfDay(new Date()).getTime();
  const yesterdayTs = startOfDay(subDays(new Date(), 1)).getTime();

  let current = 0;
  if (days[0] === todayTs || days[0] === yesterdayTs) {
    current = 1;
    for (let i = 1; i < days.length; i++) {
      if (differenceInCalendarDays(new Date(days[i - 1]), new Date(days[i])) === 1) {
        current++;
      } else break;
    }
  }

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    if (differenceInCalendarDays(new Date(days[i - 1]), new Date(days[i])) === 1) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }
  return { current, longest: Math.max(longest, current) };
}

export function flattenPRs(sessions: WorkoutSession[]): Array<PR & { date: number }> {
  const allPRs: Array<PR & { date: number }> = [];
  sessions
    .filter((s) => s.date && !isNaN(new Date(s.date).getTime()))
    .forEach((s) => {
      (s.PRs ?? []).forEach((pr) => allPRs.push({ ...pr, date: s.date }));
    });

  // Group by exercise and keep only the highest value
  const bestPRs = new Map<string, PR & { date: number }>();

  allPRs.forEach((pr) => {
    const key = `${pr.exerciseName}-${pr.type}`;
    const existing = bestPRs.get(key);

    if (!existing || pr.value > existing.value) {
      bestPRs.set(key, pr);
    } else if (pr.value === existing.value && pr.date > existing.date) {
      // If values are equal, keep the most recent one
      bestPRs.set(key, pr);
    }
  });

  return Array.from(bestPRs.values()).sort((a, b) => b.date - a.date);
}

export interface StrengthBenchmark {
  exerciseName: string;
  e1rm: number;
  weight: number;
  reps: number;
  date: number;
}

export function computeTopEstimated1RMs(sessions: WorkoutSession[]): StrengthBenchmark[] {
  const bestByExercise = new Map<string, StrengthBenchmark>();

  for (const session of sessions) {
    if (!session.date || isNaN(new Date(session.date).getTime())) continue;
    for (const ex of session.exercisesSnapshot || []) {
      if (!supportsEstimated1RM(getExerciseTrackingMode(ex))) continue;
      const best = getBestSet1RM(ex.sets);
      if (!best) continue;

      const key = ex.name.toLowerCase().trim();
      const existing = bestByExercise.get(key);
      if (
        !existing ||
        best.e1rm > existing.e1rm ||
        (best.e1rm === existing.e1rm && session.date > existing.date)
      ) {
        bestByExercise.set(key, {
          exerciseName: ex.name,
          e1rm: best.e1rm,
          weight: best.weight,
          reps: best.reps,
          date: session.date,
        });
      }
    }
  }

  return Array.from(bestByExercise.values()).sort((a, b) => b.e1rm - a.e1rm);
}

export interface EffortSummary {
  avgRpe: number | null;
  ratedSetsCount: number;
  hardSetsCount: number;
  failureSetsCount: number;
  dropSetsCount: number;
  warmupSetsCount: number;
  workingSetsCount: number;
}

export function computeEffortSummary(
  sessions: WorkoutSession[],
  daysWindow = 7,
  now = Date.now(),
): EffortSummary {
  const cutoff = now - daysWindow * 24 * 60 * 60 * 1000;
  let rpeSum = 0;
  let ratedSetsCount = 0;
  let hardSetsCount = 0;
  let failureSetsCount = 0;
  let dropSetsCount = 0;
  let warmupSetsCount = 0;
  let workingSetsCount = 0;

  for (const session of sessions) {
    if (!session.date || isNaN(new Date(session.date).getTime()) || session.date < cutoff) {
      continue;
    }
    for (const ex of session.exercisesSnapshot || []) {
      for (const set of ex.sets || []) {
        if (!set.completed) continue;
        if (isWarmupSet(set)) {
          warmupSetsCount++;
          continue;
        }
        workingSetsCount++;
        if (set.setType === 'failure') failureSetsCount++;
        else if (set.setType === 'drop') dropSetsCount++;

        if (typeof set.rpe === 'number' && Number.isFinite(set.rpe) && set.rpe > 0) {
          rpeSum += set.rpe;
          ratedSetsCount++;
          if (set.rpe >= 8) {
            hardSetsCount++;
          }
        }
      }
    }
  }

  return {
    avgRpe: ratedSetsCount > 0 ? Math.round((rpeSum / ratedSetsCount) * 10) / 10 : null,
    ratedSetsCount,
    hardSetsCount,
    failureSetsCount,
    dropSetsCount,
    warmupSetsCount,
    workingSetsCount,
  };
}
