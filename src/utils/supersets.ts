import type { Exercise } from '../types';
import { isWarmupSet } from './strength';

export interface SupersetMeta {
  groupId: string;
  letter: string;
  position: number;
  label: string;
  size: number;
  kindLabel: 'Superset' | 'Giant Set';
  isFirst: boolean;
  isLast: boolean;
  memberIds: string[];
  sharedRestSeconds: number;
}

export interface SupersetCompletionOutcome {
  inGroup: boolean;
  nextExerciseId: string | null;
  nextExerciseName: string | null;
  nextLabel: string | null;
  groupLabel: string | null;
  shouldStartRest: boolean;
  restSeconds: number;
  roundCompleted: boolean;
  roundNumber: number;
  totalRounds: number;
}

function getContiguousSupersetRuns(exercises: Exercise[]): Array<{
  groupId: string;
  startIndex: number;
  endIndex: number;
  members: Exercise[];
}> {
  const runs: Array<{
    groupId: string;
    startIndex: number;
    endIndex: number;
    members: Exercise[];
  }> = [];

  let i = 0;
  while (i < exercises.length) {
    const id = exercises[i].supersetId;
    if (!id) {
      i++;
      continue;
    }

    let j = i + 1;
    while (j < exercises.length && exercises[j].supersetId === id) {
      j++;
    }

    if (j - i >= 2) {
      runs.push({
        groupId: id,
        startIndex: i,
        endIndex: j - 1,
        members: exercises.slice(i, j),
      });
    }
    i = j;
  }

  return runs;
}

function indexToLetter(idx: number): string {
  return String.fromCharCode(65 + (idx % 26));
}

/**
 * Computes superset/giant-set metadata (`A1`, `A2`, `B1`...) for all contiguous grouped blocks of size >= 2.
 */
export function computeSupersetMap(exercises: Exercise[]): Map<string, SupersetMeta> {
  const map = new Map<string, SupersetMeta>();
  const runs = getContiguousSupersetRuns(exercises);

  runs.forEach((run, runIdx) => {
    const letter = indexToLetter(runIdx);
    const size = run.members.length;
    const kindLabel: 'Superset' | 'Giant Set' = size === 2 ? 'Superset' : 'Giant Set';
    const memberIds = run.members.map((m) => m.id);
    const sharedRestSeconds = run.members[size - 1].restTimerConfig || 90;

    run.members.forEach((member, memberIdx) => {
      const position = memberIdx + 1;
      map.set(member.id, {
        groupId: run.groupId,
        letter,
        position,
        label: `${letter}${position}`,
        size,
        kindLabel,
        isFirst: memberIdx === 0,
        isLast: memberIdx === size - 1,
        memberIds,
        sharedRestSeconds,
      });
    });
  });

  return map;
}

/**
 * Summarizes completed vs total working-set rounds across exercises in a superset or giant set.
 */
export function getSupersetRoundProgress(groupExercises: Exercise[]): {
  completedRounds: number;
  totalRounds: number;
} {
  if (groupExercises.length === 0) {
    return { completedRounds: 0, totalRounds: 0 };
  }

  const workingCounts: number[] = [];
  const completedCounts: number[] = [];

  for (const ex of groupExercises) {
    const working = ex.sets.filter((s) => !isWarmupSet(s));
    if (working.length === 0) continue;
    workingCounts.push(working.length);
    completedCounts.push(working.filter((s) => s.completed).length);
  }

  if (workingCounts.length === 0) {
    return { completedRounds: 0, totalRounds: 0 };
  }

  return {
    totalRounds: Math.max(0, ...workingCounts),
    completedRounds: Math.max(0, Math.min(...completedCounts)),
  };
}

/**
 * Normalizes `supersetId` and `supersetOrder`, clearing orphan singletons that no longer have >= 2 contiguous members.
 */
export function cleanupOrphanSupersets(exercises: Exercise[]): Exercise[] {
  const runs = getContiguousSupersetRuns(exercises);
  const validAssignment = new Map<string, { groupId: string; order: number }>();

  for (const run of runs) {
    run.members.forEach((member, idx) => {
      validAssignment.set(member.id, { groupId: run.groupId, order: idx });
    });
  }

  return exercises.map((ex) => {
    const valid = validAssignment.get(ex.id);
    if (!valid) {
      if (ex.supersetId === undefined && ex.supersetOrder === undefined) return ex;
      return { ...ex, supersetId: undefined, supersetOrder: undefined };
    }
    if (ex.supersetId === valid.groupId && ex.supersetOrder === valid.order) return ex;
    return { ...ex, supersetId: valid.groupId, supersetOrder: valid.order };
  });
}

/**
 * Links or unlinks `exercises[index]` with `exercises[index - 1]`.
 * Unlinking splits contiguous 3+ giant sets cleanly instead of dissolving unrelated pairs.
 */
