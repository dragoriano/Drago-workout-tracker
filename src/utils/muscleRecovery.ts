import type { CustomExercise, Exercise, WorkoutSession } from '../types';
import { isWarmupSet } from './strength';

export type BroadMuscleGroup =
  | 'Chest'
  | 'Back'
  | 'Legs'
  | 'Shoulders'
  | 'Arms'
  | 'Glutes'
  | 'Core';

export const TRACKED_MUSCLE_GROUPS: readonly BroadMuscleGroup[] = [
  'Chest',
  'Back',
  'Legs',
  'Shoulders',
  'Arms',
  'Glutes',
  'Core',
] as const;

export const MUSCLE_COLORS: Record<string, string> = {
  Chest: '#ef4444',
  Back: '#3b82f6',
  Shoulders: '#f97316',
  Arms: '#6366f1',
  Legs: '#22c55e',
  Core: '#eab308',
  Glutes: '#ec4899',
  Other: '#6b7280',
};

export const MUSCLE_TARGETS: Record<
  BroadMuscleGroup,
  { minSets: number; maxSets: number; baseRecoveryHours: number }
> = {
  Chest: { minSets: 10, maxSets: 20, baseRecoveryHours: 48 },
  Back: { minSets: 12, maxSets: 22, baseRecoveryHours: 48 },
  Legs: { minSets: 10, maxSets: 20, baseRecoveryHours: 72 },
  Shoulders: { minSets: 8, maxSets: 16, baseRecoveryHours: 36 },
  Arms: { minSets: 8, maxSets: 16, baseRecoveryHours: 36 },
  Glutes: { minSets: 6, maxSets: 14, baseRecoveryHours: 48 },
  Core: { minSets: 6, maxSets: 14, baseRecoveryHours: 24 },
};

const MUSCLE_GROUP_MAP: Record<string, string> = {
  'Upper Chest': 'Chest',
  'Mid Chest': 'Chest',
  'Lower Chest': 'Chest',
  Chest: 'Chest',
  'Upper Back': 'Back',
  'Mid Back': 'Back',
  Lats: 'Back',
  'Erector Spinae': 'Back',
  Back: 'Back',
  'Front Delt': 'Shoulders',
  'Side Delt': 'Shoulders',
  'Rear Delt': 'Shoulders',
  Shoulders: 'Shoulders',
  Biceps: 'Arms',
  Triceps: 'Arms',
  Forearms: 'Arms',
  'Forearm Flexors': 'Arms',
  'Forearm Extensors': 'Arms',
  Brachioradialis: 'Arms',
  Brachialis: 'Arms',
  Arms: 'Arms',
  Quads: 'Legs',
  Hamstrings: 'Legs',
  Calves: 'Legs',
  Legs: 'Legs',
  Abdominals: 'Core',
  Obliques: 'Core',
  Core: 'Core',
  'Transverse/Anti-Rotation': 'Core',
  Glutes: 'Glutes',
};

export function mapToMuscleGroup(detailed: string): string {
  const trimmed = detailed.trim();
  if (!trimmed) return 'Other';
  if (MUSCLE_GROUP_MAP[trimmed]) return MUSCLE_GROUP_MAP[trimmed];
  const lower = trimmed.toLowerCase();
  const key = Object.keys(MUSCLE_GROUP_MAP).find((k) => k.toLowerCase() === lower);
  return key ? MUSCLE_GROUP_MAP[key] : 'Other';
}

export function getMuscleColor(group: string): string {
  return MUSCLE_COLORS[group] || MUSCLE_COLORS.Other;
}

export function isTrackedMuscleGroup(group: string): group is BroadMuscleGroup {
  return (TRACKED_MUSCLE_GROUPS as readonly string[]).includes(group);
}

