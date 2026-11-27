import { format, startOfDay, subDays } from 'date-fns';
import type { CustomExercise, Measurement, PR, WorkoutSession } from '../types';
import { computeStreaks } from './analytics';
import {
  computeMuscleRecovery,
  resolveExerciseBroadMuscles,
  type BroadMuscleGroup,
  type MuscleRecoveryStatus,
} from './muscleRecovery';
import { computeTrainingMilestones } from './strengthStandards';
import { isWarmupSet, type WeightUnit } from './strength';

export interface WeeklyMuscleStat {
  muscle: BroadMuscleGroup;
  workingSets: number;
}

export interface WeeklyDigestSummary {
  dateRangeLabel: string;
  sessionsCount: number;
  prevSessionsCount: number;
  sessionsDelta: number;
  totalVolume: number;
  prevTotalVolume: number;
  volumeDeltaPct: number | null;
  totalWorkingSets: number;
  totalDurationMinutes: number;
  prCount: number;
  topPRs: Array<PR & { date: number }>;
  currentStreak: number;
  topMuscles: WeeklyMuscleStat[];
  milestonesUnlocked: number;
  milestonesTotal: number;
  headline: string;
  muscleRecovery: MuscleRecoveryStatus[];
}

function getSessionVolume(session: WorkoutSession): number {
  if (typeof session.totalVolume === 'number' && Number.isFinite(session.totalVolume) && session.totalVolume > 0) {
    return session.totalVolume;
  }
  let sum = 0;
  for (const ex of session.exercisesSnapshot || []) {
    for (const set of ex.sets || []) {
      if (set.completed && !isWarmupSet(set) && set.weight > 0 && set.reps > 0) {
        sum += set.weight * set.reps;
      }
    }
  }
  return sum;
}

export function computeWeeklyDigest(
  sessions: WorkoutSession[],
  measurements: Measurement[],
  options?: {
    unit?: WeightUnit;
    customExercises?: CustomExercise[];
    resolveFallbackMuscles?: (name: string) => string[];
    now?: number;
  },
): WeeklyDigestSummary {
  const now = options?.now ?? Date.now();
  const unit: WeightUnit = options?.unit ?? 'kg';
  const todayStart = startOfDay(new Date(now));
  const weekStartTs = subDays(todayStart, 6).getTime();
  const prevWeekStartTs = subDays(todayStart, 13).getTime();

  const dateRangeLabel = `${format(new Date(weekStartTs), 'MMM d')} – ${format(todayStart, 'MMM d, yyyy')}`;

  const validSessions = sessions.filter(
    (s) => s.date && !isNaN(new Date(s.date).getTime()) && s.date <= now + 60_000,
  );

  const thisWeek = validSessions.filter((s) => s.date >= weekStartTs);
  const prevWeek = validSessions.filter((s) => s.date >= prevWeekStartTs && s.date < weekStartTs);

  const sessionsCount = thisWeek.length;
  const prevSessionsCount = prevWeek.length;
  const sessionsDelta = sessionsCount - prevSessionsCount;

  const totalVolume = Math.round(thisWeek.reduce((sum, s) => sum + getSessionVolume(s), 0));
  const prevTotalVolume = Math.round(prevWeek.reduce((sum, s) => sum + getSessionVolume(s), 0));

  const volumeDeltaPct =
    prevTotalVolume > 0
      ? Math.round(((totalVolume - prevTotalVolume) / prevTotalVolume) * 100)
      : null;

  let totalWorkingSets = 0;
  let totalDurationSec = 0;
  const muscleSets = new Map<BroadMuscleGroup, number>();
  const weekPRs: Array<PR & { date: number }> = [];

  for (const s of thisWeek) {
    totalDurationSec += Number.isFinite(s.duration) ? Math.max(0, s.duration) : 0;

    for (const pr of s.PRs || []) {
      weekPRs.push({ ...pr, date: s.date });
    }

    for (const ex of s.exercisesSnapshot || []) {
      const setsCount = (ex.sets || []).filter((st) => st.completed && !isWarmupSet(st)).length;
      if (setsCount === 0) continue;
      totalWorkingSets += setsCount;

      const { primary } = resolveExerciseBroadMuscles(
        ex,
        options?.customExercises,
        options?.resolveFallbackMuscles,
      );
      if (primary) {
        muscleSets.set(primary, (muscleSets.get(primary) || 0) + setsCount);
      }
    }
  }

  const topPRs = [...weekPRs]
    .sort((a, b) => b.value - a.value || b.date - a.date)
    .slice(0, 3);

  const topMuscles: WeeklyMuscleStat[] = Array.from(muscleSets.entries())
    .map(([muscle, workingSets]) => ({ muscle, workingSets }))
    .sort((a, b) => b.workingSets - a.workingSets)
    .slice(0, 3);

  const { current: currentStreak } = computeStreaks(validSessions);
  const milestones = computeTrainingMilestones(validSessions, measurements, unit);
  const muscleRecovery = computeMuscleRecovery(validSessions, {
    now,
    customExercises: options?.customExercises,
    resolveFallbackMuscles: options?.resolveFallbackMuscles,
  });

  let headline = 'Ready to Kick Off the Week';
  if (sessionsCount === 0) {
    headline = 'Recovery & Preparation Week';
  } else if (weekPRs.length >= 3) {
    headline = `${weekPRs.length} Personal Records Smashed`;
  } else if (volumeDeltaPct !== null && volumeDeltaPct >= 15) {
    headline = `Volume Surged +${volumeDeltaPct}%`;
  } else if (currentStreak >= 5) {
    headline = `${currentStreak}-Day Training Streak`;
  } else if (sessionsCount >= 4) {
    headline = 'Relentless Weekly Consistency';
  } else {
    headline = `${sessionsCount} Session${sessionsCount === 1 ? '' : 's'} Banked`;
  }

  return {
    dateRangeLabel,
    sessionsCount,
    prevSessionsCount,
    sessionsDelta,
    totalVolume,
    prevTotalVolume,
    volumeDeltaPct,
    totalWorkingSets,
    totalDurationMinutes: Math.round(totalDurationSec / 60),
    prCount: weekPRs.length,
    topPRs,
    currentStreak,
    topMuscles,
    milestonesUnlocked: milestones.unlockedCount,
    milestonesTotal: milestones.totalCount,
    headline,
    muscleRecovery,
  };
}
