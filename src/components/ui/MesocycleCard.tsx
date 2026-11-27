import React, { useState } from 'react';
import {
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  Flame,
  Layers,
  RotateCcw,
  Sparkles,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { Card } from './Card';
import { Button } from './Button';
import { Progress } from './Progress';
import type { MesocycleConfig, MesocycleFocus, MesocyclePhase } from '../../types';
import {
  createDefaultMesocycle,
  MESOCYCLE_FOCUS_LABELS,
  type MesocycleProgressSummary,
  type MesocycleWeekProgress,
} from '../../utils/mesocycle';
import { cn } from '../../utils/cn';

interface MesocycleCardProps {
  variant: 'compact' | 'full';
  programName: string;
  progress: MesocycleProgressSummary | null;
  weightUnit?: 'kg' | 'lbs';
  onOpenProgram?: () => void;
  onSaveMesocycle?: (config: MesocycleConfig | undefined) => Promise<void> | void;
}

const PHASE_STYLES: Record<
  MesocyclePhase,
  { badge: string; dot: string; bar: string }
> = {
  accumulation: {
    badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
    dot: 'bg-sky-500',
    bar: 'bg-sky-500',
  },
  intensification: {
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-500',
  },
  peak: {
    badge: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
    dot: 'bg-orange-500',
    bar: 'bg-orange-500',
  },
  deload: {
    badge: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35',
    dot: 'bg-amber-500',
    bar: 'bg-amber-500',
  },
};

const WEEK_OPTIONS: ReadonlyArray<4 | 5 | 6 | 8> = [4, 5, 6, 8];
const FOCUS_OPTIONS: ReadonlyArray<MesocycleFocus> = ['hypertrophy', 'strength', 'recomp'];

export const MesocycleCard: React.FC<MesocycleCardProps> = ({
  variant,
  programName,
  progress,
  weightUnit = 'kg',
  onOpenProgram,
  onSaveMesocycle,
}) => {
  const [totalWeeks, setTotalWeeks] = useState<4 | 5 | 6 | 8>(6);
  const [goalFocus, setGoalFocus] = useState<MesocycleFocus>('hypertrophy');
  const [includeDeload, setIncludeDeload] = useState(true);
  const [selectedWeekNum, setSelectedWeekNum] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleStartBlock = async (
    weeks: 4 | 5 | 6 | 8,
    focus: MesocycleFocus,
    deload: boolean,
  ) => {
    if (!onSaveMesocycle || isSaving) return;
    setIsSaving(true);
    try {
      await onSaveMesocycle(createDefaultMesocycle(programName, weeks, deload, focus));
      setSelectedWeekNum(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEndBlock = async () => {
    if (!onSaveMesocycle || isSaving) return;
    setIsSaving(true);
    try {
      await onSaveMesocycle(undefined);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkComplete = async () => {
    if (!progress || !onSaveMesocycle || isSaving) return;
    setIsSaving(true);
    try {
      await onSaveMesocycle({ ...progress.config, completedAt: Date.now() });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Compact Home Banner ───────────────────────────────────────────
  if (variant === 'compact') {
    if (!progress) return null;
    const phaseStyle = PHASE_STYLES[progress.currentWeekSpec.phase];

    return (
      <Card
        interactive={Boolean(onOpenProgram)}
        onClick={onOpenProgram}
        className="p-4"
      >
        <div className="flex items-start justify-between gap-2.5 mb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-500/15 text-primary-700 dark:text-primary-400">
              <Layers size={17} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-xs font-extrabold text-content truncate">
                  {progress.config.name}
                </p>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                    phaseStyle.badge,
                  )}
                >
                  {progress.isCompleted ? 'Block Complete' : progress.currentWeekSpec.phaseLabel}
                </span>
              </div>
              <p className="text-[11px] font-semibold text-muted mt-0.5 tabular-nums">
                Week {progress.currentWeek}/{progress.config.totalWeeks} · {progress.currentWeekSpec.targetRpeRange}
              </p>
            </div>
          </div>
          {onOpenProgram && <ArrowRight size={16} className="text-muted shrink-0 mt-1" />}
        </div>

        {/* Week Pips */}
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${progress.weeklyBreakdown.length}, minmax(0, 1fr))` }}>
          {progress.weeklyBreakdown.map((w) => {
            const wStyle = PHASE_STYLES[w.phase];
            return (
              <div
                key={w.weekNumber}
                title={`Week ${w.weekNumber}: ${w.phaseLabel}`}
                className={cn(
                  'h-2 rounded-full transition-all',
                  w.status === 'completed'
                    ? cn(wStyle.dot, 'opacity-90')
                    : w.status === 'current'
                      ? cn(wStyle.dot, 'ring-2 ring-content/35')
                      : 'bg-content/12',
                )}
              />
            );
          })}
        </div>
      </Card>
    );
  }

  // ── Full ProgramDetails Launcher (No Active Block) ────────────────
  if (!progress) {
    return (
      <Card className="p-4 sm:p-5">
        <div className="flex items-start gap-3 mb-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-700 dark:text-sky-400">
            <CalendarRange size={19} />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-content">Mesocycle Planner</h2>
            <p className="text-xs text-muted leading-snug">
              Turn this split into a structured 4–8 week training block with progressive phases and optional deload.
            </p>
          </div>
        </div>

        {/* One-tap presets */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleStartBlock(4, 'strength', true)}
            className="rounded-2xl border border-content/10 bg-page/25 hover:border-orange-500/35 px-2.5 py-2.5 text-left transition-all cursor-pointer min-h-[44px]"
          >
            <p className="text-xs font-extrabold text-orange-700 dark:text-orange-400">4W Strength</p>
            <p className="text-[10px] font-semibold text-muted mt-0.5">Peak + Deload</p>
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleStartBlock(6, 'hypertrophy', true)}
            className="rounded-2xl border border-primary-500/30 bg-primary-500/10 hover:bg-primary-500/15 px-2.5 py-2.5 text-left transition-all cursor-pointer min-h-[44px]"
          >
            <p className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400">6W Growth</p>
            <p className="text-[10px] font-semibold text-muted mt-0.5">Recommended</p>
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleStartBlock(8, 'recomp', true)}
            className="rounded-2xl border border-content/10 bg-page/25 hover:border-sky-500/35 px-2.5 py-2.5 text-left transition-all cursor-pointer min-h-[44px]"
          >
            <p className="text-xs font-extrabold text-sky-700 dark:text-sky-400">8W Block</p>
            <p className="text-[10px] font-semibold text-muted mt-0.5">Powerbuilding</p>
          </button>
        </div>

        {/* Custom Block Builder */}
        <div className="rounded-2xl border border-content/10 bg-page/20 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Block Length
            </span>
            <div className="flex gap-1.5">
              {WEEK_OPTIONS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setTotalWeeks(w)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-bold border transition-colors cursor-pointer',
                    totalWeeks === w
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-surface/60 text-muted border-content/10 hover:text-content',
                  )}
                >
                  {w}W
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Focus</span>
            <div className="flex gap-1.5 flex-wrap">
              {FOCUS_OPTIONS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setGoalFocus(f)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-bold border transition-colors cursor-pointer',
                    goalFocus === f
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-surface/60 text-muted border-content/10 hover:text-content',
                  )}
                >
                  {MESOCYCLE_FOCUS_LABELS[f]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-content">Include final Deload week</span>
            <button
              type="button"
              onClick={() => setIncludeDeload((v) => !v)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-bold border transition-colors cursor-pointer',
                includeDeload
                  ? 'border-emerald-500/35 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'border-content/15 bg-content/5 text-muted',
              )}
            >
              {includeDeload ? 'Yes' : 'No'}
            </button>
          </div>

          <Button
            type="button"
            size="md"
            disabled={isSaving}
            onClick={() => handleStartBlock(totalWeeks, goalFocus, includeDeload)}
            className="w-full"
          >
            <Sparkles size={15} />
            Start {totalWeeks}-Week {MESOCYCLE_FOCUS_LABELS[goalFocus]} Block
          </Button>
        </div>
      </Card>
    );
  }

  // ── Full Active Block Dashboard ───────────────────────────────────
  const inspectedWeek: MesocycleWeekProgress =
    progress.weeklyBreakdown.find((w) => w.weekNumber === (selectedWeekNum ?? progress.currentWeek)) ||
    progress.weeklyBreakdown[0];
  const inspectedStyle = PHASE_STYLES[inspectedWeek.phase];
  const activeStyle = PHASE_STYLES[progress.currentWeekSpec.phase];

  return (
    <Card className="p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2.5 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-500/15 text-primary-700 dark:text-primary-400">
            <Layers size={18} />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-content truncate">
              {progress.config.name}
            </h2>
            <p className="text-[11px] font-semibold text-muted tabular-nums">
              {MESOCYCLE_FOCUS_LABELS[progress.config.goalFocus]} · Week {progress.currentWeek} of{' '}
              {progress.config.totalWeeks}
              {!progress.isCompleted && ` · ${progress.daysRemaining}d left`}
            </p>
          </div>
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0',
            progress.isCompleted
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35'
              : activeStyle.badge,
          )}
        >
          {progress.isCompleted ? 'Completed' : progress.currentWeekSpec.phaseLabel}
        </span>
      </div>

      <Progress
        value={progress.progressPct}
        className="h-2 mb-3.5"
        indicatorClassName={cn('shadow-none', progress.isCompleted ? 'bg-emerald-500' : activeStyle.bar)}
      />

      {/* Interactive Week Timeline */}
      <div
        className="grid gap-1.5 mb-3.5"
        style={{ gridTemplateColumns: `repeat(${progress.weeklyBreakdown.length}, minmax(0, 1fr))` }}
      >
        {progress.weeklyBreakdown.map((w) => {
          const wStyle = PHASE_STYLES[w.phase];
          const isSelected = w.weekNumber === inspectedWeek.weekNumber;
          return (
            <button
              key={w.weekNumber}
              type="button"
              onClick={() => setSelectedWeekNum(w.weekNumber)}
              className={cn(
                'flex flex-col items-center justify-center rounded-xl border py-1.5 text-[10px] font-bold transition-all cursor-pointer tabular-nums',
                isSelected
                  ? cn(wStyle.badge, 'ring-1 ring-current shadow-sm')
                  : w.status === 'current'
                    ? 'border-content/25 bg-page/40 text-content'
                    : 'border-content/10 bg-page/20 text-muted hover:text-content',
              )}
            >
              <span>W{w.weekNumber}</span>
              <span
                className={cn(
                  'mt-0.5 h-1.5 w-1.5 rounded-full',
                  w.sessionsCount > 0 ? wStyle.dot : 'bg-content/20',
                )}
              />
            </button>
          );
        })}
      </div>

      {/* Selected Week Guidance */}
      <div className="rounded-2xl border border-content/10 bg-page/25 p-3 mb-3.5">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-extrabold text-content whitespace-nowrap">
              Week {inspectedWeek.weekNumber} · {inspectedWeek.phaseLabel}
            </span>
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap shrink-0',
                inspectedStyle.badge,
              )}
            >
              {inspectedWeek.targetRpeRange}
            </span>
          </div>
          <span className="text-[11px] font-semibold text-muted tabular-nums whitespace-nowrap">
            {inspectedWeek.sessionsCount} {inspectedWeek.sessionsCount === 1 ? 'session' : 'sessions'} · {inspectedWeek.totalVolume.toLocaleString('en-US')} {weightUnit}
          </span>
        </div>
        <p className="text-[11px] text-muted leading-snug">{inspectedWeek.volumeGuidance}</p>
      </div>

      {/* Block Stats + Recap */}
      <div className="grid grid-cols-3 gap-2 mb-3.5">
        <div className="rounded-xl border border-content/10 bg-page/20 p-2.5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Sessions</p>
          <p className="mt-0.5 text-sm font-black text-content tabular-nums">
            {progress.blockSessionsCount}
          </p>
        </div>
        <div className="rounded-xl border border-content/10 bg-page/20 p-2.5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Block Vol</p>
          <p className="mt-0.5 text-sm font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
            {progress.blockTotalVolume >= 1000
              ? `${(progress.blockTotalVolume / 1000).toFixed(1)}k`
              : progress.blockTotalVolume}{' '}
            {weightUnit}
          </p>
        </div>
        <div className="rounded-xl border border-content/10 bg-page/20 p-2.5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
            {progress.recap.volumeGrowthPct !== null ? 'Vol Delta' : 'Block PRs'}
          </p>
          <p className="mt-0.5 text-sm font-black text-amber-800 dark:text-amber-400 tabular-nums">
            {progress.recap.volumeGrowthPct !== null
              ? `${progress.recap.volumeGrowthPct >= 0 ? '+' : ''}${progress.recap.volumeGrowthPct}%`
              : progress.blockPRCount}
          </p>
        </div>
      </div>

      {progress.recap.topLiftGain && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 mb-3.5 text-xs">
          <span className="flex items-center gap-1.5 font-bold text-content truncate">
            <TrendingUp size={14} className="text-emerald-700 dark:text-emerald-400 shrink-0" />
            Best Block Gain: {progress.recap.topLiftGain.exerciseName}
          </span>
          <span className="font-mono font-black text-emerald-700 dark:text-emerald-400 shrink-0 tabular-nums">
            +{progress.recap.topLiftGain.delta} {weightUnit} e1RM
          </span>
        </div>
      )}

      {/* Block Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {!progress.isCompleted && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isSaving}
            onClick={handleMarkComplete}
            className="flex-1 min-h-[38px]"
          >
            <CheckCircle2 size={14} />
            Finish Block
          </Button>
        )}
        {progress.isCompleted && (
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={isSaving}
            onClick={() =>
              handleStartBlock(
                progress.config.totalWeeks,
                progress.config.goalFocus,
                progress.config.includeDeloadWeek,
              )
            }
            className="flex-1 min-h-[38px]"
          >
            <Flame size={14} />
            Start New Block
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isSaving}
          onClick={() =>
            handleStartBlock(
              progress.config.totalWeeks,
              progress.config.goalFocus,
              progress.config.includeDeloadWeek,
            )
          }
          className="min-h-[38px]"
        >
          <RotateCcw size={14} />
          Restart
        </Button>
        <button
          type="button"
          disabled={isSaving}
          onClick={handleEndBlock}
          className="inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-bold text-muted hover:text-red-400 transition-colors cursor-pointer"
        >
          <XCircle size={14} />
          Clear
        </button>
      </div>
    </Card>
  );
};
