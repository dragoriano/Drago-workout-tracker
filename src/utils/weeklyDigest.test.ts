import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { startOfDay } from 'date-fns';
import { computeWeeklyDigest } from './weeklyDigest.ts';
import type { WorkoutSession } from '../types/index.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = startOfDay(new Date('2026-11-27T12:00:00Z')).getTime() + 12 * 3_600_000;

function makeSession(
  id: string,
  daysAgo: number,
  totalVolume: number,
  prs: number,
  muscle = 'Chest',
  setsCount = 4,
): WorkoutSession {
  return {
    id,
    programId: 'prog-1',
    dayId: 'day-1',
    workoutName: 'Session ' + id,
    date: NOW - daysAgo * DAY_MS,
    duration: 2700,
    totalVolume,
    PRs: Array.from({ length: prs }, (_, idx) => ({
      exerciseId: `ex-${idx}`,
      exerciseName: 'Bench Press',
      type: 'weight',
      value: 100 + idx * 5,
      previousValue: 95,
    })),
    exercisesSnapshot: [
      {
        id: `ex-${id}`,
        name: 'Bench Press',
        muscleGroup: [muscle],
        primaryMuscle: muscle,
        notes: '',
        history: [],
        restTimerConfig: 90,
        lastUpdated: NOW,
        sets: [
          { id: 'w1', weight: 40, reps: 10, completed: true, setType: 'warmup' },
          ...Array.from({ length: setsCount }, (_, idx) => ({
            id: `s-${id}-${idx}`,
            weight: 90,
            reps: 8,
            completed: true,
            setType: 'working' as const,
          })),
        ],
      },
    ],
  };
}

describe('computeWeeklyDigest', () => {
  it('computes 7-day vs prior-7-day deltas, excludes warmups, and highlights top muscles & PRs', () => {
    const sessions = [
      // This 7d window (3 sessions, 15,000 kg total, 3 PRs)
      makeSession('w0', 0, 5000, 1, 'Chest', 5),
      makeSession('w1', 2, 5000, 1, 'Back', 4),
      makeSession('w2', 4, 5000, 1, 'Chest', 4),
      // Prior 7d window (2 sessions, 10,000 kg total)
      makeSession('p0', 8, 5000, 0, 'Legs', 4),
      makeSession('p1', 10, 5000, 0, 'Legs', 4),
    ];

    const digest = computeWeeklyDigest(sessions, [], { unit: 'kg', now: NOW });

    assert.equal(digest.sessionsCount, 3);
    assert.equal(digest.prevSessionsCount, 2);
    assert.equal(digest.sessionsDelta, 1);
    assert.equal(digest.totalVolume, 15000);
    assert.equal(digest.prevTotalVolume, 10000);
    assert.equal(digest.volumeDeltaPct, 50);
    assert.equal(digest.totalWorkingSets, 13);
    assert.equal(digest.prCount, 3);
    assert.equal(digest.topPRs.length, 3);
    assert.equal(digest.topMuscles[0].muscle, 'Chest');
    assert.equal(digest.topMuscles[0].workingSets, 9);
    assert.equal(digest.headline, '3 Personal Records Smashed');
  });

  it('handles zero prior-week volume without NaN and provides clean empty state', () => {
    const empty = computeWeeklyDigest([], [], { unit: 'lbs', now: NOW });
    assert.equal(empty.sessionsCount, 0);
    assert.equal(empty.volumeDeltaPct, null);
    assert.equal(empty.headline, 'Recovery & Preparation Week');

    const firstWeekOnly = computeWeeklyDigest(
      [makeSession('only', 1, 4000, 0, 'Legs', 4)],
      [],
      { unit: 'kg', now: NOW },
    );
    assert.equal(firstWeekOnly.sessionsCount, 1);
    assert.equal(firstWeekOnly.volumeDeltaPct, null);
  });
});
