import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectLiftPlateaus, forecastStrengthGoals } from './coachingInsights.ts';
import { computeStrengthStandards } from './strengthStandards.ts';
import type { Goal, Measurement, WorkoutSession } from '../types/index.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.now();

function makeWeightedSession(
  id: string,
  daysAgo: number,
  exerciseName: string,
  weight: number,
  reps: number,
): WorkoutSession {
  return {
    id,
    programId: 'p1',
    dayId: 'd1',
    date: NOW - daysAgo * DAY_MS,
    totalVolume: weight * reps * 3,
    PRs: [],
    duration: 2400,
    exercisesSnapshot: [
      {
        id: `ex-${id}`,
        name: exerciseName,
        notes: '',
        history: [],
        restTimerConfig: 90,
        lastUpdated: NOW,
        sets: [{ id: 's1', weight, reps, completed: true, setType: 'working' }],
      },
    ],
  };
}

describe('detectLiftPlateaus', () => {
  it('flags exercises stalled across 3+ sessions while ignoring progressing lifts', () => {
    const sessions = [
      // Bench stuck at 100x5 across 3 sessions
      makeWeightedSession('b1', 12, 'Barbell Flat Standard Bench Press', 100, 5),
      makeWeightedSession('b2', 7, 'Barbell Flat Standard Bench Press', 100, 5),
      makeWeightedSession('b3', 2, 'Barbell Flat Standard Bench Press', 100, 5),
      // Squat steadily progressing
      makeWeightedSession('q1', 12, 'Barbell Back Squat', 120, 5),
      makeWeightedSession('q2', 7, 'Barbell Back Squat', 125, 5),
      makeWeightedSession('q3', 2, 'Barbell Back Squat', 132.5, 5),
    ];

    const alerts = detectLiftPlateaus(sessions, { unit: 'kg' });
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].exerciseName, 'Barbell Flat Standard Bench Press');
    assert.equal(alerts[0].sessionsStalled, 3);
  });
});

describe('forecastStrengthGoals', () => {
  it('computes ETA weeks & dates for active e1RM goals and next strength tiers with positive slope', () => {
    // Squat climbs 2.5 kg/week over 3 weeks: 120 -> 125 -> 130 (1 rep max = weight)
    const sessions = [
      makeWeightedSession('s1', 21, 'Barbell Back Squat', 120, 1),
      makeWeightedSession('s2', 14, 'Barbell Back Squat', 122.5, 1),
      makeWeightedSession('s3', 7, 'Barbell Back Squat', 125, 1),
      makeWeightedSession('s4', 0, 'Barbell Back Squat', 130, 1),
    ];
    const bw: Measurement[] = [{ id: 'w1', type: 'weight', value: 80, unit: 'kg', date: NOW }];
    const standards = computeStrengthStandards(sessions, bw, 'kg');

    const goals: Goal[] = [
      {
        id: 'g1',
        title: 'Squat 145',
        targetValue: 145,
        currentValue: 130,
        unit: 'kg',
        deadline: null,
        completed: false,
        createdAt: NOW - 20 * DAY_MS,
        trackingType: 'exercise_e1rm',
        linkedExerciseName: 'Barbell Back Squat',
      },
    ];

    const forecasts = forecastStrengthGoals(sessions, goals, standards, { unit: 'kg', now: NOW });
    assert.ok(forecasts.length >= 2);
    const goalEta = forecasts.find((f) => f.id === 'goal-g1');
    const tierEta = forecasts.find((f) => f.id === 'tier-squat');

    assert.ok(goalEta && goalEta.weeklyGainRate > 2 && goalEta.weeksToTarget >= 3 && goalEta.weeksToTarget <= 7);
    assert.ok(tierEta && tierEta.targetValue === 160);
  });
});
