import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card } from '../../components/ui/Card';
import { format, subDays, startOfDay, formatISO } from 'date-fns';
import { Flame, TrendingUp, Activity, Trophy, ArrowUp, Zap, Ruler, Calendar, Dumbbell, Gauge } from 'lucide-react';
import { PremiumIcon, FilledIcon } from '../../components/ui/PremiumIcon';
import { WorkoutHeatmap } from '../../components/ui/WorkoutHeatmap';
import { MuscleGroupChart, mapToMuscleGroup, getMuscleColor } from '../../components/ui/MuscleGroupChart';
import { MuscleRecoveryCard } from '../../components/ui/MuscleRecoveryCard';
import { getExerciseMuscleGroups } from '../../data/exercises';
import { PullToRefresh } from '../../components/ui/PullToRefresh';
import { useAppStore } from '../../store/useAppStore';
import { computeEffortSummary, computeStreaks, computeTopEstimated1RMs, flattenPRs } from '../../utils/analytics';
import { computeMeasurementTrend } from '../../utils/bodyTrends';
import { computeMuscleRecovery } from '../../utils/muscleRecovery';
import {
  buildPRTimeline,
  findPreviousComparableSession,
  getPRTimelineExercises,
} from '../../utils/sessionComparison';
import { isWarmupSet, rpeToRir } from '../../utils/strength';
import { WorkoutSession } from '../../types';
import { SessionCompareModal } from './SessionCompareModal';
import { SessionHistoryCard } from './SessionHistoryCard';

export { computeStreaks, flattenPRs };

