import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeStrengthStandards,
  computeSymmetryBalance,
  computeTrainingMilestones,
  convertWeight,
  matchBigLiftKey,
} from './strengthStandards.ts';
import type { Measurement, WorkoutSession } from '../types/index.ts';

const NOW = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;

function makeSet(weight: number, reps: number, setType: 'working' | 'warmup' = 'working') {
  return {
    id: `s-${Math.random().toString(36).slice(2)}`,
    weight,
    reps,
    completed: true,
    setType,
  };
}

function makeSession(
  id: string,
  daysAgo: number,
  exercises: Array<{ name: string; primaryMuscle?: string; sets: ReturnType<typeof makeSet>[] }>,
  options?: { totalVolume?: number; PRs?: WorkoutSession['PRs'] },
): WorkoutSession {
  const computedVol = exercises.reduce(
    (sum, ex) =>
      sum + ex.sets.filter((s) => s.setType !== 'warmup').reduce((a, b) => a + b.weight * b.reps, 0),
    0,
  );
  return {
    id,
    programId: 'prog-1',
    dayId: 'day-1',
    workoutName: 'Test Workout',
    date: NOW - daysAgo * DAY_MS,
    duration: 3600,
    totalVolume: options?.totalVolume ?? computedVol,
    PRs: options?.PRs ?? [],
    exercisesSnapshot: exercises.map((ex, idx) => ({
      id: `ex-${idx}`,
      name: ex.name,
      muscleGroup: ex.primaryMuscle ? [ex.primaryMuscle] : [],
      primaryMuscle: ex.primaryMuscle,
      sets: ex.sets,
      notes: '',
      history: [],
      lastUpdated: NOW - daysAgo * DAY_MS,
      restTimerConfig: 90,
    })),
  };
}

function makeWeight(value: number, unit: 'kg' | 'lbs' = 'kg', daysAgo = 0): Measurement {
  return {
    id: `m-${daysAgo}-${value}`,
    date: NOW - daysAgo * DAY_MS,
    type: 'weight',
    value,
    unit,
  };
}

describe('matchBigLiftKey', () => {
  it('matches standard Big 5 exercises including database names', () => {
    assert.equal(matchBigLiftKey('Barbell Back Squat'), 'squat');
    assert.equal(matchBigLiftKey('Barbell Flat Standard Bench Press'), 'bench');
    assert.equal(matchBigLiftKey('Barbell Deadlift'), 'deadlift');
    assert.equal(matchBigLiftKey('Standing Overhead Press'), 'ohp');
    assert.equal(matchBigLiftKey('Bent-Over Barbell Row'), 'row');
  });

  it('excludes accessory/unilateral/dumbbell variations that skew barbell ratios', () => {
    assert.equal(matchBigLiftKey('Bulgarian Split Squat'), null);
    assert.equal(matchBigLiftKey('Dumbbell Bench Press'), null);
    assert.equal(matchBigLiftKey('Barbell Incline Standard Bench Press'), null);
    assert.equal(matchBigLiftKey('Romanian Deadlift'), null);
    assert.equal(matchBigLiftKey('Barbell Upright Row'), null);
    assert.equal(matchBigLiftKey('Dumbbell Shoulder Press'), null);
  });
});

