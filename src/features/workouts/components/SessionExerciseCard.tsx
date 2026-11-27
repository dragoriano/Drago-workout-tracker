import React from 'react';
import { format } from 'date-fns';
import {
  AlignLeft,
  ArrowRightLeft,
  BookOpen,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Flame,
  GripVertical,
  History,
  Link,
  MoreHorizontal,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Square,
  Timer,
  Trash2,
  TrendingUp,
  Trophy,
  Unlink,
  Youtube,
} from 'lucide-react';
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../components/ui/DropdownMenu';
import type {
  AppSettings,
  EffortScale,
  Exercise,
  ExerciseTrackingMode,
  Set,
} from '../../../types';
import { cn } from '../../../utils/cn';
import {
  EXERCISE_TRACKING_MODES,
  formatDurationCompact,
  formatSetSummary,
  getExerciseTrackingMode,
  stepSetDuration,
  supportsEstimated1RM,
} from '../../../utils/exerciseModes';
import {
  formatEffortLabel,
  getBestSet1RM,
  getNextSetType,
  getSetType,
  isWarmupSet,
  RIR_OPTIONS,
  rirToRpe,
  RPE_OPTIONS,
  rpeToRir,
  type WeightUnit,
} from '../../../utils/strength';
import {
  getSupersetRoundProgress,
  type SupersetMeta,
} from '../../../utils/supersets';
import {
  REST_TIMER_PRESETS,
  stepSetReps,
  stepSetWeight,
} from '../../../utils/warmupGenerator';
import { evaluateExerciseCoach } from '../../../utils/workoutCoach';
import {
  computeExerciseHistoricalBenchmarks,
  getRecentExerciseSessions,
  type LivePRHit,
} from '../../../utils/liveSessionPR';
import { playRestFinishChime, triggerHaptic } from '../../../utils/workoutAudio';
import type { MuscleRecoveryStatus } from '../../../utils/muscleRecovery';

export interface WorkoutBlockData {
  id: string;
  exercises: Exercise[];
}

interface QuickAdjustTarget {
  set: Set;
  label: string;
}

function getQuickAdjustTarget(sets: Set[]): QuickAdjustTarget | null {
  let workingOrdinal = 0;
  let lastWorkingOrdinal = 0;

  for (const s of sets) {
    if (isWarmupSet(s)) continue;
    workingOrdinal++;
    lastWorkingOrdinal = workingOrdinal;
    if (!s.completed) {
      const st = getSetType(s);
      const label =
        st === 'drop'
          ? `Set ${workingOrdinal} (D)`
          : st === 'failure'
            ? `Set ${workingOrdinal} (F)`
            : `Set ${workingOrdinal}`;
      return { set: s, label };
    }
  }

  if (sets.length === 0) return null;

  const fallback = sets[sets.length - 1];
  if (isWarmupSet(fallback)) {
    return { set: fallback, label: 'Warmup' };
  }
  const st = getSetType(fallback);
  const label =
    st === 'drop'
      ? `Set ${lastWorkingOrdinal} (D)`
      : st === 'failure'
        ? `Set ${lastWorkingOrdinal} (F)`
        : `Set ${lastWorkingOrdinal}`;
  return { set: fallback, label };
}

