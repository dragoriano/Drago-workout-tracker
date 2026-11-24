import React from 'react';
import { Clock, Dumbbell, Edit2, Link, Trash2, Unlink, X, Youtube } from 'lucide-react';
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion';
import { Exercise, ExerciseTrackingMode, WorkoutDay } from '../../../types';
import { cn } from '../../../utils/cn';
import {
  EXERCISE_TRACKING_MODES,
  formatDurationCompact,
  getExerciseTrackingMode,
  inferTrackingModeFromName,
} from '../../../utils/exerciseModes';
import { computeSupersetMap, type SupersetMeta } from '../../../utils/supersets';
import { AutocompleteInput } from '../../../components/ui/AutocompleteInput';

export interface ExerciseFormData {
  name: string;
  muscleGroup: string[];
  primaryMuscle: string;
  secondaryMuscles: string[];
  sets: string;
  reps: string;
  duration: string;
  restTimer: string;
  trackingMode: ExerciseTrackingMode;
  muscleGroups?: string[];
}

export const emptyExerciseForm: ExerciseFormData = {
  name: '',
  muscleGroup: [],
  primaryMuscle: '',
  secondaryMuscles: [],
  sets: '3',
  reps: '10',
  duration: '45',
  restTimer: '90',
  trackingMode: 'weight_reps',
};

export const MUSCLE_GROUP_OPTIONS = [
  'Upper Chest',
  'Mid Chest',
  'Lower Chest',
  'Upper Back',
  'Lats',
  'Erector Spinae',
  'Front Delt',
  'Side Delt',
  'Rear Delt',
  'Biceps',
  'Triceps',
  'Brachioradialis',
  'Forearm Flexors',
  'Forearm Extensors',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Abdominals',
  'Obliques',
  'Transverse/Anti-Rotation',
];

interface DraggableExerciseCardProps {
  key?: React.Key;
  ex: Exercise;
  i: number;
  day: WorkoutDay;
  supersetMeta?: SupersetMeta | null;
  handleToggleSuperset: (index: number) => Promise<void>;
  openEditExercise: (ex: Exercise) => void;
  handleDeleteExercise: (id: string) => Promise<void>;
}