describe('computeStrengthStandards', () => {
  it('computes accurate bodyweight ratios, tiers, SBD total, and next-tier targets at 80 kg', () => {
    const sessions = [
      makeSession('s1', 1, [
        { name: 'Barbell Back Squat', sets: [makeSet(160, 1)] }, // 2.00x BW -> advanced
        { name: 'Barbell Flat Standard Bench Press', sets: [makeSet(100, 1)] }, // 1.25x BW -> intermediate
        { name: 'Barbell Deadlift', sets: [makeSet(200, 1)] }, // 2.50x BW -> advanced
        { name: 'Overhead Press', sets: [makeSet(60, 1)] }, // 0.75x BW -> intermediate
        { name: 'Barbell Row', sets: [makeSet(124, 1)] }, // 1.55x BW -> elite
      ]),
    ];

    const summary = computeStrengthStandards(sessions, [makeWeight(80, 'kg')], 'kg');

    assert.equal(summary.bodyweight?.value, 80);
    assert.equal(summary.trackedLiftsCount, 5);
    assert.equal(summary.sbdTotal, 460);

    const squat = summary.lifts.find((l) => l.key === 'squat')!;
    assert.equal(squat.bodyweightRatio, 2);
    assert.equal(squat.tier, 'advanced');
    assert.equal(squat.nextTier, 'elite');
    assert.equal(squat.nextTierTarget, 200);
    assert.equal(squat.deltaToNextTier, 40);

    const bench = summary.lifts.find((l) => l.key === 'bench')!;
    assert.equal(bench.tier, 'intermediate');
    assert.equal(bench.nextTier, 'advanced');
    assert.equal(bench.nextTierTarget, 120);
    assert.equal(bench.deltaToNextTier, 20);
    assert.equal(bench.progressToNextPct, 50);

    const row = summary.lifts.find((l) => l.key === 'row')!;
    assert.equal(row.tier, 'elite');
    assert.equal(row.nextTier, null);
    assert.equal(row.progressToNextPct, 100);
  });

  it('normalizes bodyweight measured in lbs when user unit is kg', () => {
    const lbsFor80Kg = convertWeight(80, 'kg', 'lbs'); // ~176.37 lbs
    const sessions = [
      makeSession('s1', 0, [{ name: 'Barbell Deadlift', sets: [makeSet(180, 1)] }]),
    ];

    const summary = computeStrengthStandards(sessions, [makeWeight(lbsFor80Kg, 'lbs')], 'kg');
    const dl = summary.lifts.find((l) => l.key === 'deadlift')!;

    assert.ok(summary.bodyweight && Math.abs(summary.bodyweight.value - 80) <= 0.2);
    assert.equal(dl.tier, 'advanced');
    assert.ok(dl.bodyweightRatio && Math.abs(dl.bodyweightRatio - 2.25) <= 0.02);
  });

  it('gracefully preserves e1RMs while leaving tier/ratio null if no bodyweight exists', () => {
    const sessions = [
      makeSession('s1', 0, [{ name: 'Barbell Flat Standard Bench Press', sets: [makeSet(90, 5)] }]),
    ];
    const summary = computeStrengthStandards(sessions, [], 'kg');

    assert.equal(summary.bodyweight, null);
    assert.equal(summary.overallTier, null);
    assert.equal(summary.trackedLiftsCount, 1);

    const bench = summary.lifts.find((l) => l.key === 'bench')!;
    assert.ok(bench.e1rm && bench.e1rm > 90);
    assert.equal(bench.bodyweightRatio, null);
    assert.equal(bench.tier, null);
    assert.equal(bench.progressToNextPct, 0);
  });
});

describe('computeSymmetryBalance', () => {
  it('identifies balanced Push/Pull & Upper/Lower while ignoring warmup sets and old sessions', () => {
    const sessions = [
      makeSession('recent', 2, [
        {
          name: 'Barbell Bench Press',
          primaryMuscle: 'Chest',
          sets: [makeSet(40, 10, 'warmup'), makeSet(80, 8), makeSet(80, 8), makeSet(80, 8)],
        },
        {
          name: 'Lat Pulldown',
          primaryMuscle: 'Back',
          sets: [makeSet(70, 10), makeSet(70, 10), makeSet(70, 10)],
        },
        {
          name: 'Barbell Back Squat',
          primaryMuscle: 'Legs',
          sets: [makeSet(110, 5), makeSet(110, 5), makeSet(110, 5)],
        },
      ]),
      makeSession('stale', 45, [
        {
          name: 'Overhead Press',
          primaryMuscle: 'Shoulders',
          sets: Array.from({ length: 10 }, () => makeSet(50, 8)),
        },
      ]),
    ];

    const result = computeSymmetryBalance(sessions, { windowDays: 30, now: NOW });
    assert.equal(result.totalWorkingSets, 9);
    assert.equal(result.pushPull.leftSets, 3);
    assert.equal(result.pushPull.rightSets, 3);
    assert.equal(result.pushPull.status, 'balanced');
    assert.equal(result.upperLower.leftSets, 6);
    assert.equal(result.upperLower.rightSets, 3);
    assert.equal(result.upperLower.status, 'balanced');
  });

  it('flags Push-Heavy / Upper-Heavy dominance and handles insufficient data', () => {
    const skewed = computeSymmetryBalance(
      [
        makeSession('skew', 1, [
          {
            name: 'Bench Press',
            primaryMuscle: 'Chest',
            sets: Array.from({ length: 7 }, () => makeSet(80, 8)),
          },
          {
            name: 'Cable Row',
            primaryMuscle: 'Back',
            sets: [makeSet(60, 10)],
          },
        ]),
      ],
      { windowDays: 30, now: NOW },
    );

    assert.equal(skewed.pushPull.status, 'left_dominant');
    assert.equal(skewed.pushPull.statusLabel, 'Push-Heavy');
    assert.equal(skewed.upperLower.status, 'left_dominant');
    assert.equal(skewed.upperLower.statusLabel, 'Upper-Heavy');

    const minimal = computeSymmetryBalance(
      [makeSession('tiny', 1, [{ name: 'Bench Press', primaryMuscle: 'Chest', sets: [makeSet(60, 8)] }])],
      { windowDays: 30, now: NOW },
    );
    assert.equal(minimal.pushPull.status, 'insufficient_data');
    assert.equal(minimal.upperLower.status, 'insufficient_data');
  });
});

