import { CustomExercise, Measurement, WorkoutSession } from '../types';
import { computeStreaks, computeTopEstimated1RMs, flattenPRs } from './analytics';
import { computeMeasurementTrend } from './bodyTrends';
import { resolveExerciseBroadMuscles } from './muscleRecovery';
import { isWarmupSet } from './strength';

export type StrengthTier = 'untrained' | 'novice' | 'intermediate' | 'advanced' | 'elite';
export type BigLiftKey = 'squat' | 'bench' | 'deadlift' | 'ohp' | 'row';
export type WeightUnit = 'kg' | 'lbs';
export type MilestoneCategory = 'consistency' | 'volume' | 'strength';
export type MilestoneAccent = 'emerald' | 'amber' | 'sky' | 'orange' | 'rose';
export type MilestoneIconKey = 'flame' | 'dumbbell' | 'trophy' | 'target' | 'zap' | 'award' | 'crown';

export interface LiftStandardResult {
  key: BigLiftKey;
  label: string;
  shortLabel: string;
  matchedExerciseName: string | null;
  e1rm: number | null;
  bestSet: { weight: number; reps: number; date: number } | null;
  bodyweightRatio: number | null;
  tier: StrengthTier | null;
  nextTier: StrengthTier | null;
  nextTierTarget: number | null;
  deltaToNextTier: number | null;
  progressToNextPct: number;
}

export interface StrengthStandardsSummary {
  bodyweight: { value: number; unit: WeightUnit; date: number } | null;
  overallTier: StrengthTier | null;
  overallScore: number;
  trackedLiftsCount: number;
  sbdTotal: number | null;
  lifts: LiftStandardResult[];
}

export interface SymmetryRatio {
  label: string;
  leftLabel: string;
  rightLabel: string;
  leftSets: number;
  rightSets: number;
  leftPct: number;
  rightPct: number;
  ratio: number | null;
  status: 'balanced' | 'left_dominant' | 'right_dominant' | 'insufficient_data';
  statusLabel: string;
  guidance: string;
}

export interface SymmetryBalanceResult {
  windowDays: number;
  totalWorkingSets: number;
  pushPull: SymmetryRatio;
  upperLower: SymmetryRatio;
}

export interface TrainingMilestone {
  id: string;
  category: MilestoneCategory;
  title: string;
  description: string;
  iconKey: MilestoneIconKey;
  accent: MilestoneAccent;
  unlocked: boolean;
  progressPct: number;
  currentValue: number;
  targetValue: number;
  currentLabel: string;
  targetLabel: string;
}

export interface TrainingMilestonesSummary {
  unlockedCount: number;
  totalCount: number;
  completionPct: number;
  milestones: TrainingMilestone[];
  nextUp: TrainingMilestone | null;
}

export const STRENGTH_TIER_ORDER: readonly StrengthTier[] = [
  'untrained',
  'novice',
  'intermediate',
  'advanced',
  'elite',
] as const;

export const STRENGTH_TIER_LABELS: Record<StrengthTier, string> = {
  untrained: 'Untrained',
  novice: 'Novice',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  elite: 'Elite',
};

const KG_TO_LBS = 2.2046226218;

interface BigLiftConfig {
  key: BigLiftKey;
  label: string;
  shortLabel: string;
  include: RegExp;
  exclude: RegExp;
  thresholds: {
    novice: number;
    intermediate: number;
    advanced: number;
    elite: number;
  };
}

