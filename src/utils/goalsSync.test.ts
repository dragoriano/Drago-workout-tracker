import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeGoalMetricValue,
  computeGoalProgressPercent,
  isGoalAchieved,
  reconcileAutoGoals,
} from './goalsSync.ts';
import type { Goal, Measurement, WorkoutSession } from '../types/index.ts';

const NOW = new Date(2026, 10, 23, 12, 0, 0, 0).getTime();
const DAY = 86_400_000;

function makeGoal(overrides: Partial<Goal>): Goal {
  return {
    id: 'g1',
    title: 'Test Goal',
    targetValue: 100,
    currentValue: 0,
    unit: 'kg',
    deadline: null,
    completed: false,
    createdAt: NOW - 10 * DAY,
    ...overrides,
  };
}

describe('computeGoalMetricValue', () => {
  const sessions: WorkoutSession[] = [
    {
      id: 's-prev-month',
      programId: 'p1',
      dayId: 'd1',
      date: new Date(2026, 9, 25, 12, 0, 0, 0).getTime(),
      totalVolume: 3000,
      PRs: [],
      duration: 1800,
      exercisesSnapshot: [
        {
          id: 'ex1',
          name: 'Bench Press',
          notes: '',
          restTimerConfig: 90,
          lastUpdated: NOW,
          history: [],
          sets: [
            { id: 'w1', weight: 150, reps: 5, completed: true, setType: 'warmup' },
            { id: 's1', weight: 90, reps: 5, completed: true, setType: 'working' },
          ],
        },
      ],
    },
    {
      id: 's-this-week',
      programId: 'p1',
      dayId: 'd1',
      date: NOW - DAY,
      totalVolume: 5000,
      PRs: [],
      duration: 2100,
      exercisesSnapshot: [
        {
          id: 'ex2',
          name: 'bench press ',
          notes: '',
          restTimerConfig: 90,
          lastUpdated: NOW,
          history: [],
          sets: [
            { id: 's2', weight: 100, reps: 5, completed: true, setType: 'working' }, // e1RM 116.7
            { id: 's3', weight: 130, reps: 3, completed: false }, // incomplete ignored
          ],
        },
      ],
    },
  ];

  const measurements: Measurement[] = [
    { id: 'm1', type: 'weight', value: 84, unit: 'kg', date: NOW - 5 * DAY },
    { id: 'm2', type: 'weight', value: 82.4, unit: 'kg', date: NOW - DAY },
    { id: 'm3', type: 'waist', value: 85, unit: 'cm', date: NOW - DAY },
  ];

  it('computes exercise e1RM, max weight, monthly workouts, weekly volume, and body weight', () => {
    assert.equal(computeGoalMetricValue(makeGoal({ trackingType: 'manual' }), sessions, measurements, NOW), null);

    assert.equal(
      computeGoalMetricValue(
        makeGoal({ trackingType: 'exercise_e1rm', linkedExerciseName: 'Bench Press' }),
        sessions,
        measurements,
        NOW,
      ),
      116.7,
    );

    assert.equal(
      computeGoalMetricValue(
        makeGoal({ trackingType: 'exercise_weight', linkedExerciseName: 'Bench Press' }),
        sessions,
        measurements,
        NOW,
      ),
      100,
    );

    assert.equal(
      computeGoalMetricValue(makeGoal({ trackingType: 'monthly_workouts' }), sessions, measurements, NOW),
      1,
    );

    assert.equal(
      computeGoalMetricValue(makeGoal({ trackingType: 'weekly_volume' }), sessions, measurements, NOW),
      5000,
    );

    assert.equal(
      computeGoalMetricValue(makeGoal({ trackingType: 'body_weight' }), sessions, measurements, NOW),
      82.4,
    );
  });
});

describe('computeGoalProgressPercent & isGoalAchieved', () => {
  it('supports both increasing goals and weight-loss decreasing goals', () => {
    assert.equal(
      computeGoalProgressPercent({ currentValue: 75, targetValue: 100, direction: 'increase' }),
      75,
    );
    assert.equal(isGoalAchieved({ targetValue: 100, direction: 'increase' }, 100), true);

    assert.equal(
      computeGoalProgressPercent({
        startValue: 85,
        currentValue: 82,
        targetValue: 80,
        direction: 'decrease',
      }),
      60,
    );
    assert.equal(isGoalAchieved({ targetValue: 80, direction: 'decrease' }, 79.8), true);
    assert.equal(isGoalAchieved({ targetValue: 80, direction: 'decrease' }, 81), false);
  });
});

describe('reconcileAutoGoals', () => {
  it('updates changed auto goals, completes achieved goals, and leaves manual/completed goals unchanged', () => {
    const manual = makeGoal({ id: 'manual', trackingType: 'manual', currentValue: 20, targetValue: 50 });
    const cutGoal = makeGoal({
      id: 'cut',
      trackingType: 'body_weight',
      direction: 'decrease',
      startValue: 85,
      currentValue: 83,
      targetValue: 80,
    });
    const benchGoal = makeGoal({
      id: 'bench',
      trackingType: 'exercise_e1rm',
      linkedExerciseName: 'Bench Press',
      currentValue: 100,
      targetValue: 115,
    });
    const alreadyDone = makeGoal({
      id: 'done',
      trackingType: 'weekly_volume',
      currentValue: 9000,
      targetValue: 5000,
      completed: true,
    });

    const sessions: WorkoutSession[] = [
      {
        id: 's1',
        programId: 'p1',
        dayId: 'd1',
        date: NOW - DAY,
        totalVolume: 2000,
        PRs: [],
        duration: 1800,
        exercisesSnapshot: [
          {
            id: 'e1',
            name: 'Bench Press',
            notes: '',
            restTimerConfig: 90,
            lastUpdated: NOW,
            history: [],
            sets: [{ id: '1', weight: 100, reps: 5, completed: true }],
          },
        ],
      },
    ];
    const measurements: Measurement[] = [
      { id: 'w1', type: 'weight', value: 81.5, unit: 'kg', date: NOW - DAY },
    ];

    const res = reconcileAutoGoals([manual, cutGoal, benchGoal, alreadyDone], sessions, measurements, NOW);

    assert.equal(res.changedGoals.length, 3);
    assert.equal(res.newlyCompleted.map((g) => g.id).join(','), 'bench');
    assert.equal(res.updatedGoals.find((g) => g.id === 'manual')!.currentValue, 20);
    assert.equal(res.updatedGoals.find((g) => g.id === 'cut')!.currentValue, 81.5);
    assert.equal(res.updatedGoals.find((g) => g.id === 'cut')!.completed, false);
    assert.equal(res.updatedGoals.find((g) => g.id === 'bench')!.currentValue, 116.7);
    assert.equal(res.updatedGoals.find((g) => g.id === 'bench')!.completed, true);
    // Already-completed goal remains completed even if weekly volume dropped
    assert.equal(res.updatedGoals.find((g) => g.id === 'done')!.completed, true);
  });
});