describe('computeTrainingMilestones', () => {
  it('unlocks streak, volume, PR, and BW-strength milestones and picks closest nextUp', () => {
    const sessions: WorkoutSession[] = Array.from({ length: 10 }, (_, idx) =>
      makeSession(
        `s-${idx}`,
        idx, // 10-day unbroken streak
        [
          { name: 'Barbell Flat Standard Bench Press', sets: [makeSet(85, 1)] }, // 1.06x @ 80kg
          { name: 'Barbell Back Squat', sets: [makeSet(124, 1)] }, // 1.55x @ 80kg
          { name: 'Barbell Deadlift', sets: [makeSet(150, 1)] }, // 1.875x @ 80kg -> 94% of 2x!
        ],
        {
          totalVolume: 5500, // 10 * 5500 = 55,000 kg -> unlocks 10K + 50K
          PRs:
            idx < 5
              ? [
                  {
                    exerciseId: `ex-${idx}`,
                    exerciseName: `Exercise ${idx}`,
                    type: 'weight',
                    value: 100 + idx,
                    previousValue: 95,
                  },
                ]
              : [],
        },
      ),
    );

    const summary = computeTrainingMilestones(sessions, [makeWeight(80, 'kg')], 'kg');

    const byId = new Map(summary.milestones.map((m) => [m.id, m]));
    assert.equal(byId.get('first_blood')?.unlocked, true);
    assert.equal(byId.get('habit_builder')?.unlocked, true);
    assert.equal(byId.get('iron_regular')?.unlocked, false);
    assert.equal(byId.get('seven_day_flame')?.unlocked, true);
    assert.equal(byId.get('volume_tier_1')?.unlocked, true);
    assert.equal(byId.get('volume_tier_2')?.unlocked, true);
    assert.equal(byId.get('volume_tier_3')?.unlocked, false);
    assert.equal(byId.get('pr_collector')?.unlocked, true);
    assert.equal(byId.get('bw_bench')?.unlocked, true);
    assert.equal(byId.get('squat_1_5x')?.unlocked, true);
    assert.equal(byId.get('deadlift_2x')?.unlocked, false);

    assert.equal(summary.unlockedCount, 8);
    assert.equal(summary.totalCount, 12);
    assert.equal(summary.nextUp?.id, 'deadlift_2x');
  });

  it('scales volume milestone targets appropriately for lbs mode', () => {
    const sessions = [makeSession('lbs-1', 0, [], { totalVolume: 24_000 })];
    const summary = computeTrainingMilestones(sessions, [], 'lbs');
    const v1 = summary.milestones.find((m) => m.id === 'volume_tier_1')!;

    assert.equal(v1.title, '22K Mover');
    assert.equal(v1.unlocked, true);
    assert.equal(v1.targetValue, 22_000);
  });
});