export function DraggableExerciseCard({
  ex,
  i,
  day,
  supersetMeta,
  handleToggleSuperset,
  openEditExercise,
  handleDeleteExercise,
}: DraggableExerciseCardProps) {
  const controls = useDragControls();
  const [isPressing, setIsPressing] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const mode = getExerciseTrackingMode(ex);

  const isSupersettedWithPrev =
    i > 0 && Boolean(supersetMeta) && ex.supersetId === day.exercises[i - 1].supersetId;
  const isSupersettedWithNext =
    i < day.exercises.length - 1 &&
    Boolean(supersetMeta) &&
    ex.supersetId === day.exercises[i + 1].supersetId;

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;

    setIsPressing(true);
    timerRef.current = setTimeout(() => {
      controls.start(e);
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(50);
        } catch {}
      }
    }, 400);
  };

  const clearTimer = () => {
    setIsPressing(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const volumeBadgeText =
    mode === 'timed'
      ? `${ex.sets.length}S × ${formatDurationCompact(ex.sets[0]?.duration ?? 45)}`
      : `${ex.sets.length}S × ${ex.sets[0]?.reps ?? 0}R`;

  return (
    <Reorder.Item
      value={ex}
      dragListener={false}
      dragControls={controls}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      style={{ position: 'relative' }}
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerUp={clearTimer}
        onPointerCancel={clearTimer}
        onPointerLeave={clearTimer}
        className={cn(
          'absolute top-2 right-2 z-20 cursor-grab active:cursor-grabbing p-2 transition-all rounded-lg select-none touch-none',
          isPressing
            ? 'bg-primary-500 text-white scale-110 shadow-lg shadow-primary-500/20'
            : 'text-muted/30 hover:text-primary-400',
        )}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <circle cx="5" cy="4" r="1.2" fill="currentColor" />
          <circle cx="5" cy="8" r="1.2" fill="currentColor" />
          <circle cx="5" cy="12" r="1.2" fill="currentColor" />
          <circle cx="11" cy="4" r="1.2" fill="currentColor" />
          <circle cx="11" cy="8" r="1.2" fill="currentColor" />
          <circle cx="11" cy="12" r="1.2" fill="currentColor" />
        </svg>
      </div>

      {i > 0 && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={() => handleToggleSuperset(i)}
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider backdrop-blur-md transition-all border',
              isSupersettedWithPrev
                ? 'bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/30'
                : 'bg-surface/80 border-content/10 text-muted hover:border-primary-400',
            )}
          >
            {isSupersettedWithPrev ? <Unlink size={10} /> : <Link size={10} />}
            {isSupersettedWithPrev ? `${supersetMeta?.kindLabel || 'Superset'}` : 'Link'}
          </button>
        </div>
      )}

      {isSupersettedWithNext && (
        <div className="absolute left-[23px] top-10 bottom-[-13px] w-[2px] bg-amber-500/30 z-[5]" />
      )}

      <div
        className={cn(
          'flex flex-col gap-3 rounded-2xl px-4 py-4 relative z-[6] border transition-all',
          supersetMeta
            ? 'bg-amber-500/[0.03] border-amber-500/20 shadow-[0_0_15px_-5px_rgba(245,158,11,0.1)]'
            : 'bg-page/5 dark:bg-content/5 border-transparent hover:border-white/5',
          isPressing && 'border-primary-500/50 shadow-xl shadow-primary-500/10 scale-[1.02]',
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black',
              supersetMeta
                ? 'bg-amber-500/20 text-amber-500 shadow-inner'
                : 'bg-primary-500/20 text-primary-400 shadow-inner',
            )}
          >
            {supersetMeta ? supersetMeta.label : <Dumbbell size={16} />}
          </div>

          <div className="flex-1 min-w-0 pr-10">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h4 className="text-sm font-bold text-content uppercase tracking-tight leading-tight break-words">
                {ex.name}
              </h4>
              {mode !== 'weight_reps' && (
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider',
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
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(
                    `https://www.youtube.com/results?search_query=how+to+do+${encodeURIComponent(ex.name)}+exercise`,
                    '_blank',
                  );
                }}
                className="text-red-500/40 hover:text-red-500 transition-colors flex-shrink-0"
              >
                <Youtube size={14} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span
                className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded',
                  supersetMeta ? 'bg-amber-500/10 text-amber-500' : 'bg-primary-500/10 text-primary-400',
                )}
              >
                {volumeBadgeText}
              </span>
              <span className="text-[10px] text-muted flex items-center gap-1">
                <Clock size={10} /> {ex.restTimerConfig}s
              </span>
              {ex.primaryMuscle && (
                <span className="text-[10px] text-primary-500/60 font-medium">· {ex.primaryMuscle}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-1 border-t border-content/5 pt-2">
          <button
            onClick={() => openEditExercise(ex)}
            className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium text-muted hover:text-content transition-colors rounded-lg hover:bg-white/5"
          >
            <Edit2 size={13} /> Edit
          </button>
          <button
            onClick={() => handleDeleteExercise(ex.id)}
            className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium text-muted hover:text-red-500 transition-colors rounded-lg hover:bg-red-500/10"
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>
    </Reorder.Item>
  );
}

interface ExerciseManagerModalProps {
  isOpen: boolean;
  day: WorkoutDay | null;
  exerciseForm: ExerciseFormData;
  editingExercise: Exercise | null;
  onClose: () => void;
  onReorderExercises: (newExercises: Exercise[]) => Promise<void>;
  onToggleSuperset: (index: number) => Promise<void>;
  onOpenEditExercise: (ex: Exercise) => void;
  onDeleteExercise: (id: string) => Promise<void>;
  onUpdateForm: React.Dispatch<React.SetStateAction<ExerciseFormData>>;
  onCancelEdit: () => void;
  onSaveExercise: () => Promise<void>;
}

