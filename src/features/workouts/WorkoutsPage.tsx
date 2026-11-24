import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, Dumbbell, Calendar, Clock, ChevronRight, Edit2, Plus,
  Flame, Weight, Copy, Zap, Download, Share2,
} from 'lucide-react';
import { WorkoutProgram } from '../../types';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';
import { generateWorkoutDays } from '../../utils/workoutGenerator';
import { PullToRefresh } from '../../components/ui/PullToRefresh';
import { useAppStore } from '../../store/useAppStore';
import { generateId } from '../../utils/uuid';
import {
  getRecommendations,
  ProgramWizardModal,
  SplitRecommendation,
  WizardState,
  WizardStep,
} from './components/ProgramWizardModal';
import {
  AddProgramModal,
  ChooseGoalModal,
  ChooseSplitModal,
} from './components/PresetProgramModals';
import { CustomExerciseModal } from './components/CustomExerciseModal';

const ProgramShareModal = React.lazy(() =>
  import('./components/ProgramShareModal').then((m) => ({ default: m.ProgramShareModal })),
);
const ImportProgramModal = React.lazy(() =>
  import('./components/ImportProgramModal').then((m) => ({ default: m.ImportProgramModal })),
);

// ─── Component ─────────────────────────────────────────────────────────────────
export function WorkoutsPage() {
  // ── Zustand store ──────────────────────────────────────────────
  const programs = useAppStore((s) => s.programs);
  const settings = useAppStore((s) => s.settings);
  const customExercises = useAppStore((s) => s.customExercises);
  const storeSaveProgram = useAppStore((s) => s.saveProgram);
  const hydrate = useAppStore((s) => s.hydrate);

  // ── Local UI state ─────────────────────────────────────────────
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isCustomLibOpen, setIsCustomLibOpen] = useState(false);
  const [shareProgram, setShareProgram] = useState<WorkoutProgram | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');

  // ── Smart Wizard state ─────────────────────────────────────────
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>('goal');
  const [wizardState, setWizardState] = useState<WizardState>({
    goal: '',
    daysPerWeek: 3,
    hoursPerSession: 1,
  });
  const [recommendations, setRecommendations] = useState<SplitRecommendation[]>([]);

  const navigate = useNavigate();

  // ─── Handlers ─────────────────────────────────────────────────
  const handleCreateProgram = async (name: string = 'New Program', daysCount: number = 1, goal: string = '', splitKey?: string) => {
    const generatorKey = splitKey || name.split(' - ')[1] || name;
    const days = goal
      ? generateWorkoutDays(goal, generatorKey, daysCount)
      : Array.from({ length: daysCount }).map((_, i) => ({
          id: generateId(),
          name: `Day ${i + 1}`,
          order: i,
          exercises: [],
        }));

    const newProgram: WorkoutProgram = {
      id: generateId(),
      name,
      goal,
      theme: 'from-primary-500 to-primary-700',
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      days,
    };
    await storeSaveProgram(newProgram);
    closeAllModals();
  };

  const toggleProgramStatus = async (program: WorkoutProgram) => {
    const nextStatus = program.status === 'active' ? 'paused' : 'active';

    if (nextStatus === 'active') {
      // Pause all other programs (single-active constraint)
      for (const p of programs) {
        if (p.id !== program.id && p.status === 'active') {
          await storeSaveProgram({ ...p, status: 'paused', updatedAt: Date.now() });
        }
      }
    }

    await storeSaveProgram({ ...program, status: nextStatus, updatedAt: Date.now() });
  };

  const startRename = (program: WorkoutProgram) => {
    setRenamingId(program.id);
    setRenameInput(program.name);
  };

  const submitRename = async (program: WorkoutProgram) => {
    if (renameInput.trim() !== '' && renameInput !== program.name) {
      await storeSaveProgram({ ...program, name: renameInput.trim(), updatedAt: Date.now() });
    }
    setRenamingId(null);
  };

  const handleDuplicateProgram = async (program: WorkoutProgram) => {
    const newProgram: WorkoutProgram = {
      ...program,
      id: generateId(),
      name: `${program.name} (Copy)`,
      status: 'paused',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      days: program.days.map((day) => ({
        ...day,
        id: generateId(),
        exercises: day.exercises.map((ex) => ({
          ...ex,
          id: generateId(),
          sets: ex.sets.map((set) => ({ ...set, id: generateId() })),
        })),
      })),
    };
    await storeSaveProgram(newProgram);
  };

  const closeAllModals = () => {
    setIsAddModalOpen(false);
    setIsSplitModalOpen(false);
    setIsGoalModalOpen(false);
    setSelectedGoal(null);
    setIsWizardOpen(false);
    setWizardStep('goal');
    setWizardState({ goal: '', daysPerWeek: 3, hoursPerSession: 1 });
    setRecommendations([]);
  };

  const openWizard = () => {
    setIsAddModalOpen(false);
    setWizardStep('goal');
    setWizardState({ goal: '', daysPerWeek: 3, hoursPerSession: 1 });
    setIsWizardOpen(true);
  };

  const advanceWizard = (updates: Partial<WizardState>) => {
    const next = { ...wizardState, ...updates };
    setWizardState(next);

    if (wizardStep === 'goal') setWizardStep('days');
    else if (wizardStep === 'days') setWizardStep('hours');
    else if (wizardStep === 'hours') {
      setRecommendations(getRecommendations(next));
      setWizardStep('recommendation');
    }
  };

  const handlePickRecommendation = async (rec: SplitRecommendation) => {
    await handleCreateProgram(
      `${wizardState.goal} - ${rec.name}`,
      rec.daysCount,
      wizardState.goal,
      rec.splitKey
    );
  };

  const handleBuildCustomFromWizard = async () => {
    await handleCreateProgram(
      wizardState.goal ? `${wizardState.goal} - Custom` : 'Custom Program',
      wizardState.daysPerWeek,
      wizardState.goal,
      'Custom'
    );
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  };

  const handleImportPrograms = async (importedList: WorkoutProgram[]) => {
    const hasActive = programs.some((p) => p.status === 'active');
    for (let i = 0; i < importedList.length; i++) {
      const nextStatus = !hasActive && i === 0 ? 'active' : 'paused';
      await storeSaveProgram({ ...importedList[i], status: nextStatus });
    }
  };

  // ── Main render ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-page">
      <PullToRefresh onRefresh={hydrate} className="pb-24">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-page/80 p-4 pt-12 backdrop-blur-md">
          <button onClick={() => navigate(-1)} className="rounded-full p-2 text-content hover:bg-content/10">
            <ArrowLeft size={24}/>
          </button>
          <h1 className="text-xl font-semibold text-content">Programs</h1>
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-1 rounded-full bg-content/5 border border-content/10 px-3 py-1.5 text-xs font-bold text-sky-400 hover:bg-sky-500/15 transition-colors"
            title="Import Shared Program"
          >
            <Download size={14} />
            <span>Import</span>
          </button>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-2 gap-3 mb-5">
            <button
              type="button"
              onClick={() => navigate('/quick-workout')}
              className="flex items-center gap-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 p-3.5 text-left hover:bg-emerald-500/15 active:scale-[0.98] transition-all"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                <Zap size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-content truncate">Quick Workout</p>
                <p className="text-[11px] text-emerald-400/80 font-medium truncate">Freestyle session</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setIsCustomLibOpen(true)}
              className="flex items-center gap-3 rounded-2xl bg-sky-500/10 border border-sky-500/25 p-3.5 text-left hover:bg-sky-500/15 active:scale-[0.98] transition-all"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400">
                <BookOpen size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-content truncate">Custom Exercises</p>
                <p className="text-[11px] text-sky-400/80 font-medium truncate">
                  {customExercises.length} {customExercises.length === 1 ? 'exercise' : 'exercises'}
                </p>
              </div>
            </button>
          </div>

          {programs.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <div className="mb-4 rounded-full bg-card p-4 shadow-lg">
                <Dumbbell size={32}className="text-muted" />
              </div>
              <h3 className="text-lg font-medium text-content">No programs yet</h3>
              <p className="mt-2 text-sm text-muted max-w-[240px]">Create your first workout program to get started.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {programs.map((program) => (
                <motion.div
                  key={program.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => navigate(`/workout/${program.id}`)}
                  className="relative overflow-hidden rounded-3xl bg-surface border border-content/5 p-4 cursor-pointer glow-card"
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="shrink-0 flex flex-col items-center gap-3">
                      <div className={cn(
                        'flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl',
                        program.goal === 'Muscle Building' && 'bg-orange-500/20 text-orange-400',
                        program.goal === 'Fat Loss' && 'bg-red-500/20 text-red-400',
                        program.goal === 'Strength' && 'bg-blue-500/20 text-blue-400',
                        !program.goal && 'bg-primary-500/20 text-primary-400',
                      )}>
                        {program.goal === 'Fat Loss' ? (
                          <Flame size={24}className="sm:w-7 sm:h-7" />
                        ) : program.goal === 'Strength' ? (
                          <Weight size={24}className="sm:w-7 sm:h-7" />
                        ) : (
                          <Dumbbell size={24}className="sm:w-7 sm:h-7" />
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleProgramStatus(program); }}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                          program.status === 'active' ? 'bg-primary-500' : 'bg-zinc-600'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          program.status === 'active' ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>

                    <div className="flex flex-1 flex-col min-w-0">
                      <div className="flex flex-col gap-1">
                        {renamingId === program.id ? (
                          <div className="flex items-center gap-2 w-full">
                            <input
                              type="text"
                              autoFocus
                              value={renameInput}
                              onChange={(e) => setRenameInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') submitRename(program);
                                if (e.key === 'Escape') setRenamingId(null);
                              }}
                              onBlur={() => submitRename(program)}
                              className="text-base sm:text-lg font-bold text-content bg-content/10 rounded px-2 py-1 outline-none w-full border border-primary-500/50"
                              onClick={(e) => e.stopPropagation()}
                              aria-label="Rename workout program"
                            />
                          </div>
                        ) : (
                          <div className="flex items-start gap-2 group/title">
                            <h3 className="text-base sm:text-lg font-bold text-content leading-tight break-words flex-1">
                              {program.name}
                            </h3>
                            <button
                              onClick={(e) => { e.stopPropagation(); setShareProgram(program); }}
                              className="text-muted/40 hover:text-sky-400 shrink-0 p-1 -mt-1 transition-colors"
                              title="Share Program"
                            >
                              <Share2 size={15}/>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDuplicateProgram(program); }}
                              className="text-muted/40 hover:text-content shrink-0 p-1 -mt-1 transition-colors"
                              title="Duplicate Program"
                            >
                              <Copy size={15}/>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); startRename(program); }}
                              className="text-muted/40 hover:text-content shrink-0 p-1 -mt-1 transition-colors"
                              title="Rename Program"
                            >
                              <Edit2 size={15}/>
                            </button>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            program.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-zinc-500/10 text-muted border border-zinc-500/20'
                          }`}>
                            {program.status === 'active' ? 'Active' : 'Paused'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                        <div className="flex items-center text-[10px] sm:text-xs text-muted/60 uppercase font-bold tracking-widest">
                          <Calendar size={12}className="mr-1.5 shrink-0 text-primary-500/50" />
                          <span>{program.days.length} Days</span>
                        </div>
                        <div className="flex items-center text-[10px] sm:text-xs text-muted/60 uppercase font-bold tracking-widest">
                          <Clock size={12}className="mr-1.5 shrink-0 text-primary-500/50" />
                          <span>Updated: {formatDate(program.updatedAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex h-full items-center justify-center self-stretch pl-1 sm:pl-2">
                      <ChevronRight size={20}className="text-muted sm:w-6 sm:h-6" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </PullToRefresh>

      {/* Floating Action Button */}
      <button
        onClick={() => setIsAddModalOpen(true)}
        className="fixed bottom-32 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary-500 text-white shadow-lg shadow-primary-500/40 transition-transform active:scale-95 touch-manipulation"
      >
        <Plus size={28}/>
      </button>

      <AddProgramModal
        isOpen={isAddModalOpen}
        onClose={closeAllModals}
        onSelectPreset={() => {
          setIsAddModalOpen(false);
          setIsSplitModalOpen(true);
        }}
        onSelectWizard={openWizard}
        onSelectBlank={() => handleCreateProgram('Custom Program')}
        onSelectImport={() => {
          setIsAddModalOpen(false);
          setIsImportOpen(true);
        }}
      />
      <ChooseGoalModal
        isOpen={isSplitModalOpen}
        onClose={() => setIsSplitModalOpen(false)}
        onSelectGoal={(goal) => {
          setSelectedGoal(goal);
          setIsSplitModalOpen(false);
          setIsGoalModalOpen(true);
        }}
      />
      <ChooseSplitModal
        isOpen={isGoalModalOpen}
        selectedGoal={selectedGoal}
        onBack={() => {
          setIsGoalModalOpen(false);
          setIsSplitModalOpen(true);
        }}
        onSelectSplit={(name, days, goal) => handleCreateProgram(name, days, goal)}
      />
      <ProgramWizardModal
        isOpen={isWizardOpen}
        wizardStep={wizardStep}
        wizardState={wizardState}
        recommendations={recommendations}
        onClose={closeAllModals}
        onStepChange={setWizardStep}
        onUpdateState={setWizardState}
        onAdvance={advanceWizard}
        onPickRecommendation={handlePickRecommendation}
        onBuildCustom={handleBuildCustomFromWizard}
      />
      <CustomExerciseModal
        isOpen={isCustomLibOpen}
        onClose={() => setIsCustomLibOpen(false)}
      />
      {shareProgram && (
        <React.Suspense fallback={null}>
          <ProgramShareModal
            isOpen={Boolean(shareProgram)}
            program={shareProgram}
            unit={settings?.weightUnit || 'kg'}
            onClose={() => setShareProgram(null)}
          />
        </React.Suspense>
      )}
      {isImportOpen && (
        <React.Suspense fallback={null}>
          <ImportProgramModal
            isOpen={isImportOpen}
            onClose={() => setIsImportOpen(false)}
            onImportPrograms={handleImportPrograms}
          />
        </React.Suspense>
      )}
    </div>
  );
}
