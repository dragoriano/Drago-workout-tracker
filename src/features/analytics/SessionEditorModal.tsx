import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  Dumbbell,
  Edit2,
  Plus,
  Save,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import type { EffortScale, Exercise, Set, WorkoutSession } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { cn } from '../../utils/cn';
import { FREESTYLE_PROGRAM_ID } from '../../utils/customExercises';
import { recalculateSessionMetrics } from '../../utils/sessionExport';
import {
  getNextSetType,
  getSetType,
  RIR_OPTIONS,
  rirToRpe,
  RPE_OPTIONS,
  rpeToRir,
} from '../../utils/strength';
import { generateId } from '../../utils/uuid';

interface SessionEditorModalProps {
  isOpen: boolean;
  session: WorkoutSession | null;
  allSessions: WorkoutSession[];
  unit: string;
  effortScale?: EffortScale;
  onClose: () => void;
}

function toDateTimeLocalValue(ts: number): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function cloneSessionForEdit(session: WorkoutSession): WorkoutSession {
  return {
    ...session,
    PRs: (session.PRs || []).map((pr) => ({ ...pr })),
    exercisesSnapshot: (session.exercisesSnapshot || []).map((ex) => ({
      ...ex,
      sets: (ex.sets || []).map((s) => ({ ...s })),
      history: (ex.history || []).map((h) => ({
        ...h,
        sets: (h.sets || []).map((s) => ({ ...s })),
      })),
    })),
  };
}

