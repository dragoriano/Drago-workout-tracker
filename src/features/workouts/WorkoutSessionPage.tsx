import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calculator, ChevronLeft, RotateCcw, Dumbbell, CheckCircle2, Trophy, X, Edit2, Plus, Zap } from 'lucide-react';
import type { Exercise, ExerciseTrackingMode, Set, WorkoutSession } from '../../types';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { PromptModal } from '../../components/ui/PromptModal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Button } from '../../components/ui/Button';
import { Progress } from '../../components/ui/Progress';
import { SwapModal } from '../../components/ui/SwapModal';
import { PlateCalculatorModal } from '../../components/ui/PlateCalculatorModal';
import { getExerciseMuscleGroups } from '../../data/exercises';
import { generateId } from '../../utils/uuid';
import { useAppStore } from '../../store/useAppStore';
import {
  calculateSetWorkingVolume,
  formatDurationCompact,
  getExerciseTrackingMode,
} from '../../utils/exerciseModes';
import {
  computeSupersetMap,
  cleanupOrphanSupersets,
  resolveSupersetSetCompletion,
  toggleSupersetLink,
} from '../../utils/supersets';
import {
  computeOverloadSpikePercent,
  computeSmartSets,
  detectSessionPRs,
} from '../../utils/workoutCoach';
import {
  buildFreestyleExercise,
  buildProgramFromFreestyle,
  CatalogExerciseItem,
  FREESTYLE_PROGRAM_ID,
} from '../../utils/customExercises';
import {
  computeMuscleRecovery,
  MuscleRecoveryStatus,
  resolveExerciseBroadMuscles,
} from '../../utils/muscleRecovery';
import {
  DEFAULT_PLATES,
  isWarmupSet,
  resolveBarbellWeight,
  type WeightUnit,
} from '../../utils/strength';
import { applyWarmupSets, generateWarmupSets } from '../../utils/warmupGenerator';
import { WorkoutBlock } from './components/SessionExerciseCard';
import { RestTimerOverlay } from './components/RestTimerOverlay';
import { QuickAddExerciseModal } from './components/QuickAddExerciseModal';

export { computeSmartSets };

const ExerciseChartModal = React.lazy(() =>
  import('../../components/ui/ExerciseChartModal').then((m) => ({ default: m.ExerciseChartModal })),
);

