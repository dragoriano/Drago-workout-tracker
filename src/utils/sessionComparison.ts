import type { Exercise, PR, Set, WorkoutSession } from '../types';
import { FREESTYLE_PROGRAM_ID } from './customExercises';
import { getBestSet1RM, isWarmupSet } from './strength';

export interface ExerciseComparison {
  exerciseName: string;
  currentWorkingSets: number;
  previousWorkingSets: number;
  currentMaxWeight: number;
  previousMaxWeight: number;
  maxWeightDelta: number;
  currentBest1RM: number;
  previousBest1RM: number;
  e1rmDelta: number;
  currentVolume: number;
  previousVolume: number;
  volumeDelta: number;
  status: 'improved' | 'matched' | 'regressed' | 'new';
}

export interface SessionComparison {
  currentSessionId: string;
  previousSessionId: string;
  previousDate: number;
  volumeCurrent: number;
  volumePrevious: number;
  volumeDelta: number;
  volumeDeltaPct: number | null;
  durationCurrentSec: number;
  durationPreviousSec: number;
  durationDeltaSec: number;
  workingSetsCurrent: number;
  workingSetsPrevious: number;
  setsDelta: number;
  improvedCount: number;
  exerciseDiffs: ExerciseComparison[];
}

export interface PRTimelineEntry {
  id: string;
  sessionId: string;
  date: number;
  exerciseName: string;
  type: PR['type'];
  value: number;
  previousValue: number;
  gain: number;
  gainPct: number | null;
  isLatestForExerciseType: boolean;
}

function summarizeWorkingSets(sets: Set[]): {
  workingSetsCount: number;
  maxWeight: number;
  best1RM: number;
  volume: number;
} {
  const workingSets = sets.filter((s) => s.completed && !isWarmupSet(s));
  let maxWeight = 0;
  let volume = 0;
  for (const s of workingSets) {
    if (s.weight > maxWeight) maxWeight = s.weight;
    volume += (s.weight || 0) * (s.reps || 0);
  }
  const best = getBestSet1RM(workingSets);
  return {
    workingSetsCount: workingSets.length,
    maxWeight,
    best1RM: best?.e1rm ?? 0,
    volume: Math.round(volume * 10) / 10,
  };
}

function collectExerciseSetsByName(exercises: Exercise[]): Map<string, { name: string; sets: Set[] }> {
  const map = new Map<string, { name: string; sets: Set[] }>();
  for (const ex of exercises) {
    const key = ex.name.trim().toLowerCase();
    if (!key) continue;
    const existing = map.get(key);
    if (existing) {
      existing.sets.push(...ex.sets);
    } else {
      map.set(key, { name: ex.name, sets: [...ex.sets] });
    }
  }
  return map;
}

export function findPreviousComparableSession(
  session: WorkoutSession,
  allSessions: WorkoutSession[],
): WorkoutSession | null {
  const candidates = allSessions
    .filter((s) => s.id !== session.id && s.date && s.date < session.date)
    .sort((a, b) => b.date - a.date);

  if (candidates.length === 0) return null;

  if (session.programId !== FREESTYLE_PROGRAM_ID) {
    return (
      candidates.find(
        (s) => s.programId === session.programId && s.dayId === session.dayId,
      ) ?? null
    );
  }

  const targetName = (session.workoutName || '').trim().toLowerCase();
  if (targetName) {
    const namedMatch = candidates.find(
      (s) =>
        (s.programId === FREESTYLE_PROGRAM_ID || Boolean(s.workoutName)) &&
        (s.workoutName || '').trim().toLowerCase() === targetName,
    );
    if (namedMatch) return namedMatch;
  }

  const currentNames = new Set(
    (session.exercisesSnapshot || [])
      .map((e) => e.name.trim().toLowerCase())
      .filter(Boolean),
  );
  if (currentNames.size === 0) return null;

  return (
    candidates.find((s) =>
      (s.exercisesSnapshot || []).some((e) => currentNames.has(e.name.trim().toLowerCase())),
    ) ?? null
  );
}