export function toggleSupersetLink(
  exercises: Exercise[],
  index: number,
  createId: () => string,
): Exercise[] {
  if (index <= 0 || index >= exercises.length) return exercises;

  const updated = [...exercises];
  const prevEx = updated[index - 1];
  const currEx = updated[index];

  if (currEx.supersetId && currEx.supersetId === prevEx.supersetId) {
    const oldId = currEx.supersetId;
    let start = index - 1;
    while (start > 0 && updated[start - 1].supersetId === oldId) start--;
    let end = index;
    while (end < updated.length - 1 && updated[end + 1].supersetId === oldId) end++;

    const leftCount = index - start;
    const rightCount = end - index + 1;
    const rightId = rightCount >= 2 ? createId() : undefined;

    for (let i = start; i < index; i++) {
      updated[i] = {
        ...updated[i],
        supersetId: leftCount >= 2 ? oldId : undefined,
      };
    }
    for (let i = index; i <= end; i++) {
      updated[i] = {
        ...updated[i],
        supersetId: rightId,
      };
    }
    return cleanupOrphanSupersets(updated);
  }

  const prevId = prevEx.supersetId;
  const currId = currEx.supersetId;
  const targetId = prevId || currId || createId();

  if (prevId) {
    for (let i = index - 1; i >= 0 && updated[i].supersetId === prevId; i--) {
      updated[i] = { ...updated[i], supersetId: targetId };
    }
  } else {
    updated[index - 1] = { ...updated[index - 1], supersetId: targetId };
  }

  if (currId) {
    for (let i = index; i < updated.length && updated[i].supersetId === currId; i++) {
      updated[i] = { ...updated[i], supersetId: targetId };
    }
  } else {
    updated[index] = { ...updated[index], supersetId: targetId };
  }

  return cleanupOrphanSupersets(updated);
}

function findPendingMemberForRound(
  members: Exercise[],
  indices: number[],
  roundIdx: number,
): Exercise | null {
  for (const idx of indices) {
    const candidate = members[idx];
    const working = candidate.sets.filter((s) => !isWarmupSet(s));
    const hasPendingInOrBeforeRound = working.some(
      (s, sIdx) => sIdx <= roundIdx && !s.completed,
    );
    if (hasPendingInOrBeforeRound) {
      return candidate;
    }
  }
  return null;
}

/**
 * Determines whether completing `setId` on `exerciseId` should auto-advance to a superset sibling or start shared rest.
 * Expects `exercises` to already contain `completed: true` on `setId`.
 */
export function resolveSupersetSetCompletion(
  exercises: Exercise[],
  exerciseId: string,
  setId: string,
): SupersetCompletionOutcome {
  const ex = exercises.find((e) => e.id === exerciseId);
  if (!ex) {
    return {
      inGroup: false,
      nextExerciseId: null,
      nextExerciseName: null,
      nextLabel: null,
      groupLabel: null,
      shouldStartRest: true,
      restSeconds: 90,
      roundCompleted: false,
      roundNumber: 0,
      totalRounds: 0,
    };
  }

  const map = computeSupersetMap(exercises);
  const meta = map.get(exerciseId);
  const completedSet = ex.sets.find((s) => s.id === setId);

  if (completedSet && isWarmupSet(completedSet)) {
    return {
      inGroup: Boolean(meta),
      nextExerciseId: null,
      nextExerciseName: null,
      nextLabel: null,
      groupLabel: meta ? `${meta.kindLabel} ${meta.letter}` : null,
      shouldStartRest: true,
      restSeconds: Math.min(ex.restTimerConfig || 90, 60),
      roundCompleted: false,
      roundNumber: 0,
      totalRounds: 0,
    };
  }

  if (!meta) {
    return {
      inGroup: false,
      nextExerciseId: null,
      nextExerciseName: null,
      nextLabel: null,
      groupLabel: null,
      shouldStartRest: true,
      restSeconds: ex.restTimerConfig || 90,
      roundCompleted: false,
      roundNumber: 0,
      totalRounds: 0,
    };
  }

  const members = meta.memberIds
    .map((id) => exercises.find((e) => e.id === id))
    .filter((m): m is Exercise => Boolean(m));
  const pos = members.findIndex((m) => m.id === exerciseId);
  const workingSets = ex.sets.filter((s) => !isWarmupSet(s));
  const roundIdx = Math.max(0, workingSets.findIndex((s) => s.id === setId));
  const { totalRounds } = getSupersetRoundProgress(members);
  const groupLabel = `${meta.kindLabel} ${meta.letter}`;

  const afterIndices: number[] = [];
  for (let i = pos + 1; i < members.length; i++) afterIndices.push(i);
  const beforeIndices: number[] = [];
  for (let i = 0; i < pos; i++) beforeIndices.push(i);

  const pendingSibling =
    findPendingMemberForRound(members, afterIndices, roundIdx) ??
    findPendingMemberForRound(members, beforeIndices, roundIdx);

  if (pendingSibling) {
    const nextMeta = map.get(pendingSibling.id);
    return {
      inGroup: true,
      nextExerciseId: pendingSibling.id,
      nextExerciseName: pendingSibling.name,
      nextLabel: nextMeta?.label ?? null,
      groupLabel,
      shouldStartRest: false,
      restSeconds: 0,
      roundCompleted: false,
      roundNumber: roundIdx + 1,
      totalRounds,
    };
  }

  const firstMember = members[0];
  const firstWorking = firstMember.sets.filter((s) => !isWarmupSet(s));
  const hasNextRoundOnFirst = Boolean(
    firstWorking[roundIdx + 1] && !firstWorking[roundIdx + 1].completed,
  );
  const firstMeta = map.get(firstMember.id);

  return {
    inGroup: true,
    nextExerciseId: hasNextRoundOnFirst ? firstMember.id : null,
    nextExerciseName: hasNextRoundOnFirst ? firstMember.name : null,
    nextLabel: hasNextRoundOnFirst ? firstMeta?.label ?? null : null,
    groupLabel,
    shouldStartRest: true,
    restSeconds: meta.sharedRestSeconds,
    roundCompleted: true,
    roundNumber: roundIdx + 1,
    totalRounds,
  };
}
