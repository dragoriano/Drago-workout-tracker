import { differenceInCalendarDays, startOfDay } from 'date-fns';
import type {
  MesocycleConfig,
  MesocycleFocus,
  MesocyclePhase,
  WorkoutProgram,
  WorkoutSession,
} from '../types';
import { getExerciseTrackingMode, supportsEstimated1RM } from './exerciseModes';
import { getBestSet1RM, isWarmupSet } from './strength';

export interface MesocycleWeekSpec {
  weekNumber: number;
  phase: MesocyclePhase;
  phaseLabel: string;
  targetRpeRange: string;
  volumeGuidance: string;
  isDeload: boolean;
}

export interface MesocycleWeekProgress extends MesocycleWeekSpec {
  sessionsCount: number;
  totalVolume: number;
  prCount: number;
  status: 'completed' | 'current' | 'upcoming';
}

export interface MesocycleRecap {
  volumeGrowthPct: number | null;
  topLiftGain: {
    exerciseName: string;
    startE1rm: number;
    endE1rm: number;
    delta: number;
  } | null;
}

export interface MesocycleProgressSummary {
  config: MesocycleConfig;
  currentWeek: number;
  isCompleted: boolean;
  progressPct: number;
  currentWeekSpec: MesocycleWeekSpec;
  daysRemaining: number;
  blockSessionsCount: number;
  blockTotalVolume: number;
  blockPRCount: number;
  weeklyBreakdown: MesocycleWeekProgress[];
  recap: MesocycleRecap;
}

export const MESOCYCLE_FOCUS_LABELS: Record<MesocycleFocus, string> = {
  hypertrophy: 'Hypertrophy',
  strength: 'Strength',
  recomp: 'Powerbuilding',
};

const PHASE_LABELS: Record<MesocyclePhase, string> = {
  accumulation: 'Accumulation',
  intensification: 'Intensification',
  peak: 'Peak',
  deload: 'Deload',
};

function getPhasePrescription(
  phase: MesocyclePhase,
  focus: MesocycleFocus,
  weekInPhaseIndex: number,
): { targetRpeRange: string; volumeGuidance: string } {
  if (phase === 'deload') {
    return {
      targetRpeRange: 'RPE 6–6.5',
      volumeGuidance: 'Cut working sets ~40% and drop loads to ~60–70% to dissipate fatigue.',
    };
  }
  if (phase === 'peak') {
    return focus === 'strength'
      ? {
          targetRpeRange: 'RPE 9–9.5',
          volumeGuidance: 'Low reps, heavy top singles/triples on primary lifts; minimal accessories.',
        }
      : {
          targetRpeRange: 'RPE 8.5–9.5',
          volumeGuidance: 'Push top-set mechanical tension close to failure with dialed-in technique.',
        };
  }
  if (phase === 'intensification') {
    return focus === 'hypertrophy'
      ? {
          targetRpeRange: 'RPE 8–9',
          volumeGuidance: 'Nudge weight up while holding target rep ranges; trim redundant warmup load.',
        }
      : {
          targetRpeRange: 'RPE 8–8.5',
          volumeGuidance: 'Shift slightly heavier (+2.5–5%) with crisp bar speed and full rest.',
        };
  }
  // accumulation
  const baseRpe = weekInPhaseIndex === 0 ? 'RPE 7–7.5' : 'RPE 7.5–8';
  return focus === 'strength'
    ? {
        targetRpeRange: baseRpe,
        volumeGuidance: 'Build submaximal technical mastery and work capacity across core compounds.',
      }
    : {
        targetRpeRange: baseRpe,
        volumeGuidance: 'Drive productive volume at controlled proximity to failure to fuel growth.',
      };
}

export function buildMesocycleWeeks(
  config: Pick<MesocycleConfig, 'totalWeeks' | 'includeDeloadWeek' | 'goalFocus'>,
): MesocycleWeekSpec[] {
  const { totalWeeks, includeDeloadWeek, goalFocus } = config;
  const activeWeeks = includeDeloadWeek ? Math.max(1, totalWeeks - 1) : totalWeeks;

  const weeks: MesocycleWeekSpec[] = [];
  for (let i = 0; i < totalWeeks; i++) {
    const weekNumber = i + 1;
    let phase: MesocyclePhase;

    if (includeDeloadWeek && weekNumber === totalWeeks) {
      phase = 'deload';
    } else if (activeWeeks <= 3) {
      phase = i === 0 ? 'accumulation' : i === activeWeeks - 1 ? 'peak' : 'intensification';
    } else {
      const accumCutoff = Math.ceil(activeWeeks * 0.45);
      const peakStart = activeWeeks - 1;
      if (i < accumCutoff) {
        phase = 'accumulation';
      } else if (i >= peakStart) {
        phase = 'peak';
      } else {
        phase = 'intensification';
      }
    }

    const phaseStartCount = weeks.filter((w) => w.phase === phase).length;
    const { targetRpeRange, volumeGuidance } = getPhasePrescription(phase, goalFocus, phaseStartCount);

    weeks.push({
      weekNumber,
      phase,
      phaseLabel: PHASE_LABELS[phase],
      targetRpeRange,
      volumeGuidance,
      isDeload: phase === 'deload',
    });
  }

  return weeks;
}

export function createDefaultMesocycle(
  programName: string,
  totalWeeks: 4 | 5 | 6 | 8 = 6,
  includeDeloadWeek = true,
  goalFocus: MesocycleFocus = 'hypertrophy',
  now = Date.now(),
): MesocycleConfig {
  const cleanName = programName.trim() || 'Training';
  return {
    name: `${cleanName} · ${totalWeeks}W Block`,
    totalWeeks,
    startDate: startOfDay(new Date(now)).getTime(),
    includeDeloadWeek,
    goalFocus,
  };
}

