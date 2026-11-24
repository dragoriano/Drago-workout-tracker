import { format } from 'date-fns';
import type { PR, Set, WorkoutProgram, WorkoutSession } from '../types';
import { FREESTYLE_PROGRAM_ID } from './customExercises';
import {
  calculateSetWorkingVolume,
  getExerciseTrackingMode,
} from './exerciseModes';
import { calculateEstimated1RM, getSetType, isWarmupSet } from './strength';

const CSV_HEADERS = [
  'Date',
  'Time',
  'Workout',
  'Program',
  'Duration (min)',
  'Exercise',
  'Set #',
  'Set Type',
  'Weight',
  'Unit',
  'Reps',
  'RPE',
  'Completed',
  'Volume',
  'Tracking Mode',
  'Duration (s)',
] as const;

interface PriorExerciseBest {
  maxWeight: number;
  maxE1RM: number;
  maxReps: number;
  maxDuration: number;
}

export function recalculateSessionMetrics(
  editedSession: WorkoutSession,
  allSessions: WorkoutSession[],
): WorkoutSession {
  const earlierSessions = allSessions.filter(
    (s) =>
      s.id !== editedSession.id &&
      Number.isFinite(s.date) &&
      s.date < editedSession.date,
  );

  const priorBestByExercise = new Map<string, PriorExerciseBest>();

  for (const prev of earlierSessions) {
    for (const prevEx of prev.exercisesSnapshot || []) {
      const key = prevEx.name.trim().toLowerCase();
      if (!key) continue;

      const mode = getExerciseTrackingMode(prevEx);
      let entry = priorBestByExercise.get(key);
      if (!entry) {
        entry = { maxWeight: 0, maxE1RM: 0, maxReps: 0, maxDuration: 0 };
        priorBestByExercise.set(key, entry);
      }

      for (const set of prevEx.sets || []) {
        if (!set.completed || isWarmupSet(set)) continue;
        const weight = Number.isFinite(set.weight) ? set.weight : 0;
        const reps = Number.isFinite(set.reps) ? set.reps : 0;
        const duration = Number.isFinite(set.duration) ? (set.duration ?? 0) : 0;

        if (weight > entry.maxWeight) entry.maxWeight = weight;
        if (reps > entry.maxReps) entry.maxReps = reps;
        if (duration > entry.maxDuration) entry.maxDuration = duration;
        if (mode === 'weight_reps') {
          const e1rm = calculateEstimated1RM(weight, reps);
          if (e1rm > entry.maxE1RM) entry.maxE1RM = e1rm;
        }
      }
    }
  }

  let totalVolume = 0;
  const detectedPRs: PR[] = [];

  for (const ex of editedSession.exercisesSnapshot || []) {
    const mode = getExerciseTrackingMode(ex);
    let maxWeightThisSession = 0;
    let maxE1RMThisSession = 0;
    let maxRepsThisSession = 0;
    let maxDurationThisSession = 0;

    for (const set of ex.sets || []) {
      if (!set.completed || isWarmupSet(set)) continue;
      const weight = Number.isFinite(set.weight) ? Math.max(0, set.weight) : 0;
      const reps = Number.isFinite(set.reps) ? Math.max(0, set.reps) : 0;
      const duration = Number.isFinite(set.duration) ? Math.max(0, set.duration ?? 0) : 0;

      totalVolume += calculateSetWorkingVolume({ ...set, weight, reps }, mode);

      if (weight > maxWeightThisSession) maxWeightThisSession = weight;
      if (reps > maxRepsThisSession) maxRepsThisSession = reps;
      if (duration > maxDurationThisSession) maxDurationThisSession = duration;

      if (mode === 'weight_reps') {
        const e1rm = calculateEstimated1RM(weight, reps);
        if (e1rm > maxE1RMThisSession) maxE1RMThisSession = e1rm;
      }
    }

    const prior = priorBestByExercise.get(ex.name.trim().toLowerCase());
    const previousMaxWeight = prior?.maxWeight ?? 0;
    const previousMaxE1RM = prior?.maxE1RM ?? 0;
    const previousMaxReps = prior?.maxReps ?? 0;
    const previousMaxDuration = prior?.maxDuration ?? 0;

    if (mode === 'timed') {
      if (maxDurationThisSession > previousMaxDuration && maxDurationThisSession > 0) {
        detectedPRs.push({
          exerciseId: ex.id,
          exerciseName: ex.name,
          type: 'duration',
          value: maxDurationThisSession,
          previousValue: previousMaxDuration,
        });
      }
      continue;
    }

    if (mode === 'assisted_reps') {
      if (maxRepsThisSession > previousMaxReps && maxRepsThisSession > 0) {
        detectedPRs.push({
          exerciseId: ex.id,
          exerciseName: ex.name,
          type: 'reps',
          value: maxRepsThisSession,
          previousValue: previousMaxReps,
        });
      }
      continue;
    }

    if (mode === 'bodyweight_reps') {
      if (maxWeightThisSession > previousMaxWeight && maxWeightThisSession > 0) {
        detectedPRs.push({
          exerciseId: ex.id,
          exerciseName: ex.name,
          type: 'weight',
          value: maxWeightThisSession,
          previousValue: previousMaxWeight,
        });
      }
      if (maxRepsThisSession > previousMaxReps && maxRepsThisSession > 0) {
        detectedPRs.push({
          exerciseId: ex.id,
          exerciseName: ex.name,
          type: 'reps',
          value: maxRepsThisSession,
          previousValue: previousMaxReps,
        });
      }
      continue;
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

    if (maxE1RMThisSession > previousMaxE1RM && maxE1RMThisSession > 0) {
      detectedPRs.push({
        exerciseId: ex.id,
        exerciseName: ex.name,
        type: '1rm',
        value: maxE1RMThisSession,
        previousValue: previousMaxE1RM,
      });
    }
  }

  return {
    ...editedSession,
    totalVolume: Math.round(totalVolume * 100) / 100,
    PRs: detectedPRs,
  };
}

export function escapeCsvField(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '';
  const str = String(val);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function resolveSessionNames(
  session: WorkoutSession,
  programMap: Map<string, WorkoutProgram>,
): { workoutTitle: string; programTitle: string } {
  const isFreestyle = session.programId === FREESTYLE_PROGRAM_ID;
  const program = isFreestyle ? undefined : programMap.get(session.programId);
  const day = program?.days?.find((d) => d.id === session.dayId);

  const programTitle = isFreestyle
    ? 'Freestyle'
    : program?.name?.trim() || 'Unknown Program';

  const workoutTitle =
    session.workoutName?.trim() ||
    day?.name?.trim() ||
    (isFreestyle ? 'Quick Workout' : 'Workout');

  return { workoutTitle, programTitle };
}

export function formatSessionsToCSV(
  sessions: WorkoutSession[],
  programs: WorkoutProgram[],
  unit: string,
): string {
  const headerLine = CSV_HEADERS.map(escapeCsvField).join(',');
  const programMap = new Map(programs.map((p) => [p.id, p]));

  const sortedSessions = [...sessions].sort((a, b) => (b.date || 0) - (a.date || 0));
  const lines: string[] = [headerLine];

  for (const session of sortedSessions) {
    const dateObj = session.date ? new Date(session.date) : null;
    const hasValidDate = dateObj !== null && !isNaN(dateObj.getTime());
    const dateStr = hasValidDate ? format(dateObj, 'yyyy-MM-dd') : '';
    const timeStr = hasValidDate ? format(dateObj, 'HH:mm') : '';
    const durationMin = Math.round(Math.max(0, session.duration || 0) / 60);
    const { workoutTitle, programTitle } = resolveSessionNames(session, programMap);

    for (const ex of session.exercisesSnapshot || []) {
      const exerciseName = ex.name || '';
      const trackingMode = getExerciseTrackingMode(ex);
      const sets: Set[] = ex.sets || [];

      sets.forEach((set, idx) => {
        const setType = getSetType(set);
        const weight = Number.isFinite(set.weight) ? set.weight : 0;
        const reps = Number.isFinite(set.reps) ? set.reps : 0;
        const rpe =
          typeof set.rpe === 'number' && Number.isFinite(set.rpe) && set.rpe > 0
            ? set.rpe
            : '';
        const completed = set.completed ? 'Yes' : 'No';
        const workingVolume =
          Math.round(
            calculateSetWorkingVolume({ ...set, weight, reps }, trackingMode) * 100,
          ) / 100;
        const durationSec =
          typeof set.duration === 'number' && Number.isFinite(set.duration) && set.duration > 0
            ? Math.round(set.duration)
            : '';

        const row = [
          dateStr,
          timeStr,
          workoutTitle,
          programTitle,
          durationMin,
          exerciseName,
          idx + 1,
          setType,
          weight,
          unit,
          reps,
          rpe,
          completed,
          workingVolume,
          trackingMode,
          durationSec,
        ];
        lines.push(row.map(escapeCsvField).join(','));
      });
    }
  }

  return lines.join('\n');
}

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
