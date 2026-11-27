import type { CustomExercise, WorkoutSession } from '../types';
import { mergeExerciseCatalog, type CatalogExerciseItem } from './customExercises';
import {
  resolveExerciseBroadMuscles,
  type BroadMuscleGroup,
  type MuscleRecoveryStatus,
} from './muscleRecovery';
import { isWarmupSet } from './strength';

export interface RecentMuscleExercise {
  name: string;
  setsCount: number;
  role: 'primary' | 'secondary';
  lastTrainedAt: number;
  hoursAgo: number;
}

export type AnatomyHeatmapMode = 'readiness' | 'volume';

export interface RegionVisualStyle {
  fill: string;
  stroke: string;
  fillOpacity: number;
  strokeOpacity: number;
  glowColor: string;
  showGlow: boolean;
}

const STAPLE_EXERCISE_REGEX =
  /\b(bench press|squat|deadlift|row|pulldown|pull-?up|overhead press|curl|pushdown|lateral raise|leg press|hip thrust|crunch|plank|calf raise)\b/i;

const CLASSIC_EQUIPMENT_REGEX = /\b(barbell|dumbbell|cable|machine)\b/i;

/**
 * Aggregates unique exercises performed over the recent window that stimulate a given muscle group.
 */
export function getMuscleRecentExercises(
  sessions: WorkoutSession[],
  muscle: BroadMuscleGroup,
  options: {
    now?: number;
    daysWindow?: number;
    limit?: number;
    customExercises?: CustomExercise[];
    resolveFallbackMuscles?: (name: string) => string[];
  } = {},
): RecentMuscleExercise[] {
  const now = options.now ?? Date.now();
  const daysWindow = options.daysWindow ?? 7;
  const limit = options.limit ?? 4;
  const cutoff = now - daysWindow * 24 * 60 * 60 * 1000;

  const byName = new Map<
    string,
    { name: string; setsCount: number; role: 'primary' | 'secondary'; lastTrainedAt: number }
  >();

  for (const session of sessions) {
    if (!session.date || Number.isNaN(new Date(session.date).getTime())) continue;
    if (session.date < cutoff || session.date > now + 60_000) continue;

    for (const ex of session.exercisesSnapshot || []) {
      const completedWorkingSets = (ex.sets || []).filter(
        (s) => s.completed && !isWarmupSet(s),
      ).length;
      if (completedWorkingSets <= 0) continue;

      const { primary, secondary } = resolveExerciseBroadMuscles(
        ex,
        options.customExercises,
        options.resolveFallbackMuscles,
      );

      let role: 'primary' | 'secondary' | null = null;
      if (primary === muscle) role = 'primary';
      else if (secondary.includes(muscle)) role = 'secondary';
      if (!role) continue;

      const key = ex.name.toLowerCase().trim();
      if (!key) continue;

      const existing = byName.get(key);
      if (!existing) {
        byName.set(key, {
          name: ex.name.trim(),
          setsCount: completedWorkingSets,
          role,
          lastTrainedAt: session.date,
        });
      } else {
        existing.setsCount += completedWorkingSets;
        if (role === 'primary') existing.role = 'primary';
        if (session.date >= existing.lastTrainedAt) {
          existing.lastTrainedAt = session.date;
          existing.name = ex.name.trim();
        }
      }
    }
  }

  return Array.from(byName.values())
    .map((entry) => ({
      ...entry,
      hoursAgo: Math.max(0, Math.round(((now - entry.lastTrainedAt) / 3_600_000) * 10) / 10),
    }))
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'primary' ? -1 : 1;
      if (b.lastTrainedAt !== a.lastTrainedAt) return b.lastTrainedAt - a.lastTrainedAt;
      return b.setsCount - a.setsCount;
    })
    .slice(0, limit);
}

/**
 * Formats estimated time until a muscle reaches >= 85% readiness.
 */
export function getEstimatedReadyLabel(status: MuscleRecoveryStatus): string {
  if (status.lastTrainedAt === null || status.recoveryPercent === 100) {
    return 'Fully recovered';
  }
  if (status.recoveryPercent >= 85 || status.readiness === 'ready') {
    return 'Ready to train';
  }

  const targetHours = status.neededRecoveryHours * 0.85;
  const remaining = Math.max(1, Math.ceil(targetHours - (status.hoursSinceTrained ?? 0)));
  if (remaining < 24) {
    return `Ready in ~${remaining}h`;
  }
  const days = Math.round((remaining / 24) * 10) / 10;
  return `Ready in ~${days}d`;
}

/**
 * Resolves SVG fill, stroke, and glow styles for an anatomical region by mode and selection state.
 */
