import React, { useMemo, useState } from 'react';
import { X, ArrowRightLeft, Youtube, Sparkles, History } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  EXERCISE_DATABASE,
  getExerciseMuscleGroups,
  getExerciseMetadata,
} from '../../data/exercises';
import type { ExerciseEquipment } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { mergeExerciseCatalog } from '../../utils/customExercises';
import {
  findSmartEquipmentSwaps,
  SWAP_EQUIPMENT_FILTERS,
} from '../../utils/exerciseTechnique';
import { AutocompleteInput } from './AutocompleteInput';
import { cn } from '../../utils/cn';

interface SwapModalProps {
  isOpen: boolean;
  exerciseName: string;
  muscleGroup?: string[];
  primaryMuscle?: string;
  secondaryMuscles?: string[];
  onSwap: (newName: string, newMuscleGroups?: string[], primary?: string, secondary?: string[]) => void;
  onClose: () => void;
}

export function SwapModal({
  isOpen,
  exerciseName,
  muscleGroup = [],
  primaryMuscle,
  secondaryMuscles = [],
  onSwap,
  onClose,
}: SwapModalProps) {
  const customExercises = useAppStore((s) => s.customExercises);
  const sessions = useAppStore((s) => s.sessions);
  const settings = useAppStore((s) => s.settings);
  const [searchQuery, setSearchQuery] = useState('');
  const [equipmentFilter, setEquipmentFilter] = useState<ExerciseEquipment | 'All'>('All');

  const unit = settings?.weightUnit || 'kg';

  const initialGroups = Array.isArray(muscleGroup) && muscleGroup.length > 0
    ? muscleGroup
    : (typeof muscleGroup === 'string' && muscleGroup ? [muscleGroup] : []);

  const safeMuscleGroups = initialGroups.length > 0
    ? initialGroups
    : getExerciseMuscleGroups(exerciseName);

  const catalog = useMemo(
    () => mergeExerciseCatalog(EXERCISE_DATABASE, customExercises),
    [customExercises],
  );

  const recommendations = useMemo(
    () =>
      findSmartEquipmentSwaps(
        {
          name: exerciseName,
          primaryMuscle,
          secondaryMuscles,
          muscleGroups: safeMuscleGroups,
        },
        catalog,
        {
          equipmentFilter,
          sessions,
          customExercises,
          weightUnit: unit,
          limit: 24,
        },
      ),
    [
      exerciseName,
      primaryMuscle,
      secondaryMuscles,
      safeMuscleGroups,
      catalog,
      equipmentFilter,
      sessions,
      customExercises,
      unit,
    ],
  );

  const resolveAndSwap = (name: string) => {
    const customMatch = customExercises.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (customMatch) {
      onSwap(
        customMatch.name,
        customMatch.muscleGroups,
        customMatch.primaryMuscle,
        customMatch.secondaryMuscles,
      );
      return;
    }
    const meta = getExerciseMetadata(name);
    onSwap(name, meta?.muscleGroups, meta?.primaryMuscle, meta?.secondaryMuscles);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-page/80 px-4 py-12 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="liquid-glass-strong w-full max-w-[460px] overflow-hidden rounded-3xl flex flex-col max-h-[84dvh]"
          >
            <div className="flex items-center justify-between border-b border-content/5 px-6 py-4 shrink-0">
              <div>
                <h3 className="font-bold text-content text-lg">Smart Swap Exercise</h3>
                <p className="text-[11px] font-semibold text-muted">
                  Preserves target muscles &amp; Smart Coach history
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close swap modal"
                className="rounded-full bg-page/5 dark:bg-content/5 p-2 text-muted hover:bg-page/10 dark:bg-content/10 hover:text-content transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-3.5 border-b border-content/5 shrink-0 bg-content/[0.02]">
              <p className="text-[10px] text-muted uppercase font-bold tracking-wider mb-0.5">
                Current
              </p>
              <p className="text-sm font-bold text-content truncate">{exerciseName}</p>
              {(primaryMuscle || secondaryMuscles.length > 0) ? (
                <p className="text-[11px] font-medium mt-1">
                  {primaryMuscle && (
                    <span className="text-primary-700 dark:text-primary-400 font-semibold">
                      Primary: {primaryMuscle}
                    </span>
                  )}
                  {secondaryMuscles.length > 0 && (
                    <>
                      <span className="mx-1.5 opacity-25 text-content">•</span>
                      <span className="text-amber-800 dark:text-amber-400">
                        Sec: {secondaryMuscles.join(', ')}
                      </span>
                    </>
                  )}
                </p>
              ) : (
                safeMuscleGroups.length > 0 && (
                  <p className="text-xs text-primary-700 dark:text-primary-400 font-medium mt-1">
                    {safeMuscleGroups.join(', ')}
                  </p>
                )
              )}
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-4 space-y-3.5 min-w-0">
              <AutocompleteInput
                value={searchQuery}
                onChange={setSearchQuery}
                onSelect={(ex) =>
                  onSwap(ex.name, ex.muscleGroups, ex.primaryMuscle, ex.secondaryMuscles)
                }
                placeholder="Search any exercise..."
              />

              {/* Equipment Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {SWAP_EQUIPMENT_FILTERS.map((eq) => {
                  const active = equipmentFilter === eq;
                  return (
                    <button
                      key={eq}
                      type="button"
                      onClick={() => setEquipmentFilter(eq)}
                      className={cn(
                        'whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold border transition-colors cursor-pointer min-h-[32px]',
                        active
                          ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                          : 'bg-surface/70 text-muted border-content/10 hover:text-content',
                      )}
                    >
                      {eq}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted uppercase font-bold tracking-wider truncate">
                  {safeMuscleGroups.length > 0
                    ? `Matches for ${safeMuscleGroups.slice(0, 2).join(', ')}`
                    : 'Equipment Alternatives'}
                </p>
                <span className="text-[10px] font-semibold text-muted tabular-nums shrink-0">
                  {recommendations.length} options
                </span>
              </div>

              {recommendations.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 min-w-0">
                  {recommendations.map((rec) => (
                    <div
                      key={rec.name}
                      className="flex items-center justify-between gap-2 w-full min-w-0 rounded-2xl border border-content/10 bg-page/25 px-3 py-2.5 hover:border-primary-500/35 transition-colors group"
                    >
                      <button
                        type="button"
                        onClick={() => resolveAndSwap(rec.name)}
                        className="flex-1 text-left min-w-0 overflow-hidden cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-content group-hover:text-primary-700 dark:group-hover:text-primary-300 truncate">
                            {rec.name}
                          </span>
                          {rec.isCustom && (
                            <span className="shrink-0 rounded bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.5 text-[9px] font-black uppercase text-sky-700 dark:text-sky-400">
                              Custom
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                          <span className="rounded-md bg-content/10 px-1.5 py-0.5 text-muted">
                            {rec.equipment}
                          </span>
                          <span
                            className={cn(
                              'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 border',
                              rec.matchReason === 'Exact Match'
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                                : 'bg-sky-500/12 border-sky-500/25 text-sky-700 dark:text-sky-400',
                            )}
                          >
                            {rec.matchReason === 'Exact Match' && <Sparkles size={9} />}
                            {rec.matchReason}
                          </span>
                          {rec.lastBestLabel && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/12 border border-amber-500/25 px-1.5 py-0.5 text-amber-800 dark:text-amber-300 tabular-nums">
                              <History size={9} />
                              Last: {rec.lastBestLabel}
                            </span>
                          )}
                        </div>
                      </button>

                      <div className="flex items-center gap-1.5 ml-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(
                              `https://www.youtube.com/results?search_query=how+to+do+${encodeURIComponent(rec.name)}+exercise`,
                              '_blank',
                            );
                          }}
                          className="text-red-500/70 hover:text-red-500 transition-colors p-1.5 cursor-pointer"
                          title="Watch Tutorial"
                          aria-label={`Watch tutorial for ${rec.name}`}
                        >
                          <Youtube size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => resolveAndSwap(rec.name)}
                          className="rounded-xl bg-primary-500/12 p-2 text-primary-700 dark:text-primary-400 hover:bg-primary-500/20 transition-colors cursor-pointer"
                          title="Swap"
                          aria-label={`Swap to ${rec.name}`}
                        >
                          <ArrowRightLeft size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted py-4 text-center">
                  No exercises matched this equipment filter for the current muscle group. Try another chip or search above.
                </p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
