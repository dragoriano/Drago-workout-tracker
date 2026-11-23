import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Set } from '../types/index.ts';
import { DEFAULT_BARBELL_WEIGHT, DEFAULT_PLATES } from './strength.ts';
import {
  applyWarmupSets,
  generateWarmupSets,
  getSmallestWeightIncrement,
  REST_TIMER_PRESETS,
  roundToIncrement,
  stepSetReps,
  stepSetWeight,
} from './warmupGenerator.ts';

describe('REST_TIMER_PRESETS', () => {
  it('exposes the standard gym rest presets in seconds', () => {
    assert.deepEqual([...REST_TIMER_PRESETS], [45, 60, 90, 120, 150, 180]);
  });
});

describe('getSmallestWeightIncrement', () => {
  it('computes 2x smallest positive plate for kg and lbs', () => {
    assert.equal(getSmallestWeightIncrement(DEFAULT_PLATES.kg, 'kg'), 2.5);
    assert.equal(getSmallestWeightIncrement(DEFAULT_PLATES.lbs, 'lbs'), 5);
    assert.equal(getSmallestWeightIncrement([20, 10, 5], 'kg'), 10);
    assert.equal(getSmallestWeightIncrement([10, 0.5, -2], 'kg'), 1);
  });

  it('falls back to 2.5 kg or 5 lbs when no positive plates are available', () => {
    assert.equal(getSmallestWeightIncrement([], 'kg'), 2.5);
    assert.equal(getSmallestWeightIncrement([], 'lbs'), 5);
    assert.equal(getSmallestWeightIncrement([0, -5, Number.NaN], 'kg'), 2.5);
    assert.equal(getSmallestWeightIncrement([0, Number.NEGATIVE_INFINITY], 'lbs'), 5);
  });
});

describe('roundToIncrement', () => {
  it('rounds cleanly to nearest increment and clamps to minWeight without float noise', () => {
    assert.equal(roundToIncrement(48, 2.5), 47.5);
    assert.equal(roundToIncrement(48.75, 2.5), 50);
    assert.equal(roundToIncrement(12, 2.5, 20), 20);
    assert.equal(roundToIncrement(0.3, 0.1), 0.3);
    assert.equal(roundToIncrement(-15, 5, 0), 0);
    assert.equal(roundToIncrement(Number.NaN, 2.5, 20), 20);
  });
});