export function WorkoutSessionPage() {
  const { programId, dayId } = useParams();
  const navigate = useNavigate();
  const isFreestyle = !programId && !dayId;

  const programs = useAppStore(s => s.programs);
  const sessions = useAppStore(s => s.sessions);
  const customExercises = useAppStore(s => s.customExercises);
  const settings = useAppStore(s => s.settings);
  const isHydrated = useAppStore(s => s.isHydrated);

  const program = programId ? (programs.find(p => p.id === programId) || null) : null;
  const day = program && dayId ? program.days.find(d => d.id === dayId) : null;

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [freestyleName, setFreestyleName] = useState('Quick Workout');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isAddExerciseOpen, setIsAddExerciseOpen] = useState(false);
  const [saveAsProgram, setSaveAsProgram] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [initialRestTimer, setInitialRestTimer] = useState<number | null>(null);
  const [restSubtitle, setRestSubtitle] = useState<string>('Recovery');
  const [activeSupersetFocusId, setActiveSupersetFocusId] = useState<string | null>(null);
  const [supersetBanner, setSupersetBanner] = useState<{
    groupLabel: string;
    nextLabel: string;
    nextExerciseName: string;
    targetExerciseId: string;
  } | null>(null);
  const supersetBannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showOverloadWarning, setShowOverloadWarning] = useState(false);
  const [overloadPercent, setOverloadPercent] = useState(0);
  const [isDeloadDay, setIsDeloadDay] = useState(false);
  const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({});

  const [noteConfig, setNoteConfig] = useState<{isOpen: boolean, exerciseId: string, initialValue: string} | null>(null);
  const [swapConfig, setSwapConfig] = useState<{isOpen: boolean, exercise: Exercise} | null>(null);
  const [chartConfig, setChartConfig] = useState<{isOpen: boolean, exercise: Exercise | null}>({isOpen: false, exercise: null});
  const [plateCalcConfig, setPlateCalcConfig] = useState<{
    isOpen: boolean;
    exerciseId?: string;
    exerciseName?: string;
    weight: number;
  }>({ isOpen: false, weight: 0 });
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [achievedPRs, setAchievedPRs] = useState<string[]>([]);
  const [prNotification, setPrNotification] = useState<{ exerciseName: string, valueLabel: string } | null>(null);
  const pendingSessionId = useRef<string | null>(null);
  const isFinishingRef = useRef(false);
  const initializedSessionKeyRef = useRef<string | null>(null);
  const finishNavTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [restEndTime, setRestEndTime] = useState<number | null>(null);
  const lastSpokenSecondRef = useRef<number | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  useEffect(() => {
    return () => {
      if (finishNavTimeoutRef.current) {
        clearTimeout(finishNavTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isHydrated || (!isFreestyle && (!program || !day)) || isFinishingRef.current) return;

    const sessionKey = isFreestyle ? 'freestyle' : `${programId}_${dayId}`;
    if (initializedSessionKeyRef.current === sessionKey) return;
    initializedSessionKeyRef.current = sessionKey;

    // 1. Try to recover active session
    const cacheKey = isFreestyle
      ? 'dragoriano_session_freestyle'
      : `dragoriano_session_${programId}_${dayId}`;
    const cachedStr = localStorage.getItem(cacheKey);
    if (cachedStr) {
      try {
        const cached = JSON.parse(cachedStr);
        if (cached.exercises && cached.exercises.length > 0) {
          const ageInMs = Date.now() - (cached.startTime || 0);
          // Only auto-restore if session is less than 16 hours old
          if (ageInMs < 16 * 60 * 60 * 1000) {
            const restoredExercises = cached.exercises.map((ex: any) => {
              const globalHistory = sessions
                .filter(s => s.exercisesSnapshot?.some(e => e.name.toLowerCase().trim() === ex.name.toLowerCase().trim()))
                .map(s => {
                  const matchingEx = s.exercisesSnapshot.find(e => e.name.toLowerCase().trim() === ex.name.toLowerCase().trim());
                  return {
                    sessionId: s.id,
                    date: s.date,
                    sets: matchingEx?.sets || []
                  };
                })
                .sort((a, b) => a.date - b.date);
              return { ...ex, history: globalHistory };
            });
            setExercises(restoredExercises);
            if (isFreestyle && cached.workoutName) setFreestyleName(cached.workoutName);
            if (cached.startTime) setStartTime(cached.startTime);
            setExpandedExercises({ [restoredExercises[0].id]: true });

            const isDeload = !!day?.isDeloadDay;
            setIsDeloadDay(isDeload);
            return; // Successfully restored from draft
          } else {
            localStorage.removeItem(cacheKey); // Prune old stale data
          }
        }
      } catch (e) {
        console.error("Failed to parse cached session", e);
      }
    }

    if (isFreestyle || !day) {
      setIsDeloadDay(false);
      setExercises([]);
      return;
    }

    // 2. Normal Initialization (Apply Smart Suggestions & Auto Deload)
    const isDeload = !!day.isDeloadDay;
    setIsDeloadDay(isDeload);

    const processedExercises = day.exercises.map(ex => {
      const globalHistory = sessions
        .filter(s => s.exercisesSnapshot?.some(e => e.name.toLowerCase().trim() === ex.name.toLowerCase().trim()))
        .map(s => {
          const matchingEx = s.exercisesSnapshot.find(e => e.name.toLowerCase().trim() === ex.name.toLowerCase().trim());
          return {
            sessionId: s.id,
            date: s.date,
            sets: matchingEx?.sets || []
          };
        })
        .sort((a, b) => a.date - b.date);
      const exWithHistory = { ...ex, history: globalHistory };
      return { ...exWithHistory, sets: computeSmartSets(exWithHistory, isDeload, settings) };
    });

    setExercises(processedExercises);
    if (processedExercises.length > 0) {
      setExpandedExercises({ [processedExercises[0].id]: true });
    }
  }, [isHydrated, isFreestyle, programId, dayId, program, day]);

  useEffect(() => {
    if (isFinishingRef.current) return;
    const cacheKey = isFreestyle
      ? 'dragoriano_session_freestyle'
      : programId && dayId
        ? `dragoriano_session_${programId}_${dayId}`
        : null;
    if (!cacheKey) return;

    if (exercises.length > 0) {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          startTime,
          workoutName: isFreestyle ? freestyleName : undefined,
          exercises,
        }),
      );
    } else if (isFreestyle) {
      localStorage.removeItem(cacheKey);
    }
  }, [exercises, startTime, freestyleName, isFreestyle, programId, dayId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const toggleExercise = (id: string) => {
    setExpandedExercises(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleAddSet = (exerciseId: string) => {
    setExercises(prev => prev.map(ex => {
      if (ex.id === exerciseId) {
        const mode = getExerciseTrackingMode(ex);
        const workingSets = ex.sets.filter(s => !isWarmupSet(s));
        const refSet = workingSets[workingSets.length - 1] ?? ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [...ex.sets, {
            id: generateId(),
            weight: refSet ? refSet.weight : 0,
            reps: mode === 'timed' ? 1 : (refSet ? refSet.reps : 0),
            ...(mode === 'timed' ? { duration: refSet?.duration ?? 45 } : {}),
            completed: false,
            setType: 'working',
          }]
        };
      }
      return ex;
    }));
  };

  const handleUpdateTrackingMode = (exerciseId: string, mode: ExerciseTrackingMode) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        return {
          ...ex,
          trackingMode: mode,
          sets:
            mode === 'timed'
              ? ex.sets.map((s) => ({
                  ...s,
                  duration: s.duration ?? 45,
                  reps: s.reps || 1,
                }))
              : ex.sets,
        };
      }),
    );
  };

  const handleUpdateGroupRestTimer = (groupId: string, seconds: number) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.supersetId === groupId ? { ...ex, restTimerConfig: seconds } : ex)),
    );
  };

  const handleDeleteSet = (exerciseId: string, setId: string) => {
    setExercises(prev => prev.map(ex => {
      if (ex.id === exerciseId) {
        return {
          ...ex,
          sets: ex.sets.filter(s => s.id !== setId)
        };
      }
      return ex;
    }));
  };

  const handleUpdateSet = (
    exerciseId: string,
    setId: string,
    field: keyof Set,
    value: Set[keyof Set],
  ) => {
    setExercises(prev => prev.map(ex => {
      if (ex.id !== exerciseId) return ex;
      return {
        ...ex,
        sets: ex.sets.map(s => {
          if (s.id !== setId) return s;
          if (field === 'setType' && value === 'warmup') {
            return { ...s, setType: 'warmup', rpe: undefined };
          }
          return { ...s, [field]: value };
        })
      };
    }));
  };

  const handleUpdateRestTimer = (exerciseId: string, seconds: number) => {
    setExercises(prev =>
      prev.map(ex => (ex.id === exerciseId ? { ...ex, restTimerConfig: seconds } : ex)),
    );
  };

  const handleGenerateWarmup = (exerciseId: string) => {
    const unit: WeightUnit = settings?.weightUnit === 'lbs' ? 'lbs' : 'kg';
    const barbellWeight = resolveBarbellWeight(settings?.barbellWeight, unit);
    const availablePlates =
      settings?.availablePlates && settings.availablePlates.length > 0
        ? settings.availablePlates
        : DEFAULT_PLATES[unit];

    setExercises(prev =>
      prev.map(ex => {
        if (ex.id !== exerciseId) return ex;
        const firstWorking = ex.sets.find(s => !isWarmupSet(s));
        const workingWeight = firstWorking?.weight ?? 0;
        if (!Number.isFinite(workingWeight) || workingWeight <= 0) return ex;

        const warmups = generateWarmupSets(workingWeight, {
          barbellWeight,
          availablePlates,
          unit,
        });
        if (warmups.length === 0) return ex;

        return {
          ...ex,
          sets: applyWarmupSets(ex.sets, warmups),
        };
      }),
    );
  };

  const handleToggleSet = (exerciseId: string, setId: string) => {
    const targetEx = exercises.find((ex) => ex.id === exerciseId);
    const prevSet = targetEx?.sets.find((s) => s.id === setId);
    if (!targetEx || !prevSet) return;

    const willComplete = !prevSet.completed;
    const nextExercises = exercises.map((ex) => {
      if (ex.id !== exerciseId) return ex;
      return {
        ...ex,
        sets: ex.sets.map((s) => (s.id === setId ? { ...s, completed: willComplete } : s)),
      };
    });

    setExercises(nextExercises);

    if (!willComplete) return;

    if (settings?.vibrateOnComplete) {
      try {
        window.navigator.vibrate(50);
      } catch {}
    }
    if (settings?.soundEnabled) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
        osc.onended = () => ctx.close();
      } catch {}
    }

    const updatedEx = nextExercises.find((ex) => ex.id === exerciseId)!;
    const toggledSet = updatedEx.sets.find((s) => s.id === setId)!;
    const isWarmup = isWarmupSet(toggledSet);
    const outcome = resolveSupersetSetCompletion(nextExercises, exerciseId, setId);

    if (outcome.shouldStartRest) {
      const restLabel = outcome.roundCompleted && outcome.groupLabel
        ? `${outcome.groupLabel} · Round ${outcome.roundNumber}/${outcome.totalRounds} done`
        : 'Recovery';
      startRestTimer(outcome.restSeconds, restLabel);
      setSupersetBanner(null);
      setActiveSupersetFocusId(outcome.nextExerciseId);
    } else if (outcome.nextExerciseId && outcome.nextLabel && outcome.nextExerciseName) {
      setExpandedExercises((prev) => ({
        ...prev,
        [outcome.nextExerciseId!]: true,
      }));
      setActiveSupersetFocusId(outcome.nextExerciseId);
      setSupersetBanner({
        groupLabel: outcome.groupLabel || 'Superset',
        nextLabel: outcome.nextLabel,
        nextExerciseName: outcome.nextExerciseName,
        targetExerciseId: outcome.nextExerciseId,
      });
      if (supersetBannerTimeoutRef.current) {
        clearTimeout(supersetBannerTimeoutRef.current);
      }
      supersetBannerTimeoutRef.current = setTimeout(() => {
        setSupersetBanner(null);
      }, 3500);
      setTimeout(() => {
        document
          .getElementById(`exercise-card-${outcome.nextExerciseId}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 120);
    }

    // Live PR Toast Detection (working sets only, mode-aware)
    if (!isWarmup && !achievedPRs.includes(updatedEx.id)) {
      const mode = getExerciseTrackingMode(updatedEx);
      const unitLabel = settings?.weightUnit || 'kg';
      let isNewPR = false;
      let prLabel = '';

      if (mode === 'timed') {
        const curDur = toggledSet.duration ?? 0;
        let prevMaxDur = 0;
        updatedEx.history.forEach((hist) => {
          hist.sets.forEach((hs) => {
            if (hs.completed && !isWarmupSet(hs) && (hs.duration ?? 0) > prevMaxDur) {
              prevMaxDur = hs.duration ?? 0;
            }
          });
        });
        if (curDur > prevMaxDur && curDur > 0) {
          isNewPR = true;
          prLabel = `${formatDurationCompact(curDur)} Hold`;
        }
      } else if (mode === 'weight_reps' || (mode === 'bodyweight_reps' && toggledSet.weight > 0)) {
        const currentWeight = toggledSet.weight || 0;
        let previousMaxWeight = 0;
        updatedEx.history.forEach((hist) => {
          hist.sets.forEach((hs) => {
            if (hs.completed && !isWarmupSet(hs) && hs.weight > previousMaxWeight) {
              previousMaxWeight = hs.weight;
            }
          });
        });
        if (currentWeight > previousMaxWeight && currentWeight > 0) {
          isNewPR = true;
          prLabel = `${currentWeight} ${unitLabel}`;
        }
      }

      if (isNewPR) {
        setAchievedPRs((prev) => [...prev, updatedEx.id]);
        setPrNotification({ exerciseName: updatedEx.name, valueLabel: prLabel });
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.3 }, zIndex: 100 });
        setTimeout(() => {
          setPrNotification(null);
        }, 4000);
      }
    }
  };

  const startRestTimer = (seconds: number, label = 'Recovery') => {
    if (seconds <= 0) return;
    const end = Date.now() + seconds * 1000;
    lastSpokenSecondRef.current = null;
    setRestSubtitle(label);
    setInitialRestTimer(seconds);
    setRestEndTime(end);
    setRestTimer(seconds);
  };

  useEffect(() => {
    if (restEndTime === null) return;

    let completed = false;
    const tick = () => {
      if (completed) return;
      const remaining = Math.max(0, Math.ceil((restEndTime - Date.now()) / 1000));
      if (remaining <= 0) {
        completed = true;
        clearInterval(interval);
        const currentSettings = settingsRef.current;
        if (currentSettings?.soundEnabled) {
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            osc.connect(ctx.destination);
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            osc.start();
            osc.onended = () => ctx.close();
            setTimeout(() => osc.stop(), 300);
          } catch (e) {}
        }
        if (currentSettings?.vibrateOnComplete) {
          try { window.navigator.vibrate([200, 100, 200]); } catch (e) {}
        }
        lastSpokenSecondRef.current = null;
        setRestEndTime(null);
        setRestTimer(null);
        setInitialRestTimer(null);
        return;
      }

      setRestTimer((prev) => (prev === remaining ? prev : remaining));

      const currentSettings = settingsRef.current;
      if (currentSettings?.voiceCountdownEnabled && remaining >= 1 && remaining <= 5 && lastSpokenSecondRef.current !== remaining) {
        lastSpokenSecondRef.current = remaining;
        try {
          const utterance = new SpeechSynthesisUtterance(String(remaining));
          utterance.rate = 1.5;
          utterance.pitch = 1.2;
          window.speechSynthesis.speak(utterance);
        } catch (e) {}
      }
    };

    const interval = setInterval(tick, 250);
    tick();
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [restEndTime]);

  const handleOpenNotes = (e: React.MouseEvent, ex: Exercise) => {
    e.stopPropagation();
    setNoteConfig({ isOpen: true, exerciseId: ex.id, initialValue: ex.notes || '' });
  };

  const handleSaveNotes = (val: string) => {
    if (!noteConfig) return;
    setExercises(prev => prev.map(ex => ex.id === noteConfig.exerciseId ? { ...ex, notes: val } : ex));
    setNoteConfig(null);
  };

  const handleOpenSwap = (e: React.MouseEvent, ex: Exercise) => {
    e.stopPropagation();
    const muscleGroup = (ex.muscleGroup && ex.muscleGroup.length > 0) ? ex.muscleGroup : getExerciseMuscleGroups(ex.name);
    setSwapConfig({ isOpen: true, exercise: { ...ex, muscleGroup } });
  };

  const handleOpenPlateCalc = (e: React.MouseEvent, ex: Exercise) => {
    e.stopPropagation();
    const nextWorking = ex.sets.find((s) => !s.completed && !isWarmupSet(s) && s.weight > 0);
    const nextUncompleted = ex.sets.find((s) => !s.completed && s.weight > 0);
    const firstWorking = ex.sets.find((s) => !isWarmupSet(s) && s.weight > 0);
    const firstWeighted = ex.sets.find((s) => s.weight > 0);
    setPlateCalcConfig({
      isOpen: true,
      exerciseId: ex.id,
      exerciseName: ex.name,
      weight: nextWorking?.weight ?? nextUncompleted?.weight ?? firstWorking?.weight ?? firstWeighted?.weight ?? 0,
    });
  };

  const handleApplySwap = async (newName: string, newMuscleGroups?: string[], primary?: string, secondary?: string[]) => {
    if (!swapConfig) return;

    // Fetch global history for this exercise from all sessions
    const globalHistory = sessions
      .filter(s => s.exercisesSnapshot.some(e => e.name.toLowerCase() === newName.toLowerCase()))
      .map(s => {
        const matchingEx = s.exercisesSnapshot.find(e => e.name.toLowerCase() === newName.toLowerCase());
        return {
          sessionId: s.id,
          date: s.date,
          sets: matchingEx?.sets || []
        };
      })
      .sort((a, b) => a.date - b.date);

    // Get the last set configuration if history exists, otherwise use defaults
    const mockEx: Exercise = {
      ...swapConfig.exercise,
      name: newName,
      muscleGroup: newMuscleGroups || swapConfig.exercise.muscleGroup,
      primaryMuscle: primary || '',
      secondaryMuscles: secondary || [],
      history: globalHistory,
      notes: '' // Reset notes for new exercise
    };
    
    // Process new sets through smart coach
    // Since swapConfig.exercise already has template sets (e.g., 4 sets defined previously),
    // mockEx will receive exactly that number of generated sets!
    const newSets = computeSmartSets(mockEx, isDeloadDay, settings);

    setExercises(prev => prev.map(ex => 
      ex.id === swapConfig.exercise.id 
      ? { 
          ...mockEx,
          sets: newSets
        } 
      : ex
    ));
    setSwapConfig(null);
  };

  const handleToggleSuperset = async (index: number) => {
    setExercises((prev) => toggleSupersetLink(prev, index, generateId));
  };

  const handleFinishWorkout = async () => {
    if ((!isFreestyle && (!program || !day)) || exercises.length === 0) return;

    isFinishingRef.current = true;
    const cacheKey = isFreestyle
      ? 'dragoriano_session_freestyle'
      : `dragoriano_session_${program!.id}_${day!.id}`;
    localStorage.removeItem(cacheKey);

    const sessionId = generateId();
    const { totalVolume, detectedPRs } = detectSessionPRs(exercises);

    const updatedExercises = exercises.map((ex) => ({
      ...ex,
      history: [...ex.history, { sessionId, date: Date.now(), sets: ex.sets }],
    }));

    const finalTitle = freestyleName.trim() || 'Quick Workout';
    const session: WorkoutSession = {
      id: sessionId,
      programId: isFreestyle ? FREESTYLE_PROGRAM_ID : program!.id,
      dayId: isFreestyle ? FREESTYLE_PROGRAM_ID : day!.id,
      ...(isFreestyle ? { workoutName: finalTitle } : {}),
      date: Date.now(),
      totalVolume,
      PRs: detectedPRs,
      duration: Math.floor((Date.now() - startTime) / 1000),
      exercisesSnapshot: updatedExercises
    };

    await useAppStore.getState().saveSession(session);

    if (!isFreestyle && program && day) {
      const updatedProgram = {
        ...program,
        days: program.days.map(d => d.id === day.id ? { ...d, exercises: updatedExercises } : d)
      };
      await useAppStore.getState().saveProgram(updatedProgram);

      if (settings?.overloadWarnings) {
        const sameDaySessions = sessions.filter((s) => s.dayId === day.id && s.id !== session.id);
        const pctIncrease = computeOverloadSpikePercent(totalVolume, sameDaySessions);
        if (pctIncrease > 20) {
          pendingSessionId.current = sessionId;
          setOverloadPercent(pctIncrease);
          setShowOverloadWarning(true);
          return;
        }
      }
    } else if (isFreestyle && saveAsProgram) {
      const hasActiveProgram = programs.some((p) => p.status === 'active');
      const template = buildProgramFromFreestyle(
        finalTitle,
        exercises,
        hasActiveProgram ? 'paused' : 'active',
      );
      await useAppStore.getState().saveProgram(template);
    }

    finishAndNavigate(sessionId);
  };

  const finishAndNavigate = (sessionId?: string) => {
    if (settings?.vibrateOnComplete) {
      try { window.navigator.vibrate([200, 100, 200, 100, 400]); } catch(e) {}
    }
    if (settings?.soundEnabled) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.setValueAtTime(500, ctx.currentTime + 0.15);
        osc.frequency.setValueAtTime(600, ctx.currentTime + 0.3);
        osc.frequency.setValueAtTime(800, ctx.currentTime + 0.45);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.6);
        osc.onended = () => ctx.close();
      } catch(e) {}
    }

    // Removed unconditional confetti to only trigger when actual PR is achieved during the workout

    // Fire-and-forget sync
    Promise.all([
      import('../../supabase/supabaseClient'),
      import('../../storage/supabaseSync'),
    ]).then(async ([{ supabase }, { pushToSupabase }]) => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        await pushToSupabase(data.session.user.id);
      }
    }).catch(err => console.error('Auto-sync failed:', err));

    finishNavTimeoutRef.current = setTimeout(() => {
      navigate(`/workout/summary/${sessionId || ''}`);
    }, 2000);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── Reordering Logic ─────────────────────────────────────────────
  const supersetMap = React.useMemo(() => computeSupersetMap(exercises), [exercises]);

  const blocks = React.useMemo(() => {
    const result: { id: string; exercises: Exercise[] }[] = [];
    let currentSupersetId: string | undefined = undefined;

    exercises.forEach((ex) => {
      const activeMeta = supersetMap.get(ex.id);
      if (activeMeta && activeMeta.groupId === currentSupersetId) {
        result[result.length - 1].exercises.push(ex);
      } else {
        currentSupersetId = activeMeta?.groupId;
        result.push({
          id: activeMeta?.groupId || ex.id,
          exercises: [ex]
        });
      }
    });
    return result;
  }, [exercises, supersetMap]);

  const handleReorderBlocks = (newBlocks: typeof blocks) => {
    const flattened = cleanupOrphanSupersets(newBlocks.flatMap((b) => b.exercises));
    setExercises(flattened);
  };
  const handleAddSessionExercise = (
    meta: CatalogExerciseItem,
    setsCount: number,
    repsOrDuration: number,
    trackingMode?: ExerciseTrackingMode,
  ) => {
    const newEx = buildFreestyleExercise(meta, sessions, settings, {
      setsCount,
      defaultReps: trackingMode === 'timed' ? 1 : repsOrDuration,
      defaultDuration: trackingMode === 'timed' ? repsOrDuration : 45,
      trackingMode,
      isDeload: isDeloadDay,
    });
    setExercises((prev) => [...prev, newEx]);
    setExpandedExercises((prev) => ({ ...prev, [newEx.id]: true }));
  };

  const handleRemoveExercise = (exId: string) => {
    setExercises((prev) => cleanupOrphanSupersets(prev.filter((ex) => ex.id !== exId)));
  };

  const muscleRecovery = React.useMemo(
    () =>
      computeMuscleRecovery(sessions, {
        customExercises,
        resolveFallbackMuscles: getExerciseMuscleGroups,
      }),
    [sessions, customExercises],
  );

  const muscleReadinessMap = React.useMemo(() => {
    const map: Record<string, MuscleRecoveryStatus> = {};
    for (const ex of exercises) {
      const { primary } = resolveExerciseBroadMuscles(
        ex,
        customExercises,
        getExerciseMuscleGroups,
      );
      if (!primary) continue;
      const status = muscleRecovery.find((r) => r.muscle === primary);
      if (status) map[ex.id] = status;
    }
    return map;
  }, [exercises, muscleRecovery, customExercises]);

  const collapseAll = () => setExpandedExercises({});

  if (!isHydrated) {
    return <div className="p-4 flex justify-center items-center h-full text-muted">Loading...</div>;
  }

  if (!isFreestyle && (!program || !day)) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-[100dvh] bg-page text-content gap-4 text-center">
        <p className="text-lg font-bold text-red-500">Workout day or program not found.</p>
        <button
          onClick={() => navigate('/')}
          className="rounded-xl bg-primary-500 px-6 py-2 font-bold text-white hover:bg-primary-400"
        >
          Go Back Home
        </button>
      </div>
    );
  }

  const totalSets = exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
  const completedSets = exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.completed).length, 0);
  const totalVolume = exercises.reduce(
    (acc, ex) => {
      const mode = getExerciseTrackingMode(ex);
      return acc + ex.sets.reduce((sum, s) => sum + calculateSetWorkingVolume(s, mode), 0);
    },
    0,
  );
  const progressPercent = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

  return (
    <div className="flex h-[100dvh] w-full justify-center bg-transparent font-sans text-content overflow-x-hidden">
      <div className="relative flex h-full w-full max-w-[460px] flex-col bg-transparent sm:border-x sm:border-content/10 sm:shadow-2xl">
        <header className="liquid-glass-strong sticky top-0 z-40 border-x-0 border-t-0">
          <div className="flex w-full items-center justify-between px-4 pb-3.5 pt-safe">
            <button
              onClick={() => navigate(-1)}
              aria-label="Back"
              className="liquid-btn-glass flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-content transition-colors cursor-pointer"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="min-w-0 flex-1 px-2 text-center">
              {isFreestyle ? (
                isEditingTitle ? (
                  <input
                    type="text"
                    autoFocus
                    value={freestyleName}
                    onChange={(e) => setFreestyleName(e.target.value)}
                    onBlur={() => setIsEditingTitle(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'Escape') setIsEditingTitle(false);
                    }}
                    className="liquid-input mx-auto w-full max-w-[190px] rounded-xl px-2 py-0.5 text-center text-base font-extrabold tracking-tight outline-none"
                    aria-label="Workout name"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingTitle(true)}
                    className="inline-flex max-w-full items-center justify-center gap-1.5 text-base font-extrabold tracking-tight hover:text-primary-400 transition-colors cursor-pointer"
                  >
                    <span className="truncate">{freestyleName || 'Quick Workout'}</span>
                    <Edit2 size={13} className="shrink-0 text-muted" />
                  </button>
                )
              ) : (
                <h1 className="truncate text-base font-extrabold tracking-tight">{day!.name}</h1>
              )}
              <p className="font-mono text-[11px] font-semibold text-muted tabular-nums">
                {exercises.length} exercises · {completedSets}/{totalSets} sets
              </p>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-1.5">
              <button
                onClick={() => setPlateCalcConfig({ isOpen: true, weight: 0 })}
                className="liquid-btn-glass flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:text-primary-400 transition-colors cursor-pointer"
                title="Plate Calculator"
                aria-label="Plate Calculator"
              >
                <Calculator size={17} />
              </button>
              <button
                onClick={() => setShowRestartConfirm(true)}
                className="liquid-btn-danger flex h-10 w-10 items-center justify-center rounded-xl transition-colors cursor-pointer"
                title="Restart Workout"
                aria-label="Restart Workout"
              >
                <RotateCcw size={16} />
              </button>
              <div className="liquid-glass rounded-xl px-2.5 py-2 font-mono text-xs font-bold text-primary-400 tabular-nums">
                {formatTime(elapsedTime)}
              </div>
            </div>
          </div>
          <Progress value={progressPercent} className="h-[3px] rounded-none border-0 bg-content/10" />
        </header>

        {isDeloadDay && (
          <div className="border-b border-sky-500/20 bg-sky-500/12 px-4 py-2 text-center backdrop-blur-md">
            <p className="text-xs font-bold text-sky-400">
              Deload Day — Lighter targets focused on form &amp; recovery
            </p>
          </div>
        )}

        <main className="w-full flex-1 overflow-y-auto overscroll-y-contain overflow-x-hidden p-4 pb-44">
        {isFreestyle && exercises.length === 0 ? (
          <div className="rounded-3xl bg-card border border-content/10 p-6 text-center space-y-4 mt-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
              <Zap size={26} />
            </div>
            <div>
              <h2 className="text-xl font-black text-content">Quick Freestyle Workout</h2>
              <p className="text-xs text-muted mt-1">
                Build your session on the fly. Recovered muscles ready to train:
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {muscleRecovery
                .filter((m) => m.readiness === 'ready')
                .slice(0, 5)
                .map((m) => (
                  <button
                    key={m.muscle}
                    type="button"
                    onClick={() => setIsAddExerciseOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-3 py-1 text-xs font-bold text-emerald-400"
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    {m.muscle} · {m.recoveryPercent}%
                  </button>
                ))}
            </div>
            <button
              type="button"
              onClick={() => setIsAddExerciseOpen(true)}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary-500 py-3.5 text-sm font-black text-white shadow-lg shadow-primary-500/30 hover:bg-primary-400 active:scale-95 transition-all cursor-pointer"
            >
              <Plus size={18} /> Add First Exercise
            </button>
          </div>
        ) : (
          <>
            <Reorder.Group 
              axis="y" 
              values={blocks} 
              onReorder={handleReorderBlocks} 
              className="grid gap-4 w-full max-w-full"
            >
              {blocks.map((block) => (
                <WorkoutBlock 
                  key={block.id}
                  block={block}
                  exercises={exercises}
                  expandedExercises={expandedExercises}
                  supersetMap={supersetMap}
                  activeSupersetFocusId={activeSupersetFocusId}
                  toggleExercise={toggleExercise}
                  handleToggleSet={handleToggleSet}
                  handleUpdateSet={handleUpdateSet}
                  handleDeleteSet={handleDeleteSet}
                  handleAddSet={handleAddSet}
                  handleUpdateRestTimer={handleUpdateRestTimer}
                  handleUpdateGroupRestTimer={handleUpdateGroupRestTimer}
                  handleUpdateTrackingMode={handleUpdateTrackingMode}
                  handleGenerateWarmup={handleGenerateWarmup}
                  handleOpenNotes={handleOpenNotes}
                  handleOpenSwap={handleOpenSwap}
                  handleOpenPlateCalc={handleOpenPlateCalc}
                  setChartConfig={setChartConfig}
                  handleToggleSuperset={handleToggleSuperset}
                  settings={settings}
                  isDeloadDay={isDeloadDay}
                  muscleReadinessMap={muscleReadinessMap}
                  onRemoveExercise={isFreestyle ? handleRemoveExercise : undefined}
                  onDragStart={collapseAll}
                />
              ))}
            </Reorder.Group>

            <button
              type="button"
              onClick={() => setIsAddExerciseOpen(true)}
              className="mt-4 w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-content/15 bg-card/40 py-3.5 text-sm font-bold text-primary-400 hover:border-primary-500/40 hover:bg-primary-500/5 active:scale-[0.99] transition-all"
            >
              <Plus size={17} /> Add Exercise
            </button>
          </>
        )}
      </main>

      <div className="liquid-glass-strong fixed bottom-0 left-1/2 z-40 w-full max-w-[460px] -translate-x-1/2 border-x-0 border-b-0 pb-safe">
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between px-1">
            <div className="flex items-center gap-4 text-xs font-bold text-muted tabular-nums">
              <div className="flex items-center gap-1.5">
                <Dumbbell size={15} className="text-primary-400" />
                <span>{totalVolume.toLocaleString()} {settings?.weightUnit || 'kg'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-400" />
                <span>{completedSets}/{totalSets} sets</span>
              </div>
            </div>
            <div className="font-mono text-xs font-bold text-primary-400 tabular-nums">
              {progressPercent}%
            </div>
          </div>
          <Button
            size="lg"
            disabled={exercises.length === 0}
            onClick={() => setShowFinishConfirm(true)}
            className="w-full font-extrabold"
          >
            <CheckCircle2 size={18} />
            Finish Workout
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {supersetBanner && (
          <motion.button
            type="button"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            onClick={() => {
              document
                .getElementById(`exercise-card-${supersetBanner.targetExerciseId}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              setSupersetBanner(null);
            }}
            className="liquid-glass-strong fixed bottom-[126px] left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-[428px] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border-amber-500/40 px-4 py-3 text-left"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                ⚡ {supersetBanner.groupLabel} · Auto-Advance
              </p>
              <p className="text-sm font-bold text-content truncate">
                Next up: {supersetBanner.nextLabel} — {supersetBanner.nextExerciseName}
              </p>
            </div>
            <span className="shrink-0 rounded-lg bg-amber-500/20 px-2.5 py-1 text-[10px] font-black uppercase text-amber-400">
              Jump
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <RestTimerOverlay
        restTimer={restTimer}
        initialRestTimer={initialRestTimer}
        subtitle={restSubtitle}
        onSubtract15={() => {
          if (restEndTime === null) return;
          const nextEnd = Math.max(Date.now() + 1000, restEndTime - 15000);
          const nextRemaining = Math.max(1, Math.ceil((nextEnd - Date.now()) / 1000));
          lastSpokenSecondRef.current = null;
          setRestEndTime(nextEnd);
          setRestTimer(nextRemaining);
        }}
        onAdd15={() => {
          const baseEnd = restEndTime ?? Date.now();
          const nextEnd = baseEnd + 15000;
          const nextRemaining = Math.max(1, Math.ceil((nextEnd - Date.now()) / 1000));
          lastSpokenSecondRef.current = null;
          setRestEndTime(nextEnd);
          setRestTimer(nextRemaining);
          setInitialRestTimer((prev) => (prev || 0) + 15);
        }}
        onSkip={() => {
          lastSpokenSecondRef.current = null;
          setRestEndTime(null);
          setRestTimer(null);
          setInitialRestTimer(null);
        }}
      />

      <AnimatePresence>
        {prNotification && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-20 left-1/2 z-[70] w-[calc(100%-2rem)] max-w-[428px] -translate-x-1/2 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-500 p-[2px] shadow-2xl shadow-yellow-500/30"
          >
            <div className="liquid-glass-strong rounded-[14px] p-4 flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-yellow-500/20 text-yellow-500">
                <Trophy size={24} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-yellow-500">New Personal Record!</p>
                <p className="text-sm font-bold text-content leading-tight mt-0.5">{prNotification.exerciseName}</p>
                <p className="text-xs font-semibold text-muted mt-1">{prNotification.valueLabel}</p>
              </div>
              <button onClick={() => setPrNotification(null)} className="p-2 text-muted hover:text-content transition-colors">
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {chartConfig.isOpen && (
        <React.Suspense fallback={null}>
          <ExerciseChartModal isOpen={chartConfig.isOpen} exercise={chartConfig.exercise} onClose={() => setChartConfig({ isOpen: false, exercise: null })} />
        </React.Suspense>
      )}
      {swapConfig && <SwapModal isOpen={swapConfig.isOpen} exerciseName={swapConfig.exercise.name} muscleGroup={swapConfig.exercise.muscleGroup} primaryMuscle={swapConfig.exercise.primaryMuscle} secondaryMuscles={swapConfig.exercise.secondaryMuscles} onSwap={handleApplySwap} onClose={() => setSwapConfig(null)} />}
      <PlateCalculatorModal
        isOpen={plateCalcConfig.isOpen}
        initialWeight={plateCalcConfig.weight}
        exerciseName={plateCalcConfig.exerciseName}
        onApplyWeight={
          plateCalcConfig.exerciseId
            ? (newWeight) => {
                const targetExId = plateCalcConfig.exerciseId;
                setExercises((prev) =>
                  prev.map((ex) => {
                    if (ex.id !== targetExId || ex.sets.length === 0) return ex;
                    const nextWorkingIdx = ex.sets.findIndex((s) => !s.completed && !isWarmupSet(s));
                    const nextIdx = nextWorkingIdx !== -1 ? nextWorkingIdx : ex.sets.findIndex((s) => !s.completed);
                    const idxToUpdate = nextIdx !== -1 ? nextIdx : ex.sets.length - 1;
                    return {
                      ...ex,
                      sets: ex.sets.map((s, idx) =>
                        idx === idxToUpdate ? { ...s, weight: newWeight } : s,
                      ),
                    };
                  }),
                );
              }
            : undefined
        }
        onClose={() => setPlateCalcConfig({ isOpen: false, weight: 0 })}
      />
      
      <AnimatePresence>
        {showFinishConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-page/80 p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-[32px] bg-card p-6 border border-content/5 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-6 opacity-5">
                <Dumbbell size={120} />
              </div>
              <div className="relative z-10">
                <h3 className="text-2xl font-black uppercase tracking-wide mb-2">Finish Workout?</h3>
                <p className="text-muted text-sm font-medium mb-4 leading-relaxed">
                  You've completed <span className="text-emerald-500 font-bold">{completedSets}</span> out of <span className="text-content font-bold">{totalSets}</span> sets and lifted a total of <span className="text-primary-500 font-bold">{totalVolume.toLocaleString()} {settings?.weightUnit || 'kg'}</span>.
                  {completedSets < totalSets && (
                    <span className="block mt-2 text-amber-500 font-bold">You have {totalSets - completedSets} unfinished sets.</span>
                  )}
                </p>

                {isFreestyle && (
                  <label className="mb-5 flex items-center gap-2.5 rounded-xl bg-surface border border-content/10 px-3 py-2.5 text-xs font-bold text-content cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveAsProgram}
                      onChange={(e) => setSaveAsProgram(e.target.checked)}
                      className="h-4 w-4 accent-primary-500 rounded"
                    />
                    <span>Save this workout as a reusable program</span>
                  </label>
                )}
                
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    onClick={() => setShowFinishConfirm(false)}
                    className="flex-1"
                  >
                    Keep Going
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    onClick={() => {
                      setShowFinishConfirm(false);
                      handleFinishWorkout();
                    }}
                    className="flex-1"
                  >
                    Finish
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <ConfirmModal
        isOpen={showRestartConfirm}
        title="Restart Workout"
        message="Clear all logged sets and timers for this session?"
        confirmText="Restart"
        isDestructive
        onCancel={() => setShowRestartConfirm(false)}
        onConfirm={() => {
          setShowRestartConfirm(false);
          const cacheKey = isFreestyle
            ? 'dragoriano_session_freestyle'
            : `dragoriano_session_${programId}_${dayId}`;
          localStorage.removeItem(cacheKey);
          setStartTime(Date.now());
          if (isFreestyle || !day) {
            setExercises((prev) =>
              prev.map((ex) => ({
                ...ex,
                sets: ex.sets.map((s) => ({ ...s, completed: false, rpe: undefined })),
              })),
            );
            toast.success('Workout restarted');
            return;
          }
          const isDeload = !!day.isDeloadDay;
          setIsDeloadDay(isDeload);
          const processedExercises = day.exercises.map((ex) => {
            const globalHistory = sessions
              .filter((s) =>
                s.exercisesSnapshot?.some(
                  (e) => e.name.toLowerCase().trim() === ex.name.toLowerCase().trim(),
                ),
              )
              .map((s) => {
                const matchingEx = s.exercisesSnapshot.find(
                  (e) => e.name.toLowerCase().trim() === ex.name.toLowerCase().trim(),
                );
                return {
                  sessionId: s.id,
                  date: s.date,
                  sets: matchingEx?.sets || [],
                };
              })
              .sort((a, b) => a.date - b.date);
            const exWithHistory = { ...ex, history: globalHistory };
            return { ...exWithHistory, sets: computeSmartSets(exWithHistory, isDeload, settings) };
          });
          setExercises(processedExercises);
          if (processedExercises.length > 0) {
            setExpandedExercises({ [processedExercises[0].id]: true });
          }
          toast.success('Workout restarted');
        }}
      />
      {noteConfig && <PromptModal isOpen={noteConfig.isOpen} title="Exercise Notes" initialValue={noteConfig.initialValue} onConfirm={handleSaveNotes} onCancel={() => setNoteConfig(null)} placeholder="Enter any notes for this exercise..." />}
      <QuickAddExerciseModal
        isOpen={isAddExerciseOpen}
        onClose={() => setIsAddExerciseOpen(false)}
        readyMuscles={muscleRecovery}
        onAddExercise={handleAddSessionExercise}
      />
      {showOverloadWarning && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 backdrop-blur-md">
        <div className="liquid-glass-strong w-full max-w-sm rounded-3xl p-6 text-center border-amber-500/30">
          <div className="text-4xl mb-3">⚠️</div>
          <h3 className="text-xl font-bold mb-2">Volume Spike Detected</h3>
          <p className="text-muted mb-2">Your volume is <span className="text-amber-400 font-bold">{overloadPercent}% higher</span> than your recent average for this day.</p>
          <p className="text-sm text-muted mb-6">Consider if this is intentional — high spikes can increase injury risk and impair recovery.</p>
          <button className="liquid-btn-primary w-full rounded-2xl py-3.5 font-bold active:scale-95 transition-transform cursor-pointer" onClick={() => { setShowOverloadWarning(false); finishAndNavigate(pendingSessionId.current || undefined); }}>Understood, Finish</button>
        </div>
      </div>}
      </div>
    </div>
  );
}