const BIG_LIFT_CONFIGS: readonly BigLiftConfig[] = [
  {
    key: 'squat',
    label: 'Back Squat',
    shortLabel: 'Squat',
    include: /\bsquat\b/i,
    exclude: /\b(split|bulgarian|goblet|sissy|pistol|jump|bodyweight|calf|cossack|shrimp|air)\b/i,
    thresholds: { novice: 1.0, intermediate: 1.5, advanced: 2.0, elite: 2.5 },
  },
  {
    key: 'bench',
    label: 'Bench Press',
    shortLabel: 'Bench',
    include: /\bbench\s*press\b/i,
    exclude: /\b(dumbbell|db|cable|machine|incline|decline)\b/i,
    thresholds: { novice: 0.75, intermediate: 1.0, advanced: 1.5, elite: 1.85 },
  },
  {
    key: 'deadlift',
    label: 'Deadlift',
    shortLabel: 'Deadlift',
    include: /\bdeadlift\b/i,
    exclude: /\b(romanian|rdl|stiff[\s-]?leg|single[\s-]?leg|dumbbell|db|kettlebell|kb|cable)\b/i,
    thresholds: { novice: 1.25, intermediate: 1.75, advanced: 2.25, elite: 2.85 },
  },
  {
    key: 'ohp',
    label: 'Overhead Press',
    shortLabel: 'OHP',
    include: /\b(overhead\s*press|military\s*press|barbell\s*shoulder\s*press|standing\s*press|ohp|strict\s*press)\b/i,
    exclude: /\b(dumbbell|db|machine|cable|smith|tricep|leg)\b/i,
    thresholds: { novice: 0.45, intermediate: 0.65, advanced: 0.9, elite: 1.15 },
  },
  {
    key: 'row',
    label: 'Barbell Row',
    shortLabel: 'Row',
    include: /\b(barbell.*row|bent[\s-]?over.*row|pendlay\s*row|yates\s*row|t[\s-]?bar\s*row)\b/i,
    exclude: /\b(upright|dumbbell|db|cable|machine)\b/i,
    thresholds: { novice: 0.65, intermediate: 0.95, advanced: 1.25, elite: 1.55 },
  },
] as const;

export function normalizeWeightUnit(unit?: string | null): WeightUnit {
  return unit && /lb/i.test(unit) ? 'lbs' : 'kg';
}

export function convertWeight(value: number, fromUnit: WeightUnit, toUnit: WeightUnit): number {
  if (!Number.isFinite(value)) return 0;
  if (fromUnit === toUnit) return value;
  return fromUnit === 'kg' ? value * KG_TO_LBS : value / KG_TO_LBS;
}

export function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

export function matchBigLiftKey(exerciseName: string): BigLiftKey | null {
  const name = exerciseName.trim();
  if (!name) return null;
  for (const cfg of BIG_LIFT_CONFIGS) {
    if (cfg.include.test(name) && !cfg.exclude.test(name)) {
      return cfg.key;
    }
  }
  return null;
}

function classifyRatio(
  ratio: number,
  t: BigLiftConfig['thresholds'],
): {
  tier: StrengthTier;
  nextTier: StrengthTier | null;
  nextRatio: number | null;
  progressToNextPct: number;
  score: number;
} {
  const clampPct = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

  if (ratio >= t.elite) {
    return {
      tier: 'elite',
      nextTier: null,
      nextRatio: null,
      progressToNextPct: 100,
      score: Math.min(100, 92 + ((ratio - t.elite) / (t.elite * 0.35)) * 8),
    };
  }
  if (ratio >= t.advanced) {
    const pct = clampPct(((ratio - t.advanced) / (t.elite - t.advanced)) * 100);
    return {
      tier: 'advanced',
      nextTier: 'elite',
      nextRatio: t.elite,
      progressToNextPct: pct,
      score: 75 + (pct / 100) * 17,
    };
  }
  if (ratio >= t.intermediate) {
    const pct = clampPct(((ratio - t.intermediate) / (t.advanced - t.intermediate)) * 100);
    return {
      tier: 'intermediate',
      nextTier: 'advanced',
      nextRatio: t.advanced,
      progressToNextPct: pct,
      score: 50 + (pct / 100) * 25,
    };
  }
  if (ratio >= t.novice) {
    const pct = clampPct(((ratio - t.novice) / (t.intermediate - t.novice)) * 100);
    return {
      tier: 'novice',
      nextTier: 'intermediate',
      nextRatio: t.intermediate,
      progressToNextPct: pct,
      score: 25 + (pct / 100) * 25,
    };
  }

  const pct = clampPct((ratio / t.novice) * 100);
  return {
    tier: 'untrained',
    nextTier: 'novice',
    nextRatio: t.novice,
    progressToNextPct: pct,
    score: (pct / 100) * 25,
  };
}