export function inferBroadMusclesFromName(name: string): BroadMuscleGroup[] {
  const lower = name.toLowerCase();
  const matched: BroadMuscleGroup[] = [];
  const push = (g: BroadMuscleGroup) => {
    if (!matched.includes(g)) matched.push(g);
  };

  if (/\b(bench|pec|fly|chest|push[\s-]?up|crossover|dip)\b/.test(lower)) push('Chest');
  if (/\b(row|pull[\s-]?up|chin[\s-]?up|pulldown|lat|deadlift|back|shrug)\b/.test(lower)) push('Back');
  if (/\b(squat|leg|lunge|quad|hamstring|calf|calves|rdl|split squat)\b/.test(lower)) push('Legs');
  if (/\b(glute|hip thrust|bridge|kickback)\b/.test(lower)) push('Glutes');
  if (/\b(delt|shoulder|overhead|ohp|lateral raise|face pull|upright row|military press)\b/.test(lower))
    push('Shoulders');
  if (/\b(curl|bicep|tricep|pushdown|skullcrusher|extension|forearm|hammer)\b/.test(lower)) push('Arms');
  if (/\b(crunch|plank|ab|oblique|core|sit[\s-]?up|leg raise|russian twist)\b/.test(lower)) push('Core');

  return matched;
}

export function resolveExerciseBroadMuscles(
  ex: Pick<Exercise, 'name' | 'primaryMuscle' | 'secondaryMuscles' | 'muscleGroup'>,
  customExercises?: CustomExercise[],
  resolveFallbackMuscles?: (name: string) => string[],
): { primary: BroadMuscleGroup | null; secondary: BroadMuscleGroup[] } {
  let primaryRaw = ex.primaryMuscle || '';
  let secondaryRaw = Array.isArray(ex.secondaryMuscles) ? ex.secondaryMuscles : [];
  let groupList = Array.isArray(ex.muscleGroup) ? ex.muscleGroup : [];

  if (!primaryRaw && groupList.length === 0 && customExercises && customExercises.length > 0) {
    const normalizedName = ex.name.toLowerCase().trim();
    const matchedCustom = customExercises.find(
      (c) => c.name.toLowerCase().trim() === normalizedName,
    );
    if (matchedCustom) {
      primaryRaw = matchedCustom.primaryMuscle;
      secondaryRaw = matchedCustom.secondaryMuscles || [];
      groupList = matchedCustom.muscleGroups || [];
    }
  }

  let primary: BroadMuscleGroup | null = null;
  const secondary: BroadMuscleGroup[] = [];

  if (primaryRaw) {
    const mappedPrimary = mapToMuscleGroup(primaryRaw);
    if (isTrackedMuscleGroup(mappedPrimary)) {
      primary = mappedPrimary;
    }
    for (const sec of secondaryRaw) {
      const mappedSec = mapToMuscleGroup(sec);
      if (isTrackedMuscleGroup(mappedSec) && mappedSec !== primary && !secondary.includes(mappedSec)) {
        secondary.push(mappedSec);
      }
    }
  } else if (groupList.length > 0) {
    for (const g of groupList) {
      const mapped = mapToMuscleGroup(g);
      if (!isTrackedMuscleGroup(mapped)) continue;
      if (!primary) {
        primary = mapped;
      } else if (mapped !== primary && !secondary.includes(mapped)) {
        secondary.push(mapped);
      }
    }
  }

  if (!primary && resolveFallbackMuscles) {
    const fallback = resolveFallbackMuscles(ex.name);
    for (const g of fallback) {
      const mapped = mapToMuscleGroup(g);
      if (!isTrackedMuscleGroup(mapped)) continue;
      if (!primary) {
        primary = mapped;
      } else if (mapped !== primary && !secondary.includes(mapped)) {
        secondary.push(mapped);
      }
    }
  }

  if (!primary) {
    const inferred = inferBroadMusclesFromName(ex.name);
    if (inferred.length > 0) {
      primary = inferred[0];
      for (const sec of inferred.slice(1)) {
        if (sec !== primary && !secondary.includes(sec)) {
          secondary.push(sec);
        }
      }
    }
  }

  return { primary, secondary };
}

export type VolumeZone = 'untrained' | 'under' | 'optimal' | 'over';
export type ReadinessLevel = 'ready' | 'recovering' | 'fatigued';

export interface MuscleRecoveryStatus {
  muscle: BroadMuscleGroup;
  color: string;
  directSets: number;
  effectiveSets: number;
  minTarget: number;
  maxTarget: number;
  volumeZone: VolumeZone;
  weeklyVolume: number;
  lastTrainedAt: number | null;
  hoursSinceTrained: number | null;
  neededRecoveryHours: number;
  recoveryPercent: number;
  readiness: ReadinessLevel;
}

interface SessionStimulus {
  effectiveSets: number;
  rpeSum: number;
  rpeCount: number;
  hasFailure: boolean;
  hasDrop: boolean;
}

