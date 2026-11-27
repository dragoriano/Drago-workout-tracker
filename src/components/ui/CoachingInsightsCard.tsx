import React from 'react';
import { format } from 'date-fns';
import { AlertCircle, CalendarClock, Flame, TrendingUp } from 'lucide-react';
import { Card } from './Card';
import type { PlateauAlert, StrengthGoalForecast } from '../../utils/coachingInsights';

interface CoachingInsightsCardProps {
  plateaus: PlateauAlert[];
  forecasts: StrengthGoalForecast[];
  unit: 'kg' | 'lbs';
}

export const CoachingInsightsCard: React.FC<CoachingInsightsCardProps> = ({
  plateaus,
  forecasts,
  unit,
}) => {
  if (plateaus.length === 0 && forecasts.length === 0) {
    return null;
  }

  return (
    <Card className="p-4 sm:p-5 mb-8">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
          <TrendingUp size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-content">
            Coaching Insights &amp; ETAs
          </h2>
          <p className="text-[11px] font-semibold text-muted">
            Plateau alerts &amp; projected strength arrival dates
          </p>
        </div>
      </div>

      {/* Plateau Watch */}
      {plateaus.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
            <AlertCircle size={13} /> Plateau Watch ({plateaus.length})
          </p>
          {plateaus.map((alert) => (
            <div
              key={alert.exerciseName}
              className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-extrabold text-content truncate">
                  {alert.exerciseName}
                </span>
                <span className="shrink-0 rounded-full border border-amber-500/35 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 tabular-nums">
                  {alert.sessionsStalled} sessions flat · {alert.latestE1rm} {unit}
                </span>
              </div>
              <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
                Fix: {alert.prescriptionTitle}
              </p>
              <p className="mt-0.5 text-[11px] text-muted leading-snug">
                {alert.prescriptionDetail}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Strength ETA Forecasts */}
      {forecasts.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">
            <CalendarClock size={13} /> Strength Goal ETAs
          </p>
          {forecasts.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-content/10 bg-page/25 p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-extrabold text-content truncate">
                    {item.label}
                  </span>
                  <span className="rounded-md border border-emerald-500/30 bg-emerald-500/12 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    +{item.weeklyGainRate} {item.unit}/wk
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted truncate tabular-nums">
                  {item.currentValue} → {item.targetValue} {item.unit} ({item.exerciseName})
                </p>
              </div>
              <div className="text-right shrink-0 tabular-nums">
                <p className="flex items-center justify-end gap-1 text-xs font-black text-sky-700 dark:text-sky-400">
                  <Flame size={12} /> ~{item.weeksToTarget}w
                </p>
                <p className="text-[10px] font-semibold text-muted">
                  {format(item.estimatedDate, 'MMM d, yyyy')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
