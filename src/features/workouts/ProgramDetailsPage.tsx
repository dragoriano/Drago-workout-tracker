import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar, Dumbbell, List, Edit2, Play, Trash2, Plus, Flame, Weight, Snowflake } from 'lucide-react';
import { WorkoutProgram, WorkoutDay, Exercise } from '../../types';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';
import { PromptModal } from '../../components/ui/PromptModal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useAppStore } from '../../store/useAppStore';
import { generateId } from '../../utils/uuid';
import { PullToRefresh } from '../../components/ui/PullToRefresh';
import {
  emptyExerciseForm,
  ExerciseFormData,
  ExerciseManagerModal,
} from './components/ExerciseManagerModal';

interface ExerciseModalState {
  isOpen: boolean;
  day: WorkoutDay | null;
}

export function ProgramDetailsPage() {
  const { programId } = useParams();
  const navigate = useNavigate();

  const programs = useAppStore(s => s.programs);
  const sessions = useAppStore(s => s.sessions);
  const isHydrated = useAppStore(s => s.isHydrated);

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

    const updatedDay: WorkoutDay = {
      ...exerciseModal.day,
      exercises: newExercises
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
    setExerciseForm({
      name: ex.name,
      muscleGroup: ex.muscleGroup ?? [],
      primaryMuscle: ex.primaryMuscle || '',
      secondaryMuscles: ex.secondaryMuscles || [],
      sets: String(ex.sets.length),
      reps: String(ex.sets[0]?.reps ?? 10),
      restTimer: String(ex.restTimerConfig),
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

      const newExercise: Exercise = {
        id: editingExercise ? editingExercise.id : generateId(),
        name: exerciseForm.name,
        muscleGroup: combinedMuscles,
        primaryMuscle: exerciseForm.primaryMuscle,
        secondaryMuscles: exerciseForm.secondaryMuscles,
        notes: editingExercise ? editingExercise.notes : '',
        sets: Array.from({ length: parseInt(exerciseForm.sets) || 1 }).map((_, i) => ({
          id: editingExercise?.sets[i]?.id || generateId(),
          weight: editingExercise?.sets[i]?.weight || 0,
          reps: parseInt(exerciseForm.reps) || 10,
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
      exercises: exerciseModal.day.exercises.filter(e => e.id !== exerciseId),
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
    const currentEx = day.exercises[index];
    const prevEx = day.exercises[index - 1];

    const newExercises = [...day.exercises];

    if (currentEx.supersetId && currentEx.supersetId === prevEx.supersetId) {
      // Toggle OFF — clear supersetId from ALL exercises sharing this group
      const targetId = currentEx.supersetId;
      for (let i = 0; i < newExercises.length; i++) {
        if (newExercises[i].supersetId === targetId) {
          newExercises[i] = { ...newExercises[i], supersetId: undefined };
        }
      }
    } else {
      // Toggle ON
      const supersetId = prevEx.supersetId || generateId();
      newExercises[index - 1] = { ...prevEx, supersetId };
      newExercises[index] = { ...currentEx, supersetId };
    }

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
          className="rounded-xl bg-primary-500 px-6 py-2 font-bold text-content hover:bg-primary-400"
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
      <PullToRefresh onRefresh={async () => { await useAppStore.getState().hydrate(); }} className="min-h-screen bg-page pb-24 font-sans">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-page/80 p-4 pt-12 backdrop-blur-md">
          <button onClick={() => navigate(-1)} className="p-2 text-content hover:bg-page/10 dark:bg-content/10 rounded-full transition-colors shrink-0">
            <ChevronLeft size={28}/>
          </button>
          <div className="flex items-center gap-1 flex-1 min-w-0 justify-center">
            <button 
              onClick={handleRename} 
              className="flex items-center justify-center gap-2 hover:text-primary-400 transition-colors px-2 py-2 -m-2 min-w-0"
            >
              <span className="truncate font-black text-xl text-content tracking-tight">{program.name}</span>
              <Edit2 size={16}className="text-muted shrink-0" />
            </button>
          </div>
          <button 
            onClick={handleDelete} 
            className="p-3 text-red-500 hover:bg-page/10 dark:bg-content/10 rounded-full transition-colors shrink-0"
            title="Delete Program"
          >
            <Trash2 size={24}/>
          </button>
        </div>

        {/* Week calendar */}
        <div className="px-4 pb-6 mt-2">
          <div className="flex items-center justify-between mb-6">
            <button onClick={handlePrevWeek} className="p-1 text-muted hover:text-content transition-colors"><ChevronLeft size={20}/></button>
            <button 
              onClick={handleGoToToday}
              className="flex items-center gap-2 text-muted font-medium text-sm hover:text-primary-400 transition-colors group"
            >
              <Calendar size={16}className="text-primary-500 group-hover:scale-110 transition-transform" />
              <span>{formatMonthYear(currentWeekStart)}</span>
            </button>
            <button onClick={handleNextWeek} className="p-1 text-muted hover:text-content transition-colors"><ChevronRight size={20}/></button>
          </div>

          <div className="flex justify-between">
            {weekDays.map((date, i) => {
              const isToday = date.toDateString() === today.toDateString();
              const isSelected = date.toDateString() === selectedDate.toDateString();
              const isCompleted = completedDates.has(date.toDateString());
              const dayName = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][i];
              return (
                <div key={i} className="flex flex-col items-center gap-3 cursor-pointer" onClick={() => setSelectedDate(date)}>
                  <span className={cn("text-xs font-bold", isSelected ? "text-primary-400" : "text-muted")}>{dayName}</span>
                  <div className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold transition-all duration-300",
                    isSelected ? "bg-primary-500 text-content shadow-lg shadow-primary-500/40" : 
                    isCompleted ? "bg-green-500/20 text-green-500 border border-green-500/30" :
                    "bg-card text-muted hover:bg-[#2c2c2e]",
                    isToday && !isSelected && !isCompleted && "border-2 border-green-500 text-green-500 bg-transparent"
                  )}>
                    {date.getDate()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Day list */}
        <div className="grid gap-4 px-4">
          {program.days.map((day, index) => {
            const isFullBody = day.exercises.some(e => e.name.toLowerCase().includes('squat')) &&
              day.exercises.some(e => e.name.toLowerCase().includes('press'));
            const primaryMuscles = Array.from(new Set(day.exercises.map(e => e.primaryMuscle).filter(Boolean)));
            const subtitle = isFullBody ? 'Full Body' : primaryMuscles.length > 0 ? primaryMuscles.join(' · ') : 'No exercises yet';

            return (
              <motion.div
                key={day.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="relative overflow-hidden rounded-2xl bg-surface border border-content/5 p-5 shadow-lg glow-card"
              >
                {program.goal === 'Fat Loss' ? (
                  <Flame className="absolute right-4 top-4 text-content /5" size={64}/>
                ) : program.goal === 'Strength' ? (
                  <Weight className="absolute right-4 top-4 text-content /5" size={64}/>
                ) : (
                  <Dumbbell className="absolute right-4 top-4 text-content /5" size={64}/>
                )}

                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-widest text-primary-500">DAY {index + 1}</span>
                  {day.isDeloadDay && (
                    <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-full">
                      <Snowflake size={10}/>
                      Deload
                    </span>
                  )}
                </div>
                <h3 className="mb-1 text-2xl font-bold text-content tracking-tight">{day.name}</h3>
                <p className="mb-5 text-sm text-muted font-medium">{subtitle}</p>

                <div className="mb-6 flex items-center gap-4 text-sm font-medium text-muted">
                  <span className="flex items-center gap-1.5"><List size={16}/>{day.exercises.length} Exercises</span>
                </div>

                <div className="flex items-center justify-between mt-2 gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => handleEditDay(day.id)}
                      className="flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-content transition-colors"
                    >
                      <Edit2 size={15}/> Rename
                    </button>
                    <span className="text-zinc-700">·</span>
                    <button
                      onClick={() => openManageModal(day)}
                      className="flex items-center gap-1.5 text-sm font-semibold text-primary-400 hover:text-primary-300 transition-colors"
                    >
                      <Plus size={15}/> Exercises
                    </button>
                    <span className="text-zinc-700">·</span>
                    <button
                      onClick={() => handleToggleDeloadDay(day.id)}
                      className={cn(
                        "flex items-center gap-1.5 text-sm font-semibold transition-colors",
                        day.isDeloadDay
                          ? "text-sky-400 hover:text-sky-300"
                          : "text-muted hover:text-sky-400"
                      )}
                      title={day.isDeloadDay ? "Remove Deload Day" : "Mark as Deload Day"}
                    >
                      <Snowflake size={15}/>
                    </button>
                    <span className="text-zinc-700">·</span>
                    <button
                      onClick={() => handleDeleteDay(day.id)}
                      className="flex items-center gap-1.5 text-sm font-semibold text-red-500/70 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={15}/>
                    </button>
                  </div>
                  <button
                    onClick={() => navigate(`/workout/${program.id}/${day.id}`)}
                    className="flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-bold text-content shadow-lg shadow-primary-500/40 transition-all hover:bg-primary-400 hover:shadow-xl shadow-primary-500/60 active:scale-95"
                  >
                    <Play size={16} /> START
                  </button>
                </div>
              </motion.div>
            );
          })}

          <button
            onClick={handleAddDay}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-black/10 dark:border-content/10 bg-transparent py-5 text-sm font-bold text-content transition-colors hover:bg-page/5 dark:bg-content/5 hover:border-content/20"
          >
            <Plus size={20}/> Add Day
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
    </>
  );
}
