import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  ClipboardCheck,
  Save,
  Wind,
  Youtube,
} from 'lucide-react';
import { AppDialog } from './Dialog';
import { Button } from './Button';
import { AnatomicalBodyMap } from './AnatomicalBodyMap';
import type { Exercise } from '../../types';
import { getExerciseMuscleGroups } from '../../data/exercises';
import { getExerciseTechniqueProfile } from '../../utils/exerciseTechnique';

interface ExerciseTechniqueModalProps {
  isOpen: boolean;
  exercise: Exercise | null;
  onClose: () => void;
  onSaveNotes: (exerciseId: string, notes: string) => void;
  onOpenSwap?: (exercise: Exercise) => void;
}

export function ExerciseTechniqueModal({
  isOpen,
  exercise,
  onClose,
  onSaveNotes,
  onOpenSwap,
}: ExerciseTechniqueModalProps) {
  const [notesDraft, setNotesDraft] = useState(exercise?.notes || '');
  const [notesSaved, setNotesSaved] = useState(false);

  const [isLightMode, setIsLightMode] = useState<boolean>(() =>
    typeof document !== 'undefined' ? !document.documentElement.classList.contains('dark') : false,
  );

  useEffect(() => {
    setNotesDraft(exercise?.notes || '');
    setNotesSaved(false);
  }, [exercise?.id, exercise?.notes]);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
    const sync = () => setIsLightMode(!document.documentElement.classList.contains('dark'));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const profile = useMemo(() => {
    if (!exercise) return null;
    const fallbackGroups =
      exercise.muscleGroup && exercise.muscleGroup.length > 0
        ? exercise.muscleGroup
        : getExerciseMuscleGroups(exercise.name);
    return getExerciseTechniqueProfile(
      exercise.name,
      exercise.primaryMuscle,
      exercise.secondaryMuscles || [],
      fallbackGroups,
    );
  }, [exercise]);

  if (!exercise || !profile) return null;

  const handleSaveNotes = () => {
    onSaveNotes(exercise.id, notesDraft.trim());
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 1800);
  };

  return (
    <AppDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={exercise.name}
      description="Technique cues & target muscle map"
      layout="sheet"
      size="md"
    >
      <div className="space-y-4">
        {/* Metadata Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-bold text-sky-700 dark:text-sky-300">
            {profile.equipment}
          </span>
          <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
            {profile.movementPatternLabel}
          </span>
          {profile.primaryBroad && (
            <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/15 px-2.5 py-0.5 text-[11px] font-bold text-red-700 dark:text-red-300">
              Primary: {profile.primaryBroad}
            </span>
          )}
          {profile.secondaryBroad.length > 0 && (
            <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
              Sec: {profile.secondaryBroad.join(', ')}
            </span>
          )}
        </div>

        {/* Anatomical Muscle Target Preview */}
        <div className="rounded-2xl border border-content/10 bg-page/25 p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Targeted Anatomy
            </span>
            <div className="flex items-center gap-2.5 text-[10px] font-bold">
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <span className="h-2 w-2 rounded-full bg-red-500" /> Primary
              </span>
              <span className="flex items-center gap-1 text-amber-800 dark:text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Secondary
              </span>
            </div>
          </div>
          <div className="max-w-[260px] mx-auto">
            <AnatomicalBodyMap
              items={profile.previewRecoveryItems}
              mode="readiness"
              view="both"
              selectedMuscle={profile.primaryBroad}
              onSelectMuscle={() => {}}
              isLightMode={isLightMode}
              hideLegend
            />
          </div>
        </div>

        {/* Setup & Execution Cues */}
        <div className="grid grid-cols-1 gap-2.5">
          <div className="rounded-2xl border border-content/10 bg-page/20 p-3.5">
            <h4 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-sky-700 dark:text-sky-400 mb-2">
              <ClipboardCheck size={14} /> Setup Checklist
            </h4>
            <ul className="space-y-1.5 text-xs text-content leading-relaxed">
              {profile.setupCues.map((cue) => (
                <li key={cue} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                  <span>{cue}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-content/10 bg-page/20 p-3.5">
            <h4 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2">
              <CheckCircle2 size={14} /> Execution Keys
            </h4>
            <ul className="space-y-1.5 text-xs text-content leading-relaxed">
              {profile.executionCues.map((cue) => (
                <li key={cue} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <span>{cue}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="rounded-2xl border border-content/10 bg-page/20 p-3">
              <h4 className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-muted mb-1">
                <Wind size={13} className="text-sky-600 dark:text-sky-400" /> Breathing
              </h4>
              <p className="text-xs text-content leading-snug">{profile.breathingCue}</p>
            </div>
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3">
              <h4 className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-400 mb-1">
                <AlertTriangle size={13} /> Watch Out
              </h4>
              <p className="text-xs text-content leading-snug">{profile.commonMistake}</p>
            </div>
          </div>
        </div>

        {/* Pinned Personal Cues / Notes */}
        <div className="rounded-2xl border border-content/10 bg-page/20 p-3.5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <label
              htmlFor="technique-notes-input"
              className="text-[11px] font-extrabold uppercase tracking-wider text-muted"
            >
              My Setup &amp; Seat Notes
            </label>
            {notesSaved && (
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                Saved
              </span>
            )}
          </div>
          <textarea
            id="technique-notes-input"
            rows={2}
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="e.g. Bench pin #4, seat height 3, pause 1s on chest..."
            className="liquid-input w-full rounded-xl px-3 py-2 text-xs font-medium text-content outline-none focus:border-primary-500"
          />
          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleSaveNotes}
              className="min-h-[34px]"
            >
              <Save size={13} />
              Save Notes
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 pt-1">
          {onOpenSwap && (
            <Button
              type="button"
              variant="primary"
              size="md"
              className="flex-1"
              onClick={() => {
                onClose();
                onOpenSwap(exercise);
              }}
            >
              <ArrowRightLeft size={15} />
              Smart Swap
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="flex-1"
            onClick={() =>
              window.open(
                `https://www.youtube.com/results?search_query=how+to+do+${encodeURIComponent(exercise.name)}+exercise`,
                '_blank',
              )
            }
          >
            <Youtube size={15} className="text-red-500" />
            Tutorial
          </Button>
        </div>
      </div>
    </AppDialog>
  );
}
