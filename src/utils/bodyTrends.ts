import { format } from 'date-fns';
import type { Measurement } from '../types';

export interface MeasurementTrendPoint {
  date: number;
  label: string;
  value: number;
  movingAvg7d: number;
}

export interface MeasurementTrendSummary {
  latest: { value: number; date: number; unit: string } | null;
  previous: { value: number; date: number } | null;
  deltaFromPrevious: number | null;
  delta30d: number | null;
  movingAvg7d: number | null;
  weeklyRate: number | null;
  series: MeasurementTrendPoint[];
}

export function computeMeasurementTrend(
  measurements: Measurement[],
  type: string,
  now = Date.now(),
): MeasurementTrendSummary {
  const valid = measurements
    .filter(
      (m) =>
        m.type === type &&
        Number.isFinite(m.value) &&
        m.date &&
        !isNaN(new Date(m.date).getTime()) &&
        m.date <= now + 60_000,
    )
    .sort((a, b) => a.date - b.date);

  if (valid.length === 0) {
    return {
      latest: null,
      previous: null,
      deltaFromPrevious: null,
      delta30d: null,
      movingAvg7d: null,
      weeklyRate: null,
      series: [],
    };
  }

  const series: MeasurementTrendPoint[] = valid.map((point) => {
    const winStart = point.date - 7 * 86_400_000;
    let sum = 0;
    let count = 0;
    for (const entry of valid) {
      if (entry.date >= winStart && entry.date <= point.date) {
        sum += entry.value;
        count++;
      }
    }
    const movingAvg7d = Math.round((sum / count) * 10) / 10;
    return {
      date: point.date,
      label: format(point.date, 'MMM d'),
      value: point.value,
      movingAvg7d,
    };
  });

  const latestItem = valid[valid.length - 1];
  const previousItem = valid.length >= 2 ? valid[valid.length - 2] : null;
  const deltaFromPrevious = previousItem
    ? Math.round((latestItem.value - previousItem.value) * 10) / 10
    : null;

  const cutoff30d = latestItem.date - 30 * 86_400_000;
  const entries30d = valid.filter((m) => m.date >= cutoff30d);
  const delta30d =
    entries30d.length >= 2
      ? Math.round((latestItem.value - entries30d[0].value) * 10) / 10
      : null;

  const cutoff28d = latestItem.date - 28 * 86_400_000;
  const entries28d = valid.filter((m) => m.date >= cutoff28d);
  let weeklyRate: number | null = null;
  if (entries28d.length >= 2) {
    const first28 = entries28d[0];
    const last28 = entries28d[entries28d.length - 1];
    const elapsedDays = (last28.date - first28.date) / 86_400_000;
    if (elapsedDays >= 2) {
      weeklyRate = Math.round(((last28.value - first28.value) / elapsedDays) * 7 * 100) / 100;
    }
  }

  return {
    latest: { value: latestItem.value, date: latestItem.date, unit: latestItem.unit },
    previous: previousItem ? { value: previousItem.value, date: previousItem.date } : null,
    deltaFromPrevious,
    delta30d,
    movingAvg7d: series[series.length - 1].movingAvg7d,
    weeklyRate,
    series,
  };
}
