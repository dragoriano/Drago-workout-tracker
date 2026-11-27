import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Clock, Dumbbell, Sparkles, X, Zap } from 'lucide-react';
import { getExerciseMuscleGroups } from '../../data/exercises';
import type { CustomExercise, WorkoutSession } from '../../types';
import {
  getEstimatedReadyLabel,
  getMuscleRecentExercises,
  type AnatomyHeatmapMode,
} from '../../utils/anatomicalRecovery';
import type {
  BroadMuscleGroup,
  MuscleRecoveryStatus,
  ReadinessLevel,
  VolumeZone,
} from '../../utils/muscleRecovery';
import { cn } from '../../utils/cn';
import { AnatomicalBodyMap, type AnatomyViewMode } from './AnatomicalBodyMap';
import { Button } from './Button';

interface MuscleRecoveryCardProps {
  items: MuscleRecoveryStatus[];
  sessions?: WorkoutSession[];
  customExercises?: CustomExercise[];
  unit?: string;
  initialSelectedMuscle?: BroadMuscleGroup | null;
  onStartFreestyle?: (muscles: BroadMuscleGroup[]) => void;
}

type RecoveryFilter = 'all' | 'ready' | 'fatigued';

const READINESS_BADGE: Record<ReadinessLevel, { label: string; badgeClass: string; barClass: string }> = {
  ready: {
    label: 'Ready',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    barClass: 'bg-emerald-500',
  },
  recovering: {
    label: 'Recovering',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    barClass: 'bg-amber-500',
  },
  fatigued: {
    label: 'Fatigued',
    badgeClass: 'bg-red-500/15 text-red-400 border-red-500/30',
    barClass: 'bg-red-500',
  },
};

const ZONE_LABEL: Record<VolumeZone, { text: string; textClass: string }> = {
  untrained: { text: 'Untrained', textClass: 'text-muted' },
  under: { text: 'Below target', textClass: 'text-amber-400' },
  optimal: { text: 'In zone', textClass: 'text-emerald-400' },
  over: { text: 'High vol', textClass: 'text-red-400' },
};

function formatHoursAgo(hours: number | null): string {
  if (hours === null) return 'Rested';
  if (hours < 1) return '<1h ago';
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = Math.round((hours / 24) * 10) / 10;
  return `${days}d ago`;
}