export function computeMuscleRecovery(
  sessions: WorkoutSession[],
  options: {
    now?: number;
    daysWindow?: number;
    customExercises?: CustomExercise[];
    resolveFallbackMuscles?: (name: string) => string[];
  } = {},
): MuscleRecoveryStatus[] {
  const now = options.now ?? Date.now();
  const daysWindow = options.daysWindow ?? 7;
  const cutoff = now - daysWindow * 24 * 60 * 60 * 1000;

  const stats: Record<
    BroadMuscleGroup,
    {
      directSets: number;
      effectiveSets: number;
      weeklyVolume: number;
      lastTrainedAt: number | null;
      lastStimulus: SessionStimulus | null;
    }
  > = {
    Chest: { directSets: 0, effectiveSets: 0, weeklyVolume: 0, lastTrainedAt: null, lastStimulus: null },
    Back: { directSets: 0, effectiveSets: 0, weeklyVolume: 0, lastTrainedAt: null, lastStimulus: null },
    Legs: { directSets: 0, effectiveSets: 0, weeklyVolume: 0, lastTrainedAt: null, lastStimulus: null },
    Shoulders: { directSets: 0, effectiveSets: 0, weeklyVolume: 0, lastTrainedAt: null, lastStimulus: null },
    Arms: { directSets: 0, effectiveSets: 0, weeklyVolume: 0, lastTrainedAt: null, lastStimulus: null },
    Glutes: { directSets: 0, effectiveSets: 0, weeklyVolume: 0, lastTrainedAt: null, lastStimulus: null },
    Core: { directSets: 0, effectiveSets: 0, weeklyVolume: 0, lastTrainedAt: null, lastStimulus: null },
  };

  for (const session of sessions) {
    if (!session.date || isNaN(new Date(session.date).getTime())) continue;
    if (session.date < cutoff || session.date > now + 60_000) continue;

    const sessionStimuli = new Map<BroadMuscleGroup, SessionStimulus>();
    const touchStimulus = (muscle: BroadMuscleGroup): SessionStimulus => {
      let existing = sessionStimuli.get(muscle);
      if (!existing) {
        existing = { effectiveSets: 0, rpeSum: 0, rpeCount: 0, hasFailure: false, hasDrop: false };
        sessionStimuli.set(muscle, existing);
      }
      return existing;
    };

    for (const ex of session.exercisesSnapshot || []) {
      const { primary, secondary } = resolveExerciseBroadMuscles(
        ex,
        options.customExercises,
        options.resolveFallbackMuscles,
      );
      if (!primary && secondary.length === 0) continue;

      for (const set of ex.sets || []) {
        if (!set.completed || isWarmupSet(set)) continue;
        const setVol = (set.weight || 0) * (set.reps || 0);
        const hasRpe = typeof set.rpe === 'number' && Number.isFinite(set.rpe) && set.rpe > 0;

        if (primary) {
          stats[primary].directSets += 1;
          stats[primary].effectiveSets += 1;
          stats[primary].weeklyVolume += setVol;

          const stim = touchStimulus(primary);
          stim.effectiveSets += 1;
          if (set.setType === 'failure') stim.hasFailure = true;
          else if (set.setType === 'drop') stim.hasDrop = true;
          if (hasRpe) {
            stim.rpeSum += set.rpe!;
            stim.rpeCount += 1;
          }
        }

        for (const sec of secondary) {
          stats[sec].effectiveSets += 0.5;
          const stim = touchStimulus(sec);
          stim.effectiveSets += 0.5;
          if (set.setType === 'failure') stim.hasFailure = true;
          else if (set.setType === 'drop') stim.hasDrop = true;
          if (hasRpe) {
            stim.rpeSum += set.rpe!;
            stim.rpeCount += 1;
          }
        }
      }
    }

    for (const [muscle, stim] of sessionStimuli.entries()) {
      if (stim.effectiveSets < 0.5) continue;
      const entry = stats[muscle];
      if (entry.lastTrainedAt === null || session.date > entry.lastTrainedAt) {
        entry.lastTrainedAt = session.date;
        entry.lastStimulus = stim;
      } else if (session.date === entry.lastTrainedAt && entry.lastStimulus) {
        entry.lastStimulus = {
          effectiveSets: entry.lastStimulus.effectiveSets + stim.effectiveSets,
          rpeSum: entry.lastStimulus.rpeSum + stim.rpeSum,
          rpeCount: entry.lastStimulus.rpeCount + stim.rpeCount,
          hasFailure: entry.lastStimulus.hasFailure || stim.hasFailure,
          hasDrop: entry.lastStimulus.hasDrop || stim.hasDrop,
        };
      }
    }
  }

  return TRACKED_MUSCLE_GROUPS.map((muscle) => {
    const target = MUSCLE_TARGETS[muscle];
    const entry = stats[muscle];
    const effectiveSets = Math.round(entry.effectiveSets * 10) / 10;

    let volumeZone: VolumeZone = 'untrained';
    if (effectiveSets > 0 && effectiveSets < target.minSets) volumeZone = 'under';
    else if (effectiveSets >= target.minSets && effectiveSets <= target.maxSets) volumeZone = 'optimal';
    else if (effectiveSets > target.maxSets) volumeZone = 'over';

    if (entry.lastTrainedAt === null || !entry.lastStimulus) {
      return {
        muscle,
        color: getMuscleColor(muscle),
        directSets: entry.directSets,
        effectiveSets,
        minTarget: target.minSets,
        maxTarget: target.maxSets,
        volumeZone,
        weeklyVolume: Math.round(entry.weeklyVolume),
        lastTrainedAt: null,
        hoursSinceTrained: null,
        neededRecoveryHours: target.baseRecoveryHours,
        recoveryPercent: 100,
        readiness: 'ready',
      };
    }

    const stim = entry.lastStimulus;
    let needed = target.baseRecoveryHours;
    if (stim.effectiveSets < 2) {
      needed = Math.round(needed * 0.65);
    } else if (stim.effectiveSets >= 6) {
      needed += 12;
    } else if (stim.effectiveSets >= 4) {
      needed += 6;
    }

    const avgRpe = stim.rpeCount > 0 ? stim.rpeSum / stim.rpeCount : null;
    if (stim.hasFailure || (avgRpe !== null && avgRpe >= 9)) {
      needed += 12;
    } else if (stim.hasDrop || (avgRpe !== null && avgRpe >= 8)) {
      needed += 6;
    }

    const neededRecoveryHours = Math.max(18, Math.min(96, needed));
    const hoursSinceTrained = Math.max(
      0,
      Math.round(((now - entry.lastTrainedAt) / 3_600_000) * 10) / 10,
    );
    const recoveryPercent = Math.min(100, Math.round((hoursSinceTrained / neededRecoveryHours) * 100));
    const readiness: ReadinessLevel =
      recoveryPercent >= 85 ? 'ready' : recoveryPercent >= 50 ? 'recovering' : 'fatigued';

    return {
      muscle,
      color: getMuscleColor(muscle),
      directSets: entry.directSets,
      effectiveSets,
      minTarget: target.minSets,
      maxTarget: target.maxSets,
      volumeZone,
      weeklyVolume: Math.round(entry.weeklyVolume),
      lastTrainedAt: entry.lastTrainedAt,
      hoursSinceTrained,
      neededRecoveryHours,
      recoveryPercent,
      readiness,
    };
  });
}