export function getRegionVisualStyle(
  status: MuscleRecoveryStatus,
  mode: AnatomyHeatmapMode,
  isSelected: boolean,
  isDimmed: boolean,
  isLightMode = false,
): RegionVisualStyle {
  let fill = '#10b981';
  let stroke = '#34d399';
  let fillOpacity = 0.7;
  let strokeOpacity = 0.82;
  let glowColor = '#10b981';
  let showGlow = false;

  if (mode === 'readiness') {
    if (status.readiness === 'fatigued') {
      fill = '#ef4444';
      stroke = '#f87171';
      fillOpacity = 0.88;
      strokeOpacity = 0.94;
      glowColor = '#ef4444';
      showGlow = true;
    } else if (status.readiness === 'recovering') {
      fill = '#f59e0b';
      stroke = '#fbbf24';
      fillOpacity = 0.82;
      strokeOpacity = 0.9;
      glowColor = '#f59e0b';
      showGlow = true;
    } else if (status.effectiveSets === 0 && status.lastTrainedAt === null) {
      fill = '#10b981';
      stroke = isLightMode ? '#059669' : '#34d399';
      fillOpacity = isLightMode ? 0.36 : 0.42;
      strokeOpacity = isLightMode ? 0.58 : 0.55;
      glowColor = '#10b981';
      showGlow = false;
    } else {
      fill = '#10b981';
      stroke = '#34d399';
      fillOpacity = isLightMode ? 0.62 : 0.72;
      strokeOpacity = 0.85;
      glowColor = '#10b981';
      showGlow = false;
    }
  } else {
    if (status.volumeZone === 'untrained') {
      fill = '#64748b';
      stroke = '#94a3b8';
      fillOpacity = isLightMode ? 0.28 : 0.24;
      strokeOpacity = 0.55;
      glowColor = '#0ea5e9';
      showGlow = false;
    } else if (status.volumeZone === 'under') {
      fill = '#f59e0b';
      stroke = '#fbbf24';
      fillOpacity = 0.68;
      strokeOpacity = 0.85;
      glowColor = '#f59e0b';
      showGlow = false;
    } else if (status.volumeZone === 'optimal') {
      fill = '#10b981';
      stroke = '#34d399';
      fillOpacity = 0.8;
      strokeOpacity = 0.92;
      glowColor = '#10b981';
      showGlow = true;
    } else {
      fill = '#ef4444';
      stroke = '#f87171';
      fillOpacity = 0.86;
      strokeOpacity = 0.95;
      glowColor = '#ef4444';
      showGlow = true;
    }
  }

  if (isSelected) {
    fillOpacity = 0.94;
    strokeOpacity = 1;
    showGlow = true;
  } else if (isDimmed) {
    fillOpacity = Math.round(fillOpacity * 0.38 * 100) / 100;
    strokeOpacity = Math.round(strokeOpacity * 0.55 * 100) / 100;
    showGlow = false;
  }

  return { fill, stroke, fillOpacity, strokeOpacity, glowColor, showGlow };
}

export function getSuggestedFreestyleTitle(muscles: BroadMuscleGroup[]): string {
  if (muscles.length === 0) return 'Quick Workout';
  if (muscles.length === 1) return `${muscles[0]} Focus`;
  if (muscles.length === 2) return `${muscles[0]} & ${muscles[1]} Focus`;
  return 'Recovered Muscles Freestyle';
}

function scoreCandidateExercise(item: CatalogExerciseItem): number {
  let score = 0;
  if (item.isCustom) score += 3;
  if (STAPLE_EXERCISE_REGEX.test(item.name)) score += 2;
  if (CLASSIC_EQUIPMENT_REGEX.test(item.name) || (item.equipment && CLASSIC_EQUIPMENT_REGEX.test(item.equipment))) {
    score += 1;
  }
  return score;
}

/**
 * Picks up to `perMuscle` staple exercises per selected muscle (capped at 6 total) for instant freestyle kickoff.
 */
export function pickRecommendedExercisesForMuscles(
  muscles: BroadMuscleGroup[],
  catalog: CatalogExerciseItem[],
  customExercises: CustomExercise[],
  perMuscle = 2,
): CatalogExerciseItem[] {
  if (muscles.length === 0) return [];
  const merged = mergeExerciseCatalog(catalog, customExercises);
  const used = new Set<string>();
  const picked: CatalogExerciseItem[] = [];
  const maxTotal = 6;

  for (const muscle of muscles) {
    if (picked.length >= maxTotal) break;

    const matching = merged
      .filter((item) => resolveExerciseBroadMuscles(item, customExercises).primary === muscle)
      .sort((a, b) => scoreCandidateExercise(b) - scoreCandidateExercise(a));

    let addedForMuscle = 0;
    for (const candidate of matching) {
      if (picked.length >= maxTotal || addedForMuscle >= perMuscle) break;
      const key = candidate.name.toLowerCase().trim();
      if (used.has(key)) continue;
      used.add(key);
      picked.push(candidate);
      addedForMuscle += 1;
    }
  }

  return picked;
}