export function ExerciseManagerModal({
  isOpen,
  day,
  exerciseForm,
  editingExercise,
  onClose,
  onReorderExercises,
  onToggleSuperset,
  onOpenEditExercise,
  onDeleteExercise,
  onUpdateForm,
  onCancelEdit,
  onSaveExercise,
}: ExerciseManagerModalProps) {
  const supersetMap = React.useMemo(
    () => (day ? computeSupersetMap(day.exercises) : new Map()),
    [day],
  );

  return (
    <AnimatePresence>
      {isOpen && day && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-page/60 backdrop-blur-sm sm:items-center">
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="liquid-glass-strong w-full max-w-[460px] rounded-t-[28px] h-[94dvh] flex flex-col pb-safe"
          >
            <div className="flex items-center justify-between p-5 pb-3 border-b border-content/5 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-content ">{day.name}</h2>
                <p className="text-xs text-muted mt-0.5">{day.exercises.length} exercises</p>
              </div>
              <button
                onClick={onClose}
                className="rounded-full bg-page/10 dark:bg-content/10 p-2 text-content hover:bg-page/20 dark:bg-content/20"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 pt-2">
              {day.exercises.length === 0 && (
                <p className="text-center text-sm text-muted py-6">No exercises yet. Add one below.</p>
              )}
              <Reorder.Group
                axis="y"
                values={day.exercises}
                onReorder={onReorderExercises}
                className="space-y-3"
              >
                {day.exercises.map((ex, i) => (
                  <DraggableExerciseCard
                    key={ex.id}
                    ex={ex}
                    i={i}
                    day={day}
                    supersetMeta={supersetMap.get(ex.id) ?? null}
                    handleToggleSuperset={onToggleSuperset}
                    openEditExercise={onOpenEditExercise}
                    handleDeleteExercise={onDeleteExercise}
                  />
                ))}
              </Reorder.Group>
            </div>

            <div className="p-4 pt-2 border-t border-content/5 shrink-0 space-y-2 bg-card rounded-b-3xl">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
                  {editingExercise ? `Editing: ${editingExercise.name}` : 'Add Exercise & Muscle Group'}
                </p>
                {!editingExercise && (
                  <span className="text-[9px] bg-primary-500/20 text-primary-400 px-2 py-0.5 rounded-full font-bold">
                    SMART SELECT
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <AutocompleteInput
                    value={exerciseForm.name}
                    onChange={(val) => onUpdateForm((f) => ({ ...f, name: val }))}
                    onSelect={(ex) =>
                      onUpdateForm((f) => ({
                        ...f,
                        name: ex.name,
                        muscleGroup: ex.muscleGroups,
                        primaryMuscle: ex.primaryMuscle,
                        secondaryMuscles: ex.secondaryMuscles,
                        trackingMode:
                          ex.trackingMode ?? inferTrackingModeFromName(ex.name, ex.equipment),
                        restTimer: ex.defaultRestTimer ? String(ex.defaultRestTimer) : f.restTimer,
                      }))
                    }
                    placeholder="Exercise name (e.g. Bench Press)"
                    filterByMuscle={exerciseForm.primaryMuscle}
                  />
                </div>
                <div className="col-span-2 flex items-center gap-1 rounded-xl bg-surface border border-content/10 p-1">
                  {EXERCISE_TRACKING_MODES.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => onUpdateForm((f) => ({ ...f, trackingMode: m.value }))}
                      className={cn(
                        'flex-1 rounded-lg py-1 text-[10px] font-bold transition-all',
                        exerciseForm.trackingMode === m.value
                          ? 'bg-primary-500 text-white shadow-sm'
                          : 'text-muted hover:text-content',
                      )}
                    >
                      {m.shortLabel}
                    </button>
                  ))}
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-[9px] font-bold text-muted uppercase tracking-wider block">
                    Muscle Groups
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-2 custom-scrollbar">
                    {MUSCLE_GROUP_OPTIONS.map((g) => {
                      const isPrimary = exerciseForm.primaryMuscle === g;
                      const isSecondary = exerciseForm.secondaryMuscles.includes(g);
                      const isSelected = isPrimary || isSecondary;

                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => {
                            onUpdateForm((f) => {
                              if (f.primaryMuscle === g) {
                                const nextPrimary = f.secondaryMuscles[0] || '';
                                const remainingSecondary = f.secondaryMuscles.slice(1);
                                return {
                                  ...f,
                                  primaryMuscle: nextPrimary,
                                  secondaryMuscles: remainingSecondary,
                                  muscleGroup: [nextPrimary, ...remainingSecondary].filter(Boolean),
                                };
                              }
                              if (f.secondaryMuscles.includes(g)) {
                                const nextSecondary = f.secondaryMuscles.filter((m) => m !== g);
                                return {
                                  ...f,
                                  secondaryMuscles: nextSecondary,
                                  muscleGroup: [f.primaryMuscle, ...nextSecondary].filter(Boolean),
                                };
                              }
                              if (!f.primaryMuscle) {
                                return {
                                  ...f,
                                  primaryMuscle: g,
                                  muscleGroup: [g, ...f.secondaryMuscles],
                                };
                              }
                              return {
                                ...f,
                                secondaryMuscles: [...f.secondaryMuscles, g],
                                muscleGroup: [f.primaryMuscle, ...f.secondaryMuscles, g],
                              };
                            });
                          }}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-semibold transition-all border relative overflow-hidden',
                            isPrimary && 'bg-primary-500 text-white border-primary-500 shadow-sm shadow-primary-500/40',
                            isSecondary && 'bg-amber-500/20 text-amber-400 border-amber-500/50',
                            !isSelected &&
                              'bg-page/5 dark:bg-content/5 text-muted border-transparent hover:bg-page/10 dark:bg-content/10',
                          )}
                        >
                          <span className="flex items-center gap-1.5">
                            {g}
                            {isPrimary && (
                              <span className="text-[8px] bg-page/20 dark:bg-content/20 px-1 rounded uppercase tracking-tighter">
                                1st
                              </span>
                            )}
                            {isSecondary && (
                              <span className="text-[8px] bg-amber-500/20 px-1 rounded uppercase tracking-tighter">
                                2nd+
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase tracking-wider block h-4">
                    Sets
                  </label>
                  <input
                    type="number"
                    value={exerciseForm.sets}
                    onChange={(e) => onUpdateForm((f) => ({ ...f, sets: e.target.value }))}
                    className="w-full rounded-xl bg-page/5 dark:bg-content/5 px-3 py-2 text-sm text-content outline-none focus:ring-2 focus:ring-primary-500 transition-all text-center"
                  />
                </div>
                {exerciseForm.trackingMode === 'timed' ? (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted uppercase tracking-wider block h-4">
                      Sec
                    </label>
                    <input
                      type="number"
                      value={exerciseForm.duration}
                      onChange={(e) => onUpdateForm((f) => ({ ...f, duration: e.target.value }))}
                      className="w-full rounded-xl bg-page/5 dark:bg-content/5 px-3 py-2 text-sm text-content outline-none focus:ring-2 focus:ring-primary-500 transition-all text-center"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted uppercase tracking-wider block h-4">
                      Reps
                    </label>
                    <input
                      type="number"
                      value={exerciseForm.reps}
                      onChange={(e) => onUpdateForm((f) => ({ ...f, reps: e.target.value }))}
                      className="w-full rounded-xl bg-page/5 dark:bg-content/5 px-3 py-2 text-sm text-content outline-none focus:ring-2 focus:ring-primary-500 transition-all text-center"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-1 h-4">
                    <Clock size={9} className="shrink-0" />
                    <span>Rest (s)</span>
                  </label>
                  <input
                    type="number"
                    value={exerciseForm.restTimer}
                    onChange={(e) => onUpdateForm((f) => ({ ...f, restTimer: e.target.value }))}
                    className="w-full rounded-xl bg-page/5 dark:bg-content/5 px-3 py-2 text-sm text-content outline-none focus:ring-2 focus:ring-primary-500 transition-all text-center"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                {editingExercise && (
                  <button
                    onClick={onCancelEdit}
                    className="flex-1 rounded-2xl border border-black/10 dark:border-content/10 py-3 text-sm font-bold text-muted hover:text-content transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={onSaveExercise}
                  disabled={!exerciseForm.name.trim()}
                  className="flex-1 rounded-2xl bg-primary-500 py-3 text-sm font-black text-white shadow-md shadow-primary-500/40 transition-all hover:bg-primary-400 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                >
                  {editingExercise ? 'Save Changes' : '+ Add'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