function scoreToOverallTier(score: number): StrengthTier {
  if (score >= 92) return 'elite';
  if (score >= 75) return 'advanced';
  if (score >= 50) return 'intermediate';
  if (score >= 25) return 'novice';
  return 'untrained';
}

export function getNormalizedBodyweight(
  measurements: Measurement[],
  targetUnit: WeightUnit,
): { value: number; unit: WeightUnit; date: number } | null {
  const trend = computeMeasurementTrend(measurements, 'weight');
  if (!trend.latest || !Number.isFinite(trend.latest.value) || trend.latest.value <= 0) {
    return null;
  }
  const sourceUnit = normalizeWeightUnit(trend.latest.unit);
  const converted = Math.round(convertWeight(trend.latest.value, sourceUnit, targetUnit) * 10) / 10;
  return {
    value: converted,
    unit: targetUnit,
    date: trend.latest.date,
  };
}

export function computeStrengthStandards(
  sessions: WorkoutSession[],
  measurements: Measurement[],
  weightUnit: WeightUnit = 'kg',
): StrengthStandardsSummary {
  const bodyweight = getNormalizedBodyweight(measurements, weightUnit);
  const top1RMs = computeTopEstimated1RMs(sessions);

  const bestByLift = new Map<BigLiftKey, (typeof top1RMs)[number]>();
  for (const bench of top1RMs) {
    const key = matchBigLiftKey(bench.exerciseName);
    if (!key) continue;
    const current = bestByLift.get(key);
    if (!current || bench.e1rm > current.e1rm) {
      bestByLift.set(key, bench);
    }
  }

  const liftScores: number[] = [];
  const lifts: LiftStandardResult[] = BIG_LIFT_CONFIGS.map((cfg) => {
    const match = bestByLift.get(cfg.key);
    if (!match) {
      return {
        key: cfg.key,
        label: cfg.label,
        shortLabel: cfg.shortLabel,
        matchedExerciseName: null,
        e1rm: null,
        bestSet: null,
        bodyweightRatio: null,
        tier: null,
        nextTier: null,
        nextTierTarget: null,
        deltaToNextTier: null,
        progressToNextPct: 0,
      };
    }

    if (!bodyweight) {
      return {
        key: cfg.key,
        label: cfg.label,
        shortLabel: cfg.shortLabel,
        matchedExerciseName: match.exerciseName,
        e1rm: match.e1rm,
        bestSet: { weight: match.weight, reps: match.reps, date: match.date },
        bodyweightRatio: null,
        tier: null,
        nextTier: null,
        nextTierTarget: null,
        deltaToNextTier: null,
        progressToNextPct: 0,
      };
    }

    const ratio = match.e1rm / bodyweight.value;
    const roundedRatio = Math.round(ratio * 100) / 100;
    const classified = classifyRatio(ratio, cfg.thresholds);
    liftScores.push(classified.score);

    const nextTierTarget =
      classified.nextRatio !== null ? roundToHalf(classified.nextRatio * bodyweight.value) : null;
    const deltaToNextTier =
      nextTierTarget !== null ? Math.round(Math.max(0, nextTierTarget - match.e1rm) * 10) / 10 : null;

    return {
      key: cfg.key,
      label: cfg.label,
      shortLabel: cfg.shortLabel,
      matchedExerciseName: match.exerciseName,
      e1rm: match.e1rm,
      bestSet: { weight: match.weight, reps: match.reps, date: match.date },
      bodyweightRatio: roundedRatio,
      tier: classified.tier,
      nextTier: classified.nextTier,
      nextTierTarget,
      deltaToNextTier,
      progressToNextPct: classified.progressToNextPct,
    };
  });

  const trackedLiftsCount = lifts.filter((l) => l.e1rm !== null).length;
  const overallScore =
    bodyweight && liftScores.length > 0
      ? Math.round(liftScores.reduce((sum, s) => sum + s, 0) / liftScores.length)
      : 0;
  const overallTier = bodyweight && liftScores.length > 0 ? scoreToOverallTier(overallScore) : null;

  const squat = lifts.find((l) => l.key === 'squat')?.e1rm ?? null;
  const bench = lifts.find((l) => l.key === 'bench')?.e1rm ?? null;
  const deadlift = lifts.find((l) => l.key === 'deadlift')?.e1rm ?? null;
  const sbdTotal =
    squat !== null && bench !== null && deadlift !== null
      ? Math.round((squat + bench + deadlift) * 10) / 10
      : null;

  return {
    bodyweight,
    overallTier,
    overallScore,
    trackedLiftsCount,
    sbdTotal,
    lifts,
  };
}

