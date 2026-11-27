import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDailyNutritionTargets,
  estimateBodyFatNavy,
  extractLatestBodyweightKg,
} from './bodyComposition.ts';
import type { Measurement } from '../types/index.ts';

describe('estimateBodyFatNavy', () => {
  it('calculates male Navy BF%, lean mass, and normalized FFMI accurately', () => {
    const est = estimateBodyFatNavy({
      sex: 'male',
      heightCm: 178,
      waist: 81,
      waistUnit: 'cm',
      neck: 39,
      neckUnit: 'cm',
      bodyweightKg: 78,
    });

    assert.ok(est);
    assert.ok(est.bodyFatPct >= 10 && est.bodyFatPct <= 17);
    assert.ok(est.leanMassKg > 64 && est.leanMassKg < 72);
    assert.ok(est.ffmi > 19 && est.ffmi < 24);
  });

  it('supports inch inputs for female circumference measurements', () => {
    const est = estimateBodyFatNavy({
      sex: 'female',
      heightCm: 165,
      waist: 28,
      waistUnit: 'in',
      neck: 13,
      neckUnit: 'in',
      hip: 38,
      hipUnit: 'in',
      bodyweightKg: 60,
    });

    assert.ok(est);
    assert.ok(est.bodyFatPct >= 16 && est.bodyFatPct <= 28);
    assert.equal(Math.round((est.leanMassKg + est.fatMassKg) * 10) / 10, 60);
  });

  it('returns null on invalid or missing circumferences', () => {
    assert.equal(
      estimateBodyFatNavy({
        sex: 'female',
        heightCm: 165,
        waist: 70,
        neck: 33,
        bodyweightKg: 60,
      }),
      null,
    );
    assert.equal(
      estimateBodyFatNavy({
        sex: 'male',
        heightCm: 175,
        waist: 35,
        neck: 40,
        bodyweightKg: 75,
      }),
      null,
    );
  });
});

describe('computeDailyNutritionTargets & extractLatestBodyweightKg', () => {
  it('computes macro targets tailored to bodyweight and mesocycle focus', () => {
    const growth = computeDailyNutritionTargets({
      bodyweightKg: 80,
      goalFocus: 'hypertrophy',
      weeklySessionsCount: 4,
    })!;
    const cut = computeDailyNutritionTargets({
      bodyweightKg: 80,
      goalFocus: 'recomp',
      weeklySessionsCount: 4,
    })!;

    assert.equal(growth.proteinGrams, 160);
    assert.equal(cut.proteinGrams, 176);
    assert.ok(growth.calories > cut.calories);
    assert.ok(growth.carbsGrams > cut.carbsGrams);
  });

  it('normalizes lbs body weight logs into kg accurately', () => {
    const measurements: Measurement[] = [
      { id: 'm1', type: 'weight', value: 176.4, unit: 'lbs', date: Date.now() },
    ];
    const bw = extractLatestBodyweightKg(measurements);
    assert.ok(bw);
    assert.ok(Math.abs(bw.kg - 80) <= 0.2);
  });
});