export function MuscleRecoveryCard({
  items,
  sessions = [],
  customExercises = [],
  unit = 'kg',
  initialSelectedMuscle = null,
  onStartFreestyle,
}: MuscleRecoveryCardProps) {
  const [filter, setFilter] = useState<RecoveryFilter>('all');
  const [heatmapMode, setHeatmapMode] = useState<AnatomyHeatmapMode>('readiness');
  const [viewMode, setViewMode] = useState<AnatomyViewMode>('both');
  const [selectedMuscle, setSelectedMuscle] = useState<BroadMuscleGroup | null>(
    initialSelectedMuscle,
  );
  const [isLightMode, setIsLightMode] = useState<boolean>(() =>
    typeof document !== 'undefined' ? !document.documentElement.classList.contains('dark') : false,
  );

  useEffect(() => {
    setSelectedMuscle(initialSelectedMuscle ?? null);
  }, [initialSelectedMuscle]);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
    const syncMode = () => setIsLightMode(!document.documentElement.classList.contains('dark'));
    syncMode();
    const obs = new MutationObserver(syncMode);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const readyCount = items.filter((i) => i.readiness === 'ready').length;
  const recommendedReadyMuscles = items
    .filter((i) => i.readiness === 'ready')
    .sort((a, b) => {
      const aRatio = a.minTarget > 0 ? a.effectiveSets / a.minTarget : 0;
      const bRatio = b.minTarget > 0 ? b.effectiveSets / b.minTarget : 0;
      return aRatio - bRatio;
    })
    .slice(0, 3)
    .map((i) => i.muscle);

  const selectedStatus = selectedMuscle
    ? items.find((item) => item.muscle === selectedMuscle) ?? null
    : null;

  const recentExercises =
    selectedStatus && sessions.length > 0
      ? getMuscleRecentExercises(sessions, selectedStatus.muscle, {
          customExercises,
          resolveFallbackMuscles: getExerciseMuscleGroups,
        })
      : [];

  const filtered = items.filter((item) => {
    if (filter === 'ready') return item.readiness === 'ready';
    if (filter === 'fatigued') return item.readiness !== 'ready';
    return true;
  });

  const handleToggleMuscle = (muscle: BroadMuscleGroup) => {
    setSelectedMuscle((prev) => (prev === muscle ? null : muscle));
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar: Readiness Summary + Mode Switcher + View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-400 tabular-nums">
          {readyCount}/{items.length} Ready
        </span>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex gap-0.5 rounded-xl border border-content/10 bg-surface p-0.5">
            {([
              { id: 'readiness', label: 'Readiness' },
              { id: 'volume', label: 'Weekly Sets' },
            ] as Array<{ id: AnatomyHeatmapMode; label: string }>).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setHeatmapMode(m.id)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer',
                  heatmapMode === m.id
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'text-muted hover:text-content',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex gap-0.5 rounded-xl border border-content/10 bg-surface p-0.5">
            {([
              { id: 'both', label: 'Both' },
              { id: 'front', label: 'Front' },
              { id: 'back', label: 'Back' },
            ] as Array<{ id: AnatomyViewMode; label: string }>).map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setViewMode(v.id)}
                className={cn(
                  'rounded-lg px-2 py-1 text-[11px] font-bold transition-all cursor-pointer',
                  viewMode === v.id
                    ? 'bg-content/15 text-content shadow-sm'
                    : 'text-muted hover:text-content',
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Anatomical Body Map Stage */}
      <div className="rounded-2xl border border-content/10 bg-page/25 p-3">
        <AnatomicalBodyMap
          items={items}
          mode={heatmapMode}
          view={viewMode}
          selectedMuscle={selectedMuscle}
          onSelectMuscle={handleToggleMuscle}
          isLightMode={isLightMode}
        />
      </div>

      {/* Live Muscle Inspector or 1-Tap Ready Launcher */}
      <AnimatePresence mode="wait">
        {selectedStatus ? (
          <motion.div
            key={selectedStatus.muscle}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="liquid-glass rounded-2xl border border-primary-500/25 p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: selectedStatus.color }}
                  />
                  <h4 className="text-base font-extrabold text-content">
                    {selectedStatus.muscle}
                  </h4>
                  <span
                    className={cn(
                      'rounded-md border px-2 py-0.5 text-[10px] font-bold tabular-nums',
                      READINESS_BADGE[selectedStatus.readiness].badgeClass,
                    )}
                  >
                    {READINESS_BADGE[selectedStatus.readiness].label} {selectedStatus.recoveryPercent}%
                  </span>
                </div>
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
                  <Clock size={12} className="text-primary-400" />
                  <span>{getEstimatedReadyLabel(selectedStatus)}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedMuscle(null)}
                aria-label="Clear selected muscle"
                className="liquid-btn-glass flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:text-content cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-content/10 bg-page/25 px-2.5 py-2 text-center">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-muted">
                  Weekly Sets
                </span>
                <p className="mt-0.5 font-mono text-sm font-extrabold text-content tabular-nums">
                  {selectedStatus.effectiveSets}
                  <span className="text-[10px] font-medium text-muted">
                    /{selectedStatus.minTarget}–{selectedStatus.maxTarget}
                  </span>
                </p>
              </div>
              <div className="rounded-xl border border-content/10 bg-page/25 px-2.5 py-2 text-center">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-muted">
                  7d Volume
                </span>
                <p className="mt-0.5 font-mono text-sm font-extrabold text-content tabular-nums">
                  {selectedStatus.weeklyVolume.toLocaleString()}
                  <span className="ml-0.5 text-[10px] font-medium text-muted">{unit}</span>
                </p>
              </div>
              <div className="rounded-xl border border-content/10 bg-page/25 px-2.5 py-2 text-center">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-muted">
                  Last Trained
                </span>
                <p className="mt-0.5 text-xs font-extrabold text-content">
                  {formatHoursAgo(selectedStatus.hoursSinceTrained)}
                </p>
              </div>
            </div>

            {/* Recent Exercise Attribution */}
            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                <Dumbbell size={11} className="text-primary-400" />
                Recent Exercises (7d)
              </p>
              {recentExercises.length === 0 ? (
                <p className="rounded-xl border border-content/5 bg-page/20 px-3 py-2 text-xs text-muted">
                  No sessions logged in the last 7 days
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {recentExercises.map((ex) => (
                    <span
                      key={ex.name}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-content/10 bg-page/25 px-2.5 py-1 text-[11px] font-semibold text-content"
                    >
                      <span className="max-w-[165px] truncate">{ex.name}</span>
                      <span className="font-mono text-[10px] text-muted tabular-nums">
                        {ex.setsCount}s
                      </span>
                      <span
                        className={cn(
                          'rounded px-1 py-0.2 text-[9px] font-bold uppercase',
                          ex.role === 'primary'
                            ? 'bg-primary-500/15 text-primary-400'
                            : 'bg-content/10 text-muted',
                        )}
                      >
                        {ex.role === 'primary' ? 'Primary' : 'Sec'}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {onStartFreestyle && (
              <Button
                type="button"
                size="md"
                variant={selectedStatus.readiness === 'ready' ? 'primary' : 'secondary'}
                onClick={() => onStartFreestyle([selectedStatus.muscle])}
                className="min-h-[44px] w-full font-extrabold"
              >
                <Zap size={16} />
                <span>
                  {selectedStatus.readiness === 'ready'
                    ? `Train ${selectedStatus.muscle} Freestyle`
                    : `Train ${selectedStatus.muscle} Anyway`}
                </span>
                <ArrowRight size={16} />
              </Button>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="inspector-hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-2.5 rounded-2xl border border-content/10 bg-page/20 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="inline-flex items-center gap-2 text-xs font-medium text-muted">
              <Sparkles size={14} className="shrink-0 text-primary-400" />
              <span>Tap any muscle on the body map to inspect recovery &amp; history</span>
            </p>
            {onStartFreestyle && recommendedReadyMuscles.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={() => onStartFreestyle(recommendedReadyMuscles)}
                className="min-h-[40px] shrink-0 font-bold"
              >
                <Zap size={14} />
                <span>Train Ready Muscles</span>
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Synchronized Filter Tabs & Selectable Muscle Breakdown List */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-muted">
          Breakdown
        </span>
        <div className="flex gap-1 rounded-xl border border-content/5 bg-surface p-1">
          {([
            { id: 'all', label: 'All' },
            { id: 'ready', label: 'Ready' },
            { id: 'fatigued', label: 'Recovering' },
          ] as Array<{ id: RecoveryFilter; label: string }>).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={cn(
                'rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer',
                filter === tab.id
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'text-muted hover:text-content',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-4 text-center text-xs font-medium text-muted">
          No muscle groups match this filter.
        </p>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((item) => {
            const rSpec = READINESS_BADGE[item.readiness];
            const zSpec = ZONE_LABEL[item.volumeZone];
            const volumePct =
              item.maxTarget > 0
                ? Math.min(100, Math.round((item.effectiveSets / item.maxTarget) * 100))
                : 0;
            const minMarkerPct =
              item.maxTarget > 0 ? Math.round((item.minTarget / item.maxTarget) * 100) : 50;
            const isSelected = selectedMuscle === item.muscle;

            return (
              <button
                key={item.muscle}
                type="button"
                onClick={() => handleToggleMuscle(item.muscle)}
                className={cn(
                  'w-full rounded-xl border p-3 text-left space-y-2 transition-all cursor-pointer',
                  isSelected
                    ? 'border-primary-500/50 bg-primary-500/10 shadow-sm'
                    : 'border-content/5 bg-page/20 hover:border-content/15',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm font-bold text-content">{item.muscle}</span>
                    <span className="text-[11px] text-muted">{formatHoursAgo(item.hoursSinceTrained)}</span>
                  </div>

                  <span
                    className={cn(
                      'shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold tabular-nums',
                      rSpec.badgeClass,
                    )}
                  >
                    {rSpec.label} {item.recoveryPercent}%
                  </span>
                </div>

                <div className="relative h-2 w-full overflow-hidden rounded-full bg-content/10">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', rSpec.barClass)}
                    style={{ width: `${volumePct}%` }}
                  />
                  <div
                    title={`Minimum weekly target: ${item.minTarget} sets`}
                    className="absolute bottom-0 top-0 w-0.5 bg-content/40"
                    style={{ left: `${minMarkerPct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-muted tabular-nums">
                    {item.effectiveSets} / {item.minTarget}–{item.maxTarget} weekly sets
                  </span>
                  <span className={cn('text-[10px] font-bold uppercase tracking-wider', zSpec.textClass)}>
                    {zSpec.text}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