function resolveSessionVolume(session: WorkoutSession): number {
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

export function computeMesocycleProgress(
  program: Pick<WorkoutProgram, 'id' | 'mesocycle'> | null | undefined,
  sessions: WorkoutSession[],
  now = Date.now(),
): MesocycleProgressSummary | null {
  if (!program?.mesocycle) return null;
  const config = program.mesocycle;
  const weeks = buildMesocycleWeeks(config);
  const startDay = startOfDay(new Date(config.startDate));
  const nowDay = startOfDay(new Date(now));
  const totalDays = config.totalWeeks * 7;

  const elapsedDays = Math.max(0, differenceInCalendarDays(nowDay, startDay));
  const isTimeCompleted = elapsedDays >= totalDays;
  const isCompleted = Boolean(config.completedAt) || isTimeCompleted;

  const rawWeek = Math.floor(elapsedDays / 7) + 1;
  const currentWeek = Math.max(1, Math.min(config.totalWeeks, rawWeek));
  const daysRemaining = isCompleted ? 0 : Math.max(0, totalDays - elapsedDays);

  const progressPct = isCompleted
    ? 100
    : Math.max(5, Math.min(100, Math.round(((elapsedDays + 1) / totalDays) * 100)));

  const startTs = startDay.getTime();
  const endTs = startTs + totalDays * 24 * 60 * 60 * 1000;

  const blockSessions = sessions
    .filter(
      (s) =>
        s.programId === program.id &&
        s.date &&
        !isNaN(new Date(s.date).getTime()) &&
        s.date >= startTs &&
        s.date < endTs,
    )
    .sort((a, b) => a.date - b.date);

  const weekBuckets = new Map<number, { sessions: number; volume: number; prs: number }>();
  for (let w = 1; w <= config.totalWeeks; w++) {
    weekBuckets.set(w, { sessions: 0, volume: 0, prs: 0 });
  }

  // Track exercise e1RM progression across the block
  const exerciseBlockE1rm = new Map<
    string,
    { name: string; first: number; best: number }
  >();

  let blockTotalVolume = 0;
  let blockPRCount = 0;

  for (const s of blockSessions) {
    const sDay = startOfDay(new Date(s.date));
    const dayOffset = Math.max(0, differenceInCalendarDays(sDay, startDay));
    const weekIdx = Math.max(1, Math.min(config.totalWeeks, Math.floor(dayOffset / 7) + 1));
    const vol = resolveSessionVolume(s);
    const prLen = Array.isArray(s.PRs) ? s.PRs.length : 0;

    const bucket = weekBuckets.get(weekIdx)!;
    bucket.sessions += 1;
    bucket.volume += vol;
    bucket.prs += prLen;

    blockTotalVolume += vol;
    blockPRCount += prLen;

    for (const ex of s.exercisesSnapshot || []) {
      if (!supportsEstimated1RM(getExerciseTrackingMode(ex))) continue;
      const best = getBestSet1RM(ex.sets);
      if (!best || best.e1rm <= 0) continue;
      const key = ex.name.toLowerCase().trim();
      const existing = exerciseBlockE1rm.get(key);
      if (!existing) {
        exerciseBlockE1rm.set(key, { name: ex.name, first: best.e1rm, best: best.e1rm });
      } else if (best.e1rm > existing.best) {
        existing.best = best.e1rm;
      }
    }
  }

  const weeklyBreakdown: MesocycleWeekProgress[] = weeks.map((spec) => {
    const b = weekBuckets.get(spec.weekNumber)!;
    const status: MesocycleWeekProgress['status'] = isCompleted
      ? 'completed'
      : spec.weekNumber < currentWeek
        ? 'completed'
        : spec.weekNumber === currentWeek
          ? 'current'
          : 'upcoming';

    return {
      ...spec,
      sessionsCount: b.sessions,
      totalVolume: Math.round(b.volume),
      prCount: b.prs,
      status,
    };
  });

  // Compute volume growth: best non-deload week volume (after week 1) vs week 1
  const w1Vol = weeklyBreakdown[0]?.totalVolume ?? 0;
  const laterBuildWeeks = weeklyBreakdown
    .slice(1)
    .filter((w) => !w.isDeload && w.totalVolume > 0);
  let volumeGrowthPct: number | null = null;
  if (w1Vol > 0 && laterBuildWeeks.length > 0) {
    const peakLaterVol = Math.max(...laterBuildWeeks.map((w) => w.totalVolume));
    volumeGrowthPct = Math.round(((peakLaterVol - w1Vol) / w1Vol) * 100);
  }

  // Compute top e1RM delta within block
  let topLiftGain: MesocycleRecap['topLiftGain'] = null;
  for (const entry of exerciseBlockE1rm.values()) {
    const delta = Math.round((entry.best - entry.first) * 10) / 10;
    if (delta > 0 && (!topLiftGain || delta > topLiftGain.delta)) {
      topLiftGain = {
        exerciseName: entry.name,
        startE1rm: entry.first,
        endE1rm: entry.best,
        delta,
      };
    }
  }

  const currentWeekSpec =
    weeks.find((w) => w.weekNumber === currentWeek) || weeks[weeks.length - 1];

  return {
    config,
    currentWeek,
    isCompleted,
    progressPct,
    currentWeekSpec,
    daysRemaining,
    blockSessionsCount: blockSessions.length,
    blockTotalVolume: Math.round(blockTotalVolume),
    blockPRCount,
    weeklyBreakdown,
    recap: {
      volumeGrowthPct,
      topLiftGain,
    },
  };
}