export function AnalyticsPage() {
  // ── Zustand store ────────────────────────────────────────────────
  const sessions = useAppStore((s) => s.sessions);
  const measurements = useAppStore((s) => s.measurements);
  const customExercises = useAppStore((s) => s.customExercises);
  const settings = useAppStore((s) => s.settings);
  const hydrate = useAppStore((s) => s.hydrate);
  const isHydrated = useAppStore((s) => s.isHydrated);

  // ── Local UI state ───────────────────────────────────────────────
  const [selectedType, setSelectedType] = useState('weight');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
  const [prView, setPrView] = useState<'best' | 'timeline'>('best');
  const [prExerciseFilter, setPrExerciseFilter] = useState('');
  const [prTypeFilter, setPrTypeFilter] = useState<'all' | 'weight' | '1rm'>('all');
  const [compareState, setCompareState] = useState<{
    isOpen: boolean;
    session: WorkoutSession | null;
    baseline: WorkoutSession | null;
  }>({ isOpen: false, session: null, baseline: null });

  useEffect(() => { if (!isHydrated) hydrate(); }, [hydrate, isHydrated]);

  const processVolumeData = () => {
    const last7 = Array.from({ length: 7 }).map((_, i) => {
      const d = subDays(new Date(), 6 - i);
      return { date: format(d, 'MMM d'), volume: 0, timestamp: d.getTime() };
    });
    sessions.forEach(s => {
      const day = last7.find(d => format(new Date(s.date), 'MMM d') === d.date);
      if (day) day.volume += s.totalVolume;
    });
    return last7;
  };

  const volumeData = processVolumeData();
  const { current: currentStreak, longest: longestStreak } = computeStreaks(sessions);
  const allPRs = flattenPRs(sessions);
  const top1RMs = computeTopEstimated1RMs(sessions);
  const sortedSessionsDesc = [...sessions].sort((a, b) => b.date - a.date);
  const unit = settings?.weightUnit || 'kg';
  const effortScale = settings?.effortScale || 'rpe';
  const effortSummary = computeEffortSummary(sessions, 7);
  const measurementTrend = computeMeasurementTrend(measurements, selectedType);
  const prTimelineExercises = getPRTimelineExercises(sessions);
  const prTimeline = buildPRTimeline(sessions, {
    exerciseFilter: prExerciseFilter || undefined,
    typeFilter: prTypeFilter,
  });
  const muscleRecovery = computeMuscleRecovery(sessions, {
    customExercises,
    resolveFallbackMuscles: getExerciseMuscleGroups,
  });

  // Compute muscle group volume (last 7 days, working sets only)
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekSessions = sessions.filter(s => s.date && s.date >= oneWeekAgo);
  const muscleVolumeMap = new Map<string, number>();
  weekSessions.forEach(s => {
    (s.exercisesSnapshot || []).forEach(ex => {
      const groups = (ex.muscleGroup && ex.muscleGroup.length > 0) ? ex.muscleGroup : getExerciseMuscleGroups(ex.name);
      const primary = groups.length > 0 ? mapToMuscleGroup(groups[0]) : 'Other';
      const exVolume = ex.sets
        .filter(set => set.completed && !isWarmupSet(set))
        .reduce((sum, set) => sum + (set.weight * set.reps), 0);
      muscleVolumeMap.set(primary, (muscleVolumeMap.get(primary) || 0) + exVolume);
    });
  });
  const muscleGroupData = Array.from(muscleVolumeMap.entries())
    .map(([name, volume]) => ({ name, volume, color: getMuscleColor(name) }))
    .sort((a, b) => b.volume - a.volume);

  // Filter sessions for the selected date
  const filteredSessions = selectedDate
    ? sortedSessionsDesc.filter(s => {
        if (!s.date || isNaN(new Date(s.date).getTime())) return false;
        return formatISO(startOfDay(new Date(s.date)), { representation: 'date' }) === selectedDate;
      })
    : sortedSessionsDesc;

  const handleDateClick = (dateStr: string) => {
    setSelectedDate(prev => prev === dateStr ? null : dateStr);
    setActiveTab('history');
  };

  return (
    <PullToRefresh onRefresh={hydrate} className="p-4 pt-8 pb-24">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Stats</h1>

      {/* Tab Switcher */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => { setActiveTab('overview'); setSelectedDate(null); }}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'overview' 
            ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30' 
            : 'bg-card border border-content/10 text-muted'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'history' 
            ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30' 
            : 'bg-card border border-content/10 text-muted'
          }`}
        >
          History
        </button>
      </div>

      {/* Activity Calendar — always visible */}
      {sessions.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
            <Calendar size={16}/> Activity Calendar
            {selectedDate && (
              <button onClick={() => setSelectedDate(null)} className="ml-auto text-primary-400 text-[10px] font-bold uppercase tracking-widest">
                Clear Filter
              </button>
            )}
          </h2>
          <Card className="p-4 bg-black/20 border border-content/5">
            <WorkoutHeatmap sessions={sessions} unit={unit} selectedDate={selectedDate} onDateClick={handleDateClick} />
          </Card>
          {selectedDate && (
            <p className="text-xs text-primary-400 font-bold mt-2 text-center">
              Showing: {format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}
            </p>
          )}
        </div>
      )}

      {activeTab === 'overview' ? (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Card className="p-4 bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
              <div className="flex items-center gap-2 text-orange-500 mb-2">
                <Flame size={18}/>
                <span className="font-bold text-sm">Streak</span>
              </div>
              <div className="text-3xl font-black text-content ">
                {currentStreak} <span className="text-sm font-medium text-orange-500/60">days</span>
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-primary-500/10 to-primary-500/10 border-primary-500/20">
              <div className="flex items-center gap-2 text-primary-400 mb-2">
                <Zap size={18}/>
                <span className="font-bold text-sm">Best Streak</span>
              </div>
              <div className="text-3xl font-black text-content ">
                {longestStreak} <span className="text-sm font-medium text-primary-400/60">days</span>
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-primary-500/10 to-cyan-500/10 border-primary-500/20">
              <div className="flex items-center gap-2 text-primary-400 mb-2">
                <TrendingUp size={18}/>
                <span className="font-bold text-sm">Workouts</span>
              </div>
              <div className="text-3xl font-black text-content ">{sessions.length}</div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20">
              <div className="flex items-center gap-2 text-emerald-400 mb-2">
                <Trophy size={18}/>
                <span className="font-bold text-sm">Total PRs</span>
              </div>
              <div className="text-3xl font-black text-content ">{sessions.reduce((sum, s) => sum + (s.PRs?.length || 0), 0)}</div>
            </Card>
          </div>

          {/* Volume chart */}
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <FilledIcon icon={Activity} size={20} className="text-emerald-400" /> Volume (7 days)
          </h2>
          <Card className="p-4 h-56 mb-8">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="date" stroke="#666" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#666" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #333', borderRadius: '8px' }}
                  itemStyle={{ color: '#818cf8' }}
                  formatter={(v) => [`${Number(v ?? 0).toLocaleString()} ${unit}`, 'Volume']}
                />
                <Bar dataKey="volume" fill="#818cf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Muscle Recovery & Weekly Sets */}
          <h2 className="text-xl font-bold mb-4 mt-8 flex items-center gap-2">
            <FilledIcon icon={Activity} size={20} className="text-emerald-400" /> Muscle Recovery &amp; Weekly Sets
          </h2>
          <Card className="p-4 mb-8">
            <MuscleRecoveryCard items={muscleRecovery} />
          </Card>

          {/* Muscle Group Volume */}
          <h2 className="text-xl font-bold mb-4 mt-8 flex items-center gap-2">
            <FilledIcon icon={Dumbbell} size={20} className="text-primary-400" /> Muscle Groups (7 days)
          </h2>
          <Card className="p-4 mb-8">
            <MuscleGroupChart data={muscleGroupData} unit={unit} />
          </Card>

          {/* Training Effort (7 days) */}
          <h2 className="text-xl font-bold mb-4 mt-8 flex items-center gap-2">
            <FilledIcon icon={Zap} size={20} className="text-amber-400" /> Training Effort (7 days)
          </h2>
          <Card className="p-4 mb-8">
            {effortSummary.workingSetsCount === 0 && effortSummary.ratedSetsCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center text-muted">
                <Zap size={28} className="mb-2 opacity-30" />
                <p className="text-sm">Log set types (W/D/F) and RPE/RIR during workouts to track training intensity.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="rounded-xl bg-page/20 border border-content/5 p-3 text-center">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                      Avg {effortScale.toUpperCase()}
                    </span>
                    <p className="mt-1 text-xl font-black text-emerald-400 tabular-nums">
                      {effortSummary.avgRpe !== null
                        ? effortScale === 'rir'
                          ? rpeToRir(effortSummary.avgRpe)
                          : effortSummary.avgRpe
                        : '—'}
                    </p>
                    <span className="block text-[10px] text-muted mt-0.5">
                      {effortSummary.ratedSetsCount > 0 ? `${effortSummary.ratedSetsCount} rated` : 'Unrated'}
                    </span>
                  </div>

                  <div className="rounded-xl bg-page/20 border border-content/5 p-3 text-center">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                      Hard Sets
                    </span>
                    <p className="mt-1 text-xl font-black text-amber-400 tabular-nums">
                      {effortSummary.hardSetsCount}
                    </p>
                    <span className="block text-[10px] text-muted mt-0.5">
                      {effortScale === 'rir' ? 'RIR ≤ 2' : 'RPE 8+'}
                    </span>
                  </div>

                  <div className="rounded-xl bg-page/20 border border-content/5 p-3 text-center">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                      Failure / Drop
                    </span>
                    <p className="mt-1 text-xl font-black text-red-400 tabular-nums">
                      {effortSummary.failureSetsCount}F · {effortSummary.dropSetsCount}D
                    </p>
                    <span className="block text-[10px] text-muted mt-0.5">
                      of {effortSummary.workingSetsCount} sets
                    </span>
                  </div>
                </div>

                {effortSummary.warmupSetsCount > 0 && (
                  <p className="mt-3 text-center text-[11px] font-medium text-sky-400/80">
                    {effortSummary.warmupSetsCount} warmup {effortSummary.warmupSetsCount === 1 ? 'set' : 'sets'} logged &amp; excluded from volume/PRs
                  </p>
                )}
              </>
            )}
          </Card>
          
          {/* Body Measurements Chart */}
          <h2 className="text-xl font-bold mb-4 mt-8 flex items-center gap-2">
            <FilledIcon icon={Ruler} size={20} className="text-blue-400" /> Body Measurements
          </h2>
          <Card className="p-4 mb-8">
            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide mb-2">
              {['weight', 'chest', 'arms', 'waist', 'thighs', 'calves'].map(t => (
                <button
                  key={t}
                  onClick={() => setSelectedType(t)}
                  className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                    selectedType === t 
                    ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
                    : 'bg-page/5 dark:bg-content/5 text-muted hover:bg-page/10'
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            
            {measurementTrend.series.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted">
                <Ruler size={32}className="mb-2 opacity-30" />
                <p className="text-sm">No measurements recorded for this type yet.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="rounded-xl bg-page/20 border border-content/5 p-2.5 text-center">
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-muted">
                      Latest
                    </span>
                    <p className="mt-0.5 text-sm font-black text-content tabular-nums">
                      {measurementTrend.latest?.value} {measurementTrend.latest?.unit}
                    </p>
                  </div>
                  <div className="rounded-xl bg-page/20 border border-content/5 p-2.5 text-center">
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-muted">
                      7d Avg
                    </span>
                    <p className="mt-0.5 text-sm font-black text-emerald-400 tabular-nums">
                      {measurementTrend.movingAvg7d ?? '—'} {measurementTrend.latest?.unit}
                    </p>
                  </div>
                  <div className="rounded-xl bg-page/20 border border-content/5 p-2.5 text-center">
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-muted">
                      {measurementTrend.weeklyRate !== null ? 'Weekly Rate' : 'Change'}
                    </span>
                    <p className="mt-0.5 text-sm font-black text-blue-400 tabular-nums">
                      {measurementTrend.weeklyRate !== null
                        ? `${measurementTrend.weeklyRate > 0 ? '+' : ''}${measurementTrend.weeklyRate}/wk`
                        : measurementTrend.deltaFromPrevious !== null
                          ? `${measurementTrend.deltaFromPrevious > 0 ? '+' : ''}${measurementTrend.deltaFromPrevious}`
                          : '—'}
                    </p>
                  </div>
                </div>

                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={measurementTrend.series}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                      <XAxis dataKey="label" stroke="#666" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#666" fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #333', borderRadius: '8px' }}
                        formatter={(v, name) => {
                          const unitLabel = measurementTrend.latest?.unit || '';
                          return [`${Number(v ?? 0)} ${unitLabel}`, name === 'movingAvg7d' ? '7d Avg' : 'Value'];
                        }}
                      />
                      <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#18181b', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="movingAvg7d" stroke="#10b981" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </Card>

          {/* Strength Benchmarks (Est. 1RM) */}
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <FilledIcon icon={Gauge} size={20} className="text-emerald-400" /> Strength Benchmarks (Est. 1RM)
          </h2>
          <Card className="p-4 mb-8">
            {top1RMs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted">
                <Gauge size={32} className="mb-2 opacity-30" />
                <p className="text-sm">Log completed sets to see estimated 1RM benchmarks.</p>
              </div>
            ) : (
              <div className="divide-y divide-content/5">
                {top1RMs.slice(0, 10).map((item, i) => (
                  <div key={item.exerciseName + i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3 min-w-0 pr-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 font-black text-xs">
                        {i + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-content truncate">{item.exerciseName}</p>
                        <p className="text-xs text-muted">
                          Best set: {item.weight} {unit} × {item.reps} · {format(item.date, 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-emerald-400 tabular-nums">
                        {item.e1rm} {unit}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">e1RM</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* PR table & Progression Timeline */}
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FilledIcon icon={Trophy} size={20} className="text-yellow-500" /> Personal Records
            </h2>
            <div className="flex gap-1 rounded-xl bg-surface p-1 border border-content/5">
              <button
                type="button"
                onClick={() => setPrView('best')}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                  prView === 'best' ? 'bg-primary-500 text-white shadow-sm' : 'text-muted hover:text-content'
                }`}
              >
                Best PRs
              </button>
              <button
                type="button"
                onClick={() => setPrView('timeline')}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                  prView === 'timeline' ? 'bg-primary-500 text-white shadow-sm' : 'text-muted hover:text-content'
                }`}
              >
                Timeline
              </button>
            </div>
          </div>

          <Card className="p-4">
            {prView === 'best' ? (
              allPRs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted">
                  <Trophy size={32}className="mb-2 opacity-30" />
                  <p className="text-sm">Keep pushing to hit new personal records!</p>
                </div>
              ) : (
                <div className="divide-y divide-content/5">
                  {allPRs.slice(0, 20).map((pr, i) => (
                    <div key={i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-500">
                          <Trophy size={14}/>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-content ">{pr.exerciseName}</p>
                          <p className="text-xs text-muted">{format(pr.date, 'MMM d, yyyy')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-content flex items-center gap-1 justify-end">
                          <ArrowUp size={12}className="text-emerald-400" />
                          {pr.value} {pr.type === '1rm' ? `${unit} e1RM` : pr.type === 'weight' ? unit : pr.type === 'reps' ? 'reps' : 'vol'}
                        </p>
                        <p className="text-[10px] text-muted">was {pr.previousValue}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="space-y-4">
                {prTimelineExercises.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                      <button
                        type="button"
                        onClick={() => setPrExerciseFilter('')}
                        className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold border transition-all ${
                          prExerciseFilter === ''
                            ? 'bg-primary-500 text-white border-primary-500'
                            : 'bg-surface text-muted border-content/10 hover:text-content'
                        }`}
                      >
                        All Exercises
                      </button>
                      {prTimelineExercises.map((exName) => (
                        <button
                          key={exName}
                          type="button"
                          onClick={() => setPrExerciseFilter(exName)}
                          className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold border transition-all ${
                            prExerciseFilter.toLowerCase() === exName.toLowerCase()
                              ? 'bg-primary-500 text-white border-primary-500'
                              : 'bg-surface text-muted border-content/10 hover:text-content'
                          }`}
                        >
                          {exName}
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-1.5">
                      {(['all', 'weight', '1rm'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setPrTypeFilter(t)}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border transition-all ${
                            prTypeFilter === t
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                              : 'bg-surface text-muted border-content/10 hover:text-content'
                          }`}
                        >
                          {t === 'all' ? 'All Types' : t === 'weight' ? 'Weight' : 'Est. 1RM'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {prTimeline.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-muted">
                    <Trophy size={32} className="mb-2 opacity-30" />
                    <p className="text-sm">No PR milestones match this filter yet.</p>
                  </div>
                ) : (
                  <div className="relative pl-5 space-y-3 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[2px] before:bg-content/10">
                    {prTimeline.slice(0, 30).map((entry) => (
                      <div key={entry.id} className="relative">
                        <span
                          className={`absolute -left-5 top-3 h-3.5 w-3.5 rounded-full border-2 border-card ${
                            entry.isLatestForExerciseType ? 'bg-amber-400' : 'bg-emerald-400'
                          }`}
                        />
                        <div className="rounded-xl bg-page/20 border border-content/5 p-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-bold text-content truncate">{entry.exerciseName}</p>
                              {entry.isLatestForExerciseType && (
                                <span className="rounded bg-amber-500/20 border border-amber-500/35 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-400">
                                  Peak
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted mt-0.5">
                              {format(entry.date, 'MMM d, yyyy')} · {entry.type === '1rm' ? 'Est. 1RM' : entry.type === 'weight' ? 'Weight' : entry.type}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-black text-content tabular-nums">
                              {entry.value}{' '}
                              <span className="text-xs font-semibold text-muted">
                                {entry.type === '1rm' || entry.type === 'weight' ? unit : ''}
                              </span>
                            </p>
                            <p className="text-[11px] font-bold text-emerald-400 tabular-nums">
                              {entry.previousValue > 0 ? `+${entry.gain}` : 'First PR'}
                              {entry.gainPct !== null ? ` (+${entry.gainPct}%)` : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        </>
      ) : (
        /* ── HISTORY TAB ───────────────────────────────── */
        <>
          {filteredSessions.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-center">
              <Calendar size={32}className="mb-3 text-muted opacity-30" />
              <h3 className="text-lg font-medium">
                {selectedDate ? 'No workouts on this date' : 'No history yet'}
              </h3>
              <p className="mt-1 text-sm text-muted">
                {selectedDate ? 'Tap another date or clear the filter.' : 'Complete a workout to see it here.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredSessions.map((session, index) => (
                <SessionHistoryCard
                  key={session.id}
                  session={session}
                  index={index}
                  unit={unit}
                  effortScale={effortScale}
                  previousSession={findPreviousComparableSession(session, sessions)}
                  onCompare={(target, baseline) =>
                    setCompareState({ isOpen: true, session: target, baseline })
                  }
                />
              ))}
            </div>
          )}
        </>
      )}

      <SessionCompareModal
        isOpen={compareState.isOpen}
        session={compareState.session}
        initialBaseline={compareState.baseline}
        allSessions={sessions}
        unit={unit}
        onClose={() => setCompareState({ isOpen: false, session: null, baseline: null })}
      />
    </PullToRefresh>
  );
}
