import React, { useState } from 'react';
import { Award, ChevronRight, Scale, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { Card } from './Card';
import { Button } from './Button';
import { Progress } from './Progress';
import {
  STRENGTH_TIER_LABELS,
  type LiftStandardResult,
  type StrengthStandardsSummary,
  type StrengthTier,
  type SymmetryBalanceResult,
  type SymmetryRatio,
  type WeightUnit,
} from '../../utils/strengthStandards';
import { cn } from '../../utils/cn';

interface StrengthStandardsCardProps {
  standards: StrengthStandardsSummary;
  symmetry: SymmetryBalanceResult;
  unit: WeightUnit;
  milestonesUnlocked: number;
  milestonesTotal: number;
  onLogBodyweight: (value: number) => Promise<void> | void;
  onViewMilestones: () => void;
}

const TIER_STYLES: Record<
  StrengthTier,
  { badge: string; bar: string; ring: string }
> = {
  untrained: {
    badge: 'bg-content/10 text-muted border-content/15',
    bar: 'bg-content/45',
    ring: 'border-content/20 text-content',
  },
  novice: {
    badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
    bar: 'bg-sky-500',
    ring: 'border-sky-500/35 text-sky-700 dark:text-sky-300',
  },
  intermediate: {
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    bar: 'bg-emerald-500',
    ring: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
  },
  advanced: {
    badge: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
    bar: 'bg-orange-500',
    ring: 'border-orange-500/40 text-orange-700 dark:text-orange-300',
  },
  elite: {
    badge: 'bg-amber-500/18 text-amber-700 dark:text-amber-300 border-amber-500/35',
    bar: 'bg-amber-500',
    ring: 'border-amber-500/45 text-amber-700 dark:text-amber-300',
  },
};

function getSymmetryBadgeStyle(status: SymmetryRatio['status']): string {
  switch (status) {
    case 'balanced':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
    case 'left_dominant':
    case 'right_dominant':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
    default:
      return 'bg-content/10 text-muted border-content/15';
  }
}

function SymmetryRow({ ratio }: { ratio: SymmetryRatio }) {
  const hasData = ratio.status !== 'insufficient_data';
  const leftWidth = hasData ? Math.max(8, Math.min(92, ratio.leftPct)) : 50;
  const rightWidth = hasData ? 100 - leftWidth : 50;

  return (
    <div className="rounded-2xl border border-content/10 bg-page/25 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-bold text-content">{ratio.label}</span>
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide',
            getSymmetryBadgeStyle(ratio.status),
          )}
        >
          {ratio.statusLabel}
        </span>
      </div>

      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-content/10 flex">
        {hasData ? (
          <>
            <div
              className="h-full bg-sky-500/85 transition-all duration-300"
              style={{ width: `${leftWidth}%` }}
            />
            <div
              className="h-full bg-emerald-500/85 transition-all duration-300"
              style={{ width: `${rightWidth}%` }}
            />
          </>
        ) : (
          <div className="h-full w-full bg-content/10" />
        )}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-content/40"
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold tabular-nums">
        <span className="text-sky-700 dark:text-sky-400">
          {ratio.leftLabel} {hasData ? `${ratio.leftPct}%` : '—'} ({ratio.leftSets} sets)
        </span>
        <span className="text-emerald-700 dark:text-emerald-400">
          {ratio.rightLabel} {hasData ? `${ratio.rightPct}%` : '—'} ({ratio.rightSets} sets)
        </span>
      </div>

      <p className="mt-1 text-[11px] text-muted leading-snug">{ratio.guidance}</p>
    </div>
  );
}

