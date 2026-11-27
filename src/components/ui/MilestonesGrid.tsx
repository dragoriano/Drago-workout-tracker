import React, { useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Crown,
  Dumbbell,
  Flame,
  Lock,
  Scale,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';
import { Card } from './Card';
import { Button } from './Button';
import { Progress } from './Progress';
import type {
  MilestoneAccent,
  MilestoneCategory,
  MilestoneIconKey,
  TrainingMilestone,
  TrainingMilestonesSummary,
} from '../../utils/strengthStandards';
import { cn } from '../../utils/cn';

interface MilestonesGridProps {
  summary: TrainingMilestonesSummary;
  hasBodyweight: boolean;
  onLogBodyweight?: () => void;
}

type CategoryFilter = 'all' | MilestoneCategory;

const CATEGORY_OPTIONS: Array<{ id: CategoryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'strength', label: 'Strength' },
  { id: 'consistency', label: 'Consistency' },
  { id: 'volume', label: 'Volume' },
];

const ACCENT_STYLES: Record<
  MilestoneAccent,
  { border: string; bg: string; iconBox: string; text: string; bar: string }
> = {
  emerald: {
    border: 'border-emerald-500/35',
    bg: 'bg-emerald-500/10',
    iconBox: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
    text: 'text-emerald-700 dark:text-emerald-400',
    bar: 'bg-emerald-500',
  },
  amber: {
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/10',
    iconBox: 'bg-amber-500/20 text-amber-800 dark:text-amber-400',
    text: 'text-amber-800 dark:text-amber-400',
    bar: 'bg-amber-500',
  },
  sky: {
    border: 'border-sky-500/35',
    bg: 'bg-sky-500/10',
    iconBox: 'bg-sky-500/20 text-sky-700 dark:text-sky-400',
    text: 'text-sky-700 dark:text-sky-400',
    bar: 'bg-sky-500',
  },
  orange: {
    border: 'border-orange-500/35',
    bg: 'bg-orange-500/10',
    iconBox: 'bg-orange-500/20 text-orange-700 dark:text-orange-400',
    text: 'text-orange-700 dark:text-orange-400',
    bar: 'bg-orange-500',
  },
  rose: {
    border: 'border-rose-500/35',
    bg: 'bg-rose-500/10',
    iconBox: 'bg-rose-500/20 text-rose-700 dark:text-rose-400',
    text: 'text-rose-700 dark:text-rose-400',
    bar: 'bg-rose-500',
  },
};

function renderMilestoneIcon(iconKey: MilestoneIconKey, size = 18) {
  switch (iconKey) {
    case 'flame':
      return <Flame size={size} />;
    case 'dumbbell':
      return <Dumbbell size={size} />;
    case 'trophy':
      return <Trophy size={size} />;
    case 'target':
      return <Target size={size} />;
    case 'zap':
      return <Zap size={size} />;
    case 'crown':
      return <Crown size={size} />;
    default:
      return <Award size={size} />;
  }
}

const MilestoneBadgeCard: React.FC<{ milestone: TrainingMilestone }> = ({ milestone }) => {
  const accent = ACCENT_STYLES[milestone.accent];

  return (
    <div
      className={cn(
        'liquid-glass relative flex flex-col justify-between rounded-2xl p-3.5 transition-all',
        milestone.unlocked
          ? cn(accent.border, accent.bg, 'shadow-sm')
          : 'border border-content/10 opacity-90',
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
              milestone.unlocked ? accent.iconBox : 'bg-content/10 text-muted',
            )}
          >
            {renderMilestoneIcon(milestone.iconKey, 18)}
          </div>

          {milestone.unlocked ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border',
                accent.border,
                accent.text,
                'bg-page/40',
              )}
            >
              <CheckCircle2 size={10} /> Unlocked
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-content/15 bg-content/5 px-2 py-0.5 text-[10px] font-bold text-muted">
              <Lock size={10} /> {milestone.progressPct}%
            </span>
          )}
        </div>

        <h3 className="text-sm font-extrabold text-content leading-tight">
          {milestone.title}
        </h3>
        <p className="mt-1 text-[11px] text-muted leading-snug">
          {milestone.description}
        </p>
      </div>

      <div className="mt-3 pt-2.5 border-t border-content/10">
        {milestone.unlocked ? (
          <p className={cn('text-[11px] font-bold tabular-nums', accent.text)}>
            Reached · {milestone.currentLabel}
          </p>
        ) : (
          <>
            <Progress
              value={milestone.progressPct}
              className="h-1.5"
              indicatorClassName={cn('shadow-none', accent.bar)}
            />
            <div className="mt-1.5 flex items-center justify-between gap-1 text-[10px] font-semibold text-muted tabular-nums">
              <span className="truncate">{milestone.currentLabel}</span>
              <span className="shrink-0">{milestone.targetLabel}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function MilestonesGrid({
  summary,
  hasBodyweight,
  onLogBodyweight,
}: MilestonesGridProps) {
  const [filter, setFilter] = useState<CategoryFilter>('all');

  const filteredMilestones = useMemo(() => {
    if (filter === 'all') return summary.milestones;
    return summary.milestones.filter((m) => m.category === filter);
  }, [filter, summary.milestones]);

  return (
    <div className="space-y-4">
      {/* Trophy Case Summary Card */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-400">
              <Trophy size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Training Trophy Case
              </p>
              <h2 className="text-lg font-extrabold text-content tabular-nums">
                {summary.unlockedCount} / {summary.totalCount} Unlocked
              </h2>
            </div>
          </div>
          <span className="inline-flex items-center rounded-full border border-amber-500/35 bg-amber-500/15 px-2.5 py-1 text-xs font-black text-amber-700 dark:text-amber-300 tabular-nums shrink-0">
            {summary.completionPct}%
          </span>
        </div>

        <Progress
          value={summary.completionPct}
          className="h-2.5"
          indicatorClassName="bg-amber-500 shadow-none"
        />

        {summary.nextUp ? (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-content/10 bg-page/25 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-xs font-semibold text-content truncate">
                Next up: <span className="font-extrabold">{summary.nextUp.title}</span>
              </p>
            </div>
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 tabular-nums shrink-0">
              {summary.nextUp.progressPct}% · {summary.nextUp.currentLabel} / {summary.nextUp.targetLabel}
            </span>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
            <Crown size={14} className="shrink-0" />
            <span>Every training milestone unlocked — legendary consistency!</span>
          </div>
        )}
      </Card>

      {/* Missing bodyweight notice */}
      {!hasBodyweight && (
        <Card className="p-3.5 border-sky-500/25 bg-sky-500/10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Scale size={16} className="text-sky-700 dark:text-sky-400 shrink-0" />
              <p className="text-xs font-semibold text-content leading-snug">
                Log your bodyweight to evaluate relative strength milestones (Bench, Squat, Deadlift).
              </p>
            </div>
            {onLogBodyweight && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={onLogBodyweight}
                className="shrink-0 min-h-[36px]"
              >
                Log BW
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORY_OPTIONS.map((cat) => {
          const isActive = filter === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setFilter(cat.id)}
              className={cn(
                'whitespace-nowrap rounded-full px-3.5 py-2 min-h-[38px] text-xs font-bold border transition-all cursor-pointer',
                isActive
                  ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                  : 'bg-surface/70 text-muted border-content/10 hover:text-content',
              )}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Responsive Badge Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {filteredMilestones.map((m) => (
          <MilestoneBadgeCard key={m.id} milestone={m} />
        ))}
      </div>
    </div>
  );
}
