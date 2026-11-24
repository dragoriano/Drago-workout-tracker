import React, { useEffect, useState } from 'react';
import { Dumbbell, Flame, Trophy, ArrowRight, Clock, BarChart3, Ruler, Zap, Target } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Progress } from '../../components/ui/Progress';
import { useNavigate } from 'react-router-dom';
import { WORKOUT_QUOTES } from '../../data/quotes';
import { MeasurementModal } from '../../components/ui/MeasurementModal';
import { computeStreaks, flattenPRs } from '../../utils/analytics';
import { computeMeasurementTrend } from '../../utils/bodyTrends';
import { computeGoalProgressPercent } from '../../utils/goalsSync';
import { computeMuscleRecovery, evaluateDayReadiness } from '../../utils/muscleRecovery';
import { estimateWorkoutDurationMinutes } from '../../utils/workoutCoach';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { OnboardingWizard } from './OnboardingWizard';
import { PullToRefresh } from '../../components/ui/PullToRefresh';
import { useAppStore } from '../../store/useAppStore';
import { PremiumIcon } from '../../components/ui/PremiumIcon';

export function HomePage() {
  const navigate = useNavigate();

  // ── Zustand store ────────────────────────────────────────────────
  const programs = useAppStore((s) => s.programs);
  const sessions = useAppStore((s) => s.sessions);
  const settings = useAppStore((s) => s.settings);
  const measurements = useAppStore((s) => s.measurements);
  const goals = useAppStore((s) => s.goals);
  const customExercises = useAppStore((s) => s.customExercises);
  const isHydrated = useAppStore((s) => s.isHydrated);
  const hydrate = useAppStore((s) => s.hydrate);

  // ── Local UI state ───────────────────────────────────────────────
  const [quote, setQuote] = useState('');
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [isMeasurementModalOpen, setIsMeasurementModalOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const activePrograms = programs.filter((p) => p.status === 'active');
  const nextProgram =
    activePrograms.length > 0
      ? [...activePrograms].sort((a, b) => b.updatedAt - a.updatedAt)[0]
      : programs.length > 0
        ? programs[0]
        : null;

  const suggestedDayId = React.useMemo(() => {
    if (!nextProgram || !nextProgram.days || nextProgram.days.length === 0) return null;

    const programSessions = sessions
      .filter((s) => s.programId === nextProgram.id && s.date)
      .sort((a, b) => a.date - b.date);

    if (programSessions.length > 0) {
      const lastSession = programSessions[programSessions.length - 1];
      const lastDayIndex = nextProgram.days.findIndex((d) => d.id === lastSession.dayId);
      if (lastDayIndex !== -1) {
        const nextDayIndex = (lastDayIndex + 1) % nextProgram.days.length;
        return nextProgram.days[nextDayIndex].id;
      }
    }

    return nextProgram.days[0].id;
  }, [nextProgram, sessions]);

  useEffect(() => {
    setQuote(WORKOUT_QUOTES[Math.floor(Math.random() * WORKOUT_QUOTES.length)]);
  }, []);

  const prevSuggestedDayIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (!isHydrated) return;

    const suggestionChanged = suggestedDayId !== prevSuggestedDayIdRef.current;
    prevSuggestedDayIdRef.current = suggestedDayId;

    if (nextProgram && nextProgram.days.length > 0) {
      setSelectedDayId((prev) => {
        if (suggestionChanged && suggestedDayId) {
          return suggestedDayId;
        }
        if (prev && nextProgram.days.some((d) => d.id === prev)) {
          return prev;
        }
        return suggestedDayId || nextProgram.days[0].id;
      });
    }
    if ((!settings || !settings.hasSeenOnboarding) && programs.length === 0) {
      setShowOnboarding(true);
    }
  }, [isHydrated, nextProgram, settings, suggestedDayId, programs]);

  const weightTrend = React.useMemo(
    () => computeMeasurementTrend(measurements, 'weight'),
    [measurements],
  );
  const latestWeight = weightTrend.latest?.value ?? null;
  const activeGoals = React.useMemo(
    () => goals.filter((g) => !g.completed).sort((a, b) => b.createdAt - a.createdAt),
    [goals],
  );
  const topGoal = activeGoals[0] ?? null;

  const { current: currentStreak, longest: bestStreak } = computeStreaks(sessions);
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklySessions = sessions.filter(
    (s) => s.date && !isNaN(new Date(s.date).getTime()) && s.date >= oneWeekAgo,
  );
  const totalVolume = weeklySessions.reduce((sum, s) => sum + (s.totalVolume || 0), 0);
  const newPRs = flattenPRs(weeklySessions).length;

  const nextDay =
    nextProgram && selectedDayId
      ? nextProgram.days.find((d) => d.id === selectedDayId) || nextProgram.days[0]
      : nextProgram?.days[0] || null;
  const estimatedDuration = estimateWorkoutDurationMinutes(nextDay);
  const weeklyVolumeK = Math.round(totalVolume / 1000);
  const volumeTargetK = Math.max(weeklyVolumeK, 20);
  const muscleRecovery = React.useMemo(
    () => computeMuscleRecovery(sessions, { customExercises }),
    [sessions, customExercises],
  );
  const nextDayReadiness = React.useMemo(
    () => (nextDay ? evaluateDayReadiness(nextDay.exercises, muscleRecovery, customExercises) : null),
    [nextDay, muscleRecovery, customExercises],
  );

  const unit = settings?.weightUnit || 'kg';

  if (!isHydrated) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center p-6 text-center text-content">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        <h2 className="mb-2 text-xl font-bold">Loading your data...</h2>
        <p className="text-sm italic text-muted">
          If this takes more than 10 seconds, please restart the app.
        </p>
      </div>
    );
  }

  if (showOnboarding) {
    return (
      <OnboardingWizard
        onComplete={() => {
          setShowOnboarding(false);
          hydrate();
        }}
      />
    );
  }

  return (
    <>
      <PullToRefresh
        onRefresh={hydrate}
        className="px-4 pb-8 text-content"
      >
        <div className="flex flex-col gap-5 pt-safe">
        {/* Compact Mobile Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-400">
              Dragoriano
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight text-content">
              Ready to Train
            </h1>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsMeasurementModalOpen(true)}
            aria-label="Log body measurement"
          >
            <Ruler size={16} className="text-primary-400" />
            <span>Log Weight</span>
          </Button>
        </div>

        {/* Hero Section: Up Next + Quick Freestyle */}
        <section className="space-y-4">
          {/* Day Selector Pills */}
          {nextProgram && nextProgram.days.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {nextProgram.days.map((day) => {
                const isSelected = nextDay?.id === day.id;
                const isSuggested = suggestedDayId === day.id;
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => setSelectedDayId(day.id)}
                    className={`liquid-pill flex min-h-[38px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                      isSelected
                        ? 'liquid-btn-primary text-white'
                        : 'liquid-btn-glass text-muted hover:text-content'
                    }`}
                  >
                    <span>{day.name}</span>
                    {isSuggested && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-primary-500/15 text-primary-400'
                        }`}
                      >
                        Next
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Hero Workout Card — Single-Column Mobile First */}
          <Card className="relative overflow-hidden p-5">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-75"
              style={{
                background:
                  'radial-gradient(circle at 92% 12%, color-mix(in srgb, var(--theme-500) 24%, transparent), transparent 58%)',
              }}
            />

            <div className="relative z-10 flex flex-col gap-4">
              <div className="min-w-0 space-y-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="primary">{nextProgram ? nextProgram.name : 'No Program'}</Badge>
                  {suggestedDayId === nextDay?.id && (
                    <Badge variant="success">Suggested Next</Badge>
                  )}
                  {nextDayReadiness &&
                    nextDayReadiness.targetMuscles.length > 0 &&
                    (nextDayReadiness.fatiguedMuscles.length > 0 ? (
                      <Badge variant="danger">
                        {nextDayReadiness.fatiguedMuscles[0].muscle}{' '}
                        {nextDayReadiness.fatiguedMuscles[0].recoveryPercent}%
                      </Badge>
                    ) : nextDayReadiness.allReady ? (
                      <Badge variant="info">Muscles Ready</Badge>
                    ) : null)}
                </div>

                <h2 className="text-2xl font-extrabold tracking-tight text-content line-clamp-1">
                  {nextDay ? nextDay.name : 'Create a program'}
                </h2>

                <div className="flex flex-wrap items-center gap-5 text-xs font-semibold text-muted">
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Clock size={14} className="text-primary-400" />
                    {estimatedDuration
                      ? `${estimatedDuration.min}–${estimatedDuration.max} mins`
                      : '0 mins'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Dumbbell size={14} className="text-primary-400" />
                    {nextDay ? nextDay.exercises.length : 0} exercises
                  </span>
                </div>
              </div>

              <Button
                size="lg"
                onClick={() => {
                  if (nextProgram && nextDay) {
                    navigate(`/workout/${nextProgram.id}/${nextDay.id}`);
                  } else {
                    navigate('/workouts');
                  }
                }}
                className="w-full font-extrabold"
              >
                <span>{nextProgram && nextDay ? 'Start Workout' : 'Browse Programs'}</span>
                <ArrowRight size={18} />
              </Button>
            </div>
          </Card>

          {/* Quick Freestyle Launcher */}
          <button
            type="button"
            onClick={() => navigate('/quick-workout')}
            className="liquid-glass liquid-glass-interactive flex min-h-[56px] w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left active:scale-[0.99] cursor-pointer"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                <Zap size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-content">Quick Freestyle Workout</p>
                <p className="truncate text-xs text-muted">
                  Train ad-hoc without a program or pick recovered muscles
                </p>
              </div>
            </div>
            <ArrowRight size={16} className="shrink-0 text-muted" />
          </button>
        </section>

        {/* Unified This Week Summary */}
        <Card className="p-4">
          <div className="mb-3.5 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted">
              <BarChart3 size={14} className="text-primary-400" />
              This Week
            </h3>
            <button
              type="button"
              onClick={() => navigate('/stats')}
              className="text-xs font-bold text-primary-400 hover:text-primary-300 cursor-pointer"
            >
              View Analytics →
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            <ProgressRing
              value={currentStreak}
              max={Math.max(bestStreak, 7)}
              size={64}
              color="#f97316"
              label="Streak"
              unit="days"
              icon={<Flame size={11} className="text-orange-400" />}
            />
            <ProgressRing
              value={weeklySessions.length}
              max={7}
              size={64}
              color="var(--theme-500)"
              label="Workouts"
              unit="/ 7"
              icon={<Dumbbell size={11} className="text-primary-400" />}
            />
            <ProgressRing
              value={weeklyVolumeK}
              max={volumeTargetK}
              size={64}
              color="#10b981"
              label="Volume"
              unit={`k ${unit}`}
              icon={<Zap size={11} className="text-emerald-400" />}
            />
            <ProgressRing
              value={newPRs}
              max={Math.max(newPRs, 5)}
              size={64}
              color="#eab308"
              label="PRs"
              icon={<Trophy size={11} className="text-amber-400" />}
            />
          </div>
        </Card>

        {/* Muscle Readiness Strip */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted">
              Muscle Readiness
            </h3>
            <button
              type="button"
              onClick={() => navigate('/stats')}
              className="text-xs font-bold text-primary-400 hover:text-primary-300 cursor-pointer"
            >
              Recovery →
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {muscleRecovery.map((item) => {
              const dotClass =
                item.readiness === 'ready'
                  ? 'bg-emerald-400'
                  : item.readiness === 'recovering'
                    ? 'bg-amber-400'
                    : 'bg-red-400';
              const pctClass =
                item.readiness === 'ready'
                  ? 'text-emerald-400'
                  : item.readiness === 'recovering'
                    ? 'text-amber-400'
                    : 'text-red-400';
              return (
                <button
                  key={item.muscle}
                  type="button"
                  onClick={() => navigate('/stats')}
                  className="liquid-glass liquid-glass-interactive min-w-[92px] shrink-0 rounded-2xl px-3 py-2 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${dotClass}`} />
                    <span className="text-[11px] font-bold text-content">{item.muscle}</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <span className={`font-mono text-xs font-bold tabular-nums ${pctClass}`}>
                      {item.recoveryPercent}%
                    </span>
                    <span className="font-mono text-[10px] font-medium text-muted tabular-nums">
                      {item.effectiveSets}s
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Body Progress & Active Goal — Single Column */}
        <div className="grid grid-cols-1 gap-4">
          <Card className="flex items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <PremiumIcon icon={Ruler} color="primary" variant="soft" size="md" />
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-content">Body Progress</h3>
                <p className="truncate text-xs text-muted tabular-nums">
                  {latestWeight
                    ? `${latestWeight} ${unit}${
                        weightTrend.movingAvg7d !== null
                          ? ` · 7d avg ${weightTrend.movingAvg7d} ${unit}`
                          : ''
                      }`
                    : 'Start tracking weight & tape'}
                </p>
                {weightTrend.weeklyRate !== null && (
                  <p className="mt-0.5 text-[11px] font-bold text-sky-400 tabular-nums">
                    Trend: {weightTrend.weeklyRate > 0 ? '+' : ''}
                    {weightTrend.weeklyRate} {unit}/wk
                  </p>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="subtle"
              onClick={() => setIsMeasurementModalOpen(true)}
              className="shrink-0"
            >
              Log
            </Button>
          </Card>

          {topGoal ? (
            <Card
              interactive
              onClick={() => navigate('/goals')}
              className="flex flex-col justify-between gap-2.5 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Target size={16} className="shrink-0 text-primary-400" />
                  <span className="truncate text-sm font-bold text-content">{topGoal.title}</span>
                  {topGoal.trackingType && topGoal.trackingType !== 'manual' && (
                    <Badge variant="info" className="text-[9px]">Auto</Badge>
                  )}
                </div>
                <span className="shrink-0 font-mono text-xs font-bold text-muted tabular-nums">
                  {topGoal.currentValue}/{topGoal.targetValue} {topGoal.unit} (
                  {computeGoalProgressPercent(topGoal)}%)
                </span>
              </div>
              <Progress value={computeGoalProgressPercent(topGoal)} />
            </Card>
          ) : (
            <Card
              interactive
              onClick={() => navigate('/goals')}
              className="flex items-center justify-between gap-3 p-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <PremiumIcon icon={Target} color="primary" variant="soft" size="md" />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-content">Set a Training Goal</h3>
                  <p className="truncate text-xs text-muted">
                    Track 1RM targets, weight, or weekly streak
                  </p>
                </div>
              </div>
              <ArrowRight size={16} className="shrink-0 text-muted" />
            </Card>
          )}
        </div>

        {/* Subtle Daily Quote Footer */}
        <p className="pt-1 text-center text-xs font-medium italic text-muted/80">
          “{quote || "Excuses don't burn calories."}”
        </p>
        </div>
      </PullToRefresh>

      <MeasurementModal
        isOpen={isMeasurementModalOpen}
        onClose={() => setIsMeasurementModalOpen(false)}
        onSaved={() => {
          setIsMeasurementModalOpen(false);
          hydrate();
        }}
      />
    </>
  );
}
