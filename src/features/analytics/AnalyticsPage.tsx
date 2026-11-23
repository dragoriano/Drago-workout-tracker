import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card } from '../../components/ui/Card';
import { format, subDays, startOfDay, formatISO } from 'date-fns';
import { Flame, TrendingUp, Activity, Trophy, ArrowUp, Zap, Ruler, Calendar, Dumbbell } from 'lucide-react';
import { PremiumIcon, FilledIcon } from '../../components/ui/PremiumIcon';
import { WorkoutHeatmap } from '../../components/ui/WorkoutHeatmap';
import { MuscleGroupChart, mapToMuscleGroup, getMuscleColor } from '../../components/ui/MuscleGroupChart';
import { getExerciseMuscleGroups } from '../../data/exercises';
import { PullToRefresh } from '../../components/ui/PullToRefresh';
import { useAppStore } from '../../store/useAppStore';
import { computeStreaks, flattenPRs } from '../../utils/analytics';
import { SessionHistoryCard } from './SessionHistoryCard';

export { computeStreaks, flattenPRs };

export function AnalyticsPage() {
  // ── Zustand store ────────────────────────────────────────────────
  const sessions = useAppStore((s) => s.sessions);
  const measurements = useAppStore((s) => s.measurements);
  const settings = useAppStore((s) => s.settings);
  const hydrate = useAppStore((s) => s.hydrate);
  const isHydrated = useAppStore((s) => s.isHydrated);

  // ── Local UI state ───────────────────────────────────────────────
  const [selectedType, setSelectedType] = useState('weight');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');

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
  const sortedSessionsDesc = [...sessions].sort((a, b) => b.date - a.date);
  const unit = settings?.weightUnit || 'kg';

  // Compute muscle group volume (last 7 days)
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekSessions = sessions.filter(s => s.date && s.date >= oneWeekAgo);
  const muscleVolumeMap = new Map<string, number>();
  weekSessions.forEach(s => {
    (s.exercisesSnapshot || []).forEach(ex => {
      const groups = (ex.muscleGroup && ex.muscleGroup.length > 0) ? ex.muscleGroup : getExerciseMuscleGroups(ex.name);
      const primary = groups.length > 0 ? mapToMuscleGroup(groups[0]) : 'Other';
      const exVolume = ex.sets.filter(set => set.completed).reduce((sum, set) => sum + (set.weight * set.reps), 0);
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

          {/* Muscle Group Volume */}
          <h2 className="text-xl font-bold mb-4 mt-8 flex items-center gap-2">
            <FilledIcon icon={Dumbbell} size={20} className="text-primary-400" /> Muscle Groups (7 days)
          </h2>
          <Card className="p-4 mb-8">
            <MuscleGroupChart data={muscleGroupData} unit={unit} />
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
            
            {measurements.filter(m => m.type === selectedType).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted">
                <Ruler size={32}className="mb-2 opacity-30" />
                <p className="text-sm">No measurements recorded for this type yet.</p>
              </div>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={measurements.filter(m => m.type === selectedType).map(m => ({
                    date: format(m.date, 'MMM d'),
                    value: m.value
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis dataKey="date" stroke="#666" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#666" fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #333', borderRadius: '8px' }}
                      itemStyle={{ color: '#3b82f6' }}
                      formatter={(v) => {
                        const sample = measurements.find(m => m.type === selectedType);
                        return [`${Number(v ?? 0)} ${sample?.unit || ''}`, 'Value'];
                      }}
                    />
                    <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#18181b', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* PR table */}
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <FilledIcon icon={Trophy} size={20} className="text-yellow-500" /> Personal Records
          </h2>
          <Card className="p-4">
            {allPRs.length === 0 ? (
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
                        {pr.value} {pr.type === 'weight' ? unit : pr.type === 'reps' ? 'reps' : 'vol'}
                      </p>
                      <p className="text-[10px] text-muted">was {pr.previousValue}</p>
                    </div>
                  </div>
                ))}
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
                <SessionHistoryCard key={session.id} session={session} index={index} unit={unit} />
              ))}
            </div>
          )}
        </>
      )}
    </PullToRefresh>
  );
}
