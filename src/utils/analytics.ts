import { differenceInCalendarDays, startOfDay, subDays } from 'date-fns';
import { PR, WorkoutSession } from '../types';

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