describe('generateWarmupSets', () => {
  it('returns empty array for zero, negative, or non-finite working weights', () => {
    const kgOpts = {
      barbellWeight: DEFAULT_BARBELL_WEIGHT.kg,
      availablePlates: DEFAULT_PLATES.kg,
      unit: 'kg' as const,
    };
    assert.deepEqual(generateWarmupSets(0, kgOpts), []);
    assert.deepEqual(generateWarmupSets(-50, kgOpts), []);
    assert.deepEqual(generateWarmupSets(Number.NaN, kgOpts), []);
    assert.deepEqual(generateWarmupSets(Number.POSITIVE_INFINITY, kgOpts), []);
  });

  it('generates standard kg and lbs ramped warmup tiers rounded to gym plates', () => {
    const kgWarmups = generateWarmupSets(100, {
      barbellWeight: 20,
      availablePlates: DEFAULT_PLATES.kg,
      unit: 'kg',
    });
    assert.equal(kgWarmups.length, 3);
    assert.deepEqual(
      kgWarmups.map((s) => ({
        weight: s.weight,
        reps: s.reps,
        completed: s.completed,
        setType: s.setType,
      })),
      [
        { weight: 40, reps: 8, completed: false, setType: 'warmup' },
        { weight: 60, reps: 5, completed: false, setType: 'warmup' },
        { weight: 80, reps: 2, completed: false, setType: 'warmup' },
      ],
    );
    assert.equal(new Set(kgWarmups.map((s) => s.id)).size, 3);

    const lbsWarmups = generateWarmupSets(225, {
      barbellWeight: 45,
      availablePlates: DEFAULT_PLATES.lbs,
      unit: 'lbs',
    });
    assert.deepEqual(
      lbsWarmups.map((s) => ({ weight: s.weight, reps: s.reps })),
      [
        { weight: 90, reps: 8 },
        { weight: 135, reps: 5 },
        { weight: 180, reps: 2 },
      ],
    );
  });

  it('rounds tiers to custom plate inventory increments (e.g. 5 kg increment without 1.25 kg plates)', () => {
    const warmups = generateWarmupSets(95, {
      barbellWeight: 20,
      availablePlates: [20, 10, 5, 2.5],
      unit: 'kg',
    });
    // increment = 5; 95*0.4=38->40, 95*0.6=57->55, 95*0.8=76->75
    assert.deepEqual(
      warmups.map((s) => ({ weight: s.weight, reps: s.reps })),
      [
        { weight: 40, reps: 8 },
        { weight: 55, reps: 5 },
        { weight: 75, reps: 2 },
      ],
    );
  });

  it('floors tiers to barbellWeight and deduplicates identical rounded weights', () => {
    const warmups30 = generateWarmupSets(30, {
      barbellWeight: 20,
      availablePlates: DEFAULT_PLATES.kg,
      unit: 'kg',
    });
    // 30*0.4=12->20, 30*0.6=18->20 (deduped), 30*0.8=24->25
    assert.deepEqual(
      warmups30.map((s) => ({ weight: s.weight, reps: s.reps })),
      [
        { weight: 20, reps: 8 },
        { weight: 25, reps: 2 },
      ],
    );

    const warmups25 = generateWarmupSets(25, {
      barbellWeight: 20,
      availablePlates: DEFAULT_PLATES.kg,
      unit: 'kg',
    });
    // All tiers floor to 20 kg -> deduplicated to a single 20x8 warmup
    assert.deepEqual(
      warmups25.map((s) => ({ weight: s.weight, reps: s.reps })),
      [{ weight: 20, reps: 8 }],
    );
  });

  it('handles weights just above bar (<= 1.15x bar) and bar-only/light weights cleanly', () => {
    const justAboveBar = generateWarmupSets(22.5, {
      barbellWeight: 20,
      availablePlates: DEFAULT_PLATES.kg,
      unit: 'kg',
    });
    assert.deepEqual(
      justAboveBar.map((s) => ({ weight: s.weight, reps: s.reps })),
      [
        { weight: 10, reps: 8 },
        { weight: 12.5, reps: 5 },
        { weight: 17.5, reps: 2 },
      ],
    );

    const barOnlyKg = generateWarmupSets(20, {
      barbellWeight: 20,
      availablePlates: DEFAULT_PLATES.kg,
      unit: 'kg',
    });
    assert.deepEqual(
      barOnlyKg.map((s) => ({ weight: s.weight, reps: s.reps, setType: s.setType })),
      [{ weight: 10, reps: 8, setType: 'warmup' }],
    );

    const barOnlyLbs = generateWarmupSets(45, {
      barbellWeight: 45,
      availablePlates: DEFAULT_PLATES.lbs,
      unit: 'lbs',
    });
    assert.deepEqual(
      barOnlyLbs.map((s) => ({ weight: s.weight, reps: s.reps })),
      [{ weight: 25, reps: 8 }],
    );

    // Too light to yield a positive warmup strictly below workingWeight
    assert.deepEqual(
      generateWarmupSets(2.5, {
        barbellWeight: 20,
        availablePlates: DEFAULT_PLATES.kg,
        unit: 'kg',
      }),
      [],
    );
    assert.deepEqual(
      generateWarmupSets(1, {
        barbellWeight: 20,
        availablePlates: DEFAULT_PLATES.kg,
        unit: 'kg',
      }),
      [],
    );
  });
});

describe('applyWarmupSets', () => {
  it('prepends warmups before working sets and replaces uncompleted top warmups while keeping completed ones', () => {
    const working: Set[] = [
      { id: 's1', weight: 100, reps: 8, completed: false, setType: 'working' },
      { id: 's2', weight: 100, reps: 8, completed: false, setType: 'working' },
    ];
    const warmups1: Set[] = [
      { id: 'w1', weight: 40, reps: 8, completed: false, setType: 'warmup' },
      { id: 'w2', weight: 60, reps: 5, completed: false, setType: 'warmup' },
    ];

    const prepended = applyWarmupSets(working, warmups1);
    assert.deepEqual(prepended.map((s) => s.id), ['w1', 'w2', 's1', 's2']);

    const withDoneWarmup: Set[] = [
      { id: 'w-done', weight: 40, reps: 8, completed: true, setType: 'warmup' },
      { id: 'w-todo', weight: 60, reps: 5, completed: false, setType: 'warmup' },
      ...working,
    ];
    const warmups2: Set[] = [
      { id: 'w3', weight: 80, reps: 2, completed: false, setType: 'warmup' },
    ];
    const replaced = applyWarmupSets(withDoneWarmup, warmups2);
    assert.deepEqual(replaced.map((s) => s.id), ['w-done', 'w3', 's1', 's2']);
  });
});

describe('stepSetWeight & stepSetReps', () => {
  it('steps weight cleanly with float rounding and clamps >= 0', () => {
    assert.equal(stepSetWeight(60, 2.5), 62.5);
    assert.equal(stepSetWeight(60, -2.5), 57.5);
    assert.equal(stepSetWeight(2.5, -5), 0);
    assert.equal(stepSetWeight(0.1, 0.2), 0.3);
    assert.equal(stepSetWeight(Number.NaN, 5), 5);
  });

  it('steps reps as integers and clamps >= 0', () => {
    assert.equal(stepSetReps(8, 1), 9);
    assert.equal(stepSetReps(8, -1), 7);
    assert.equal(stepSetReps(0, -1), 0);
    assert.equal(stepSetReps(7.6, 1), 9);
    assert.equal(stepSetReps(Number.NaN, -1), 0);
  });
});
