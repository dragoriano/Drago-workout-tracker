import React from 'react';
import { Flame, ShieldAlert, Sparkles, TrendingUp } from 'lucide-react';
import type { EffortScale } from '../../types';
import { formatEffortLabel } from '../../utils/strength';
import type {
  DebriefExerciseProjection,
  PostWorkoutCoachDebrief,
} from '../../utils/workoutCoach';

interface WorkoutCoachDebriefCardProps {
  debrief: PostWorkoutCoachDebrief;
  effortScale?: EffortScale;
}

function ProjectionSection({
  title,
  tone,
  items,
  icon,
}: {
  title: string;
  tone: 'emerald' | 'amber' | 'red';
  items: DebriefExerciseProjection[];
  icon: React.ReactNode;
}) {
  if (items.length === 0) return null;

  const palette =
    tone === 'emerald'
      ? {
          badge: 'bg-emerald-500/12 border-emerald-500/25 text-emerald-700 dark:text-emerald-400',
          row: 'bg-emerald-500/8 border-emerald-500/20',
          target: 'text-emerald-700 dark:text-emerald-300',
        }
      : tone === 'amber'
        ? {
            badge: 'bg-amber-500/12 border-amber-500/25 text-amber-800 dark:text-amber-300',
            row: 'bg-amber-500/8 border-amber-500/20',
            target: 'text-amber-800 dark:text-amber-300',
          }
        : {
            badge: 'bg-red-500/12 border-red-500/25 text-red-700 dark:text-red-400',
            row: 'bg-red-500/8 border-red-500/20',
            target: 'text-red-700 dark:text-red-300',
          };

  return (
    <div className="space-y-1.5">
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${palette.badge}`}
      >
        {icon}
        <span>{title}</span>
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div
            key={item.exerciseName}
            className={`rounded-xl border px-3 py-2 flex items-start justify-between gap-2.5 ${palette.row}`}
          >
            <div className="min-w-0">
              <p className="text-xs font-bold text-content truncate">{item.exerciseName}</p>
              <p className="text-[11px] text-muted leading-snug mt-0.5">{item.rationale}</p>
            </div>
            <span
              className={`shrink-0 text-xs font-black tabular-nums whitespace-nowrap ${palette.target}`}
            >
              {item.nextTargetSummary}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Post-workout Smart Coach summary projecting next-session overload, hold, and deload targets.
 */
export function WorkoutCoachDebriefCard({
  debrief,
  effortScale = 'rpe',
}: WorkoutCoachDebriefCardProps) {
  const totalItems =
    debrief.overloadReady.length +
    debrief.holdOrConsolidate.length +
    debrief.deloadOrRetry.length;

  if (totalItems === 0 && debrief.avgSessionRpe === null && !debrief.recoveryNote) {
    return null;
  }

  return (
    <section
      aria-label="Smart Coach Debrief"
      className="rounded-2xl bg-card border border-content/10 p-4 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary-500/15 text-primary-600 dark:text-primary-400">
            <Sparkles size={15} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-black uppercase tracking-wider text-content">
              Smart Coach Debrief
            </h2>
            <p className="text-[11px] text-muted truncate">Next-session targets from today’s sets</p>
          </div>
        </div>
        {debrief.avgSessionRpe !== null && (
          <span className="shrink-0 rounded-full bg-surface border border-content/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-content tabular-nums">
            Avg {formatEffortLabel(debrief.avgSessionRpe, effortScale)}
          </span>
        )}
      </div>

      {debrief.recoveryNote && (
        <div className="rounded-xl bg-sky-500/10 border border-sky-500/20 px-3 py-2 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
          Recovery ETA: {debrief.recoveryNote}
        </div>
      )}

      <div className="space-y-3">
        <ProjectionSection
          title="Ready to Progress"
          tone="emerald"
          items={debrief.overloadReady}
          icon={<TrendingUp size={11} />}
        />
        <ProjectionSection
          title="Consolidate Target"
          tone="amber"
          items={debrief.holdOrConsolidate}
          icon={<Flame size={11} />}
        />
        <ProjectionSection
          title="Adjust / Deload Next"
          tone="red"
          items={debrief.deloadOrRetry}
          icon={<ShieldAlert size={11} />}
        />
      </div>
    </section>
  );
}