export function evaluateDayReadiness(
  exercises: Exercise[],
  recoveryList: MuscleRecoveryStatus[],
  customExercises?: CustomExercise[],
  resolveFallbackMuscles?: (name: string) => string[],
): {
  targetMuscles: MuscleRecoveryStatus[];
  fatiguedMuscles: MuscleRecoveryStatus[];
  recoveringMuscles: MuscleRecoveryStatus[];
  allReady: boolean;
} {
  const seen = new Set<BroadMuscleGroup>();
  const targetMuscles: MuscleRecoveryStatus[] = [];

  for (const ex of exercises) {
    const { primary } = resolveExerciseBroadMuscles(ex, customExercises, resolveFallbackMuscles);
    if (!primary || seen.has(primary)) continue;
    seen.add(primary);
    const status = recoveryList.find((r) => r.muscle === primary);
    if (status) targetMuscles.push(status);
  }

  const fatiguedMuscles = targetMuscles.filter((m) => m.readiness === 'fatigued');
  const recoveringMuscles = targetMuscles.filter((m) => m.readiness === 'recovering');
  const allReady =
    targetMuscles.length > 0 && targetMuscles.every((m) => m.readiness === 'ready');

  return { targetMuscles, fatiguedMuscles, recoveringMuscles, allReady };
}
