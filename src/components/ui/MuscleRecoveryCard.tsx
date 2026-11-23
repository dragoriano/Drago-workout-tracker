import { useState } from 'react';
import type { MuscleRecoveryStatus, ReadinessLevel, VolumeZone } from '../../utils/muscleRecovery';
import { cn } from '../../utils/cn';

interface MuscleRecoveryCardProps {
  items: MuscleRecoveryStatus[];
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

export function MuscleRecoveryCard({ items }: MuscleRecoveryCardProps) {
  const [filter, setFilter] = useState<RecoveryFilter>('all');

  const readyCount = items.filter((i) => i.readiness === 'ready').length;
  const filtered = items.filter((item) => {
    if (filter === 'ready') return item.readiness === 'ready';
    if (filter === 'fatigued') return item.readiness !== 'ready';
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-400 tabular-nums">
          {readyCount}/{items.length} Ready
        </span>

        <div className="flex gap-1 rounded-xl bg-surface p-1 border border-content/5">
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
                'rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all',
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
        <div className="space-y-3">
          {filtered.map((item) => {
            const rSpec = READINESS_BADGE[item.readiness];
            const zSpec = ZONE_LABEL[item.volumeZone];
            const volumePct =
              item.maxTarget > 0
                ? Math.min(100, Math.round((item.effectiveSets / item.maxTarget) * 100))
                : 0;
            const minMarkerPct =
              item.maxTarget > 0 ? Math.round((item.minTarget / item.maxTarget) * 100) : 50;

            return (
              <div
                key={item.muscle}
                className="rounded-xl bg-page/20 border border-content/5 p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm font-bold text-content">{item.muscle}</span>
                    <span className="text-[11px] text-muted">{formatHoursAgo(item.hoursSinceTrained)}</span>
                  </div>

                  <span
                    className={cn(
                      'rounded-md border px-2 py-0.5 text-[10px] font-bold tabular-nums shrink-0',
                      rSpec.badgeClass,
                    )}
                  >
                    {rSpec.label} {item.recoveryPercent}%
                  </span>
                </div>

                <div className="relative h-2 w-full rounded-full bg-content/10 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', rSpec.barClass)}
                    style={{ width: `${volumePct}%` }}
                  />
                  <div
                    title={`Minimum weekly target: ${item.minTarget} sets`}
                    className="absolute top-0 bottom-0 w-0.5 bg-content/40"
                    style={{ left: `${minMarkerPct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-muted tabular-nums">
                    {item.effectiveSets} / {item.minTarget}–{item.maxTarget} weekly sets
                  </span>
                  <span className={cn('font-bold uppercase tracking-wider text-[10px]', zSpec.textClass)}>
                    {zSpec.text}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
