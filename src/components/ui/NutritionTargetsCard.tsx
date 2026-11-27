import React from 'react';
import { Flame, Scale, Utensils } from 'lucide-react';
import { Card } from './Card';
import type { DailyNutritionTargets } from '../../utils/bodyComposition';

interface NutritionTargetsCardProps {
  targets: DailyNutritionTargets | null;
  bodyweightLabel: string | null;
  onLogWeight?: () => void;
}

export const NutritionTargetsCard: React.FC<NutritionTargetsCardProps> = ({
  targets,
  bodyweightLabel,
  onLogWeight,
}) => {
  if (!targets) {
    return (
      <Card
        interactive={Boolean(onLogWeight)}
        onClick={onLogWeight}
        className="flex items-center justify-between gap-3 p-4"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-400">
            <Utensils size={17} />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-content">Daily Fuel Targets</h3>
            <p className="text-xs text-muted truncate">
              Log your bodyweight to calculate daily protein &amp; calories
            </p>
          </div>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 rounded-xl border border-content/15 bg-page/30 px-2.5 py-1.5 text-[11px] font-bold text-content">
          <Scale size={12} /> Log
        </span>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-400">
            <Utensils size={17} />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-content">Daily Fuel Targets</h3>
            <p className="text-[11px] text-muted truncate tabular-nums">
              {targets.focusLabel} · {bodyweightLabel}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/15 px-2.5 py-0.5 font-mono text-xs font-black text-orange-700 dark:text-orange-300 tabular-nums shrink-0">
          <Flame size={11} />
          {targets.calories.toLocaleString('en-US')} kcal
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Protein
          </p>
          <p className="mt-0.5 font-mono text-sm font-black text-content tabular-nums">
            {targets.proteinGrams}g
          </p>
          <p className="text-[9px] font-semibold text-muted tabular-nums">
            {targets.proteinPerKg.toFixed(1)} g/kg
          </p>
        </div>

        <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-2.5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">
            Carbs
          </p>
          <p className="mt-0.5 font-mono text-sm font-black text-content tabular-nums">
            {targets.carbsGrams}g
          </p>
          <p className="text-[9px] font-semibold text-muted">Training fuel</p>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
            Fats
          </p>
          <p className="mt-0.5 font-mono text-sm font-black text-content tabular-nums">
            {targets.fatGrams}g
          </p>
          <p className="text-[9px] font-semibold text-muted">25% intake</p>
        </div>
      </div>
    </Card>
  );
};
