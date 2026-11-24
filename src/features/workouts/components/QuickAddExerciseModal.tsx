import { useEffect, useState } from 'react';
import { Dumbbell, Plus, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { AutocompleteInput } from '../../../components/ui/AutocompleteInput';
import type { ExerciseTrackingMode } from '../../../types';
import { getExerciseMetadata } from '../../../data/exercises';
import { useAppStore } from '../../../store/useAppStore';
import type { CatalogExerciseItem } from '../../../utils/customExercises';
import {
  EXERCISE_TRACKING_MODES,
  inferTrackingModeFromName,
} from '../../../utils/exerciseModes';
import type { MuscleRecoveryStatus } from '../../../utils/muscleRecovery';
import { cn } from '../../../utils/cn';
import { CustomExerciseModal } from './CustomExerciseModal';

interface QuickAddExerciseModalProps {
  isOpen: boolean;
  onClose: () => void;
  readyMuscles: MuscleRecoveryStatus[];
  onAddExercise: (
    meta: CatalogExerciseItem,
    setsCount: number,
    repsOrDuration: number,
    trackingMode?: ExerciseTrackingMode,
  ) => void;
}

export function QuickAddExerciseModal({
  isOpen,
  onClose,
  readyMuscles,
  onAddExercise,
}: QuickAddExerciseModalProps) {
  const customExercises = useAppStore((s) => s.customExercises);
  const [query, setQuery] = useState('');
  const [selectedMeta, setSelectedMeta] = useState<CatalogExerciseItem | null>(null);
  const [filterMuscle, setFilterMuscle] = useState('');
  const [trackingMode, setTrackingMode] = useState<ExerciseTrackingMode>('weight_reps');
  const [setsInput, setSetsInput] = useState('3');
  const [repsInput, setRepsInput] = useState('10');
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [pendingCustomName, setPendingCustomName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedMeta(null);
      setFilterMuscle('');
      setTrackingMode('weight_reps');
      setSetsInput('3');
      setRepsInput('10');
    }
  }, [isOpen]);

  const sortedMuscles = [...readyMuscles].sort((a, b) => b.recoveryPercent - a.recoveryPercent);
  const trimmedName = query.trim();

  const resolveExerciseItem = (): CatalogExerciseItem | null => {
    if (!trimmedName) return null;
    if (selectedMeta && selectedMeta.name.toLowerCase() === trimmedName.toLowerCase()) {
      return selectedMeta;
    }

    const customMatch = customExercises.find(
      (c) => c.name.toLowerCase() === trimmedName.toLowerCase(),
    );
    if (customMatch) {
      return {
        name: customMatch.name,
        primaryMuscle: customMatch.primaryMuscle,
        secondaryMuscles: customMatch.secondaryMuscles,
        muscleGroups: customMatch.muscleGroups,
        isCustom: true,
        customId: customMatch.id,
        equipment: customMatch.equipment,
        trackingMode: customMatch.trackingMode,
        defaultRestTimer: customMatch.defaultRestTimer,
        notes: customMatch.notes,
      };
    }

    const builtIn = getExerciseMetadata(trimmedName);
    if (builtIn) return builtIn;

    return {
      name: trimmedName,
      primaryMuscle: filterMuscle || '',
      secondaryMuscles: [],
      muscleGroups: filterMuscle ? [filterMuscle] : [],
    };
  };

  const handleConfirmAdd = () => {
    const item = resolveExerciseItem();
    if (!item) return;
    const setsCount = Math.max(1, Math.min(12, Number(setsInput) || 3));
    const maxTarget = trackingMode === 'timed' ? 1800 : 100;
    const targetVal = Math.max(
      1,
      Math.min(maxTarget, Number(repsInput) || (trackingMode === 'timed' ? 45 : 10)),
    );
    onAddExercise(item, setsCount, targetVal, trackingMode);
    onClose();
  };

  const handleModeSelect = (nextMode: ExerciseTrackingMode) => {
    setTrackingMode(nextMode);
    if (nextMode === 'timed' && repsInput === '10') {
      setRepsInput('45');
    } else if (nextMode !== 'timed' && repsInput === '45') {
      setRepsInput('10');
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-page/75 backdrop-blur-sm sm:items-center">
            <motion.div
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md rounded-t-3xl bg-card p-5 sm:rounded-3xl border border-content/10 shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                    <Dumbbell size={18} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-content">Add Exercise</h3>
                    <p className="text-xs text-muted">Pick a fresh muscle or search exercises</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full bg-page/10 dark:bg-content/10 p-2 text-content hover:bg-page/20"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Ready muscle quick-filter chips */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">
                  Muscle Readiness Filter
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {sortedMuscles.map((m) => {
                    const active = filterMuscle === m.muscle;
                    const dotColor =
                      m.readiness === 'ready'
                        ? 'bg-emerald-400'
                        : m.readiness === 'recovering'
                          ? 'bg-amber-400'
                          : 'bg-red-400';
                    return (
                      <button
                        key={m.muscle}
                        type="button"
                        onClick={() => setFilterMuscle(active ? '' : m.muscle)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border transition-all',
                          active
                            ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                            : 'bg-surface text-content border-content/10 hover:border-primary-500/40',
                        )}
                      >
                        <span className={cn('h-2 w-2 rounded-full', dotColor)} />
                        <span>{m.muscle}</span>
                        <span className={cn('text-[10px] tabular-nums', active ? 'text-white/80' : 'text-muted')}>
                          {m.recoveryPercent}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Search built-in + custom exercises */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1.5">
                  Exercise
                </label>
                <AutocompleteInput
                  value={query}
                  onChange={(val) => {
                    setQuery(val);
                    setSelectedMeta(null);
                  }}
                  onSelect={(ex) => {
                    setSelectedMeta(ex);
                    const inferred =
                      ex.trackingMode ?? inferTrackingModeFromName(ex.name, ex.equipment);
                    handleModeSelect(inferred);
                  }}
                  onCreateCustom={(initial) => {
                    setPendingCustomName(initial);
                    setIsCustomOpen(true);
                  }}
                  filterByMuscle={filterMuscle || undefined}
                  placeholder={
                    filterMuscle
                      ? `Search or pick ${filterMuscle} exercise...`
                      : 'Search built-in or custom exercises...'
                  }
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1.5">
                  Tracking Mode
                </label>
                <div className="flex items-center gap-1 rounded-xl bg-surface border border-content/10 p-1">
                  {EXERCISE_TRACKING_MODES.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => handleModeSelect(m.value)}
                      className={cn(
                        'flex-1 rounded-lg py-1.5 text-[11px] font-bold transition-all',
                        trackingMode === m.value
                          ? 'bg-primary-500 text-white shadow-sm'
                          : 'text-muted hover:text-content',
                      )}
                    >
                      {m.shortLabel}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
                    Sets
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={setsInput}
                    onChange={(e) => setSetsInput(e.target.value)}
                    className="w-full rounded-xl bg-page/10 dark:bg-content/5 px-3 py-2.5 text-center text-sm font-bold text-content outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
                    {trackingMode === 'timed' ? 'Target Sec' : 'Target Reps'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={trackingMode === 'timed' ? 1800 : 100}
                    value={repsInput}
                    onChange={(e) => setRepsInput(e.target.value)}
                    className="w-full rounded-xl bg-page/10 dark:bg-content/5 px-3 py-2.5 text-center text-sm font-bold text-content outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={!trimmedName}
                onClick={handleConfirmAdd}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary-500 py-3.5 text-sm font-black text-content shadow-lg shadow-primary-500/30 hover:bg-primary-400 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                <Plus size={16} /> Add to Workout
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <CustomExerciseModal
        isOpen={isCustomOpen}
        onClose={() => setIsCustomOpen(false)}
        initialName={pendingCustomName}
        onCreated={(ce) => {
          onAddExercise(
            {
              name: ce.name,
              primaryMuscle: ce.primaryMuscle,
              secondaryMuscles: ce.secondaryMuscles,
              muscleGroups: ce.muscleGroups,
              isCustom: true,
              customId: ce.id,
              equipment: ce.equipment,
              trackingMode: ce.trackingMode,
              defaultRestTimer: ce.defaultRestTimer,
              notes: ce.notes,
            },
            Math.max(1, Math.min(12, Number(setsInput) || 3)),
            Math.max(
              1,
              Math.min(
                ce.trackingMode === 'timed' ? 1800 : 100,
                Number(repsInput) || (ce.trackingMode === 'timed' ? 45 : 10),
              ),
            ),
            ce.trackingMode,
          );
          setIsCustomOpen(false);
          onClose();
        }}
      />
    </>
  );
}
