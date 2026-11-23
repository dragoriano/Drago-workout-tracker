import React, { useEffect, useState } from 'react';
import { Dumbbell, Flame, Trophy, ArrowRight, Clock, BarChart3, Star, Ruler, Zap } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { WORKOUT_QUOTES } from '../../data/quotes';
import { MeasurementModal } from '../../components/ui/MeasurementModal';
import { computeStreaks, flattenPRs } from '../../utils/analytics';
import { estimateWorkoutDurationMinutes } from '../../utils/workoutCoach';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { OnboardingWizard } from './OnboardingWizard';
import { PullToRefresh } from '../../components/ui/PullToRefresh';
import { useAppStore } from '../../store/useAppStore';
import { PremiumIcon, FilledIcon } from '../../components/ui/PremiumIcon';

export function HomePage() {
  const navigate = useNavigate();

  // ── Zustand store ────────────────────────────────────────────────
  const programs = useAppStore((s) => s.programs);
  const sessions = useAppStore((s) => s.sessions);
  const settings = useAppStore((s) => s.settings);
  const measurements = useAppStore((s) => s.measurements);
  const isHydrated = useAppStore((s) => s.isHydrated);
  const hydrate = useAppStore((s) => s.hydrate);

  // ── Local UI state ───────────────────────────────────────────────
  const [quote, setQuote] = useState('');
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [isMeasurementModalOpen, setIsMeasurementModalOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Find the next workout
  const activePrograms = programs.filter(p => p.status === 'active');
  const nextProgram = activePrograms.length > 0 
    ? activePrograms.sort((a, b) => b.updatedAt - a.updatedAt)[0] 
    : (programs.length > 0 ? programs[0] : null);

  const suggestedDayId = React.useMemo(() => {
    if (!nextProgram || !nextProgram.days || nextProgram.days.length === 0) return null;
    
    // Find sessions that match this active program
    const programSessions = sessions
      .filter(s => s.programId === nextProgram.id && s.date)
      .sort((a, b) => a.date - b.date);
      
    if (programSessions.length > 0) {
      const lastSession = programSessions[programSessions.length - 1];
      const lastDayId = lastSession.dayId;
      const lastDayIndex = nextProgram.days.findIndex(d => d.id === lastDayId);
      
      if (lastDayIndex !== -1) {
        // Suggest the next day in sequence
        const nextDayIndex = (lastDayIndex + 1) % nextProgram.days.length;
        return nextProgram.days[nextDayIndex].id;
      }
    }
    
    // Fallback to first day
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
      setSelectedDayId(prev => {
        // If the suggestedDayId changed (e.g. after completing a session), select the new suggestion
        if (suggestionChanged && suggestedDayId) {
          return suggestedDayId;
        }
        // Otherwise, keep manual selection if it's still valid in the program
        if (prev && nextProgram.days.some(d => d.id === prev)) {
          return prev;
        }
        return suggestedDayId || nextProgram.days[0].id;
      });
    }
    if ((!settings || !settings.hasSeenOnboarding) && programs.length === 0) {
      setShowOnboarding(true);
    }
  }, [isHydrated, nextProgram, settings, suggestedDayId, programs]);

  const latestWeight = (() => {
    const weightLog = measurements.filter(m => m.type === 'weight').sort((a, b) => b.date - a.date);
    return weightLog.length > 0 ? weightLog[0].value : null;
  })();

  const { current: currentStreak, longest: bestStreak } = computeStreaks(sessions);
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklySessions = sessions.filter(s => s.date && !isNaN(new Date(s.date).getTime()) && s.date >= oneWeekAgo);
  const totalVolume = weeklySessions.reduce((sum, s) => sum + (s.totalVolume || 0), 0);
  const totalWorkouts = weeklySessions.reduce((sum, s) => sum + (s.exercisesSnapshot?.length || 0), 0);
  const newPRs = flattenPRs(weeklySessions).length;

  const nextDay = nextProgram && selectedDayId 
    ? (nextProgram.days.find(d => d.id === selectedDayId) || nextProgram.days[0]) 
    : (nextProgram?.days[0] || null);
  const estimatedDuration = estimateWorkoutDurationMinutes(nextDay);
  const weeklyVolumeK = Math.round(totalVolume / 1000);
  const volumeTargetK = Math.max(weeklyVolumeK, 20);

  if (!isHydrated) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center p-6 text-center text-content">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-500 border-t-transparent mb-4" />
        <h2 className="text-xl font-bold mb-2">Loading your data...</h2>
        <p className="text-muted text-sm italic">If this takes more than 10 seconds, please restart the app.</p>
      </div>
    );
  }

  if (showOnboarding) {
    return <OnboardingWizard onComplete={() => {
      setShowOnboarding(false);
      hydrate();
    }} />;
  }

  return (
    <>
      <PullToRefresh onRefresh={hydrate} className="flex flex-col p-4 pt-8 pb-24 text-content">
        {/* Header */}
        <div className="flex items-start justify-between">
          <h1 className="text-lg font-black uppercase tracking-wider text-primary-400 leading-tight">
            DRAGORIANO WORKOUT<br />TRACKER
          </h1>
          <div className="flex gap-2">
            <Button size="icon" variant="ghost" className="rounded-full text-primary-400 hover:bg-content/10" onClick={() => setIsMeasurementModalOpen(true)} aria-label="Log body measurement">
              <Ruler size={24}/>
            </Button>
          </div>
        </div>

        {/* Daily Motivation */}
        <Card className="relative overflow-hidden border-content/5 bg-card/50 p-6 text-center shadow-lg shadow-black/20 mt-8">
          <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-primary-400 to-primary-600" />
          <span className="absolute right-4 top-2 text-4xl text-zinc-800">"</span>
          <h2 className="relative z-10 text-xl font-bold italic text-content ">
            {quote || "Excuses don't burn calories."}
          </h2>
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="h-px w-8 bg-zinc-100 dark:bg-elevated" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary-500/80">
              Daily Motivation
            </p>
            <div className="h-px w-8 bg-zinc-100 dark:bg-elevated" />
          </div>
        </Card>

        {/* Weekly Stats — Animated progress rings */}
        <Card className="border-content/5 bg-card/50 p-5 mt-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-4 flex items-center gap-2">
            <FilledIcon icon={BarChart3} size={14} /> This Week
          </h3>
          <div className="flex items-center justify-between gap-1 overflow-x-hidden">
            <ProgressRing 
              value={currentStreak} 
              max={Math.max(bestStreak, 7)} 
              size={72}
              color="#f97316" 
              label="Streak" 
              unit="days" 
              icon={<Flame size={12}/>} 
            />
            <ProgressRing 
              value={weeklySessions.length} 
              max={7} 
              size={72}
              color="#818cf8" 
              label="Workouts" 
              unit={`/ 7`}
              icon={<Dumbbell size={12}/>} 
            />
            <ProgressRing 
              value={weeklyVolumeK} 
              max={volumeTargetK} 
              size={72}
              color="#22c55e" 
              label="Volume" 
              unit={`k ${settings?.weightUnit || 'kg'}`}
              icon={<Zap size={12}/>} 
            />
            <ProgressRing 
              value={newPRs} 
              max={Math.max(newPRs, 5)} 
              size={72}
              color="#eab308" 
              label="PRs" 
              icon={<Trophy size={12}/>} 
            />
          </div>
        </Card>
        
        {/* Body Progress Card */}
        <Card className="border-primary-500/20 bg-primary-500/5 p-4 border-2 mt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <PremiumIcon icon={Ruler} color="primary" variant="gradient" size="md" animate="float" />
              <div>
                <h3 className="font-bold text-content text-sm">Body Progress</h3>
                <p className="text-xs text-muted">
                  {latestWeight ? `Last weight: ${latestWeight}${settings?.weightUnit || 'kg'}` : 'Start tracking today'}
                </p>
              </div>
            </div>
            <Button 
              size="sm" 
              className="rounded-xl px-4 py-2 font-bold shadow-md shadow-primary-500/20"
              onClick={() => setIsMeasurementModalOpen(true)}
            >
              LOG PROGRESS
            </Button>
          </div>
        </Card>

        {/* Up Next */}
        <div className="mt-8">
          <h3 className="mb-4 text-xl font-bold">Up Next</h3>
          
          {/* Pills */}
          <div className="mb-4 flex gap-3 overflow-x-auto pb-4 pt-2 px-2 -mx-2 scrollbar-hide">
            {nextProgram ? nextProgram.days.map((day) => {
              const isSelected = nextDay?.id === day.id;
              const isSuggested = suggestedDayId === day.id;
              return (
                <button 
                  key={day.id}
                  onClick={() => setSelectedDayId(day.id)}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-all duration-300 flex items-center gap-1.5 ${
                    isSelected 
                      ? 'bg-primary-500 text-white shadow-md shadow-primary-500/50 scale-105' 
                      : 'bg-elevated/80 text-muted hover:bg-elevated hover:text-content'
                  }`}
                >
                  {day.name}
                  {isSuggested && (
                    <span className={`text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-full font-extrabold transition-all duration-300 ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-primary-500/10 text-primary-400'
                    }`}>
                      Next
                    </span>
                  )}
                </button>
              );
            }) : (
              <div className="whitespace-nowrap rounded-full bg-primary-500 px-4 py-2 text-sm font-medium text-white shadow-md shadow-primary-500/50">
                No workouts planned
              </div>
            )}
          </div>

          {/* Main Card */}
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary-600 to-primary-900 p-6 shadow-xl h-64 flex flex-col justify-between">
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(rgba(255,255,255,0.22) 1px, transparent 1px)',
                backgroundSize: '16px 16px',
              }}
            />
            
            <div className="relative z-10">
              <div className="flex items-center gap-2">
                <span className="inline-block rounded bg-white/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                  {nextProgram ? nextProgram.name : 'No Program'}
                </span>
                {suggestedDayId === nextDay?.id && (
                  <span className="inline-block rounded bg-emerald-500/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm shadow-lg shadow-emerald-500/20">
                    ★ Suggested Next
                  </span>
                )}
              </div>
              <h2 className="mt-2 text-3xl font-bold text-white line-clamp-1">
                {nextDay ? nextDay.name : 'Create a program'}
              </h2>
              
              <div className="mt-6 flex items-center gap-8 text-sm text-white/90">
                <div className="flex items-center gap-2">
                  <Clock size={16}className="text-primary-300" />
                  <span>{estimatedDuration ? `${estimatedDuration.min}-${estimatedDuration.max} mins` : '0 mins'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Dumbbell size={16}className="text-primary-300" />
                  <span>{nextDay ? nextDay.exercises.length : 0} exercises</span>
                </div>
              </div>
            </div>

            <div className="relative z-10 flex items-end justify-between mt-auto">
              <div className="flex gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-lg">💪</div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-lg">🏋️</div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-lg">🎯</div>
              </div>
              
              <Button 
                onClick={() => {
                  if (nextProgram && nextDay) {
                    navigate(`/workout/${nextProgram.id}/${nextDay.id}`);
                  } else {
                    navigate('/workouts');
                  }
                }}
                className="rounded-xl bg-primary-400 px-6 py-6 font-bold text-white shadow-lg shadow-primary-500/50 hover:bg-primary-300 flex items-center gap-2"
              >
                <div className="flex flex-col items-center">
                  <span>START</span>
                  <span>WORKOUT</span>
                </div>
                <ArrowRight size={20}/>
              </Button>
            </div>
          </Card>
        </div>

        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold">Weekly Summary</h3>
            <button onClick={() => navigate('/stats')} className="text-xs font-bold uppercase tracking-wider text-primary-400 hover:text-primary-300">
              View All
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Card className="flex flex-col items-center justify-center border-content/5 bg-card/50 p-4 text-center">
              <PremiumIcon icon={BarChart3} color="primary" variant="soft" size="sm" />
              <span className="text-xl font-bold text-content mt-2">{(totalVolume / 1000).toFixed(1)}k</span>
              <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted">{(settings?.weightUnit || 'kg').toUpperCase()} Volume</span>
            </Card>
            <Card className="flex flex-col items-center justify-center border-content/5 bg-card/50 p-4 text-center">
              <PremiumIcon icon={Dumbbell} color="primary" variant="soft" size="sm" />
              <span className="text-xl font-bold text-content mt-2">{totalWorkouts}</span>
              <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted">Exercises</span>
            </Card>
            <Card className="flex flex-col items-center justify-center border-content/5 bg-card/50 p-4 text-center">
              <PremiumIcon icon={Star} color="yellow" variant="soft" size="sm" />
              <span className="text-xl font-bold text-content mt-2">{newPRs}</span>
              <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted">New PRs</span>
            </Card>
          </div>
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