export function computeSymmetryBalance(
  sessions: WorkoutSession[],
  options?: {
    windowDays?: number;
    now?: number;
    customExercises?: CustomExercise[];
    resolveFallbackMuscles?: (name: string) => string[];
  },
): SymmetryBalanceResult {
  const windowDays = options?.windowDays ?? 30;
  const now = options?.now ?? Date.now();
  const cutoff = now - windowDays * 24 * 60 * 60 * 1000;

  let pushSets = 0;
  let pullSets = 0;
  let upperSets = 0;
  let lowerSets = 0;
  let totalWorkingSets = 0;

  for (const session of sessions) {
    if (!session.date || isNaN(new Date(session.date).getTime()) || session.date < cutoff) {
      continue;
    }

    for (const ex of session.exercisesSnapshot || []) {
      const workingSets = (ex.sets || []).filter((s) => s.completed && !isWarmupSet(s)).length;
      if (workingSets === 0) continue;

      totalWorkingSets += workingSets;

      const { primary } = resolveExerciseBroadMuscles(
        ex,
        options?.customExercises,
        options?.resolveFallbackMuscles,
      );

      const lowerText = `${ex.name} ${ex.primaryMuscle || ''}`.toLowerCase();

      if (/\b(face\s*pull|rear\s*delt|reverse\s*fly)\b/i.test(lowerText)) {
        pullSets += workingSets;
      } else if (primary === 'Chest' || primary === 'Shoulders') {
        pushSets += workingSets;
      } else if (primary === 'Back') {
        pullSets += workingSets;
      } else if (primary === 'Arms') {
        if (/\b(tricep|pushdown|skullcrusher|dip|extension)\b/i.test(lowerText)) {
          pushSets += workingSets;
        } else if (/\b(bicep|curl|hammer|preacher)\b/i.test(lowerText)) {
          pullSets += workingSets;
        }
      }

      if (primary === 'Chest' || primary === 'Back' || primary === 'Shoulders' || primary === 'Arms') {
        upperSets += workingSets;
      } else if (primary === 'Legs' || primary === 'Glutes') {
        lowerSets += workingSets;
      }
    }
  }

  const pushPullTotal = pushSets + pullSets;
  const pushPct = pushPullTotal > 0 ? Math.round((pushSets / pushPullTotal) * 100) : 50;
  const pullPct = pushPullTotal > 0 ? 100 - pushPct : 50;

  let pushPullStatus: SymmetryRatio['status'] = 'insufficient_data';
  let pushPullLabel = 'Need 6+ sets';
  let pushPullGuidance = 'Log at least 6 upper push/pull sets to evaluate symmetry.';

  if (pushPullTotal >= 6) {
    if (pushPct > 58) {
      pushPullStatus = 'left_dominant';
      pushPullLabel = 'Push-Heavy';
      pushPullGuidance = 'Add extra rows, pulldowns, or face pulls to keep shoulder health balanced.';
    } else if (pushPct < 42) {
      pushPullStatus = 'right_dominant';
      pushPullLabel = 'Pull-Heavy';
      pushPullGuidance = 'Strong pulling base — pair with pressing volume for balanced upper growth.';
    } else {
      pushPullStatus = 'balanced';
      pushPullLabel = 'Balanced';
      pushPullGuidance = 'Ideal ~1:1 push-to-pull ratio supporting posture and joint longevity.';
    }
  }

  const upperLowerTotal = upperSets + lowerSets;
  const upperPct = upperLowerTotal > 0 ? Math.round((upperSets / upperLowerTotal) * 100) : 50;
  const lowerPct = upperLowerTotal > 0 ? 100 - upperPct : 50;

  let upperLowerStatus: SymmetryRatio['status'] = 'insufficient_data';
  let upperLowerLabel = 'Need 6+ sets';
  let upperLowerGuidance = 'Log at least 6 upper/lower working sets to evaluate split balance.';

  if (upperLowerTotal >= 6) {
    if (upperPct > 70) {
      upperLowerStatus = 'left_dominant';
      upperLowerLabel = 'Upper-Heavy';
      upperLowerGuidance = 'Add squats, hinges, or lunges to bring lower-body volume into range.';
    } else if (upperPct < 50) {
      upperLowerStatus = 'right_dominant';
      upperLowerLabel = 'Lower-Heavy';
      upperLowerGuidance = 'Lower body is driving volume — maintain upper pressing & pulling work.';
    } else {
      upperLowerStatus = 'balanced';
      upperLowerLabel = 'Balanced';
      upperLowerGuidance = 'Well-proportioned upper/lower split across recent sessions.';
    }
  }

  return {
    windowDays,
    totalWorkingSets,
    pushPull: {
      label: 'Push vs Pull',
      leftLabel: 'Push',
      rightLabel: 'Pull',
      leftSets: pushSets,
      rightSets: pullSets,
      leftPct: pushPct,
      rightPct: pullPct,
      ratio: pullSets > 0 ? Math.round((pushSets / pullSets) * 100) / 100 : null,
      status: pushPullStatus,
      statusLabel: pushPullLabel,
      guidance: pushPullGuidance,
    },
    upperLower: {
      label: 'Upper vs Lower',
      leftLabel: 'Upper',
      rightLabel: 'Lower',
      leftSets: upperSets,
      rightSets: lowerSets,
      leftPct: upperPct,
      rightPct: lowerPct,
      ratio: lowerSets > 0 ? Math.round((upperSets / lowerSets) * 100) / 100 : null,
      status: upperLowerStatus,
      statusLabel: upperLowerLabel,
      guidance: upperLowerGuidance,
    },
  };
}

