import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, Dumbbell, Calendar, Clock, ChevronRight, Edit2, Plus,
  Flame, Weight, Copy, Zap, Download, Share2, MoreHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/DropdownMenu';
import { WorkoutProgram } from '../../types';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';
import { generateWorkoutDays } from '../../utils/workoutGenerator';
import { PullToRefresh } from '../../components/ui/PullToRefresh';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Switch } from '../../components/ui/Switch';
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
    <div className="min-h-full bg-transparent">
      <PullToRefresh onRefresh={hydrate} className="pb-24">
        <div className="liquid-glass-strong sticky top-0 z-10 flex items-center justify-between border-x-0 border-t-0 px-4 pb-3.5 pt-safe">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="liquid-btn-glass flex h-10 w-10 items-center justify-center rounded-full text-content transition-colors cursor-pointer"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-extrabold tracking-tight text-content">Programs</h1>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={() => setIsImportOpen(true)}
            title="Import Shared Program"
          >
            <Download size={14} className="text-sky-400" />
            <span>Import</span>
          </Button>
        </div>

        <div className="p-4">
          <div className="mb-5 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/quick-workout')}
              className="liquid-glass liquid-glass-interactive flex min-h-[64px] items-center gap-2.5 rounded-2xl p-3 text-left active:scale-[0.98] cursor-pointer"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                <Zap size={18} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-content">Quick Workout</p>
                <p className="truncate text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Freestyle</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setIsCustomLibOpen(true)}
              className="liquid-glass liquid-glass-interactive flex min-h-[64px] items-center gap-2.5 rounded-2xl p-3 text-left active:scale-[0.98] cursor-pointer"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400">
                <BookOpen size={18} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-content">Custom Bank</p>
                <p className="truncate text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                  {customExercises.length} {customExercises.length === 1 ? 'exercise' : 'exercises'}
                </p>
              </div>
            </button>
          </div>

          {programs.length === 0 ? (
            <div className="liquid-glass flex h-60 flex-col items-center justify-center rounded-3xl p-6 text-center">
              <div className="mb-4 rounded-2xl bg-content/10 p-4">
                <Dumbbell size={32} className="text-muted" />
              </div>
              <h3 className="text-lg font-bold text-content">No programs yet</h3>
              <p className="mt-1.5 max-w-[240px] text-xs text-muted">
                Create your first workout program to get started.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {programs.map((program) => (
                <motion.div
                  key={program.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => navigate(`/workout/${program.id}`)}
                  className="liquid-glass liquid-glass-interactive relative cursor-pointer overflow-hidden rounded-3xl p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex shrink-0 flex-col items-center gap-3">
                      <div
                        className={cn(
                          'flex h-12 w-12 items-center justify-center rounded-2xl',
                          program.goal === 'Muscle Building' && 'bg-orange-500/20 text-orange-400',
                          program.goal === 'Fat Loss' && 'bg-red-500/20 text-red-400',
                          program.goal === 'Strength' && 'bg-blue-500/20 text-blue-400',
                          !program.goal && 'bg-primary-500/20 text-primary-400',
                        )}
                      >
                        {program.goal === 'Fat Loss' ? (
                          <Flame size={22} />
                        ) : program.goal === 'Strength' ? (
                          <Weight size={22} />
                        ) : (
                          <Dumbbell size={22} />
                        )}
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={program.status === 'active'}
                          onCheckedChange={() => toggleProgramStatus(program)}
                          aria-label={`Toggle ${program.name} active status`}
                        />
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex flex-col gap-1.5">
                        {renamingId === program.id ? (
                          <div className="flex w-full items-center gap-2">
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
                              className="liquid-input w-full rounded-xl px-2.5 py-1.5 text-base font-bold text-content outline-none"
                              onClick={(e) => e.stopPropagation()}
                              aria-label="Rename workout program"
                            />
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="flex-1 break-words text-base font-bold leading-tight text-content">
                              {program.name}
                            </h3>
                            <div className="flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    aria-label={`Actions for ${program.name}`}
                                    className="liquid-btn-glass -mr-1 -mt-1 flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:text-content transition-colors cursor-pointer"
                                  >
                                    <MoreHorizontal size={18} />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setShareProgram(program)}>
                                    <Share2 size={14} className="text-sky-400" />
                                    <span>Share Program</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDuplicateProgram(program)}>
                                    <Copy size={14} className="text-muted" />
                                    <span>Duplicate</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => startRename(program)}>
                                    <Edit2 size={14} className="text-muted" />
                                    <span>Rename</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <Badge variant={program.status === 'active' ? 'success' : 'outline'}>
                            {program.status === 'active' ? 'Active' : 'Paused'}
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                        <div className="flex items-center text-[11px] font-bold uppercase tracking-wider text-muted tabular-nums">
                          <Calendar size={12} className="mr-1.5 shrink-0 text-primary-400" />
                          <span>{program.days.length} Days</span>
                        </div>
                        <div className="flex items-center text-[11px] font-bold uppercase tracking-wider text-muted tabular-nums">
                          <Clock size={12} className="mr-1.5 shrink-0 text-primary-400" />
                          <span>Updated {formatDate(program.updatedAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex h-full shrink-0 items-center justify-center self-stretch pl-0.5">
                      <ChevronRight size={18} className="text-muted" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </PullToRefresh>

      {/* Mobile-Framed Floating Action Button above Persistent Bottom Nav */}
      <div className="pointer-events-none fixed bottom-[92px] left-1/2 z-40 flex w-full max-w-[460px] -translate-x-1/2 justify-end px-4 pb-safe">
        <button
          onClick={() => setIsAddModalOpen(true)}
          aria-label="Add Program"
          className="pointer-events-auto liquid-btn-primary flex h-14 w-14 items-center justify-center rounded-2xl text-white transition-transform active:scale-95 touch-manipulation cursor-pointer"
        >
          <Plus size={26} />
        </button>
      </div>

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