export function compareSessions(
  current: WorkoutSession,
  previous: WorkoutSession | null,
): SessionComparison | null {
  if (!previous) return null;

  const prevByName = collectExerciseSetsByName(previous.exercisesSnapshot || []);
  const currByName = collectExerciseSetsByName(current.exercisesSnapshot || []);

  let workingSetsCurrent = 0;
  let workingSetsPrevious = 0;
  for (const entry of prevByName.values()) {
    workingSetsPrevious += summarizeWorkingSets(entry.sets).workingSetsCount;
  }

  const exerciseDiffs: ExerciseComparison[] = [];
  for (const [key, currEntry] of currByName.entries()) {
    const currStats = summarizeWorkingSets(currEntry.sets);
    workingSetsCurrent += currStats.workingSetsCount;

    const prevEntry = prevByName.get(key);
    if (!prevEntry) {
      exerciseDiffs.push({
        exerciseName: currEntry.name,
        currentWorkingSets: currStats.workingSetsCount,
        previousWorkingSets: 0,
        currentMaxWeight: currStats.maxWeight,
        previousMaxWeight: 0,
        maxWeightDelta: currStats.maxWeight,
        currentBest1RM: currStats.best1RM,
        previousBest1RM: 0,
        e1rmDelta: currStats.best1RM,
        currentVolume: currStats.volume,
        previousVolume: 0,
        volumeDelta: currStats.volume,
        status: 'new',
      });
      continue;
    }

    const prevStats = summarizeWorkingSets(prevEntry.sets);
    const maxWeightDelta = Math.round((currStats.maxWeight - prevStats.maxWeight) * 10) / 10;
    const e1rmDelta = Math.round((currStats.best1RM - prevStats.best1RM) * 10) / 10;
    const volumeDelta = Math.round((currStats.volume - prevStats.volume) * 10) / 10;

    let status: ExerciseComparison['status'] = 'matched';
    if (prevStats.workingSetsCount === 0 && currStats.workingSetsCount > 0) {
      status = 'new';
    } else if (
      e1rmDelta > 0 ||
      (e1rmDelta === 0 && maxWeightDelta > 0) ||
      (e1rmDelta === 0 && maxWeightDelta === 0 && volumeDelta > 0)
    ) {
      status = 'improved';
    } else if (e1rmDelta < 0 || maxWeightDelta < 0 || volumeDelta < 0) {
      status = 'regressed';
    }

    exerciseDiffs.push({
      exerciseName: currEntry.name,
      currentWorkingSets: currStats.workingSetsCount,
      previousWorkingSets: prevStats.workingSetsCount,
      currentMaxWeight: currStats.maxWeight,
      previousMaxWeight: prevStats.maxWeight,
      maxWeightDelta,
      currentBest1RM: currStats.best1RM,
      previousBest1RM: prevStats.best1RM,
      e1rmDelta,
      currentVolume: currStats.volume,
      previousVolume: prevStats.volume,
      volumeDelta,
      status,
    });
  }

  const volumeCurrent = current.totalVolume || 0;
  const volumePrevious = previous.totalVolume || 0;
  const volumeDelta = Math.round((volumeCurrent - volumePrevious) * 10) / 10;
  const volumeDeltaPct =
    volumePrevious > 0 ? Math.round(((volumeCurrent - volumePrevious) / volumePrevious) * 1000) / 10 : null;

  return {
    currentSessionId: current.id,
    previousSessionId: previous.id,
    previousDate: previous.date,
    volumeCurrent,
    volumePrevious,
    volumeDelta,
    volumeDeltaPct,
    durationCurrentSec: current.duration || 0,
    durationPreviousSec: previous.duration || 0,
    durationDeltaSec: (current.duration || 0) - (previous.duration || 0),
    workingSetsCurrent,
    workingSetsPrevious,
    setsDelta: workingSetsCurrent - workingSetsPrevious,
    improvedCount: exerciseDiffs.filter((d) => d.status === 'improved').length,
    exerciseDiffs,
  };
}

export function buildPRTimeline(
  sessions: WorkoutSession[],
  options: { exerciseFilter?: string; typeFilter?: 'all' | 'weight' | '1rm' } = {},
): PRTimelineEntry[] {
  const chronological = sessions
    .filter((s) => s.date && !isNaN(new Date(s.date).getTime()))
    .sort((a, b) => a.date - b.date);

  const rawEntries: PRTimelineEntry[] = [];
  const latestByKey = new Map<string, number>();

  for (const session of chronological) {
    (session.PRs || []).forEach((pr, idx) => {
      const key = `${pr.exerciseName.trim().toLowerCase()}::${pr.type}`;
      const gain = Math.round((pr.value - pr.previousValue) * 10) / 10;
      const gainPct =
        pr.previousValue > 0
          ? Math.round(((pr.value - pr.previousValue) / pr.previousValue) * 1000) / 10
          : null;
      const entryIndex = rawEntries.length;
      latestByKey.set(key, entryIndex);
      rawEntries.push({
        id: `${session.id}-${pr.exerciseId}-${pr.type}-${idx}`,
        sessionId: session.id,
        date: session.date,
        exerciseName: pr.exerciseName,
        type: pr.type,
        value: pr.value,
        previousValue: pr.previousValue,
        gain,
        gainPct,
        isLatestForExerciseType: false,
      });
    });
  }

  for (const latestIdx of latestByKey.values()) {
    rawEntries[latestIdx].isLatestForExerciseType = true;
  }

  const normalizedExFilter = options.exerciseFilter?.trim().toLowerCase();
  const filtered = rawEntries.filter((entry) => {
    if (normalizedExFilter && entry.exerciseName.trim().toLowerCase() !== normalizedExFilter) {
      return false;
    }
    if (options.typeFilter && options.typeFilter !== 'all' && entry.type !== options.typeFilter) {
      return false;
    }
    return true;
  });

  return filtered.sort((a, b) => b.date - a.date);
}

export function getPRTimelineExercises(sessions: WorkoutSession[]): string[] {
  const seen = new Map<string, { name: string; latestDate: number }>();
  for (const session of sessions) {
    if (!session.date || isNaN(new Date(session.date).getTime())) continue;
    for (const pr of session.PRs || []) {
      const key = pr.exerciseName.trim().toLowerCase();
      if (!key) continue;
      const existing = seen.get(key);
      if (!existing || session.date > existing.latestDate) {
        seen.set(key, { name: pr.exerciseName, latestDate: session.date });
      }
    }
  }
  return Array.from(seen.values())
    .sort((a, b) => b.latestDate - a.latestDate)
    .map((v) => v.name);
}