function getSessionVolumeFallback(session: WorkoutSession): number {
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

function formatCompactVolume(value: number, unit: WeightUnit): string {
  const rounded = Math.round(value);
  if (rounded >= 1_000_000) {
    return `${(rounded / 1_000_000).toFixed(2).replace(/\.00$/, '')}M ${unit}`;
  }
  if (rounded >= 10_000) {
    return `${(rounded / 1_000).toFixed(1).replace(/\.0$/, '')}k ${unit}`;
  }
  return `${rounded.toLocaleString('en-US')} ${unit}`;
}

export function computeTrainingMilestones(
  sessions: WorkoutSession[],
  measurements: Measurement[],
  weightUnit: WeightUnit = 'kg',
): TrainingMilestonesSummary {
  const validSessions = sessions.filter((s) => s.date && !isNaN(new Date(s.date).getTime()));
  const workoutCount = validSessions.length;
  const { longest: longestStreak } = computeStreaks(validSessions);
  const totalVolume = validSessions.reduce((sum, s) => sum + getSessionVolumeFallback(s), 0);
  const prCount = flattenPRs(validSessions).length;
  const standards = computeStrengthStandards(validSessions, measurements, weightUnit);

  const benchRatio = standards.lifts.find((l) => l.key === 'bench')?.bodyweightRatio ?? 0;
  const squatRatio = standards.lifts.find((l) => l.key === 'squat')?.bodyweightRatio ?? 0;
  const deadliftRatio = standards.lifts.find((l) => l.key === 'deadlift')?.bodyweightRatio ?? 0;

  const volumeTargets =
    weightUnit === 'lbs'
      ? { v1: 22_000, v2: 110_000, v3: 220_000, v4: 1_100_000 }
      : { v1: 10_000, v2: 50_000, v3: 100_000, v4: 500_000 };

  const clampPct = (current: number, target: number) =>
    target > 0 ? Math.max(0, Math.min(100, Math.round((current / target) * 100))) : 0;

  const milestones: TrainingMilestone[] = [
    // Consistency (4)
    {
      id: 'first_blood',
      category: 'consistency',
      title: 'First Blood',
      description: 'Complete your very first tracked workout session.',
      iconKey: 'zap',
      accent: 'emerald',
      unlocked: workoutCount >= 1,
      progressPct: clampPct(workoutCount, 1),
      currentValue: workoutCount,
      targetValue: 1,
      currentLabel: `${workoutCount}`,
      targetLabel: '1 workout',
    },
    {
      id: 'habit_builder',
      category: 'consistency',
      title: 'Habit Builder',
      description: 'Log 10 completed training sessions.',
      iconKey: 'target',
      accent: 'emerald',
      unlocked: workoutCount >= 10,
      progressPct: clampPct(workoutCount, 10),
      currentValue: workoutCount,
      targetValue: 10,
      currentLabel: `${workoutCount}`,
      targetLabel: '10 workouts',
    },
    {
      id: 'iron_regular',
      category: 'consistency',
      title: 'Iron Regular',
      description: 'Reach 25 completed workouts in your training log.',
      iconKey: 'award',
      accent: 'sky',
      unlocked: workoutCount >= 25,
      progressPct: clampPct(workoutCount, 25),
      currentValue: workoutCount,
      targetValue: 25,
      currentLabel: `${workoutCount}`,
      targetLabel: '25 workouts',
    },
    {
      id: 'seven_day_flame',
      category: 'consistency',
      title: '7-Day Flame',
      description: 'Build a 7-day consecutive training streak.',
      iconKey: 'flame',
      accent: 'orange',
      unlocked: longestStreak >= 7,
      progressPct: clampPct(longestStreak, 7),
      currentValue: longestStreak,
      targetValue: 7,
      currentLabel: `${longestStreak}d`,
      targetLabel: '7d streak',
    },

    // Volume (4)
    {
      id: 'volume_tier_1',
      category: 'volume',
      title: weightUnit === 'lbs' ? '22K Mover' : '10K Mover',
      description: `Move ${formatCompactVolume(volumeTargets.v1, weightUnit)} in lifetime training volume.`,
      iconKey: 'dumbbell',
      accent: 'sky',
      unlocked: totalVolume >= volumeTargets.v1,
      progressPct: clampPct(totalVolume, volumeTargets.v1),
      currentValue: Math.round(totalVolume),
      targetValue: volumeTargets.v1,
      currentLabel: formatCompactVolume(totalVolume, weightUnit),
      targetLabel: formatCompactVolume(volumeTargets.v1, weightUnit),
    },
    {
      id: 'volume_tier_2',
      category: 'volume',
      title: weightUnit === 'lbs' ? '110K Hauler' : '50K Hauler',
      description: `Accumulate ${formatCompactVolume(volumeTargets.v2, weightUnit)} lifetime volume.`,
      iconKey: 'dumbbell',
      accent: 'emerald',
      unlocked: totalVolume >= volumeTargets.v2,
      progressPct: clampPct(totalVolume, volumeTargets.v2),
      currentValue: Math.round(totalVolume),
      targetValue: volumeTargets.v2,
      currentLabel: formatCompactVolume(totalVolume, weightUnit),
      targetLabel: formatCompactVolume(volumeTargets.v2, weightUnit),
    },
    {
      id: 'volume_tier_3',
      category: 'volume',
      title: weightUnit === 'lbs' ? '220K Titan' : '100K Titan',
      description: `Surpass ${formatCompactVolume(volumeTargets.v3, weightUnit)} total weight moved.`,
      iconKey: 'award',
      accent: 'amber',
      unlocked: totalVolume >= volumeTargets.v3,
      progressPct: clampPct(totalVolume, volumeTargets.v3),
      currentValue: Math.round(totalVolume),
      targetValue: volumeTargets.v3,
      currentLabel: formatCompactVolume(totalVolume, weightUnit),
      targetLabel: formatCompactVolume(volumeTargets.v3, weightUnit),
    },
    {
      id: 'volume_tier_4',
      category: 'volume',
      title: weightUnit === 'lbs' ? '1.1M Club' : 'Half-Million Club',
      description: `Join the elite ${formatCompactVolume(volumeTargets.v4, weightUnit)} lifetime volume club.`,
      iconKey: 'crown',
      accent: 'amber',
      unlocked: totalVolume >= volumeTargets.v4,
      progressPct: clampPct(totalVolume, volumeTargets.v4),
      currentValue: Math.round(totalVolume),
      targetValue: volumeTargets.v4,
      currentLabel: formatCompactVolume(totalVolume, weightUnit),
      targetLabel: formatCompactVolume(volumeTargets.v4, weightUnit),
    },

    // Strength (4)
    {
      id: 'pr_collector',
      category: 'strength',
      title: 'PR Collector',
      description: 'Claim 5 distinct Personal Records across your exercises.',
      iconKey: 'trophy',
      accent: 'amber',
      unlocked: prCount >= 5,
      progressPct: clampPct(prCount, 5),
      currentValue: prCount,
      targetValue: 5,
      currentLabel: `${prCount} PRs`,
      targetLabel: '5 PRs',
    },
    {
      id: 'bw_bench',
      category: 'strength',
      title: 'Bodyweight Bench',
      description: 'Reach a 1.00× Bodyweight estimated 1RM on Barbell Bench Press.',
      iconKey: 'award',
      accent: 'rose',
      unlocked: benchRatio >= 1.0,
      progressPct: clampPct(benchRatio, 1.0),
      currentValue: benchRatio,
      targetValue: 1.0,
      currentLabel: benchRatio > 0 ? `${benchRatio.toFixed(2)}× BW` : 'No data',
      targetLabel: '1.00× BW',
    },
    {
      id: 'squat_1_5x',
      category: 'strength',
      title: '1.5× Squat Club',
      description: 'Achieve a 1.50× Bodyweight estimated 1RM on Back Squat.',
      iconKey: 'trophy',
      accent: 'orange',
      unlocked: squatRatio >= 1.5,
      progressPct: clampPct(squatRatio, 1.5),
      currentValue: squatRatio,
      targetValue: 1.5,
      currentLabel: squatRatio > 0 ? `${squatRatio.toFixed(2)}× BW` : 'No data',
      targetLabel: '1.50× BW',
    },
    {
      id: 'deadlift_2x',
      category: 'strength',
      title: '2× Deadlift Club',
      description: 'Pull a 2.00× Bodyweight estimated 1RM on Barbell Deadlift.',
      iconKey: 'crown',
      accent: 'amber',
      unlocked: deadliftRatio >= 2.0,
      progressPct: clampPct(deadliftRatio, 2.0),
      currentValue: deadliftRatio,
      targetValue: 2.0,
      currentLabel: deadliftRatio > 0 ? `${deadliftRatio.toFixed(2)}× BW` : 'No data',
      targetLabel: '2.00× BW',
    },
  ];

  const unlockedCount = milestones.filter((m) => m.unlocked).length;
  const totalCount = milestones.length;
  const completionPct = Math.round((unlockedCount / totalCount) * 100);

  const locked = milestones.filter((m) => !m.unlocked);
  const nextUp =
    locked.length > 0
      ? locked.reduce((best, cur) => (cur.progressPct > best.progressPct ? cur : best), locked[0])
      : null;

  return {
    unlockedCount,
    totalCount,
    completionPct,
    milestones,
    nextUp,
  };
}
