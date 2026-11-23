import React, { useState } from 'react';
import { X, ArrowRightLeft, Youtube } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MUSCLE_REGION_MAPPING, getExerciseMuscleGroups, getExerciseMetadata } from '../../data/exercises';
import { useAppStore } from '../../store/useAppStore';
import { AutocompleteInput } from './AutocompleteInput';

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
  onClose 
}: SwapModalProps) {
  const customExercises = useAppStore((s) => s.customExercises);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Defensive check for legacy data or unexpected types
  const initialGroups = Array.isArray(muscleGroup) && muscleGroup.length > 0 
    ? muscleGroup 
    : (typeof muscleGroup === 'string' && muscleGroup ? [muscleGroup] : []);

  // Fallback: if no muscle groups, look them up in the database by name
  const safeMuscleGroups = initialGroups.length > 0 
    ? initialGroups 
    : getExerciseMuscleGroups(exerciseName);

  const safeGroupsLower = safeMuscleGroups.map((g) => g.toLowerCase());
  const customMatches = customExercises.filter(
    (ce) =>
      ce.name.toLowerCase() !== exerciseName.toLowerCase() &&
      (safeGroupsLower.length === 0 ||
        safeGroupsLower.includes(ce.primaryMuscle.toLowerCase()) ||
        ce.muscleGroups.some((g) => safeGroupsLower.includes(g.toLowerCase()))),
  );
  const customNamesSet = new Set(customMatches.map((c) => c.name.toLowerCase()));

  // Combine custom recommendations + built-in recommendations (case-insensitive dedupe)
  const builtInRecs = safeMuscleGroups.flatMap(group => {
    const key = Object.keys(MUSCLE_REGION_MAPPING).find(k => k.toLowerCase() === group.toLowerCase());
    return key ? (MUSCLE_REGION_MAPPING as Record<string, string[]>)[key] : [];
  });
  const seenNames = new Set<string>([exerciseName.toLowerCase()]);
  const recommendations: string[] = [];
  for (const name of [...customMatches.map((c) => c.name), ...builtInRecs]) {
    const lower = name.toLowerCase();
    if (seenNames.has(lower)) continue;
    seenNames.add(lower);
    recommendations.push(name);
  }

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
            className="w-full max-w-sm overflow-hidden rounded-3xl bg-card shadow-2xl ring-1 ring-content/10 flex flex-col max-h-[80vh]"
          >
            <div className="flex items-center justify-between border-b border-content/5 px-6 py-4 shrink-0">
              <h3 className="font-bold text-content text-lg">Swap Exercise</h3>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-page/5 dark:bg-content/5 p-2 text-muted hover:bg-page/10 dark:bg-content/10 hover:text-content transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="px-6 py-4 border-b border-content/5 shrink-0 bg-content/[0.02]">
              <p className="text-xs text-muted uppercase font-bold tracking-wider mb-1">Current</p>
              <p className="text-sm font-semibold text-content ">{exerciseName}</p>
              {(primaryMuscle || secondaryMuscles.length > 0) ? (
                <p className="text-[10px] font-medium mt-1">
                  {primaryMuscle && <span className="text-primary-400">Primary: {primaryMuscle}</span>}
                  {secondaryMuscles.length > 0 && (
                    <>
                      <span className="mx-1 opacity-20 text-content ">•</span>
                      <span className="text-amber-400/80">Sec: {secondaryMuscles.join(', ')}</span>
                    </>
                  )}
                </p>
              ) : muscleGroup.length > 0 && (
                <p className="text-xs text-primary-400 font-medium mt-1">
                  {muscleGroup.join(', ')}
                </p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="mb-4">
                <AutocompleteInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onSelect={(ex) => onSwap(ex.name, ex.muscleGroups, ex.primaryMuscle, ex.secondaryMuscles)}
                  placeholder="Search any exercise..."
                />
              </div>

              <p className="text-xs text-muted uppercase font-bold tracking-wider mb-3">
                {safeMuscleGroups.length > 0 ? `Recommended for ${safeMuscleGroups.join(', ')}` : 'No Recommendations Available'}
              </p>
              
              {recommendations.length > 0 ? (
                <div className="grid gap-2">
                  {recommendations.map((rec) => (
                    <div
                      key={rec}
                      className="flex items-center justify-between w-full rounded-xl bg-page/5 dark:bg-content/5 px-4 py-3 hover:bg-page/10 dark:bg-content/10 transition-colors group"
                    >
                      <button
                        onClick={() => resolveAndSwap(rec)}
                        className="flex-1 text-left text-sm font-medium text-content group-hover:text-primary-300 transition-colors flex items-center gap-2 min-w-0"
                      >
                        <span className="truncate">{rec}</span>
                        {customNamesSet.has(rec.toLowerCase()) && (
                          <span className="shrink-0 rounded bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.5 text-[9px] font-black uppercase text-sky-400">
                            Custom
                          </span>
                        )}
                      </button>
                      <div className="flex items-center gap-3 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`https://www.youtube.com/results?search_query=how+to+do+${encodeURIComponent(rec)}+exercise`, '_blank');
                          }}
                          className="text-red-500/60 hover:text-red-500 transition-colors p-1"
                          title="Watch Tutorial"
                        >
                          <Youtube size={16}/>
                        </button>
                        <button
                          onClick={() => resolveAndSwap(rec)}
                          className="text-muted hover:text-primary-400 transition-colors p-1"
                          title="Swap"
                        >
                          <ArrowRightLeft size={14}/>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted mt-2">
                  {!muscleGroup 
                    ? "This exercise doesn't have a specific muscle group assigned, so we can't recommend swaps." 
                    : "No specific alternative recommendations found for this muscle group."}
                </p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
