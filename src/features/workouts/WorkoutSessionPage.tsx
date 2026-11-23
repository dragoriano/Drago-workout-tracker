import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calculator, ChevronLeft, RotateCcw, Dumbbell, CheckCircle2, Trophy, X, Edit2, Plus, Zap } from 'lucide-react';
import type { Exercise, Set, WorkoutSession } from '../../types';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import confetti from 'canvas-confetti';
import { PromptModal } from '../../components/ui/PromptModal';
import { SwapModal } from '../../components/ui/SwapModal';
import { PlateCalculatorModal } from '../../components/ui/PlateCalculatorModal';
import { getExerciseMuscleGroups } from '../../data/exercises';
import { generateId } from '../../utils/uuid';
import { useAppStore } from '../../store/useAppStore';
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
  DEFAULT_BARBELL_WEIGHT,
  DEFAULT_PLATES,
  isWarmupSet,
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
  const [prNotification, setPrNotification] = useState<{ exerciseName: string, weight: number } | null>(null);
  const pendingSessionId = useRef<string | null>(null);
  const isFinishingRef = useRef(false);
  const initializedSessionKeyRef = useRef<string | null>(null);
  const finishNavTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [restEndTime, setRestEndTime] = useState<number | null>(null);
  const lastSpokenSecondRef = useRef<number | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

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
        const workingSets = ex.sets.filter(s => !isWarmupSet(s));
        const refSet = workingSets[workingSets.length - 1] ?? ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [...ex.sets, {
            id: generateId(),
            weight: refSet ? refSet.weight : 0,
            reps: refSet ? refSet.reps : 0,
            completed: false,
            setType: 'working',
          }]
        };
      }
      return ex;
    }));
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
    const barbellWeight = settings?.barbellWeight ?? DEFAULT_BARBELL_WEIGHT[unit];
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
    setExercises(prev => prev.map(ex => {
      if (ex.id !== exerciseId) return ex;
      
      const newSets = ex.sets.map(s => {
        if (s.id !== setId) return s;
        if (!s.completed) {
          if (settings?.vibrateOnComplete) {
            try { window.navigator.vibrate(50); } catch (e) {}
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
            } catch(e) {}
          }
        }
        return { ...s, completed: !s.completed };
      });

      const toggledSet = newSets.find(s => s.id === setId);
      if (toggledSet?.completed) {
        const isWarmup = isWarmupSet(toggledSet);
        startRestTimer(isWarmup ? Math.min(ex.restTimerConfig, 60) : ex.restTimerConfig);

        // PR Detection (working sets only)
        const currentWeight = toggledSet.weight || 0;
        if (!isWarmup && currentWeight > 0) {
          let previousMaxWeight = 0;
          ex.history.forEach(hist => {
            hist.sets.forEach(hs => {
              if (hs.completed && !isWarmupSet(hs) && hs.weight > previousMaxWeight) previousMaxWeight = hs.weight;
            });
          });
          
          if (currentWeight > previousMaxWeight && !achievedPRs.includes(ex.id)) {
            setAchievedPRs(prev => [...prev, ex.id]);
            setPrNotification({ exerciseName: ex.name, weight: currentWeight });
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.3 }, zIndex: 100 });
            
            setTimeout(() => {
              setPrNotification(null);
            }, 4000);
          }
        }
      }

      return { ...ex, sets: newSets };
    }));
  };

  const startRestTimer = (seconds: number) => {
    if (seconds <= 0) return;
    const end = Date.now() + seconds * 1000;
    lastSpokenSecondRef.current = null;
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
    if (index === 0) return;
    const currentEx = exercises[index];
    const prevEx = exercises[index - 1];

    const newExercises = [...exercises];

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
    setExercises(newExercises);
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
  const blocks = React.useMemo(() => {
    const result: { id: string; exercises: Exercise[] }[] = [];
    let currentSupersetId: string | undefined = undefined;

    exercises.forEach((ex) => {
      if (ex.supersetId && ex.supersetId === currentSupersetId) {
        result[result.length - 1].exercises.push(ex);
      } else {
        currentSupersetId = ex.supersetId;
        result.push({
          id: ex.supersetId || ex.id,
          exercises: [ex]
        });
      }
    });
    return result;
  }, [exercises]);

  const handleReorderBlocks = (newBlocks: typeof blocks) => {
    const flattened = newBlocks.flatMap((b) => b.exercises);
    setExercises(flattened);
  };
  const handleAddSessionExercise = (
    meta: CatalogExerciseItem,
    setsCount: number,
    reps: number,
  ) => {
    const newEx = buildFreestyleExercise(meta, sessions, settings, {
      setsCount,
      defaultReps: reps,
      isDeload: isDeloadDay,
    });
    setExercises((prev) => [...prev, newEx]);
    setExpandedExercises((prev) => ({ ...prev, [newEx.id]: true }));
  };

  const handleRemoveExercise = (exId: string) => {
    setExercises((prev) => prev.filter((ex) => ex.id !== exId));
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
          className="rounded-xl bg-primary-500 px-6 py-2 font-bold text-content hover:bg-primary-400"
        >
          Go Back Home
        </button>
      </div>
    );
  }

  const totalSets = exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
  const completedSets = exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.completed).length, 0);
  const totalVolume = exercises.reduce(
    (acc, ex) =>
      acc +
      ex.sets
        .filter((s) => s.completed && !isWarmupSet(s))
        .reduce((sum, s) => sum + s.weight * s.reps, 0),
    0,
  );
  const progressPercent = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-transparent font-sans text-content overflow-x-hidden">
      <header className="sticky top-0 z-40 flex items-center justify-between bg-page px-4 py-4 backdrop-blur-md border-b border-content/5">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-content hover:bg-page/10 rounded-full transition-colors">
          <ChevronLeft size={24}/>
        </button>
        <div className="text-center flex-1 min-w-0 px-2">
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
                className="w-full max-w-[200px] mx-auto bg-card border border-primary-500/40 rounded-lg px-2 py-0.5 text-center text-base font-black uppercase tracking-wide outline-none"
                aria-label="Workout name"
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingTitle(true)}
                className="inline-flex items-center justify-center gap-1.5 text-lg font-black uppercase tracking-wide hover:text-primary-400 transition-colors max-w-full"
              >
                <span className="truncate">{freestyleName || 'Quick Workout'}</span>
                <Edit2 size={13} className="text-muted shrink-0" />
              </button>
            )
          ) : (
            <h1 className="text-lg font-black uppercase tracking-wide truncate">{day!.name}</h1>
          )}
          <p className="text-xs text-muted font-medium">{exercises.length} exercises • {completedSets}/{totalSets} sets</p>
        </div>
        <div className="flex items-center justify-end gap-1.5 shrink-0">
          <button
            onClick={() => setPlateCalcConfig({ isOpen: true, weight: 0 })}
            className="p-1.5 text-muted hover:text-primary-400 transition-colors"
            title="Plate Calculator"
          >
            <Calculator size={16} />
          </button>
          <button 
            onClick={() => {
              if (window.confirm("Restart this workout and clear all unsaved progress?")) {
                const cacheKey = isFreestyle
                  ? 'dragoriano_session_freestyle'
                  : `dragoriano_session_${programId}_${dayId}`;
                localStorage.removeItem(cacheKey);
                setStartTime(Date.now());
                if (isFreestyle || !day) {
                  setExercises(prev =>
                    prev.map(ex => ({
                      ...ex,
                      sets: ex.sets.map(s => ({ ...s, completed: false, rpe: undefined })),
                    })),
                  );
                  return;
                }
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
              }
            }}
            className="p-1.5 text-red-500/60 hover:text-red-500 transition-colors"
            title="Restart Workout"
          >
            <RotateCcw size={16}/>
          </button>
          <div className="text-primary-400 font-bold font-mono text-[15px] tabular-nums mt-[1px]">
            {formatTime(elapsedTime)}
          </div>
        </div>
      </header>

      {isDeloadDay && (
        <div className="bg-sky-500/10 border-b border-sky-500/20 px-4 py-2.5 flex items-center gap-2">
          <span className="text-sky-400 text-sm">❄️</span>
          <p className="text-sm font-bold text-sky-300">Deload Day <span className="font-normal text-sky-400/70">— Light weights, focus on form &amp; recovery</span></p>
        </div>
      )}

      <main className="flex-1 overflow-y-auto overflow-x-hidden w-full p-4 pb-40">
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
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary-500 py-3.5 text-sm font-black text-content shadow-lg shadow-primary-500/30 hover:bg-primary-400 active:scale-95 transition-all"
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
                  toggleExercise={toggleExercise}
                  handleToggleSet={handleToggleSet}
                  handleUpdateSet={handleUpdateSet}
                  handleDeleteSet={handleDeleteSet}
                  handleAddSet={handleAddSet}
                  handleUpdateRestTimer={handleUpdateRestTimer}
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

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-page border-t border-content/5 p-4 pb-safe backdrop-blur-xl">
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex items-center gap-4 text-sm font-bold text-muted">
            <div className="flex items-center gap-1.5"><Dumbbell size={16}className="text-primary-500" /><span>{totalVolume.toLocaleString()} {settings?.weightUnit || 'kg'}</span></div>
            <div className="flex items-center gap-1.5"><CheckCircle2 size={16}className="text-emerald-500" /><span>{completedSets}/{totalSets} sets</span></div>
          </div>
          <div className="text-sm font-bold text-primary-400">{progressPercent}%</div>
        </div>
        <button
          disabled={exercises.length === 0}
          onClick={() => setShowFinishConfirm(true)}
          className="w-full rounded-2xl bg-primary-500 py-4 text-base font-black text-content shadow-lg shadow-primary-500/40 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
        >
          <CheckCircle2 size={20}/> FINISH WORKOUT
        </button>
      </div>

      <RestTimerOverlay
        restTimer={restTimer}
        initialRestTimer={initialRestTimer}
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
            className="fixed top-20 left-4 right-4 z-[70] rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-500 p-[2px] shadow-2xl shadow-yellow-500/30"
          >
            <div className="rounded-[14px] bg-card/95 backdrop-blur-xl p-4 flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-yellow-500/20 text-yellow-500">
                <Trophy size={24} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-yellow-500">New Personal Record!</p>
                <p className="text-sm font-bold text-content leading-tight mt-0.5">{prNotification.exerciseName}</p>
                <p className="text-xs font-semibold text-muted mt-1">{prNotification.weight} {settings?.weightUnit || 'kg'}</p>
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
                  <button 
                    onClick={() => setShowFinishConfirm(false)}
                    className="flex-1 rounded-2xl bg-page/5 py-3.5 text-sm font-bold text-content hover:bg-page/10 active:scale-95 transition-all"
                  >
                    Keep Going
                  </button>
                  <button 
                    onClick={() => {
                      setShowFinishConfirm(false);
                      handleFinishWorkout();
                    }}
                    className="flex-1 rounded-2xl bg-primary-500 py-3.5 text-sm font-black text-content shadow-lg shadow-primary-500/30 active:scale-95 transition-all"
                  >
                    Finish
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {noteConfig && <PromptModal isOpen={noteConfig.isOpen} title="Exercise Notes" initialValue={noteConfig.initialValue} onConfirm={handleSaveNotes} onCancel={() => setNoteConfig(null)} placeholder="Enter any notes for this exercise..." />}
      <QuickAddExerciseModal
        isOpen={isAddExerciseOpen}
        onClose={() => setIsAddExerciseOpen(false)}
        readyMuscles={muscleRecovery}
        onAddExercise={handleAddSessionExercise}
      />
      {showOverloadWarning && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-page/80 p-4 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-3xl bg-card p-6 text-center border border-amber-500/20">
          <div className="text-4xl mb-3">⚠️</div>
          <h3 className="text-xl font-bold mb-2">Volume Spike Detected</h3>
          <p className="text-muted mb-2">Your volume is <span className="text-amber-400 font-bold">{overloadPercent}% higher</span> than your recent average for this day.</p>
          <p className="text-sm text-muted mb-6">Consider if this is intentional — high spikes can increase injury risk and impair recovery.</p>
          <button className="w-full rounded-xl bg-primary-500 py-3 font-bold active:scale-95 transition-transform" onClick={() => { setShowOverloadWarning(false); finishAndNavigate(pendingSessionId.current || undefined); }}>Understood, Finish</button>
        </div>
      </div>}
    </div>
  );
}
