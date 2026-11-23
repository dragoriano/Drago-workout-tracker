import React, { useEffect, useState } from 'react';
import { BookOpen, Clock, Dumbbell, Edit2, Plus, Search, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { CustomExercise, ExerciseEquipment } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';
import {
  EXERCISE_EQUIPMENT_OPTIONS,
  normalizeCustomExerciseInput,
} from '../../../utils/customExercises';
import { cn } from '../../../utils/cn';
import { MUSCLE_GROUP_OPTIONS } from './ExerciseManagerModal';

interface CustomExerciseModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialName?: string;
  onCreated?: (exercise: CustomExercise) => void;
}

export function CustomExerciseModal({
  isOpen,
  onClose,
  initialName = '',
  onCreated,
}: CustomExerciseModalProps) {
  const customExercises = useAppStore((s) => s.customExercises);
  const saveCustomExercise = useAppStore((s) => s.saveCustomExercise);
  const deleteCustomExercise = useAppStore((s) => s.deleteCustomExercise);

  const [tab, setTab] = useState<'library' | 'form'>('library');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCreatedAt, setEditingCreatedAt] = useState<number | undefined>(undefined);

  const [name, setName] = useState('');
  const [equipment, setEquipment] = useState<ExerciseEquipment>('Barbell');
  const [primaryMuscle, setPrimaryMuscle] = useState('');
  const [secondaryMuscles, setSecondaryMuscles] = useState<string[]>([]);
  const [defaultRestTimer, setDefaultRestTimer] = useState('90');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = (seedName = '') => {
    setEditingId(null);
    setEditingCreatedAt(undefined);
    setName(seedName);
    setEquipment('Barbell');
    setPrimaryMuscle('');
    setSecondaryMuscles([]);
    setDefaultRestTimer('90');
    setNotes('');
  };

  useEffect(() => {
    if (!isOpen) return;
    setSearch('');
    if (initialName.trim() || onCreated) {
      resetForm(initialName.trim());
      setTab('form');
    } else {
      resetForm('');
      setTab('library');
    }
  }, [isOpen, initialName, onCreated]);

  const handleEdit = (ce: CustomExercise) => {
    setEditingId(ce.id);
    setEditingCreatedAt(ce.createdAt);
    setName(ce.name);
    setEquipment(ce.equipment || 'Barbell');
    setPrimaryMuscle(ce.primaryMuscle);
    setSecondaryMuscles(ce.secondaryMuscles || []);
    setDefaultRestTimer(String(ce.defaultRestTimer || 90));
    setNotes(ce.notes || '');
    setTab('form');
  };

  const toggleMuscle = (muscle: string) => {
    if (primaryMuscle === muscle) {
      const nextPrimary = secondaryMuscles[0] || '';
      setPrimaryMuscle(nextPrimary);
      setSecondaryMuscles(secondaryMuscles.slice(1));
      return;
    }
    if (secondaryMuscles.includes(muscle)) {
      setSecondaryMuscles(secondaryMuscles.filter((m) => m !== muscle));
      return;
    }
    if (!primaryMuscle) {
      setPrimaryMuscle(muscle);
      return;
    }
    setSecondaryMuscles([...secondaryMuscles, muscle]);
  };

  const canSave = name.trim().length > 0 && primaryMuscle !== '';

  const handleSave = async () => {
    if (!canSave || isSaving) return;
    setIsSaving(true);
    try {
      const normalized = normalizeCustomExerciseInput({
        id: editingId || undefined,
        name,
        primaryMuscle,
        secondaryMuscles,
        equipment,
        defaultRestTimer: Number(defaultRestTimer) || 90,
        notes,
        createdAt: editingCreatedAt,
      });
      await saveCustomExercise(normalized);
      if (onCreated) {
        onCreated(normalized);
        onClose();
        return;
      }
      resetForm();
      setTab('library');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredLibrary = customExercises.filter((ce) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      ce.name.toLowerCase().includes(q) ||
      ce.primaryMuscle.toLowerCase().includes(q) ||
      (ce.equipment || '').toLowerCase().includes(q)
    );
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-page/75 backdrop-blur-sm sm:items-center">
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="w-full max-w-md rounded-t-3xl bg-card sm:rounded-3xl max-h-[92dvh] flex flex-col border border-content/10 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 pb-3 border-b border-content/5 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
                  <BookOpen size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-content">Custom Exercises</h2>
                  <p className="text-xs text-muted">{customExercises.length} saved in library</p>
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

            {/* Tabs */}
            <div className="px-5 pt-3 shrink-0">
              <div className="flex gap-1.5 rounded-xl bg-surface p-1 border border-content/5">
                <button
                  type="button"
                  onClick={() => setTab('library')}
                  className={cn(
                    'flex-1 rounded-lg py-1.5 text-xs font-bold transition-all',
                    tab === 'library'
                      ? 'bg-primary-500 text-white shadow-sm'
                      : 'text-muted hover:text-content',
                  )}
                >
                  My Library ({customExercises.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!editingId && tab !== 'form') resetForm(initialName.trim());
                    setTab('form');
                  }}
                  className={cn(
                    'flex-1 rounded-lg py-1.5 text-xs font-bold transition-all',
                    tab === 'form'
                      ? 'bg-primary-500 text-white shadow-sm'
                      : 'text-muted hover:text-content',
                  )}
                >
                  {editingId ? 'Edit Exercise' : '+ Create New'}
                </button>
              </div>
            </div>

            {tab === 'library' ? (
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {customExercises.length > 0 && (
                  <div className="relative">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Filter your exercises..."
                      className="w-full rounded-xl bg-page/5 dark:bg-content/5 pl-9 pr-3 py-2.5 text-sm text-content placeholder-zinc-600 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  </div>
                )}

                {filteredLibrary.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Dumbbell size={32} className="text-muted opacity-30 mb-3" />
                    <p className="text-sm font-bold text-content">
                      {customExercises.length === 0
                        ? 'No custom exercises yet'
                        : 'No matching custom exercises'}
                    </p>
                    <p className="text-xs text-muted mt-1 max-w-[240px]">
                      Add specialty machines, cables, or weighted variations and use them anywhere in the app.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        resetForm('');
                        setTab('form');
                      }}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-sky-500/15 border border-sky-500/30 px-4 py-2 text-xs font-bold text-sky-400 hover:bg-sky-500/25 transition-colors"
                    >
                      <Plus size={14} /> Create Custom Exercise
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredLibrary.map((ce) => (
                      <div
                        key={ce.id}
                        className="rounded-2xl bg-surface border border-content/5 p-3.5 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-content truncate">{ce.name}</h3>
                            {ce.equipment && (
                              <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase text-sky-400">
                                {ce.equipment}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
                            <span className="text-primary-400 font-semibold">{ce.primaryMuscle}</span>
                            {ce.secondaryMuscles.length > 0 && (
                              <span>· {ce.secondaryMuscles.join(', ')}</span>
                            )}
                            {ce.defaultRestTimer && (
                              <span className="inline-flex items-center gap-1">
                                · <Clock size={10} /> {ce.defaultRestTimer}s
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEdit(ce)}
                            className="p-2 text-muted hover:text-content rounded-lg hover:bg-content/5 transition-colors"
                            title="Edit Exercise"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Delete "${ce.name}" from your custom library?`)) {
                                deleteCustomExercise(ce.id);
                              }
                            }}
                            className="p-2 text-muted hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors"
                            title="Delete Exercise"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1.5">
                    Exercise Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Pendulum Squat, Chest-Supported T-Bar"
                    className="w-full rounded-xl bg-page/5 dark:bg-content/5 px-3.5 py-2.5 text-sm text-content placeholder-zinc-600 outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1.5">
                    Equipment
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {EXERCISE_EQUIPMENT_OPTIONS.map((eq) => (
                      <button
                        key={eq}
                        type="button"
                        onClick={() => setEquipment(eq)}
                        className={cn(
                          'rounded-full px-3 py-1 text-xs font-bold border transition-all',
                          equipment === eq
                            ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                            : 'bg-surface text-muted border-content/5 hover:text-content',
                        )}
                      >
                        {eq}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1.5">
                    Target Muscles * (1st = Primary, 2nd+ = Secondary)
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                    {MUSCLE_GROUP_OPTIONS.map((g) => {
                      const isPrimary = primaryMuscle === g;
                      const isSecondary = secondaryMuscles.includes(g);
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => toggleMuscle(g)}
                          className={cn(
                            'px-2.5 py-1 rounded-full text-xs font-semibold transition-all border',
                            isPrimary &&
                              'bg-primary-500 text-content border-primary-500 shadow-sm',
                            isSecondary &&
                              'bg-amber-500/20 text-amber-400 border-amber-500/40',
                            !isPrimary &&
                              !isSecondary &&
                              'bg-page/5 dark:bg-content/5 text-muted border-transparent hover:bg-page/10',
                          )}
                        >
                          {g}
                          {isPrimary ? ' (1st)' : isSecondary ? ' (2nd)' : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1.5">
                      Default Rest (sec)
                    </label>
                    <input
                      type="number"
                      min={15}
                      max={600}
                      value={defaultRestTimer}
                      onChange={(e) => setDefaultRestTimer(e.target.value)}
                      className="w-full rounded-xl bg-page/5 dark:bg-content/5 px-3 py-2 text-sm text-content text-center font-bold outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1.5">
                      Notes (Optional)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Seat pin #4, cues..."
                      className="w-full rounded-xl bg-page/5 dark:bg-content/5 px-3 py-2 text-sm text-content placeholder-zinc-600 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                {!canSave && (
                  <p className="text-[11px] font-medium text-amber-400/90 text-center">
                    Enter an exercise name and pick at least 1 primary muscle group.
                  </p>
                )}

                <div className="flex gap-2 pt-1">
                  {editingId && (
                    <button
                      type="button"
                      onClick={() => {
                        resetForm();
                        setTab('library');
                      }}
                      className="flex-1 rounded-2xl border border-content/10 py-3 text-sm font-bold text-muted hover:text-content transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!canSave || isSaving}
                    onClick={handleSave}
                    className="flex-1 rounded-2xl bg-primary-500 py-3 text-sm font-black text-content shadow-md shadow-primary-500/30 hover:bg-primary-400 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {editingId
                      ? 'Save Changes'
                      : onCreated
                        ? 'Create & Add'
                        : 'Save to Library'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
