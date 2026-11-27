import type { MesocycleFocus } from '../types';
import { convertWeight, normalizeWeightUnit, type WeightUnit } from './strengthStandards';
import { computeMeasurementTrend } from './bodyTrends';
import type { Measurement } from '../types';

export interface BodyCompositionEstimate {
  bodyFatPct: number;
  leanMassKg: number;
  fatMassKg: number;
  ffmi: number;
  category: 'Essential' | 'Athletic' | 'Fitness' | 'Average' | 'Elevated';
}

export interface DailyNutritionTargets {
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  proteinPerKg: number;
  focusLabel: string;
}

function toCm(value: number, unit?: string): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return unit && /in/i.test(unit) ? value * 2.54 : value;
}

/**
 * Estimates body fat %, lean mass, fat mass, and normalized FFMI using the U.S. Navy tape method.
 * Waist, neck, and (for females) hip measurements are normalized from cm or inches cleanly.
 */
export function estimateBodyFatNavy(input: {
  sex: 'male' | 'female';
  heightCm: number;
  waist: number;
  waistUnit?: string;
  neck: number;
  neckUnit?: string;
  hip?: number;
  hipUnit?: string;
  bodyweightKg: number;
}): BodyCompositionEstimate | null {
  const heightCm = Number(input.heightCm);
  const waistCm = toCm(input.waist, input.waistUnit);
  const neckCm = toCm(input.neck, input.neckUnit);
  const hipCm = input.hip ? toCm(input.hip, input.hipUnit) : 0;
  const bodyweightKg = Number(input.bodyweightKg);

  if (!Number.isFinite(heightCm) || heightCm < 120 || heightCm > 240) return null;
  if (!Number.isFinite(bodyweightKg) || bodyweightKg < 30 || bodyweightKg > 300) return null;
  if (waistCm <= 0 || neckCm <= 0) return null;

  let rawBf: number;
  if (input.sex === 'female') {
    if (hipCm <= 0) return null;
    const sumMinusNeck = waistCm + hipCm - neckCm;
    if (sumMinusNeck <= 5) return null;
    const density =
      1.29579 -
      0.35004 * Math.log10(sumMinusNeck) +
      0.221 * Math.log10(heightCm);
    rawBf = 495 / density - 450;
  } else {
    const diff = waistCm - neckCm;
    if (diff <= 5) return null;
    const density =
      1.0324 -
      0.19077 * Math.log10(diff) +
      0.15456 * Math.log10(heightCm);
    rawBf = 495 / density - 450;
  }

  if (!Number.isFinite(rawBf)) return null;
  const bodyFatPct = Math.round(Math.max(3, Math.min(55, rawBf)) * 10) / 10;
  const fatMassKg = Math.round(bodyweightKg * (bodyFatPct / 100) * 10) / 10;
  const leanMassKg = Math.round(Math.max(0, bodyweightKg - fatMassKg) * 10) / 10;

  const heightM = heightCm / 100;
  const rawFfmi = leanMassKg / (heightM * heightM);
  const normalizedFfmi = rawFfmi + 6.1 * (1.8 - heightM);
  const ffmi = Math.round(normalizedFfmi * 10) / 10;

  let category: BodyCompositionEstimate['category'] = 'Average';
  if (input.sex === 'female') {
    if (bodyFatPct < 14) category = 'Essential';
    else if (bodyFatPct < 21) category = 'Athletic';
    else if (bodyFatPct < 25) category = 'Fitness';
    else if (bodyFatPct < 32) category = 'Average';
    else category = 'Elevated';
  } else {
    if (bodyFatPct < 6) category = 'Essential';
    else if (bodyFatPct < 14) category = 'Athletic';
    else if (bodyFatPct < 18) category = 'Fitness';
    else if (bodyFatPct < 25) category = 'Average';
    else category = 'Elevated';
  }

  return {
    bodyFatPct,
    leanMassKg,
    fatMassKg,
    ffmi,
    category,
  };
}

export function extractLatestBodyweightKg(
  measurements: Measurement[],
): { kg: number; rawValue: number; rawUnit: WeightUnit } | null {
  const trend = computeMeasurementTrend(measurements, 'weight');
  if (!trend.latest || !Number.isFinite(trend.latest.value) || trend.latest.value <= 0) {
    return null;
  }
  const unit = normalizeWeightUnit(trend.latest.unit);
  return {
    kg: Math.round(convertWeight(trend.latest.value, unit, 'kg') * 10) / 10,
    rawValue: trend.latest.value,
    rawUnit: unit,
  };
}

/**
 * Computes athlete-specific daily calories and macro targets from bodyweight,
 * training frequency, and active Mesocycle focus.
 */
export function computeDailyNutritionTargets(input: {
  bodyweightKg: number;
  goalFocus?: MesocycleFocus | null;
  weeklySessionsCount?: number;
}): DailyNutritionTargets | null {
  const bw = Number(input.bodyweightKg);
  if (!Number.isFinite(bw) || bw <= 0) return null;

  const sessions = Math.max(0, Math.min(10, input.weeklySessionsCount ?? 3));
  // Baseline maintenance ~ 29–34 kcal/kg depending on training frequency
  const activityKcalPerKg = 29 + Math.min(5, sessions * 0.9);
  const maintenance = bw * activityKcalPerKg;

  const focus = input.goalFocus ?? 'hypertrophy';
  let calorieMultiplier = 1.07;
  let proteinPerKg = 2.0;
  let focusLabel = 'Lean Growth (+7%)';

  if (focus === 'strength') {
    calorieMultiplier = 1.05;
    proteinPerKg = 1.9;
    focusLabel = 'Strength Fuel (+5%)';
  } else if (focus === 'recomp') {
    calorieMultiplier = 0.92;
    proteinPerKg = 2.2;
    focusLabel = 'Recomp Cut (-8%)';
  }

  const calories = Math.round((maintenance * calorieMultiplier) / 25) * 25;
  const proteinGrams = Math.round(bw * proteinPerKg);
  const fatGrams = Math.round(Math.max(40, (calories * 0.25) / 9));
  const remainingCals = Math.max(0, calories - proteinGrams * 4 - fatGrams * 9);
  const carbsGrams = Math.round(remainingCals / 4);

  return {
    calories,
    proteinGrams,
    carbsGrams,
    fatGrams,
    proteinPerKg,
    focusLabel,
  };
}

export async function compressImageToDataUrl(
  file: Blob,
  maxWidth = 900,
  quality = 0.78,
): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Image compression requires a browser environment');
  }

  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode selected image'));
      el.src = bitmapUrl;
    });

    const scale = img.width > maxWidth ? maxWidth / img.width : 1;
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(img, 0, 0, width, height);

    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}