const LiftRow: React.FC<{ lift: LiftStandardResult; unit: WeightUnit; hasBodyweight: boolean }> = ({
  lift,
  unit,
  hasBodyweight,
}) => {
  const tierStyle = lift.tier ? TIER_STYLES[lift.tier] : null;
  const barWidth = lift.tier ? Math.max(6, lift.progressToNextPct) : 0;

  return (
    <div className="rounded-2xl border border-content/10 bg-page/20 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-content">{lift.label}</span>
            {lift.tier && tierStyle && (
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                  tierStyle.badge,
                )}
              >
                {STRENGTH_TIER_LABELS[lift.tier]}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-muted truncate">
            {lift.matchedExerciseName ? lift.matchedExerciseName : 'Not logged yet'}
          </p>
        </div>

        <div className="text-right shrink-0 tabular-nums">
          {lift.e1rm !== null ? (
            <>
              <p className="text-sm font-black text-content">
                {lift.e1rm} {unit}
              </p>
              <p className="text-[11px] font-semibold text-muted">
                {lift.bodyweightRatio !== null
                  ? `${lift.bodyweightRatio.toFixed(2)}× BW`
                  : hasBodyweight
                    ? '—'
                    : 'Log BW for tier'}
              </p>
            </>
          ) : (
            <p className="text-xs font-semibold text-muted">—</p>
          )}
        </div>
      </div>

      {lift.e1rm !== null && lift.tier && (
        <div className="mt-2.5">
          <Progress
            value={barWidth}
            className="h-1.5"
            indicatorClassName={cn('shadow-none', tierStyle?.bar)}
          />
          <div className="mt-1 flex items-center justify-between text-[10px] font-semibold text-muted tabular-nums">
            <span>
              {lift.bestSet ? `Best ${lift.bestSet.weight} ${unit} × ${lift.bestSet.reps}` : 'e1RM'}
            </span>
            <span>
              {lift.nextTier && lift.deltaToNextTier !== null && lift.nextTierTarget !== null
                ? lift.deltaToNextTier > 0
                  ? `+${lift.deltaToNextTier} ${unit} to ${STRENGTH_TIER_LABELS[lift.nextTier]} (${lift.nextTierTarget} ${unit})`
                  : `At ${STRENGTH_TIER_LABELS[lift.nextTier]} threshold`
                : 'Peak standard reached'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function StrengthStandardsCard({
  standards,
  symmetry,
  unit,
  milestonesUnlocked,
  milestonesTotal,
  onLogBodyweight,
  onViewMilestones,
}: StrengthStandardsCardProps) {
  const [editingBw, setEditingBw] = useState(false);
  const [bwInput, setBwInput] = useState(
    standards.bodyweight ? String(standards.bodyweight.value) : '',
  );
  const [isSavingBw, setIsSavingBw] = useState(false);

  const overallTierStyle = standards.overallTier ? TIER_STYLES[standards.overallTier] : null;
  const parsedBw = Number(bwInput);
  const canSaveBw = Number.isFinite(parsedBw) && parsedBw >= 20 && parsedBw <= 350;

  const handleOpenEdit = () => {
    setBwInput(standards.bodyweight ? String(standards.bodyweight.value) : '');
    setEditingBw(true);
  };

  const handleSaveBw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSaveBw || isSavingBw) return;
    setIsSavingBw(true);
    try {
      await onLogBodyweight(Math.round(parsedBw * 10) / 10);
      setEditingBw(false);
    } finally {
      setIsSavingBw(false);
    }
  };

  return (
    <Card className="p-4 sm:p-5 mb-8">
      {/* Header Summary */}
      <div className="flex items-start justify-between gap-2.5 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-400">
            <ShieldCheck size={18} />
          </span>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-content leading-tight">
              Strength Standards
            </h2>
            <p className="text-[11px] font-semibold text-muted leading-snug">
              Big 5 BW-relative benchmarks
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end shrink-0">
          {standards.overallTier && overallTierStyle ? (
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                  overallTierStyle.badge,
                )}
              >
                {STRENGTH_TIER_LABELS[standards.overallTier]}
              </span>
              <span className="font-mono text-xs font-black text-content tabular-nums">
                {standards.overallScore}/100
              </span>
            </div>
          ) : (
            <span className="inline-flex items-center rounded-full border border-content/15 bg-content/10 px-2.5 py-0.5 text-[11px] font-bold text-muted">
              {standards.trackedLiftsCount}/5 Lifts
            </span>
          )}
          {standards.sbdTotal !== null && (
            <span className="mt-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
              SBD Total: {standards.sbdTotal} {unit}
            </span>
          )}
        </div>
      </div>

      {/* Bodyweight Status & Inline Quick Log */}
      <div className="rounded-2xl border border-content/10 bg-surface/60 p-3 mb-4">
        {!editingBw ? (
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-700 dark:text-sky-400">
                <Scale size={15} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-content tabular-nums">
                  {standards.bodyweight
                    ? `Bodyweight: ${standards.bodyweight.value} ${standards.bodyweight.unit}`
                    : 'Bodyweight not logged yet'}
                </p>
                <p className="text-[11px] text-muted truncate">
                  {standards.bodyweight
                    ? `${standards.trackedLiftsCount}/5 Big 5 tracked · BW ratios active`
                    : 'Log bodyweight to unlock strength tiers'}
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant={standards.bodyweight ? 'secondary' : 'primary'}
              onClick={handleOpenEdit}
              className="shrink-0 min-h-[38px]"
            >
              {standards.bodyweight ? 'Update' : 'Log Weight'}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSaveBw} className="flex items-center gap-2 flex-wrap">
            <label htmlFor="quick-bw-input" className="sr-only">
              Bodyweight in {unit}
            </label>
            <div className="relative flex-1 min-w-[140px]">
              <input
                id="quick-bw-input"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="20"
                max="350"
                value={bwInput}
                onChange={(e) => setBwInput(e.target.value)}
                placeholder={`Enter weight (${unit})`}
                autoFocus
                className="w-full rounded-xl border border-content/15 bg-page/60 px-3 py-2 pr-10 text-sm font-bold text-content outline-none focus:border-primary-500 tabular-nums"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">
                {unit}
              </span>
            </div>
            <Button type="submit" size="sm" disabled={!canSaveBw || isSavingBw} className="min-h-[38px]">
              {isSavingBw ? 'Saving...' : 'Save'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setEditingBw(false)}
              className="min-h-[38px]"
            >
              Cancel
            </Button>
          </form>
        )}
      </div>

      {/* Big 5 Lift Rows */}
      <div className="space-y-2.5 mb-5">
        {standards.lifts.map((lift) => (
          <LiftRow
            key={lift.key}
            lift={lift}
            unit={unit}
            hasBodyweight={Boolean(standards.bodyweight)}
          />
        ))}
      </div>

      {/* 30-Day Symmetry & Training Balance */}
      <div className="border-t border-content/10 pt-4 mb-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={15} className="text-sky-700 dark:text-sky-400" />
            <h3 className="text-sm font-extrabold text-content">
              {symmetry.windowDays}-Day Training Balance
            </h3>
          </div>
          <span className="text-[11px] font-semibold text-muted tabular-nums">
            {symmetry.totalWorkingSets} working sets
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          <SymmetryRow ratio={symmetry.pushPull} />
          <SymmetryRow ratio={symmetry.upperLower} />
        </div>
      </div>

      {/* Footer CTA to Milestones */}
      <button
        type="button"
        onClick={onViewMilestones}
        className="w-full flex items-center justify-between gap-3 rounded-2xl border border-primary-500/25 bg-primary-500/10 hover:bg-primary-500/15 px-3.5 py-3 text-left transition-colors cursor-pointer min-h-[44px]"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400">
            <Award size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-content truncate flex items-center gap-1.5">
              Training Milestones
              <Sparkles size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
            </p>
            <p className="text-[11px] font-semibold text-muted tabular-nums">
              {milestonesUnlocked} / {milestonesTotal} badges unlocked
            </p>
          </div>
        </div>
        <ChevronRight size={16} className="text-muted shrink-0" />
      </button>
    </Card>
  );
}
