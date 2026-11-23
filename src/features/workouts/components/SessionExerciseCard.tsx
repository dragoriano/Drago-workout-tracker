import React from 'react';
import {
  AlignLeft,
  ArrowRightLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Link,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  TrendingUp,
  Unlink,
  Youtube,
} from 'lucide-react';
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion';
import { AppSettings, Exercise, Set } from '../../../types';
import { cn } from '../../../utils/cn';

export interface WorkoutBlockData {
  id: string;
  exercises: Exercise[];
}

interface ExerciseItemProps {
  key?: React.Key;
  exercise: Exercise;
  index: number;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onSetToggle: (exId: string, setId: string) => void;
  onSetUpdate: (exId: string, setId: string, field: keyof Set, value: number) => void;
  onSetDelete: (exId: string, setId: string) => void;
  onSetAdd: (exId: string) => void;
  onOpenNotes: (e: React.MouseEvent, ex: Exercise) => void;
  onOpenSwap: (e: React.MouseEvent, ex: Exercise) => void;
  onOpenChart: (e: React.MouseEvent, ex: Exercise) => void;
  onToggleSuperset: (index: number) => void;
  isSupersettedWithNext: boolean;
  isSupersettedWithPrev: boolean;
  settings: AppSettings | null;
  isDeloadDay?: boolean;
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
  onOpenNotes,
  onOpenSwap,
  onOpenChart,
  onToggleSuperset,
  isSupersettedWithNext,
  settings,
  isDeloadDay,
  dragControls,
}: ExerciseItemProps) {
  const completedExSets = exercise.sets.filter((s) => s.completed).length;
  const totalExSets = exercise.sets.length;
  const lastSession = exercise.history[exercise.history.length - 1];

  const [isPressing, setIsPressing] = React.useState(false);
  const pressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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

  return (
    <div className="relative w-full min-w-0">
      {isSupersettedWithNext && (
        <div className="absolute left-[34px] top-[60px] bottom-[-16px] w-[2px] bg-amber-500 z-[5]" />
      )}
      <div
        className={cn(
          'rounded-2xl border overflow-hidden transition-all duration-300 relative z-[6] w-full',
          exercise.supersetId ? 'bg-amber-500/5 border-amber-500/30' : 'bg-surface border-content/5',
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
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-bold text-xs',
                      exercise.supersetId
                        ? 'bg-amber-500/20 text-amber-500'
                        : 'bg-primary-500/20 text-primary-400',
                    )}
                  >
                    {index + 1}
                  </div>
                  <h2 className="text-sm font-bold text-content leading-tight">{exercise.name}</h2>
                  {exercise.supersetId && (
                    <span className="text-[9px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded uppercase font-black tracking-tighter">
                      Superset
                    </span>
                  )}
                </div>

                {(exercise.primaryMuscle ||
                  (exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0)) && (
                  <div className="flex flex-wrap items-center gap-x-2 mt-1">
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
              <div className="flex items-center gap-1">
                <p className="text-[10px] text-muted font-bold uppercase tracking-widest">
                  {completedExSets}/{totalExSets} Sets
                </p>
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

              <div className="flex items-center gap-1">
                <button
                  className="text-red-500/60 hover:text-red-500 p-1.5 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(
                      `https://www.youtube.com/results?search_query=how+to+do+${encodeURIComponent(exercise.name)}+exercise`,
                      '_blank',
                    );
                  }}
                  title="Watch Tutorial"
                >
                  <Youtube size={18} />
                </button>

                <button
                  className="text-muted hover:text-content p-1.5 transition-colors"
                  onClick={(e) => onOpenSwap(e, exercise)}
                  title="Swap Exercise"
                >
                  <ArrowRightLeft size={16} />
                </button>

                <button
                  className={cn('p-1.5 transition-colors', exercise.notes ? 'text-primary-400' : 'text-muted')}
                  onClick={(e) => onOpenNotes(e, exercise)}
                  title="Notes"
                >
                  <AlignLeft size={18} />
                </button>

                {index > 0 && (
                  <button
                    className={cn(
                      'p-1.5 transition-colors',
                      exercise.supersetId ? 'text-amber-500' : 'text-muted',
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSuperset(index);
                    }}
                    title={exercise.supersetId ? 'Unlink Superset' : 'Link Superset'}
                  >
                    {exercise.supersetId ? <Unlink size={16} /> : <Link size={16} />}
                  </button>
                )}
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
              {lastSession && lastSession.sets.length > 0 && (
                <div className="mb-4 text-xs">
                  <div className="flex items-center gap-1 text-muted mb-2">
                    <RotateCcw size={14} />
                    <span>Last session:</span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-muted font-medium">
                    {lastSession.sets.map((s, i) => (
                      <span key={i}>
                        Set {i + 1}: {s.weight}
                        {settings?.weightUnit || 'kg'} × {s.reps}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(() => {
                const secondLastSession = exercise.history[exercise.history.length - 2];
                const unit = settings?.weightUnit || 'kg';
                const targetWeight = exercise.sets[0]?.weight || 0;
                const targetReps = exercise.sets[0]?.reps || 8;

                if (isDeloadDay) {
                  return (
                    <div className="mb-4 rounded-xl bg-sky-500/15 border border-sky-500/30 p-3 flex items-start gap-3 w-full min-w-0">
                      <span className="text-sky-400 text-lg">❄️</span>
                      <div>
                        <p className="text-sm font-bold text-sky-300 leading-tight">
                          Deload Day — {targetWeight}
                          {unit} × {targetReps}
                        </p>
                        <p className="text-[10px] font-bold text-sky-500/70 mt-1 uppercase tracking-wider">
                          60% of last session • Focus on form & recovery
                        </p>
                      </div>
                    </div>
                  );
                }

                if (!lastSession) {
                  return (
                    <div className="mb-4 rounded-xl bg-primary-500/10 border border-primary-500/20 p-3 flex items-start gap-3 w-full min-w-0">
                      <Sparkles className="text-primary-400 shrink-0" size={18} />
                      <div>
                        <p className="text-sm font-semibold text-content leading-tight">
                          First session! Aim for {targetReps} reps at {targetWeight}
                          {unit}
                        </p>
                        <p className="text-[10px] font-bold text-muted mt-1 uppercase tracking-wider">
                          First Session · Build the baseline
                        </p>
                      </div>
                    </div>
                  );
                }

                const lastAllCompleted = lastSession.sets.every((s) => s.completed);
                const prevAllCompleted = secondLastSession
                  ? secondLastSession.sets.every((s) => s.completed)
                  : false;

                let consecutiveFails = 0;
                for (let i = exercise.history.length - 1; i >= 0; i--) {
                  if (!exercise.history[i].sets.every((s) => s.completed)) consecutiveFails++;
                  else break;
                }

                if (consecutiveFails >= 2) {
                  return (
                    <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 p-3 flex items-start gap-3 w-full min-w-0">
                      <span className="text-red-400 text-base shrink-0">📉</span>
                      <div>
                        <p className="text-sm font-bold text-red-300 leading-tight">
                          Auto-Deload — {targetWeight}
                          {unit} × {targetReps}
                        </p>
                        <p className="text-[10px] font-bold text-red-500/60 mt-1 uppercase tracking-wider">
                          {consecutiveFails} consecutive fails · Weight reduced{' '}
                          {consecutiveFails >= 3 ? '15' : '10'}%
                        </p>
                      </div>
                    </div>
                  );
                }

                if (!lastAllCompleted && consecutiveFails === 1) {
                  return (
                    <div className="mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 flex items-start gap-3 w-full min-w-0">
                      <span className="text-amber-400 text-base shrink-0">⚡</span>
                      <div>
                        <p className="text-sm font-bold text-amber-300 leading-tight">
                          Try again — {targetWeight}
                          {unit} × {targetReps}
                        </p>
                        <p className="text-[10px] font-bold text-amber-500/60 mt-1 uppercase tracking-wider">
                          1 failed session · Keep the weight, push harder
                        </p>
                      </div>
                    </div>
                  );
                }

                if (lastAllCompleted && prevAllCompleted) {
                  return (
                    <div className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 flex items-start gap-3 w-full min-w-0">
                      <span className="text-emerald-400 text-base shrink-0">🚀</span>
                      <div>
                        <p className="text-sm font-bold text-emerald-300 leading-tight">
                          Overload! Aim for {targetWeight}
                          {unit} × {targetReps}
                        </p>
                        <p className="text-[10px] font-bold text-emerald-500/60 mt-1 uppercase tracking-wider">
                          2 sessions done · +2.5{unit} progressive overload
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="mb-4 rounded-xl bg-primary-500/10 border border-primary-500/20 p-3 flex items-start gap-3 w-full min-w-0">
                    <Sparkles className="text-primary-400 shrink-0" size={18} />
                    <div>
                      <p className="text-sm font-semibold text-content leading-tight">
                        Maintain — {targetWeight}
                        {unit} × {targetReps}
                      </p>
                      <p className="text-[10px] font-bold text-muted mt-1 uppercase tracking-wider">
                        1 success · Hold weight, aim for 2 before overloading
                      </p>
                    </div>
                  </div>
                );
              })()}

              <div className="grid gap-2 mt-4">
                {exercise.sets.map((set, setIndex) => (
                  <div
                    key={set.id}
                    className={cn(
                      'grid grid-cols-[40px_1fr_1fr_40px_32px] items-center gap-2 rounded-xl p-1 transition-colors min-w-0 w-full overflow-hidden',
                      set.completed ? 'bg-emerald-900/10' : 'bg-transparent',
                    )}
                  >
                    <div className="text-center text-sm font-bold text-muted">{setIndex + 1}</div>
                    <input
                      type="number"
                      value={set.weight || ''}
                      onChange={(e) => onSetUpdate(exercise.id, set.id, 'weight', Number(e.target.value))}
                      className={cn(
                        'h-12 w-full rounded-xl bg-page text-center text-lg font-bold outline-none',
                        set.completed && 'text-emerald-400',
                      )}
                      placeholder="0"
                    />
                    <input
                      type="number"
                      value={set.reps || ''}
                      onChange={(e) => onSetUpdate(exercise.id, set.id, 'reps', Number(e.target.value))}
                      className={cn(
                        'h-12 w-full rounded-xl bg-page text-center text-lg font-bold outline-none',
                        set.completed && 'text-emerald-400',
                      )}
                      placeholder="0"
                    />
                    <div className="flex justify-center">
                      <button
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-lg border-2',
                          set.completed ? 'border-emerald-500 bg-emerald-500 text-content' : 'border-content/20 bg-transparent',
                        )}
                        onClick={() => onSetToggle(exercise.id, set.id)}
                      >
                        {set.completed && <CheckCircle2 size={16} />}
                      </button>
                    </div>
                    <button
                      className="flex h-8 w-8 items-center justify-center text-muted hover:text-red-500"
                      onClick={() => onSetDelete(exercise.id, set.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="mt-4 flex w-full items-center justify-center gap-2 py-2 text-sm font-bold text-primary-400"
                onClick={() => onSetAdd(exercise.id)}
              >
                <Plus size={16} /> Add Set
              </button>
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
  toggleExercise: (id: string) => void;
  handleToggleSet: (exId: string, setId: string) => void;
  handleUpdateSet: (exId: string, setId: string, field: keyof Set, value: number) => void;
  handleDeleteSet: (exId: string, setId: string) => void;
  handleAddSet: (exId: string) => void;
  handleOpenNotes: (e: React.MouseEvent, ex: Exercise) => void;
  handleOpenSwap: (e: React.MouseEvent, ex: Exercise) => void;
  setChartConfig: React.Dispatch<React.SetStateAction<{ isOpen: boolean; exercise: Exercise | null }>>;
  handleToggleSuperset: (index: number) => void;
  settings: AppSettings | null;
  isDeloadDay?: boolean;
  onDragStart: () => void;
}

export function WorkoutBlock({
  block,
  exercises,
  expandedExercises,
  toggleExercise,
  handleToggleSet,
  handleUpdateSet,
  handleDeleteSet,
  handleAddSet,
  handleOpenNotes,
  handleOpenSwap,
  setChartConfig,
  handleToggleSuperset,
  settings,
  isDeloadDay,
  onDragStart,
}: WorkoutBlockProps) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={block}
      key={block.id}
      dragListener={false}
      dragControls={controls}
      onDragStart={onDragStart}
      className="grid gap-4 w-full cursor-default"
    >
      {block.exercises.map((exercise) => {
        const exIndex = exercises.findIndex((e) => e.id === exercise.id);
        const isSupersettedWithNext =
          exIndex < exercises.length - 1 &&
          Boolean(exercise.supersetId) &&
          exercise.supersetId === exercises[exIndex + 1].supersetId;
        const isSupersettedWithPrev =
          exIndex > 0 &&
          Boolean(exercise.supersetId) &&
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
            onOpenNotes={handleOpenNotes}
            onOpenSwap={handleOpenSwap}
            onOpenChart={(e, ex) => {
              e.stopPropagation();
              setChartConfig({ isOpen: true, exercise: ex });
            }}
            onToggleSuperset={handleToggleSuperset}
            isSupersettedWithNext={isSupersettedWithNext}
            isSupersettedWithPrev={isSupersettedWithPrev}
            settings={settings}
            dragControls={controls}
            isDeloadDay={isDeloadDay}
          />
        );
      })}
    </Reorder.Item>
  );
}
