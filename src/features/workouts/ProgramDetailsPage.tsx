import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar, Dumbbell, List, Edit2, Play, Share2, Trash2, Plus, Flame, Weight, Snowflake } from 'lucide-react';
import { WorkoutProgram, WorkoutDay, Exercise } from '../../types';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';
import { PromptModal } from '../../components/ui/PromptModal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useAppStore } from '../../store/useAppStore';
import { MesocycleCard } from '../../components/ui/MesocycleCard';
import { getExerciseTrackingMode } from '../../utils/exerciseModes';
import { computeMesocycleProgress } from '../../utils/mesocycle';
import { cleanupOrphanSupersets, toggleSupersetLink } from '../../utils/supersets';
import { generateId } from '../../utils/uuid';
import { PullToRefresh } from '../../components/ui/PullToRefresh';
import {
  emptyExerciseForm,
  ExerciseFormData,
  ExerciseManagerModal,
} from './components/ExerciseManagerModal';

const ProgramShareModal = React.lazy(() =>
  import('./components/ProgramShareModal').then((m) => ({ default: m.ProgramShareModal })),
);

interface ExerciseModalState {
  isOpen: boolean;
  day: WorkoutDay | null;
}

export function ProgramDetailsPage() {
  const { programId } = useParams();
  const navigate = useNavigate();

  const programs = useAppStore(s => s.programs);
  const sessions = useAppStore(s => s.sessions);
  const settings = useAppStore(s => s.settings);
  const isHydrated = useAppStore(s => s.isHydrated);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const program = programs.find(p => p.id === programId) || null;

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const currentDay = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - currentDay);
    start.setHours(0, 0, 0, 0);
    return start;
  });

  const completedDates = React.useMemo(() => {
    return new Set(sessions.map(s => new Date(s.date).toDateString()));
  }, [sessions]);

  // Exercise management modal
  const [exerciseModal, setExerciseModal] = useState<ExerciseModalState>({ isOpen: false, day: null });
  const [exerciseForm, setExerciseForm] = useState<ExerciseFormData>(emptyExerciseForm);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

  // Prompt Modal
  const [promptConfig, setPromptConfig] = useState<{
    isOpen: boolean;
    title: string;
    initialValue: string;
    onConfirm: (val: string) => void;
  } | null>(null);

  // Confirm Modal
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isDestructive: boolean;
    onConfirm: () => void;
  } | null>(null);

  const saveProgram = async (updated: WorkoutProgram) => {
    await useAppStore.getState().saveProgram(updated);
  };

  const storeDeleteProgram = useAppStore((s) => s.deleteProgram);
  
  // ── Program actions ────────────────────────────────────────────────
  const handleDelete = () => {
    if (!programId) return;
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Program',
      message: 'Are you sure you want to delete this program?',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmConfig(null);
        await storeDeleteProgram(programId);
        navigate('/workouts');
      }
    });
  };

  const handleRename = () => {
    if (!program) return;
    setPromptConfig({
      isOpen: true,
      title: 'Rename Program',
      initialValue: program.name,
      onConfirm: async (newName: string) => {
        setPromptConfig(null);
        await saveProgram({ ...program, name: newName, updatedAt: Date.now() });
      }
    });
  };

  const handleGoToToday = () => {
    const now = new Date();
    setSelectedDate(now);
    const currentDay = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - currentDay);
    start.setHours(0, 0, 0, 0);
    setCurrentWeekStart(start);
  };

  // ── Day actions ────────────────────────────────────────────────────
  const handlePrevWeek = () => {
    const s = new Date(currentWeekStart);
    s.setDate(s.getDate() - 7);
    setCurrentWeekStart(s);
  };

  const handleNextWeek = () => {
    const s = new Date(currentWeekStart);
    s.setDate(s.getDate() + 7);
    setCurrentWeekStart(s);
  };

  const handleAddDay = async () => {
    if (!program) return;
    const newDay: WorkoutDay = {
      id: generateId(),
      name: `Day ${program.days.length + 1}`,
      order: program.days.length,
      exercises: [],
    };
    await saveProgram({
      ...program,
      days: [...program.days, newDay],
      updatedAt: Date.now(),
    });
    // Add small feedback
    console.log('[ProgramDetails] Added new day:', newDay.id);
  };

  const handleEditDay = (dayId: string) => {
    const day = program?.days.find(d => d.id === dayId);
    if (!day || !program) return;
    setPromptConfig({
      isOpen: true,
      title: 'Rename Day',
      initialValue: day.name,
      onConfirm: async (newName: string) => {
        setPromptConfig(null);
        await saveProgram({
          ...program,
          days: program.days.map(d => d.id === dayId ? { ...d, name: newName } : d),
          updatedAt: Date.now(),
        });
      }
    });
  };

  const handleDeleteDay = (dayId: string) => {
    if (!program) return;
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Day',
      message: 'Are you sure you want to delete this day? All exercises in this day will also be deleted.',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmConfig(null);
        await saveProgram({
          ...program,
          days: program.days.filter(d => d.id !== dayId),
          updatedAt: Date.now(),
        });
      }
    });
  };

  const handleToggleDeloadDay = async (dayId: string) => {
    if (!program) return;
    const day = program.days.find(d => d.id === dayId);
    if (!day) return;
    await saveProgram({
      ...program,
      days: program.days.map(d =>
        d.id === dayId ? { ...d, isDeloadDay: !d.isDeloadDay } : d
      ),
      updatedAt: Date.now(),
    });
  };

  // ── Exercise modal helpers ─────────────────────────────────────────
  const openManageModal = (day: WorkoutDay) => {
    setExerciseModal({ isOpen: true, day });
    setEditingExercise(null);
    setExerciseForm(emptyExerciseForm);
  };

  const closeExerciseModal = () => {
    setExerciseModal({ isOpen: false, day: null });
    setEditingExercise(null);
    setExerciseForm(emptyExerciseForm);
  };

  const handleReorderExercises = async (newExercises: Exercise[]) => {
    if (!program || !exerciseModal.day) return;
    
    // Check if anything actually changed to avoid redundant saves
    const isSame = JSON.stringify(newExercises.map(e => e.id)) === JSON.stringify(exerciseModal.day.exercises.map(e => e.id));
    if (isSame) return;

    const cleaned = cleanupOrphanSupersets(newExercises);
    const updatedDay: WorkoutDay = {
      ...exerciseModal.day,
      exercises: cleaned
    };

    const updatedProgram: WorkoutProgram = {
      ...program,
      days: program.days.map(d => d.id === updatedDay.id ? updatedDay : d),
      updatedAt: Date.now()
    };

    setExerciseModal(prev => ({ ...prev, day: updatedDay }));
    await useAppStore.getState().saveProgram(updatedProgram);
  };

  const openEditExercise = (ex: Exercise) => {
    setEditingExercise(ex);
    const mode = getExerciseTrackingMode(ex);
    setExerciseForm({
      name: ex.name,
      muscleGroup: ex.muscleGroup ?? [],
      primaryMuscle: ex.primaryMuscle || '',
      secondaryMuscles: ex.secondaryMuscles || [],
      sets: String(ex.sets.length),
      reps: String(ex.sets[0]?.reps ?? 10),
      duration: String(ex.sets[0]?.duration ?? 45),
      restTimer: String(ex.restTimerConfig),
      trackingMode: mode,
    });
  };

  const handleSaveExercise = async () => {
    if (!program || !exerciseModal.day || !exerciseForm.name.trim()) return;

    try {
      // 1. Combine muscles for storage
      const combinedMuscles = Array.from(new Set([
        exerciseForm.primaryMuscle,
        ...exerciseForm.secondaryMuscles,
        ...(exerciseForm.muscleGroup || [])
      ])).filter(Boolean);

      const mode = exerciseForm.trackingMode;
      const parsedDuration = Math.max(5, parseInt(exerciseForm.duration) || 45);
      const parsedReps = Math.max(1, parseInt(exerciseForm.reps) || 10);

      const newExercise: Exercise = {
        id: editingExercise ? editingExercise.id : generateId(),
        name: exerciseForm.name,
        muscleGroup: combinedMuscles,
        primaryMuscle: exerciseForm.primaryMuscle,
        secondaryMuscles: exerciseForm.secondaryMuscles,
        notes: editingExercise ? editingExercise.notes : '',
        supersetId: editingExercise?.supersetId,
        supersetOrder: editingExercise?.supersetOrder,
        trackingMode: mode,
        sets: Array.from({ length: parseInt(exerciseForm.sets) || 1 }).map((_, i) => ({
          id: editingExercise?.sets[i]?.id || generateId(),
          weight: editingExercise?.sets[i]?.weight || 0,
          reps: mode === 'timed' ? 1 : parsedReps,
          ...(mode === 'timed' ? { duration: editingExercise?.sets[i]?.duration ?? parsedDuration } : {}),
          completed: false,
        })),
        history: editingExercise ? editingExercise.history : [],
        restTimerConfig: parseInt(exerciseForm.restTimer) || 90,
        lastUpdated: Date.now(),
      };

      const updatedDay: WorkoutDay = {
        ...exerciseModal.day,
        exercises: editingExercise
          ? exerciseModal.day.exercises.map(e => e.id === newExercise.id ? newExercise : e)
          : [...exerciseModal.day.exercises, newExercise],
      };

      const updatedProgram: WorkoutProgram = {
        ...program,
        days: program.days.map(d => d.id === updatedDay.id ? updatedDay : d),
        updatedAt: Date.now(),
      };

      console.log('[ProgramDetails] Saving exercise:', newExercise.name, 'to day:', updatedDay.name);
      
      // Update states
      setExerciseModal(prev => ({ ...prev, day: updatedDay }));
      
      // Save to persistence
      await useAppStore.getState().saveProgram(updatedProgram);
      
      // Reset form
      setEditingExercise(null);
      setExerciseForm(emptyExerciseForm);
      
      // Optional: Add success toast if available, or just visual feedback by clearing
    } catch (err) {
      console.error('[ProgramDetails] Failed to save exercise:', err);
    }
  };

  const handleDeleteExercise = async (exerciseId: string) => {
    if (!program || !exerciseModal.day) return;

    const updatedDay: WorkoutDay = {
      ...exerciseModal.day,
      exercises: cleanupOrphanSupersets(
        exerciseModal.day.exercises.filter(e => e.id !== exerciseId),
      ),
    };

    const updatedProgram: WorkoutProgram = {
      ...program,
      days: program.days.map(d => d.id === updatedDay.id ? updatedDay : d),
      updatedAt: Date.now(),
    };

    await saveProgram(updatedProgram);
    setExerciseModal(prev => ({ ...prev, day: updatedDay }));
  };

  const handleToggleSuperset = async (index: number) => {
    if (!program || !exerciseModal.day || index === 0) return;
    const day = exerciseModal.day;
    const newExercises = toggleSupersetLink(day.exercises, index, generateId);

    const updatedDay: WorkoutDay = { ...day, exercises: newExercises };
    const updatedProgram: WorkoutProgram = {
      ...program,
      days: program.days.map(d => d.id === updatedDay.id ? updatedDay : d),
      updatedAt: Date.now(),
    };
    await saveProgram(updatedProgram);
    setExerciseModal(prev => ({ ...prev, day: updatedDay }));
  };

  if (!isHydrated) {
    return <div className="p-4 flex justify-center items-center h-full text-muted">Loading...</div>;
  }

  if (!program) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-[100dvh] bg-page text-content gap-4 text-center">
        <p className="text-lg font-bold text-red-500">Workout program not found.</p>
        <button
          onClick={() => navigate('/')}
          className="rounded-xl bg-primary-500 px-6 py-2 font-bold text-white hover:bg-primary-400"
        >
          Go Back Home
        </button>
      </div>
    );
  }

  const today = new Date();
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date(currentWeekStart);
    date.setDate(currentWeekStart.getDate() + i);
    return date;
  });

  const formatMonthYear = (start: Date) => {
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
    const year = end.getFullYear();
    return startMonth === endMonth
      ? `${startMonth} ${start.getDate()} - ${end.getDate()}, ${year}`
      : `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${year}`;
  };

  return (
    <>
      <PullToRefresh onRefresh={async () => { await useAppStore.getState().hydrate(); }} className="min-h-full bg-transparent pb-24 font-sans">
        {/* Header */}
        <div className="liquid-glass-strong sticky top-0 z-10 flex items-center justify-between border-x-0 border-t-0 px-4 pb-3.5 pt-safe">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="liquid-btn-glass flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-content transition-colors cursor-pointer"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="flex flex-1 min-w-0 items-center justify-center px-2">
            <button
              onClick={handleRename}
              className="flex min-w-0 items-center justify-center gap-1.5 px-2 py-2 hover:text-primary-400 transition-colors cursor-pointer"
            >
              <span className="truncate font-extrabold text-lg text-content tracking-tight">{program.name}</span>
              <Edit2 size={15} className="text-muted shrink-0" />
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => setIsShareOpen(true)}
              className="liquid-btn-glass flex h-10 w-10 items-center justify-center rounded-full text-sky-400 transition-colors cursor-pointer"
              title="Share Program"
              aria-label="Share Program"
            >
              <Share2 size={18} />
            </button>
            <button
              onClick={handleDelete}
              className="liquid-btn-danger flex h-10 w-10 items-center justify-center rounded-full transition-colors cursor-pointer"
              title="Delete Program"
              aria-label="Delete Program"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Week calendar */}
        <div className="px-4 pb-6 mt-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={handlePrevWeek} className="liquid-btn-glass flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-content transition-colors cursor-pointer" aria-label="Previous week"><ChevronLeft size={18} /></button>
            <button
              onClick={handleGoToToday}
              className="flex items-center gap-2 text-muted font-semibold text-xs hover:text-primary-400 transition-colors group cursor-pointer"
            >
              <Calendar size={15} className="text-primary-400 group-hover:scale-110 transition-transform" />
              <span>{formatMonthYear(currentWeekStart)}</span>
            </button>
            <button onClick={handleNextWeek} className="liquid-btn-glass flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-content transition-colors cursor-pointer" aria-label="Next week"><ChevronRight size={18} /></button>
          </div>

          <div className="flex justify-between gap-1">
            {weekDays.map((date, i) => {
              const isToday = date.toDateString() === today.toDateString();
              const isSelected = date.toDateString() === selectedDate.toDateString();
              const isCompleted = completedDates.has(date.toDateString());
              const dayName = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][i];
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-2 cursor-pointer" onClick={() => setSelectedDate(date)}>
                  <span className={cn('text-[11px] font-bold', isSelected ? 'text-primary-400' : 'text-muted')}>{dayName}</span>
                  <div className={cn(
                    'flex h-11 w-full max-w-[44px] items-center justify-center rounded-2xl text-sm font-bold transition-all tabular-nums',
                    isSelected
                      ? 'liquid-btn-primary text-white'
                      : isCompleted
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/35 backdrop-blur-md'
                        : 'liquid-btn-glass text-muted',
                    isToday && !isSelected && !isCompleted && 'border-2 border-emerald-400/70 text-emerald-400',
                  )}>
                    {date.getDate()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mesocycle Periodization Planner */}
        <div className="px-4 mb-5">
          <MesocycleCard
            variant="full"
            programName={program.name}
            progress={computeMesocycleProgress(program, sessions)}
            weightUnit={settings?.weightUnit || 'kg'}
            onSaveMesocycle={async (mesocycle) => {
              await saveProgram({
                ...program,
                mesocycle,
                updatedAt: Date.now(),
              });
            }}
          />
        </div>

        {/* Day list */}
        <div className="grid grid-cols-1 gap-3.5 px-4">
          {program.days.map((day, index) => {
            const isFullBody = day.exercises.some(e => e.name.toLowerCase().includes('squat')) &&
              day.exercises.some(e => e.name.toLowerCase().includes('press'));
            const primaryMuscles = Array.from(new Set(day.exercises.map(e => e.primaryMuscle).filter(Boolean)));
            const subtitle = isFullBody ? 'Full Body' : primaryMuscles.length > 0 ? primaryMuscles.join(' · ') : 'No exercises yet';

            return (
              <motion.div
                key={day.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="liquid-glass liquid-glass-interactive relative overflow-hidden rounded-3xl p-5"
              >
                {program.goal === 'Fat Loss' ? (
                  <Flame className="pointer-events-none absolute right-4 top-4 text-content/5" size={60} />
                ) : program.goal === 'Strength' ? (
                  <Weight className="pointer-events-none absolute right-4 top-4 text-content/5" size={60} />
                ) : (
                  <Dumbbell className="pointer-events-none absolute right-4 top-4 text-content/5" size={60} />
                )}

                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-widest text-primary-400">DAY {index + 1}</span>
                  {day.isDeloadDay && (
                    <span className="flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-sky-400 backdrop-blur-sm">
                      <Snowflake size={10} />
                      Deload
                    </span>
                  )}
                </div>
                <h3 className="mb-1 text-xl font-extrabold text-content tracking-tight">{day.name}</h3>
                <p className="mb-4 text-xs text-muted font-medium">{subtitle}</p>

                <div className="mb-5 flex items-center gap-4 text-xs font-semibold text-muted">
                  <span className="flex items-center gap-1.5"><List size={15} className="text-primary-400" />{day.exercises.length} Exercises</span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-content/10">
                  <div className="flex items-center gap-1.5 flex-wrap pt-2">
                    <button
                      onClick={() => handleEditDay(day.id)}
                      className="flex min-h-[36px] items-center gap-1 rounded-xl px-2 text-xs font-semibold text-muted hover:text-content transition-colors cursor-pointer"
                    >
                      <Edit2 size={14} /> Rename
                    </button>
                    <button
                      onClick={() => openManageModal(day)}
                      className="flex min-h-[36px] items-center gap-1 rounded-xl px-2 text-xs font-semibold text-primary-400 hover:text-primary-300 transition-colors cursor-pointer"
                    >
                      <Plus size={14} /> Exercises
                    </button>
                    <button
                      onClick={() => handleToggleDeloadDay(day.id)}
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-xl transition-colors cursor-pointer',
                        day.isDeloadDay
                          ? 'bg-sky-500/20 text-sky-400'
                          : 'text-muted hover:text-sky-400',
                      )}
                      title={day.isDeloadDay ? 'Remove Deload Day' : 'Mark as Deload Day'}
                      aria-label="Toggle Deload Day"
                    >
                      <Snowflake size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteDay(day.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-red-400/75 hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer"
                      aria-label="Delete Day"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <button
                    onClick={() => navigate(`/workout/${program.id}/${day.id}`)}
                    className="liquid-btn-primary mt-2 flex shrink-0 items-center gap-1.5 rounded-2xl px-4 py-2.5 text-xs font-extrabold text-white transition-all active:scale-95 cursor-pointer"
                  >
                    <Play size={15} /> START
                  </button>
                </div>
              </motion.div>
            );
          })}

          <button
            onClick={handleAddDay}
            className="liquid-glass liquid-glass-interactive mt-1 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-content/20 py-4 text-sm font-bold text-content cursor-pointer"
          >
            <Plus size={18} /> Add Day
          </button>
        </div>

      </PullToRefresh>

      <ExerciseManagerModal
        isOpen={exerciseModal.isOpen}
        day={exerciseModal.day}
        exerciseForm={exerciseForm}
        editingExercise={editingExercise}
        onClose={closeExerciseModal}
        onReorderExercises={handleReorderExercises}
        onToggleSuperset={handleToggleSuperset}
        onOpenEditExercise={openEditExercise}
        onDeleteExercise={handleDeleteExercise}
        onUpdateForm={setExerciseForm}
        onCancelEdit={() => {
          setEditingExercise(null);
          setExerciseForm(emptyExerciseForm);
        }}
        onSaveExercise={handleSaveExercise}
      />


      {/* Reusable Prompt Modal */}
      {promptConfig && (
        <PromptModal
          isOpen={promptConfig.isOpen}
          title={promptConfig.title}
          initialValue={promptConfig.initialValue}
          onConfirm={promptConfig.onConfirm}
          onCancel={() => setPromptConfig(null)}
        />
      )}

      {/* Confirm Modal */}
      {confirmConfig && (
        <ConfirmModal
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          isDestructive={confirmConfig.isDestructive}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(null)}
        />
      )}

      {isShareOpen && (
        <React.Suspense fallback={null}>
          <ProgramShareModal
            isOpen={isShareOpen}
            program={program}
            unit={settings?.weightUnit || 'kg'}
            onClose={() => setIsShareOpen(false)}
          />
        </React.Suspense>
      )}
    </>
  );
}