function formatHistoryAge(timestamp: number): string {
  const diffHours = Math.max(0, (Date.now() - timestamp) / 3_600_000);
  if (diffHours < 24) return `${Math.max(1, Math.round(diffHours))}h ago`;
  const days = Math.round(diffHours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.round(days / 7)}w ago`;
}

interface ExerciseItemProps {
  key?: React.Key;
  exercise: Exercise;
  index: number;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onSetToggle: (exId: string, setId: string) => void;
  onSetUpdate: (exId: string, setId: string, field: keyof Set, value: Set[keyof Set]) => void;
  onSetDelete: (exId: string, setId: string) => void;
  onSetAdd: (exId: string) => void;
  onUpdateRestTimer: (exId: string, seconds: number) => void;
  onUpdateTrackingMode: (exId: string, mode: ExerciseTrackingMode) => void;
  onGenerateWarmup: (exId: string) => void;
  onOpenNotes: (e: React.MouseEvent, ex: Exercise) => void;
  onOpenTechnique?: (e: React.MouseEvent, ex: Exercise) => void;
  onOpenSwap: (e: React.MouseEvent, ex: Exercise) => void;
  onOpenChart: (e: React.MouseEvent, ex: Exercise) => void;
  onOpenPlateCalc: (e: React.MouseEvent, ex: Exercise) => void;
  onToggleSuperset: (index: number) => void;
  isSupersettedWithNext: boolean;
  isSupersettedWithPrev: boolean;
  supersetMeta?: SupersetMeta | null;
  isSupersetNextUp?: boolean;
  settings: AppSettings | null;
  isDeloadDay?: boolean;
  muscleReadiness?: MuscleRecoveryStatus | null;
  livePRSetMap?: Map<string, LivePRHit>;
  onRemoveExercise?: (exId: string) => void;
  dragControls?: ReturnType<typeof useDragControls>;
}

export function DraggableExerciseItem({
  exercise,
  index,
  isExpanded,
  onToggle,
  onSetToggle,
  onSetUpdate,
  onSetDelete,
  onSetAdd,
  onUpdateRestTimer,
  onUpdateTrackingMode,
  onGenerateWarmup,
  onOpenNotes,
  onOpenTechnique,
  onOpenSwap,
  onOpenChart,
  onOpenPlateCalc,
  onToggleSuperset,
  isSupersettedWithNext,
  supersetMeta,
  isSupersetNextUp,
  settings,
  isDeloadDay,
  muscleReadiness,
  livePRSetMap,
  onRemoveExercise,
  dragControls,
}: ExerciseItemProps) {
  const mode = getExerciseTrackingMode(exercise);
  const completedExSets = exercise.sets.filter((s) => s.completed).length;
  const totalExSets = exercise.sets.length;
  const workingSets = exercise.sets.filter((s) => !isWarmupSet(s));
  const completedWorkingSets = workingSets.filter((s) => s.completed).length;
  const warmupCount = totalExSets - workingSets.length;
  const displaySetsDone = workingSets.length > 0 ? completedWorkingSets : completedExSets;
  const displaySetsTotal = workingSets.length > 0 ? workingSets.length : totalExSets;
  const lastSession = exercise.history[exercise.history.length - 1];
  const best1RM = supportsEstimated1RM(mode) ? getBestSet1RM(exercise.sets, true) : null;
  const unit: WeightUnit = settings?.weightUnit === 'lbs' ? 'lbs' : 'kg';
  const weightStep = unit === 'lbs' ? 5 : 2.5;
  const effortScale: EffortScale = settings?.effortScale || 'rpe';
  const coach = evaluateExerciseCoach(exercise, !!isDeloadDay, settings);
  const quickTarget = getQuickAdjustTarget(exercise.sets);
  const firstWorkingWeight = workingSets[0]?.weight ?? 0;
  const canGenerateWarmup =
    (mode === 'weight_reps' || mode === 'bodyweight_reps') &&
    Number.isFinite(firstWorkingWeight) &&
    firstWorkingWeight > 0;
  const showPlateAndWarmup = mode === 'weight_reps' || (mode === 'bodyweight_reps' && canGenerateWarmup);
  const benchmarks = computeExerciseHistoricalBenchmarks(exercise);
  const recentSessions = getRecentExerciseSessions(exercise, unit, 3);
  const hasLivePR = Boolean(livePRSetMap && livePRSetMap.size > 0);

  const [showRestPresets, setShowRestPresets] = React.useState(false);
  const [showHistoryPeek, setShowHistoryPeek] = React.useState(false);
  const [isPressing, setIsPressing] = React.useState(false);
  const pressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live stopwatch for timed exercises
  const [isHolding, setIsHolding] = React.useState(false);
  const [holdElapsed, setHoldElapsed] = React.useState(0);
  const holdStartRef = React.useRef<number | null>(null);
  const targetCueFiredRef = React.useRef(false);

  React.useEffect(() => {
    if (!isHolding || holdStartRef.current === null) return;
    const targetSec = quickTarget?.set.duration ?? 45;
    const interval = setInterval(() => {
      if (holdStartRef.current === null) return;
      const elapsed = Math.floor((Date.now() - holdStartRef.current) / 1000);
      setHoldElapsed(elapsed);
      if (
        targetSec > 0 &&
        elapsed >= targetSec &&
        !targetCueFiredRef.current
      ) {
        targetCueFiredRef.current = true;
        playRestFinishChime(Boolean(settings?.soundEnabled));
        triggerHaptic('rest_done', Boolean(settings?.vibrateOnComplete));
      }
    }, 200);
    return () => clearInterval(interval);
  }, [isHolding, quickTarget?.set.duration, settings?.soundEnabled, settings?.vibrateOnComplete]);

  const handleStartHold = () => {
    holdStartRef.current = Date.now();
    targetCueFiredRef.current = false;
    setHoldElapsed(0);
    setIsHolding(true);
  };

  const handleStopAndLogHold = () => {
    const logged = Math.max(1, holdElapsed);
    setIsHolding(false);
    holdStartRef.current = null;
    if (quickTarget) {
      onSetUpdate(exercise.id, quickTarget.set.id, 'duration', logged);
      if (!quickTarget.set.completed) {
        onSetToggle(exercise.id, quickTarget.set.id);
      }
    }
    setHoldElapsed(0);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!dragControls) return;
    setIsPressing(true);
    pressTimer.current = setTimeout(() => {
      if (window.navigator.vibrate) {
        try {
          window.navigator.vibrate(40);
        } catch {}
      }
      dragControls.start(e);
      setIsPressing(false);
    }, 400);
  };

  const clearTimer = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    setIsPressing(false);
  };

  const weightColLabel =
    mode === 'assisted_reps'
      ? `-${unit}`
      : mode === 'bodyweight_reps'
        ? `+${unit}`
        : mode === 'timed'
          ? 'Load'
          : unit;

  const repsColLabel = mode === 'timed' ? 'Sec' : 'Reps';

  return (
    <div id={`exercise-card-${exercise.id}`} className="relative w-full min-w-0">
      {isSupersettedWithNext && (
        <div className="absolute left-[34px] top-[60px] bottom-[-16px] w-[2px] bg-amber-500 z-[5]" />
      )}
      <div
        className={cn(
          'liquid-glass rounded-3xl overflow-hidden transition-all duration-200 relative z-[6] w-full',
          supersetMeta
            ? 'border-amber-500/35 bg-amber-500/8'
            : '',
          isSupersetNextUp && 'ring-2 ring-amber-400/75 border-amber-500/60 bg-amber-500/10',
          isPressing && 'scale-[0.98] opacity-80',
        )}
      >
        <div className="flex p-4 cursor-pointer select-none" onClick={() => onToggle(exercise.id)}>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div
                    className={cn(
                      'flex h-7 min-w-7 px-1 shrink-0 items-center justify-center rounded-lg font-bold text-xs',
                      supersetMeta
                        ? 'bg-amber-500/20 text-amber-500'
                        : 'bg-primary-500/20 text-primary-400',
                    )}
                  >
                    {supersetMeta ? supersetMeta.label : index + 1}
                  </div>
                  <h2 className="text-sm font-bold text-content leading-tight">{exercise.name}</h2>
                  {supersetMeta && (
                    <span className="text-[9px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded uppercase font-black tracking-tighter">
                      {supersetMeta.kindLabel}
                    </span>
                  )}
                  {mode !== 'weight_reps' && (
                    <span
                      className={cn(
                        'text-[9px] px-1.5 py-0.5 rounded uppercase font-black tracking-wider',
                        mode === 'bodyweight_reps'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : mode === 'assisted_reps'
                            ? 'bg-sky-500/15 text-sky-400'
                            : 'bg-amber-500/15 text-amber-400',
                      )}
                    >
                      {mode === 'bodyweight_reps'
                        ? 'BW'
                        : mode === 'assisted_reps'
                          ? 'Assist'
                          : 'Timed'}
                    </span>
                  )}
                </div>

                {(exercise.primaryMuscle ||
                  (exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0) ||
                  muscleReadiness?.readiness === 'fatigued') && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                    {exercise.primaryMuscle && (
                      <span className="text-[10px] text-primary-400/80 font-bold uppercase tracking-wider">
                        {exercise.primaryMuscle}
                      </span>
                    )}
                    {exercise.secondaryMuscles &&
                      exercise.secondaryMuscles.slice(0, 1).map((m) => (
                        <span key={m} className="text-[10px] text-muted font-bold uppercase tracking-wider">
                          · {m}
                        </span>
                      ))}
                    {muscleReadiness?.readiness === 'fatigued' && (
                      <span className="rounded bg-red-500/15 border border-red-500/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-400">
                        Fatigued · {muscleReadiness.recoveryPercent}%
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 mt-1 shrink-0">
                <div
                  className={cn(
                    'p-1.5 text-muted/30 hover:text-content active:scale-95 transition-all cursor-grab active:cursor-grabbing touch-none',
                    isPressing && 'text-primary-400 scale-125',
                  )}
                  onPointerDown={handlePointerDown}
                  onPointerUp={clearTimer}
                  onPointerLeave={clearTimer}
                  onPointerCancel={clearTimer}
                >
                  <GripVertical size={20} />
                </div>
                <div className="text-muted">
                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-content/5 pt-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-[10px] text-muted font-bold uppercase tracking-widest flex items-center gap-1.5">
                  <span>{displaySetsDone}/{displaySetsTotal} Sets</span>
                  {warmupCount > 0 && (
                    <span className="rounded bg-sky-500/15 px-1 py-0.5 text-[9px] font-black text-sky-400">
                      +{warmupCount}W
                    </span>
                  )}
                </p>
                {best1RM && (
                  <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 tabular-nums">
                    e1RM {best1RM.e1rm}
                    {unit}
                  </span>
                )}
                {hasLivePR && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-black text-amber-700 dark:text-amber-400">
                    <Trophy size={10} />
                    <span>PR</span>
                  </span>
                )}
                {exercise.history && exercise.history.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenChart(e, exercise);
                    }}
                    className="text-primary-400/60 hover:text-primary-400 transition-colors p-1"
                  >
                    <TrendingUp size={14} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                {showPlateAndWarmup && (
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-muted hover:bg-elevated hover:text-primary-400 transition-colors cursor-pointer"
                    onClick={(e) => onOpenPlateCalc(e, exercise)}
                    title="Plate Calculator"
                    aria-label="Plate Calculator"
                  >
                    <Calculator size={16} />
                  </button>
                )}

                <button
                  type="button"
                  className={cn(
                    'rounded-lg p-1.5 transition-colors cursor-pointer',
                    exercise.notes ? 'text-primary-400 hover:bg-elevated' : 'text-muted hover:bg-elevated hover:text-content',
                  )}
                  onClick={(e) => onOpenNotes(e, exercise)}
                  title="Exercise Notes"
                  aria-label="Exercise Notes"
                >
                  <AlignLeft size={16} />
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-muted hover:bg-elevated hover:text-content transition-colors cursor-pointer"
                      aria-label="More exercise actions"
                    >
                      <MoreHorizontal size={17} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onOpenTechnique && (
                      <DropdownMenuItem onClick={(e) => onOpenTechnique(e as unknown as React.MouseEvent, exercise)}>
                        <BookOpen size={14} className="text-sky-600 dark:text-sky-400" />
                        <span>Form &amp; Cues</span>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={(e) => onOpenSwap(e as unknown as React.MouseEvent, exercise)}>
                      <ArrowRightLeft size={14} className="text-muted" />
                      <span>Swap Exercise</span>
                    </DropdownMenuItem>
                    {exercise.history && exercise.history.length > 0 && (
                      <DropdownMenuItem onClick={(e) => onOpenChart(e as unknown as React.MouseEvent, exercise)}>
                        <TrendingUp size={14} className="text-primary-400" />
                        <span>Progress Chart</span>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() =>
                        window.open(
                          `https://www.youtube.com/results?search_query=how+to+do+${encodeURIComponent(exercise.name)}+exercise`,
                          '_blank',
                        )
                      }
                    >
                      <Youtube size={14} className="text-red-400" />
                      <span>Watch Tutorial</span>
                    </DropdownMenuItem>
                    {index > 0 && (
                      <DropdownMenuItem onClick={() => onToggleSuperset(index)}>
                        {supersetMeta ? (
                          <>
                            <Unlink size={14} className="text-amber-400" />
                            <span>Unlink Superset</span>
                          </>
                        ) : (
                          <>
                            <Link size={14} className="text-muted" />
                            <span>Link Superset Above</span>
                          </>
                        )}
                      </DropdownMenuItem>
                    )}
                    {onRemoveExercise && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          destructive
                          onClick={() => onRemoveExercise(exercise.id)}
                        >
                          <Trash2 size={14} />
                          <span>Remove Exercise</span>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-4 pb-4"
            >
              {/* Tracking Mode Selector */}
              <div className="mb-3 flex items-center gap-1 rounded-xl bg-page/60 border border-content/10 p-1">
                {EXERCISE_TRACKING_MODES.map((opt) => {
                  const active = mode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onUpdateTrackingMode(exercise.id, opt.value)}
                      className={cn(
                        'flex-1 rounded-lg py-1 text-[10px] font-bold transition-all',
                        active
                          ? 'bg-primary-500 text-white shadow-sm'
                          : 'text-muted hover:text-content',
                      )}
                      title={opt.description}
                    >
                      {opt.shortLabel}
                    </button>
                  );
                })}
              </div>

              {lastSession && lastSession.sets.length > 0 && (
                <div className="mb-4 rounded-2xl border border-content/10 bg-page/35 p-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowHistoryPeek((prev) => !prev)}
                    aria-expanded={showHistoryPeek}
                    className="flex w-full items-center justify-between gap-2 text-left cursor-pointer"
                  >
                    <div className="flex min-w-0 items-center gap-1.5 text-muted">
                      <RotateCcw size={13} className="shrink-0 text-primary-400" />
                      <span className="font-bold text-content">Last session</span>
                      <span className="text-[11px] text-muted">
                        · {formatHistoryAge(lastSession.date)}
                      </span>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-content/10 bg-surface/80 px-2 py-0.5 text-[10px] font-bold text-primary-400">
                      <History size={11} />
                      <span>Peek ({recentSessions.length})</span>
                      {showHistoryPeek ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </span>
                  </button>

                  <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-muted font-medium">
                    {(() => {
                      let lastWorkingOrdinal = 0;
                      return lastSession.sets.map((s, i) => {
                        const st = getSetType(s);
                        let tag = '';
                        if (st === 'warmup') {
                          tag = 'W';
                        } else {
                          lastWorkingOrdinal++;
                          tag = st === 'drop' ? 'D' : st === 'failure' ? 'F' : `S${lastWorkingOrdinal}`;
                        }
                        const effortText = !isWarmupSet(s) ? formatEffortLabel(s.rpe, effortScale) : '';
                        return (
                          <span key={s.id || i} className={cn(st === 'warmup' && 'opacity-70')}>
                            {tag}: {formatSetSummary(s, mode, unit)}
                            {effortText ? ` · ${effortText}` : ''}
                          </span>
                        );
                      });
                    })()}
                  </div>

                  <AnimatePresence>
                    {showHistoryPeek && recentSessions.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 space-y-2.5 border-t border-content/10 pt-3">
                          {benchmarks.hasHistory && (
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-[11px]">
                              <span className="inline-flex items-center gap-1 font-extrabold uppercase tracking-wider text-amber-400">
                                <Trophy size={11} /> Target to Beat
                              </span>
                              <div className="flex flex-wrap items-center gap-2 font-mono font-bold text-content tabular-nums">
                                {mode === 'timed' ? (
                                  <span>{formatDurationCompact(benchmarks.bestDuration)}</span>
                                ) : benchmarks.bestWeight > 0 ? (
                                  <>
                                    <span>{benchmarks.bestWeight}{unit}</span>
                                    {benchmarks.best1RM > 0 && (
                                      <span className="text-muted">· {benchmarks.best1RM}{unit} e1RM</span>
                                    )}
                                  </>
                                ) : (
                                  <span>{benchmarks.bestReps} reps</span>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="space-y-2">
                            {recentSessions.map((sess) => (
                              <div
                                key={sess.sessionId + sess.date}
                                className="rounded-xl border border-content/10 bg-surface/60 p-2.5 space-y-1.5"
                              >
                                <div className="flex items-center justify-between gap-2 text-[11px]">
                                  <span className="font-bold text-content">
                                    {format(new Date(sess.date), 'MMM d')}
                                    <span className="ml-1.5 font-medium text-muted">
                                      ({formatHistoryAge(sess.date)})
                                    </span>
                                  </span>
                                  <div className="flex items-center gap-1.5 font-mono tabular-nums">
                                    {sess.best1RM !== null && (
                                      <span className="font-bold text-emerald-400">
                                        {sess.best1RM}{unit} e1RM
                                      </span>
                                    )}
                                    {sess.totalVolume > 0 && (
                                      <span className="text-muted">
                                        {sess.totalVolume.toLocaleString()}{unit}
                                      </span>
                                    )}
                                    {sess.volumeDeltaPct !== null && sess.volumeDeltaPct !== 0 && (
                                      <span
                                        className={cn(
                                          'rounded px-1 py-0.5 text-[9px] font-black',
                                          sess.volumeDeltaPct > 0
                                            ? 'bg-emerald-500/15 text-emerald-400'
                                            : 'bg-amber-500/15 text-amber-400',
                                        )}
                                      >
                                        {sess.volumeDeltaPct > 0 ? '+' : ''}
                                        {sess.volumeDeltaPct}%
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-1">
                                  {sess.workingSets.map((ws, idx) => {
                                    const wt = getSetType(ws);
                                    const prefix = wt === 'drop' ? 'D: ' : wt === 'failure' ? 'F: ' : '';
                                    const eff = !isWarmupSet(ws) ? formatEffortLabel(ws.rpe, effortScale) : '';
                                    return (
                                      <span
                                        key={ws.id || idx}
                                        className="rounded-md border border-content/10 bg-page/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-content/90 tabular-nums"
                                      >
                                        {prefix}{formatSetSummary(ws, mode, unit)}
                                        {eff ? ` · ${eff}` : ''}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {coach.status === 'deload_day' && (
                <div className="mb-4 rounded-xl bg-sky-500/15 border border-sky-500/30 p-3 flex items-start gap-3 w-full min-w-0">
                  <span className="text-sky-400 text-lg">❄️</span>
                  <div>
                    <p className="text-sm font-bold text-sky-300 leading-tight">
                      {mode === 'timed'
                        ? `Deload Day — ${formatDurationCompact(coach.targetDuration)}`
                        : mode === 'assisted_reps'
                          ? `Deload Day — -${coach.targetWeight}${unit} × ${coach.targetReps}`
                          : `Deload Day — ${coach.targetWeight}${unit} × ${coach.targetReps}`}
                    </p>
                    <p className="text-[10px] font-bold text-sky-500/70 mt-1 uppercase tracking-wider">
                      {mode === 'assisted_reps'
                        ? '+20% assistance · Focus on form & recovery'
                        : '60% of last session • Focus on form & recovery'}
                    </p>
                  </div>
                </div>
              )}

              {coach.status === 'first_session' && (
                <div className="mb-4 rounded-xl bg-primary-500/10 border border-primary-500/20 p-3 flex items-start gap-3 w-full min-w-0">
                  <Sparkles className="text-primary-400 shrink-0" size={18} />
                  <div>
                    <p className="text-sm font-semibold text-content leading-tight">
                      {mode === 'timed'
                        ? `First session! Aim for ${formatDurationCompact(coach.targetDuration)}`
                        : mode === 'bodyweight_reps' && coach.targetWeight === 0
                          ? `First session! Aim for ${coach.targetReps} bodyweight reps`
                          : mode === 'assisted_reps'
                            ? `First session! Aim for ${coach.targetReps} reps (-${coach.targetWeight}${unit} assist)`
                            : `First session! Aim for ${coach.targetReps} reps at ${coach.targetWeight}${unit}`}
                    </p>
                    <p className="text-[10px] font-bold text-muted mt-1 uppercase tracking-wider">
                      First Session · Build the baseline
                    </p>
                  </div>
                </div>
              )}

              {coach.status === 'auto_deload' && (
                <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 p-3 flex items-start gap-3 w-full min-w-0">
                  <span className="text-red-400 text-base shrink-0">📉</span>
                  <div>
                    <p className="text-sm font-bold text-red-300 leading-tight">
                      {mode === 'timed'
                        ? `Auto-Deload — ${formatDurationCompact(coach.targetDuration)}`
                        : mode === 'assisted_reps'
                          ? `More Assistance — -${coach.targetWeight}${unit} × ${coach.targetReps}`
                          : `Auto-Deload — ${coach.targetWeight}${unit} × ${coach.targetReps}`}
                    </p>
                    <p className="text-[10px] font-bold text-red-500/60 mt-1 uppercase tracking-wider">
                      {coach.consecutiveFails} consecutive fails ·{' '}
                      {mode === 'timed'
                        ? `Hold reduced ${coach.deloadReductionPct}%`
                        : mode === 'assisted_reps'
                          ? `Assistance increased ${coach.deloadReductionPct}%`
                          : `Weight reduced ${coach.deloadReductionPct}%`}
                    </p>
                  </div>
                </div>
              )}

              {coach.status === 'retry' && (
                <div className="mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 flex items-start gap-3 w-full min-w-0">
                  <span className="text-amber-400 text-base shrink-0">⚡</span>
                  <div>
                    <p className="text-sm font-bold text-amber-300 leading-tight">
                      {mode === 'timed'
                        ? `Try again — ${formatDurationCompact(coach.targetDuration)}`
                        : `Try again — ${coach.targetWeight}${unit} × ${coach.targetReps}`}
                    </p>
                    <p className="text-[10px] font-bold text-amber-500/60 mt-1 uppercase tracking-wider">
                      {coach.consecutiveFails === 1
                        ? '1 failed session'
                        : `${coach.consecutiveFails} consecutive fails`}{' '}
                      · Consolidate target before progressing
                    </p>
                  </div>
                </div>
              )}

              {coach.status === 'rpe_hold' && (
                <div className="mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 flex items-start gap-3 w-full min-w-0">
                  <span className="text-amber-400 text-base shrink-0">⚖️</span>
                  <div>
                    <p className="text-sm font-bold text-amber-300 leading-tight">
                      {mode === 'timed'
                        ? `Consolidate — ${formatDurationCompact(coach.targetDuration)}`
                        : `Consolidate — ${coach.targetWeight}${unit} × ${coach.targetReps}`}
                    </p>
                    <p className="text-[10px] font-bold text-amber-500/70 mt-1 uppercase tracking-wider">
                      Last avg {formatEffortLabel(coach.avgRecentRpe ?? undefined, effortScale)} · Hold before overloading
                    </p>
                  </div>
                </div>
              )}

              {coach.status === 'overload' && (
                <div className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 flex items-start gap-3 w-full min-w-0">
                  <span className="text-emerald-400 text-base shrink-0">🚀</span>
                  <div>
                    <p className="text-sm font-bold text-emerald-300 leading-tight">
                      {mode === 'timed'
                        ? `Overload! Aim for ${formatDurationCompact(coach.targetDuration)}`
                        : mode === 'assisted_reps'
                          ? `Progress! Reduce assist to -${coach.targetWeight}${unit} × ${coach.targetReps}`
                          : mode === 'bodyweight_reps' && coach.targetWeight === 0
                            ? `Progress! Aim for ${coach.targetReps} bodyweight reps`
                            : `Overload! Aim for ${coach.targetWeight}${unit} × ${coach.targetReps}`}
                    </p>
                    <p className="text-[10px] font-bold text-emerald-500/60 mt-1 uppercase tracking-wider">
                      {mode === 'timed'
                        ? '2 sessions done · +5s hold progression'
                        : mode === 'assisted_reps'
                          ? '2 sessions done · -2.5' + unit + ' less assistance'
                          : mode === 'bodyweight_reps' && coach.repsModifier > 0
                            ? '2 sessions done · +1 rep progression'
                            : `2 sessions done · +2.5${unit} progressive overload`}
                    </p>
                  </div>
                </div>
              )}

              {coach.status === 'maintain' && (
                <div className="mb-4 rounded-xl bg-primary-500/10 border border-primary-500/20 p-3 flex items-start gap-3 w-full min-w-0">
                  <Sparkles className="text-primary-400 shrink-0" size={18} />
                  <div>
                    <p className="text-sm font-semibold text-content leading-tight">
                      {mode === 'timed'
                        ? `Maintain — ${formatDurationCompact(coach.targetDuration)}`
                        : `Maintain — ${coach.targetWeight}${unit} × ${coach.targetReps}`}
                    </p>
                    <p className="text-[10px] font-bold text-muted mt-1 uppercase tracking-wider">
                      1 success · Hold target, aim for 2 before overloading
                    </p>
                  </div>
                </div>
              )}

              {/* Hold Stopwatch for Timed Exercises */}
              {mode === 'timed' && quickTarget && (
                <div className="mb-3 rounded-xl bg-amber-500/10 border border-amber-500/25 p-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Timer size={16} className="text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                        Hold Stopwatch · {quickTarget.label}
                      </p>
                      <p className="font-mono text-sm font-black text-content tabular-nums">
                        {formatDurationCompact(holdElapsed)}{' '}
                        <span className="text-xs font-medium text-muted">
                          / {formatDurationCompact(quickTarget.set.duration ?? 45)} target
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isHolding ? (
                      <button
                        type="button"
                        onClick={handleStartHold}
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-black text-zinc-950 active:scale-95 transition-transform"
                      >
                        <Play size={12} /> Start Hold
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStopAndLogHold}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-black text-zinc-950 active:scale-95 transition-transform"
                      >
                        <Square size={12} /> Stop &amp; Log
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-2 mb-3 rounded-xl bg-page/60 border border-content/10 p-2.5 space-y-2 w-full min-w-0">
                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {quickTarget ? (
                      <>
                        <span className="rounded-md bg-primary-500/15 border border-primary-500/25 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary-400 shrink-0">
                          {quickTarget.label}
                        </span>
                        <span className="text-[11px] font-bold text-muted tabular-nums truncate">
                          {formatSetSummary(quickTarget.set, mode, unit)}
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                        Quick Controls
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowRestPresets((prev) => !prev)}
                      aria-expanded={showRestPresets}
                      aria-label={`Rest timer ${exercise.restTimerConfig} seconds, tap to change`}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold tabular-nums transition-all active:scale-95',
                        showRestPresets
                          ? 'bg-primary-500/20 border-primary-500/40 text-primary-400'
                          : 'bg-surface border-content/10 text-content hover:border-primary-500/30',
                      )}
                    >
                      <span aria-hidden="true">⏱</span>
                      <span>{exercise.restTimerConfig}s</span>
                    </button>

                    {(mode === 'weight_reps' || mode === 'bodyweight_reps') && (
                      <button
                        type="button"
                        disabled={!canGenerateWarmup}
                        onClick={() => onGenerateWarmup(exercise.id)}
                        title={
                          canGenerateWarmup
                            ? `Generate warm-up ramp from ${firstWorkingWeight}${unit}`
                            : 'Set a working weight above 0 to generate warm-ups'
                        }
                        className={cn(
                          'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-all',
                          canGenerateWarmup
                            ? 'bg-sky-500/15 border-sky-500/35 text-sky-400 hover:bg-sky-500/25 active:scale-95'
                            : 'bg-surface/40 border-content/5 text-muted/40 opacity-50 cursor-not-allowed',
                        )}
                      >
                        <Flame size={12} className="shrink-0" />
                        <span>Warm-Up</span>
                      </button>
                    )}
                  </div>
                </div>

                {showRestPresets && (
                  <div className="grid grid-cols-6 gap-1 pt-0.5">
                    {REST_TIMER_PRESETS.map((preset) => {
                      const isActive = exercise.restTimerConfig === preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            onUpdateRestTimer(exercise.id, preset);
                            setShowRestPresets(false);
                          }}
                          className={cn(
                            'h-8 rounded-lg border text-[11px] font-bold tabular-nums transition-all active:scale-95',
                            isActive
                              ? 'bg-primary-500 border-primary-500 text-white shadow-sm shadow-primary-500/30'
                              : 'bg-surface border-content/10 text-muted hover:text-content',
                          )}
                        >
                          {preset}s
                        </button>
                      );
                    })}
                  </div>
                )}

                {quickTarget && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center rounded-xl bg-surface border border-content/10 overflow-hidden min-w-0">
                      <button
                        type="button"
                        disabled={quickTarget.set.weight <= 0}
                        onClick={() =>
                          onSetUpdate(
                            exercise.id,
                            quickTarget.set.id,
                            'weight',
                            stepSetWeight(quickTarget.set.weight, -weightStep),
                          )
                        }
                        aria-label={`Decrease ${quickTarget.label} load by ${weightStep} ${unit}`}
                        className="flex-1 h-9 flex items-center justify-center text-xs font-bold text-content hover:bg-content/5 active:bg-content/10 transition-colors tabular-nums disabled:opacity-35 disabled:pointer-events-none"
                      >
                        -{weightStep}
                      </button>
                      <span className="px-1.5 text-[10px] font-bold uppercase text-muted border-x border-content/10 select-none shrink-0">
                        {weightColLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onSetUpdate(
                            exercise.id,
                            quickTarget.set.id,
                            'weight',
                            stepSetWeight(quickTarget.set.weight, weightStep),
                          )
                        }
                        aria-label={`Increase ${quickTarget.label} load by ${weightStep} ${unit}`}
                        className="flex-1 h-9 flex items-center justify-center text-xs font-bold text-primary-400 hover:bg-primary-500/10 active:bg-primary-500/20 transition-colors tabular-nums"
                      >
                        +{weightStep}
                      </button>
                    </div>

                    {mode === 'timed' ? (
                      <div className="flex items-center rounded-xl bg-surface border border-content/10 overflow-hidden min-w-0">
                        <button
                          type="button"
                          disabled={(quickTarget.set.duration ?? 0) <= 0}
                          onClick={() =>
                            onSetUpdate(
                              exercise.id,
                              quickTarget.set.id,
                              'duration',
                              stepSetDuration(quickTarget.set.duration ?? 45, -5),
                            )
                          }
                          aria-label={`Decrease ${quickTarget.label} hold duration by 5 seconds`}
                          className="flex-1 h-9 flex items-center justify-center text-xs font-bold text-content hover:bg-content/5 active:bg-content/10 transition-colors tabular-nums disabled:opacity-35 disabled:pointer-events-none"
                        >
                          -5s
                        </button>
                        <span className="px-1.5 text-[10px] font-bold uppercase text-muted border-x border-content/10 select-none shrink-0">
                          hold
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onSetUpdate(
                              exercise.id,
                              quickTarget.set.id,
                              'duration',
                              stepSetDuration(quickTarget.set.duration ?? 45, 5),
                            )
                          }
                          aria-label={`Increase ${quickTarget.label} hold duration by 5 seconds`}
                          className="flex-1 h-9 flex items-center justify-center text-xs font-bold text-primary-400 hover:bg-primary-500/10 active:bg-primary-500/20 transition-colors tabular-nums"
                        >
                          +5s
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center rounded-xl bg-surface border border-content/10 overflow-hidden min-w-0">
                        <button
                          type="button"
                          disabled={quickTarget.set.reps <= 0}
                          onClick={() =>
                            onSetUpdate(
                              exercise.id,
                              quickTarget.set.id,
                              'reps',
                              stepSetReps(quickTarget.set.reps, -1),
                            )
                          }
                          aria-label={`Decrease ${quickTarget.label} reps by 1`}
                          className="flex-1 h-9 flex items-center justify-center text-xs font-bold text-content hover:bg-content/5 active:bg-content/10 transition-colors tabular-nums disabled:opacity-35 disabled:pointer-events-none"
                        >
                          -1
                        </button>
                        <span className="px-1.5 text-[10px] font-bold uppercase text-muted border-x border-content/10 select-none shrink-0">
                          reps
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onSetUpdate(
                              exercise.id,
                              quickTarget.set.id,
                              'reps',
                              stepSetReps(quickTarget.set.reps, 1),
                            )
                          }
                          aria-label={`Increase ${quickTarget.label} reps by 1`}
                          className="flex-1 h-9 flex items-center justify-center text-xs font-bold text-primary-400 hover:bg-primary-500/10 active:bg-primary-500/20 transition-colors tabular-nums"
                        >
                          +1
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-[34px_1fr_1fr_52px_34px_26px] items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-muted mt-2">
                <span className="text-center">Set</span>
                <span className="text-center">{weightColLabel}</span>
                <span className="text-center">{repsColLabel}</span>
                <span className="text-center">{effortScale.toUpperCase()}</span>
                <span className="text-center">✓</span>
                <span />
              </div>

              <div className="grid gap-2 mt-1.5">
                {(() => {
                  let workingOrdinal = 0;
                  return exercise.sets.map((set) => {
                    const setType = getSetType(set);
                    const warmup = setType === 'warmup';
                    if (!warmup) workingOrdinal++;

                    const rirValue = set.rpe === undefined ? undefined : rpeToRir(set.rpe);
                    const rirOptions =
                      rirValue !== undefined && !RIR_OPTIONS.some((v) => v === rirValue)
                        ? [...RIR_OPTIONS, rirValue].sort((a, b) => b - a)
                        : [...RIR_OPTIONS];

                    const effortToneClass =
                      set.rpe === undefined
                        ? 'text-muted/60'
                        : set.rpe >= 9.5
                          ? 'text-red-400'
                          : set.rpe >= 8.5
                            ? 'text-amber-400'
                            : 'text-emerald-400';

                    const typeButtonClass =
                      setType === 'warmup'
                        ? 'bg-sky-500/15 border-sky-500/35 text-sky-400'
                        : setType === 'drop'
                          ? 'bg-amber-500/15 border-amber-500/35 text-amber-400'
                          : setType === 'failure'
                            ? 'bg-red-500/15 border-red-500/35 text-red-400'
                            : 'bg-page border-content/10 text-muted hover:text-content';

                    const typeBadgeLabel =
                      setType === 'warmup'
                        ? 'W'
                        : setType === 'drop'
                          ? 'D'
                          : setType === 'failure'
                            ? 'F'
                            : String(workingOrdinal);

                    const prHit = livePRSetMap?.get(set.id);

                    return (
                      <div
                        key={set.id}
                        className={cn(
                          'rounded-xl p-1 transition-colors min-w-0 w-full',
                          set.completed
                            ? prHit
                              ? 'bg-amber-500/10 ring-1 ring-amber-500/25'
                              : warmup
                                ? 'bg-sky-900/10'
                                : 'bg-emerald-900/10'
                            : 'bg-transparent',
                        )}
                      >
                        <div className="grid grid-cols-[34px_1fr_1fr_52px_34px_26px] items-center gap-1.5 min-w-0 w-full">
                        <button
                          type="button"
                          onClick={() => onSetUpdate(exercise.id, set.id, 'setType', getNextSetType(set.setType))}
                          title="Tap to change set type (Working → Warmup → Drop → Failure)"
                          aria-label={`Set type ${setType}, tap to change`}
                          className={cn(
                            'flex h-9 w-[34px] items-center justify-center rounded-lg border text-xs font-black transition-all active:scale-95',
                            typeButtonClass,
                          )}
                        >
                          {typeBadgeLabel}
                        </button>
                        <input
                          type="number"
                          value={set.weight || ''}
                          onChange={(e) => onSetUpdate(exercise.id, set.id, 'weight', Number(e.target.value))}
                          className={cn(
                            'h-11 w-full min-w-0 rounded-xl bg-page/70 text-center text-base font-bold text-content placeholder:text-muted/60 outline-none',
                            warmup && 'opacity-75',
                            set.completed && (warmup ? 'text-sky-700 dark:text-sky-300' : 'text-emerald-700 dark:text-emerald-300'),
                          )}
                          placeholder={mode === 'bodyweight_reps' || mode === 'timed' ? 'BW' : '0'}
                        />
                        {mode === 'timed' ? (
                          <input
                            type="number"
                            value={set.duration || ''}
                            onChange={(e) =>
                              onSetUpdate(
                                exercise.id,
                                set.id,
                                'duration',
                                Math.max(0, Math.round(Number(e.target.value) || 0)),
                              )
                            }
                            className={cn(
                              'h-11 w-full min-w-0 rounded-xl bg-page/70 text-center text-base font-bold text-content placeholder:text-muted/60 outline-none',
                              warmup && 'opacity-75',
                              set.completed && (warmup ? 'text-sky-700 dark:text-sky-300' : 'text-emerald-700 dark:text-emerald-300'),
                            )}
                            placeholder="45"
                          />
                        ) : (
                          <input
                            type="number"
                            value={set.reps || ''}
                            onChange={(e) => onSetUpdate(exercise.id, set.id, 'reps', Number(e.target.value))}
                            className={cn(
                              'h-11 w-full min-w-0 rounded-xl bg-page/70 text-center text-base font-bold text-content placeholder:text-muted/60 outline-none',
                              warmup && 'opacity-75',
                              set.completed && (warmup ? 'text-sky-700 dark:text-sky-300' : 'text-emerald-700 dark:text-emerald-300'),
                            )}
                            placeholder="0"
                          />
                        )}
                        {warmup ? (
                          <div className="text-center text-xs font-bold text-muted/40">—</div>
                        ) : (
                          <select
                            aria-label={effortScale === 'rir' ? 'RIR' : 'RPE'}
                            value={
                              set.rpe === undefined
                                ? ''
                                : effortScale === 'rir'
                                  ? String(rpeToRir(set.rpe))
                                  : String(set.rpe)
                            }
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === '') {
                                onSetUpdate(exercise.id, set.id, 'rpe', undefined);
                              } else {
                                const parsed = Number(raw);
                                onSetUpdate(
                                  exercise.id,
                                  set.id,
                                  'rpe',
                                  effortScale === 'rir' ? rirToRpe(parsed) : parsed,
                                );
                              }
                            }}
                            className={cn(
                              'h-11 w-full min-w-0 rounded-xl bg-page text-center text-xs font-bold outline-none cursor-pointer px-0.5 appearance-none',
                              effortToneClass,
                            )}
                          >
                            <option value="" className="bg-card text-content">
                              —
                            </option>
                            {effortScale === 'rir'
                              ? rirOptions.map((opt) => (
                                  <option key={opt} value={String(opt)} className="bg-card text-content">
                                    {opt}
                                  </option>
                                ))
                              : RPE_OPTIONS.map((opt) => (
                                  <option key={opt} value={String(opt)} className="bg-card text-content">
                                    {opt}
                                  </option>
                                ))}
                          </select>
                        )}
                        <div className="flex justify-center">
                          <button
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-lg border-2',
                              set.completed
                                ? warmup
                                  ? 'border-sky-500 bg-sky-500 text-white'
                                  : 'border-emerald-500 bg-emerald-500 text-white'
                                : 'border-content/20 bg-transparent',
                            )}
                            onClick={() => onSetToggle(exercise.id, set.id)}
                          >
                            {set.completed && <CheckCircle2 size={16} />}
                          </button>
                        </div>
                        <button
                          className="flex h-7 w-7 items-center justify-center text-muted hover:text-red-500"
                          onClick={() => onSetDelete(exercise.id, set.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                        </div>
                        {prHit && (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 px-1">
                            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                              <Trophy size={9} />
                              <span>{prHit.shortTag}</span>
                            </span>
                            <span className="font-mono text-[10px] font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                              {prHit.valueLabel}
                              {prHit.deltaLabel ? ` (${prHit.deltaLabel})` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
              <button
                className="mt-4 flex w-full items-center justify-center gap-2 py-2 text-sm font-bold text-primary-400"
                onClick={() => onSetAdd(exercise.id)}
              >
                <Plus size={16} /> Add Set
              </button>
              <p className="mt-1 text-center text-[10px] font-medium text-muted/60">
                Tap set # to tag: W Warmup · D Drop · F Failure
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface WorkoutBlockProps {
  key?: React.Key;
  block: WorkoutBlockData;
  exercises: Exercise[];
  expandedExercises: Record<string, boolean>;
  supersetMap: Map<string, SupersetMeta>;
  activeSupersetFocusId?: string | null;
  toggleExercise: (id: string) => void;
  handleToggleSet: (exId: string, setId: string) => void;
  handleUpdateSet: (exId: string, setId: string, field: keyof Set, value: Set[keyof Set]) => void;
  handleDeleteSet: (exId: string, setId: string) => void;
  handleAddSet: (exId: string) => void;
  handleUpdateRestTimer: (exId: string, seconds: number) => void;
  handleUpdateGroupRestTimer: (groupId: string, seconds: number) => void;
  handleUpdateTrackingMode: (exId: string, mode: ExerciseTrackingMode) => void;
  handleGenerateWarmup: (exId: string) => void;
  handleOpenNotes: (e: React.MouseEvent, ex: Exercise) => void;
  handleOpenTechnique?: (e: React.MouseEvent, ex: Exercise) => void;
  handleOpenSwap: (e: React.MouseEvent, ex: Exercise) => void;
  handleOpenPlateCalc: (e: React.MouseEvent, ex: Exercise) => void;
  setChartConfig: React.Dispatch<React.SetStateAction<{ isOpen: boolean; exercise: Exercise | null }>>;
  handleToggleSuperset: (index: number) => void;
  settings: AppSettings | null;
  isDeloadDay?: boolean;
  muscleReadinessMap?: Record<string, MuscleRecoveryStatus>;
  livePRMapsByExercise?: Record<string, Map<string, LivePRHit>>;
  onRemoveExercise?: (exId: string) => void;
  onDragStart: () => void;
}

export function WorkoutBlock({
  block,
  exercises,
  expandedExercises,
  supersetMap,
  activeSupersetFocusId,
  toggleExercise,
  handleToggleSet,
  handleUpdateSet,
  handleDeleteSet,
  handleAddSet,
  handleUpdateRestTimer,
  handleUpdateGroupRestTimer,
  handleUpdateTrackingMode,
  handleGenerateWarmup,
  handleOpenNotes,
  handleOpenTechnique,
  handleOpenSwap,
  handleOpenPlateCalc,
  setChartConfig,
  handleToggleSuperset,
  settings,
  isDeloadDay,
  muscleReadinessMap,
  livePRMapsByExercise,
  onRemoveExercise,
  onDragStart,
}: WorkoutBlockProps) {
  const controls = useDragControls();
  const [showGroupRestPresets, setShowGroupRestPresets] = React.useState(false);

  const firstMeta = block.exercises.length >= 2 ? supersetMap.get(block.exercises[0].id) : undefined;
  const roundProgress = firstMeta ? getSupersetRoundProgress(block.exercises) : null;

  return (
    <Reorder.Item
      value={block}
      key={block.id}
      dragListener={false}
      dragControls={controls}
      onDragStart={onDragStart}
      className="grid gap-3 w-full cursor-default"
    >
      {firstMeta && roundProgress && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider',
                  firstMeta.size >= 3
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'bg-amber-500/20 text-amber-400',
                )}
              >
                {firstMeta.kindLabel} {firstMeta.letter}
              </span>
              <span className="text-xs font-bold text-content tabular-nums">
                Round {roundProgress.completedRounds}/{roundProgress.totalRounds}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowGroupRestPresets((prev) => !prev)}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold tabular-nums transition-all',
                showGroupRestPresets
                  ? 'bg-amber-500 border-amber-500 text-zinc-950'
                  : 'bg-surface border-amber-500/30 text-amber-400 hover:bg-amber-500/15',
              )}
            >
              <span aria-hidden="true">⏱</span>
              <span>{firstMeta.sharedRestSeconds}s round rest</span>
            </button>
          </div>
          {showGroupRestPresets && (
            <div className="grid grid-cols-6 gap-1">
              {REST_TIMER_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    handleUpdateGroupRestTimer(firstMeta.groupId, preset);
                    setShowGroupRestPresets(false);
                  }}
                  className={cn(
                    'h-7 rounded-lg border text-[11px] font-bold tabular-nums transition-all',
                    firstMeta.sharedRestSeconds === preset
                      ? 'bg-amber-500 border-amber-500 text-zinc-950'
                      : 'bg-surface border-content/10 text-muted hover:text-content',
                  )}
                >
                  {preset}s
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {block.exercises.map((exercise) => {
        const exIndex = exercises.findIndex((e) => e.id === exercise.id);
        const supersetMeta = supersetMap.get(exercise.id) ?? null;
        const isSupersettedWithNext =
          exIndex < exercises.length - 1 &&
          Boolean(supersetMeta) &&
          exercise.supersetId === exercises[exIndex + 1].supersetId;
        const isSupersettedWithPrev =
          exIndex > 0 &&
          Boolean(supersetMeta) &&
          exercise.supersetId === exercises[exIndex - 1].supersetId;

        return (
          <DraggableExerciseItem
            key={exercise.id}
            exercise={exercise}
            index={exIndex}
            isExpanded={!!expandedExercises[exercise.id]}
            onToggle={toggleExercise}
            onSetToggle={handleToggleSet}
            onSetUpdate={handleUpdateSet}
            onSetDelete={handleDeleteSet}
            onSetAdd={handleAddSet}
            onUpdateRestTimer={handleUpdateRestTimer}
            onUpdateTrackingMode={handleUpdateTrackingMode}
            onGenerateWarmup={handleGenerateWarmup}
            onOpenNotes={handleOpenNotes}
            onOpenTechnique={handleOpenTechnique}
            onOpenSwap={handleOpenSwap}
            onOpenPlateCalc={handleOpenPlateCalc}
            onOpenChart={(e, ex) => {
              e.stopPropagation();
              setChartConfig({ isOpen: true, exercise: ex });
            }}
            onToggleSuperset={handleToggleSuperset}
            isSupersettedWithNext={isSupersettedWithNext}
            isSupersettedWithPrev={isSupersettedWithPrev}
            supersetMeta={supersetMeta}
            isSupersetNextUp={activeSupersetFocusId === exercise.id}
            settings={settings}
            dragControls={controls}
            isDeloadDay={isDeloadDay}
            muscleReadiness={muscleReadinessMap?.[exercise.id] ?? null}
            livePRSetMap={livePRMapsByExercise?.[exercise.id]}
            onRemoveExercise={onRemoveExercise}
          />
        );
      })}
    </Reorder.Item>
  );
}