export function SessionEditorModal({
  isOpen,
  session,
  allSessions,
  unit,
  effortScale = 'rpe',
  onClose,
}: SessionEditorModalProps) {
  const [draft, setDraft] = useState<WorkoutSession | null>(null);
  const [dateTimeInput, setDateTimeInput] = useState('');
  const [durationMinutesInput, setDurationMinutesInput] = useState('0');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen || !session) return;
    const cloned = cloneSessionForEdit(session);
    setDraft(cloned);
    setDateTimeInput(toDateTimeLocalValue(cloned.date));
    setDurationMinutesInput(String(Math.max(0, Math.round((cloned.duration || 0) / 60))));
    setErrorMessage(null);
    setIsSaving(false);
    setIsDeleting(false);
  }, [isOpen, session]);

  const previewMetrics = useMemo(() => {
    if (!draft) return null;
    return recalculateSessionMetrics(draft, allSessions);
  }, [draft, allSessions]);

  if (!session || !draft) return null;

  const isBusy = isSaving || isDeleting;
  const isFreestyle = draft.programId === FREESTYLE_PROGRAM_ID;
  const showWorkoutTitle = isFreestyle || draft.workoutName !== undefined;

  const updateExerciseSets = (exerciseId: string, updater: (sets: Set[]) => Set[]) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercisesSnapshot: (prev.exercisesSnapshot || []).map((ex: Exercise) =>
          ex.id === exerciseId ? { ...ex, sets: updater(ex.sets || []) } : ex,
        ),
      };
    });
  };

  const handleSetFieldChange = (
    exerciseId: string,
    setId: string,
    field: keyof Set,
    value: Set[keyof Set],
  ) => {
    updateExerciseSets(exerciseId, (sets) =>
      sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)),
    );
  };

  const handleToggleSetCompleted = (exerciseId: string, setId: string) => {
    updateExerciseSets(exerciseId, (sets) =>
      sets.map((s) => (s.id === setId ? { ...s, completed: !s.completed } : s)),
    );
  };

  const handleDeleteSet = (exerciseId: string, setId: string) => {
    updateExerciseSets(exerciseId, (sets) => sets.filter((s) => s.id !== setId));
  };

  const handleAddSet = (exerciseId: string) => {
    updateExerciseSets(exerciseId, (sets) => {
      const lastWorking = [...sets].reverse().find((s) => getSetType(s) !== 'warmup');
      const fallback = lastWorking ?? sets[sets.length - 1];
      const newSet: Set = {
        id: generateId(),
        weight: fallback?.weight ?? 0,
        reps: fallback?.reps ?? 8,
        completed: true,
        setType: 'working',
      };
      return [...sets, newSet];
    });
  };

  const handleRemoveExercise = (exerciseId: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercisesSnapshot: (prev.exercisesSnapshot || []).filter((ex) => ex.id !== exerciseId),
      };
    });
  };

  const handleDateChange = (raw: string) => {
    setDateTimeInput(raw);
    setErrorMessage(null);
    const parsed = new Date(raw).getTime();
    if (raw && !isNaN(parsed)) {
      setDraft((prev) => (prev ? { ...prev, date: parsed } : prev));
    }
  };

  const handleDurationChange = (raw: string) => {
    setDurationMinutesInput(raw);
    const parsed = Number(raw);
    if (raw !== '' && Number.isFinite(parsed) && parsed >= 0) {
      setDraft((prev) => (prev ? { ...prev, duration: Math.round(parsed) * 60 } : prev));
    } else if (raw === '') {
      setDraft((prev) => (prev ? { ...prev, duration: 0 } : prev));
    }
  };

  const handleSave = async () => {
    const parsedDate = new Date(dateTimeInput).getTime();
    if (!dateTimeInput || isNaN(parsedDate)) {
      setErrorMessage('Please enter a valid workout date and time.');
      return;
    }

    const parsedMinutes = durationMinutesInput.trim() === '' ? 0 : Number(durationMinutesInput);
    if (!Number.isFinite(parsedMinutes) || parsedMinutes < 0) {
      setErrorMessage('Duration must be 0 or more minutes.');
      return;
    }

    const trimmedTitle = draft.workoutName?.trim();
    const preparedDraft: WorkoutSession = {
      ...draft,
      date: parsedDate,
      duration: Math.round(parsedMinutes) * 60,
      ...(showWorkoutTitle
        ? {
            workoutName: trimmedTitle || (isFreestyle ? 'Quick Workout' : undefined),
          }
        : {}),
    };

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const updated = recalculateSessionMetrics(preparedDraft, allSessions);
      await useAppStore.getState().saveSession(updated);
      onClose();
    } catch (err) {
      console.error('Failed to save edited session:', err);
      setErrorMessage('Could not save session changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this workout session? This cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);
    try {
      await useAppStore.getState().deleteSession(session.id);
      await useAppStore.getState().syncAutoGoals();
      onClose();
    } catch (err) {
      console.error('Failed to delete session:', err);
      setErrorMessage('Could not delete session. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-page/75 backdrop-blur-sm sm:items-center">
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="w-full max-w-lg rounded-t-3xl bg-card sm:rounded-3xl max-h-[92dvh] flex flex-col border border-content/10 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 pb-3 border-b border-content/5 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-500/15 text-primary-400">
                  <Edit2 size={17} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-content truncate">Edit Session</h2>
                  <p className="text-xs text-muted truncate">
                    Update sets, timing, or remove exercises
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isBusy}
                aria-label="Close session editor"
                className="rounded-full bg-page/10 dark:bg-content/10 p-2 text-content hover:bg-page/20 shrink-0 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {/* Live Metric Preview Strip */}
            {previewMetrics && (
              <div className="grid grid-cols-2 gap-2 px-4 sm:px-5 py-2.5 bg-surface/60 border-b border-content/5 shrink-0">
                <div className="flex items-center justify-center gap-2 rounded-xl bg-page/25 px-3 py-1.5">
                  <Dumbbell size={14} className="text-primary-400 shrink-0" />
                  <span className="text-xs font-bold text-muted">Volume:</span>
                  <span className="text-xs font-black text-content tabular-nums">
                    {previewMetrics.totalVolume.toLocaleString()} {unit}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-2 rounded-xl bg-page/25 px-3 py-1.5">
                  <Trophy size={14} className="text-amber-400 shrink-0" />
                  <span className="text-xs font-bold text-muted">PRs:</span>
                  <span className="text-xs font-black text-content tabular-nums">
                    {previewMetrics.PRs.length}
                  </span>
                </div>
              </div>
            )}

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {errorMessage && (
                <div className="rounded-xl bg-red-500/15 border border-red-500/30 px-3 py-2 text-xs font-bold text-red-400">
                  {errorMessage}
                </div>
              )}

              {/* Session Metadata */}
              <div className="rounded-2xl bg-surface border border-content/5 p-3.5 space-y-3">
                {showWorkoutTitle && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                      Workout Title
                    </label>
                    <input
                      type="text"
                      value={draft.workoutName ?? ''}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev ? { ...prev, workoutName: e.target.value } : prev,
                        )
                      }
                      placeholder={isFreestyle ? 'Quick Workout' : 'Workout Title'}
                      className="w-full min-w-0 rounded-xl bg-page border border-content/10 px-3 py-2 text-sm font-bold text-content outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_115px] gap-3">
                  <div className="min-w-0">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                      Date &amp; Time
                    </label>
                    <input
                      type="datetime-local"
                      value={dateTimeInput}
                      onChange={(e) => handleDateChange(e.target.value)}
                      className="w-full min-w-0 rounded-xl bg-page border border-content/10 px-3 py-2 text-sm font-bold text-content outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div className="min-w-0">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                      Duration (min)
                    </label>
                    <div className="relative flex items-center">
                      <Clock size={14} className="absolute left-3 text-muted pointer-events-none" />
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={durationMinutesInput}
                        onChange={(e) => handleDurationChange(e.target.value)}
                        className="w-full min-w-0 rounded-xl bg-page border border-content/10 pl-8 pr-3 py-2 text-sm font-bold text-content outline-none focus:ring-2 focus:ring-primary-500 tabular-nums"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Exercises */}
              {(draft.exercisesSnapshot || []).length === 0 ? (
                <div className="rounded-2xl bg-surface border border-content/5 p-6 text-center text-sm text-muted">
                  No exercises in this session.
                </div>
              ) : (
                <div className="space-y-3">
                  {(draft.exercisesSnapshot || []).map((ex) => {
                    let workingOrdinal = 0;

                    return (
                      <div
                        key={ex.id}
                        className="rounded-2xl bg-surface border border-content/5 p-3 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-bold text-content truncate">
                            {ex.name.replace(/_/g, ' ')}
                          </h3>
                          <button
                            type="button"
                            onClick={() => handleRemoveExercise(ex.id)}
                            aria-label={`Remove ${ex.name}`}
                            title="Remove exercise"
                            className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 border border-red-500/20 px-2 py-1 text-[11px] font-bold text-red-400 hover:bg-red-500/20 transition-colors shrink-0"
                          >
                            <Trash2 size={12} />
                            <span>Remove</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-[34px_1fr_1fr_52px_34px_26px] items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                          <span className="text-center">Set</span>
                          <span className="text-center">{unit}</span>
                          <span className="text-center">Reps</span>
                          <span className="text-center">{effortScale.toUpperCase()}</span>
                          <span className="text-center">✓</span>
                          <span />
                        </div>

                        <div className="grid gap-1.5">
                          {(ex.sets || []).map((set) => {
                            const setType = getSetType(set);
                            const warmup = setType === 'warmup';
                            if (!warmup) workingOrdinal++;

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

                            const rirValue = set.rpe === undefined ? undefined : rpeToRir(set.rpe);
                            const rirOptions =
                              rirValue !== undefined && !RIR_OPTIONS.some((v) => v === rirValue)
                                ? [...RIR_OPTIONS, rirValue].sort((a, b) => b - a)
                                : [...RIR_OPTIONS];
                            const rpeOptions =
                              set.rpe !== undefined && !RPE_OPTIONS.some((v) => v === set.rpe)
                                ? [...RPE_OPTIONS, set.rpe].sort((a, b) => a - b)
                                : [...RPE_OPTIONS];

                            const effortToneClass =
                              set.rpe === undefined
                                ? 'text-muted/60'
                                : set.rpe >= 9.5
                                  ? 'text-red-400'
                                  : set.rpe >= 8.5
                                    ? 'text-amber-400'
                                    : 'text-emerald-400';

                            return (
                              <div
                                key={set.id}
                                className={cn(
                                  'grid grid-cols-[34px_1fr_1fr_52px_34px_26px] items-center gap-1.5 rounded-xl p-1 min-w-0 w-full',
                                  set.completed
                                    ? warmup
                                      ? 'bg-sky-900/10'
                                      : 'bg-emerald-900/10'
                                    : 'bg-transparent',
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSetFieldChange(
                                      ex.id,
                                      set.id,
                                      'setType',
                                      getNextSetType(set.setType),
                                    )
                                  }
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
                                  step="any"
                                  min={0}
                                  inputMode="decimal"
                                  aria-label={`Weight (${unit})`}
                                  value={set.weight === 0 ? '' : set.weight}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const parsed = raw === '' ? 0 : Number(raw);
                                    if (Number.isFinite(parsed)) {
                                      handleSetFieldChange(
                                        ex.id,
                                        set.id,
                                        'weight',
                                        Math.max(0, parsed),
                                      );
                                    }
                                  }}
                                  placeholder="0"
                                  className={cn(
                                    'h-10 w-full min-w-0 rounded-xl bg-page text-center text-sm font-bold outline-none tabular-nums',
                                    warmup && 'opacity-75',
                                    set.completed && (warmup ? 'text-sky-400' : 'text-emerald-400'),
                                  )}
                                />

                                <input
                                  type="number"
                                  min={0}
                                  inputMode="numeric"
                                  aria-label="Reps"
                                  value={set.reps === 0 ? '' : set.reps}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const parsed = raw === '' ? 0 : Math.round(Number(raw));
                                    if (Number.isFinite(parsed)) {
                                      handleSetFieldChange(
                                        ex.id,
                                        set.id,
                                        'reps',
                                        Math.max(0, parsed),
                                      );
                                    }
                                  }}
                                  placeholder="0"
                                  className={cn(
                                    'h-10 w-full min-w-0 rounded-xl bg-page text-center text-sm font-bold outline-none tabular-nums',
                                    warmup && 'opacity-75',
                                    set.completed && (warmup ? 'text-sky-400' : 'text-emerald-400'),
                                  )}
                                />

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
                                        handleSetFieldChange(ex.id, set.id, 'rpe', undefined);
                                      } else {
                                        const parsed = Number(raw);
                                        handleSetFieldChange(
                                          ex.id,
                                          set.id,
                                          'rpe',
                                          effortScale === 'rir' ? rirToRpe(parsed) : parsed,
                                        );
                                      }
                                    }}
                                    className={cn(
                                      'h-10 w-full min-w-0 rounded-xl bg-page text-center text-xs font-bold outline-none cursor-pointer px-0.5 appearance-none',
                                      effortToneClass,
                                    )}
                                  >
                                    <option value="" className="bg-card text-content">
                                      —
                                    </option>
                                    {effortScale === 'rir'
                                      ? rirOptions.map((opt) => (
                                          <option
                                            key={opt}
                                            value={String(opt)}
                                            className="bg-card text-content"
                                          >
                                            {opt}
                                          </option>
                                        ))
                                      : rpeOptions.map((opt) => (
                                          <option
                                            key={opt}
                                            value={String(opt)}
                                            className="bg-card text-content"
                                          >
                                            {opt}
                                          </option>
                                        ))}
                                  </select>
                                )}

                                <div className="flex justify-center">
                                  <button
                                    type="button"
                                    aria-label={
                                      set.completed ? 'Mark set incomplete' : 'Mark set completed'
                                    }
                                    onClick={() => handleToggleSetCompleted(ex.id, set.id)}
                                    className={cn(
                                      'flex h-8 w-8 items-center justify-center rounded-lg border-2 transition-colors',
                                      set.completed
                                        ? warmup
                                          ? 'border-sky-500 bg-sky-500 text-content'
                                          : 'border-emerald-500 bg-emerald-500 text-content'
                                        : 'border-content/20 bg-transparent',
                                    )}
                                  >
                                    {set.completed && <CheckCircle2 size={16} />}
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  aria-label="Delete set"
                                  onClick={() => handleDeleteSet(ex.id, set.id)}
                                  className="flex h-7 w-7 items-center justify-center text-muted hover:text-red-500 transition-colors"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddSet(ex.id)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-page/40 border border-content/5 py-2 text-xs font-bold text-primary-400 hover:bg-page/60 transition-colors"
                        >
                          <Plus size={14} />
                          <span>Add Set</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between gap-2 p-4 sm:p-5 border-t border-content/5 bg-card shrink-0">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-500/10 border border-red-500/25 px-3 py-2.5 text-xs font-bold text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 shrink-0"
              >
                <Trash2 size={14} />
                <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
              </button>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isBusy}
                  className="rounded-xl bg-surface border border-content/10 px-3.5 py-2.5 text-xs font-bold text-muted hover:text-content transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isBusy}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-primary-600 shadow-lg shadow-primary-500/25 transition-colors disabled:opacity-50"
                >
                  <Save size={14} />
                  <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
