import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Clock, Dumbbell, GitCompareArrows, Trophy } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { EffortScale, WorkoutSession } from '../../types';
import { cn } from '../../utils/cn';
import { formatEffortLabel, getSetType, isWarmupSet } from '../../utils/strength';
import { FREESTYLE_PROGRAM_ID } from '../../utils/customExercises';
import { compareSessions } from '../../utils/sessionComparison';

interface SessionHistoryCardProps {
  key?: string | number;
  session: WorkoutSession;
  index: number;
  unit: string;
  effortScale?: EffortScale;
  previousSession?: WorkoutSession | null;
  onCompare?: (session: WorkoutSession, baseline: WorkoutSession | null) => void;
}

export function SessionHistoryCard({
  session,
  index,
  unit,
  effortScale = 'rpe',
  previousSession = null,
  onCompare,
}: SessionHistoryCardProps) {
  const comparison = previousSession ? compareSessions(session, previousSession) : null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.3) }}
    >
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between border-b border-content/5 pb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-lg">{format(session.date, 'EEEE, MMM d')}</h3>
              {(session.workoutName || session.programId === FREESTYLE_PROGRAM_ID) && (
                <span className="rounded bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 text-[10px] font-bold text-sky-400">
                  {session.workoutName || 'Quick Workout'}
                </span>
              )}
            </div>
            <p className="text-sm text-muted">{format(session.date, 'h:mm a')}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onCompare && previousSession && (
              <button
                type="button"
                onClick={() => onCompare(session, previousSession)}
                className="flex items-center gap-1 rounded-lg bg-sky-500/10 border border-sky-500/25 px-2.5 py-1 text-xs font-bold text-sky-400 hover:bg-sky-500/20 transition-colors"
                title="Compare with previous session"
              >
                <GitCompareArrows size={13} />
                <span>Diff</span>
              </button>
            )}
            <div className="flex items-center gap-1 rounded-lg bg-primary-500/10 px-3 py-1 text-primary-400">
              <Clock size={14} />
              <span className="text-sm font-medium">{Math.floor(session.duration / 60)}m</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-page/20 p-3">
            <div className="flex items-center gap-2 text-muted">
              <Dumbbell size={16} />
              <span className="text-xs font-medium uppercase tracking-wider">Volume</span>
            </div>
            <p className="mt-1 text-xl font-bold">
              {(session.totalVolume || 0).toLocaleString()}{' '}
              <span className="text-sm font-normal text-muted">{unit}</span>
            </p>
            {comparison && (
              <p
                className={cn(
                  'mt-0.5 text-[11px] font-bold tabular-nums',
                  comparison.volumeDelta > 0
                    ? 'text-emerald-400'
                    : comparison.volumeDelta < 0
                      ? 'text-red-400'
                      : 'text-muted',
                )}
              >
                {comparison.volumeDelta > 0 ? '+' : ''}
                {comparison.volumeDelta.toLocaleString()} {unit}
                {comparison.volumeDeltaPct !== null
                  ? ` (${comparison.volumeDeltaPct > 0 ? '+' : ''}${comparison.volumeDeltaPct}%)`
                  : ''}
              </p>
            )}
          </div>
          <div className="rounded-xl bg-page/20 p-3">
            <div className="flex items-center gap-2 text-muted">
              <Trophy size={16} />
              <span className="text-xs font-medium uppercase tracking-wider">PRs</span>
            </div>
            <p className="mt-1 text-xl font-bold">{session.PRs?.length || 0}</p>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <p className="text-xs font-medium text-muted uppercase tracking-wider mb-3">Exercises</p>
          {session.exercisesSnapshot?.map((ex) => {
            const completedSets = ex.sets.filter((s) => s.completed);
            if (completedSets.length === 0) return null;
            const workingCount = completedSets.filter((s) => !isWarmupSet(s)).length;
            const warmupCount = completedSets.length - workingCount;
            let workingOrdinal = 0;

            return (
              <div key={ex.id} className="rounded-xl bg-page/5 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-content">{ex.name.replace(/_/g, ' ')}</span>
                  <span className="text-[10px] font-black tracking-widest text-muted uppercase">
                    {workingCount > 0 ? workingCount : completedSets.length} Sets
                    {warmupCount > 0 ? ` · ${warmupCount}W` : ''}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {completedSets.map((set) => {
                    const setType = getSetType(set);
                    const warmup = setType === 'warmup';
                    if (!warmup) workingOrdinal++;

                    const badgeText =
                      setType === 'warmup'
                        ? 'W'
                        : setType === 'drop'
                          ? 'D'
                          : setType === 'failure'
                            ? 'F'
                            : `S${workingOrdinal}`;

                    const badgeColor =
                      setType === 'warmup'
                        ? 'text-sky-400'
                        : setType === 'drop'
                          ? 'text-amber-400'
                          : setType === 'failure'
                            ? 'text-red-400'
                            : 'text-muted';

                    const chipBorder =
                      setType === 'warmup'
                        ? 'opacity-75 border-sky-500/20'
                        : setType === 'drop'
                          ? 'border-amber-500/25'
                          : setType === 'failure'
                            ? 'border-red-500/25'
                            : 'border-content/5';

                    const effortLabel = !warmup ? formatEffortLabel(set.rpe, effortScale) : '';
                    const effortColor =
                      set.rpe !== undefined && set.rpe >= 9.5
                        ? 'text-red-400'
                        : set.rpe !== undefined && set.rpe >= 8.5
                          ? 'text-amber-400'
                          : 'text-emerald-400';

                    return (
                      <div
                        key={set.id}
                        className={cn(
                          'flex flex-col items-center justify-center rounded-lg bg-card/50 border px-2.5 py-1.5 min-w-[50px]',
                          chipBorder,
                        )}
                      >
                        <span className={cn('text-[10px] font-black uppercase mb-0.5', badgeColor)}>
                          {badgeText}
                        </span>
                        <div className="flex flex-col items-center leading-tight">
                          <span className={cn('text-xs font-black', warmup ? 'text-sky-400' : 'text-primary-400')}>
                            {set.weight}
                            <span className="text-[10px] text-muted font-normal ml-0.5">{unit}</span>
                          </span>
                          <span className="text-[10px] font-bold text-content mt-0.5">{set.reps} reps</span>
                          {effortLabel && (
                            <span className={cn('text-[9px] font-bold mt-0.5 tabular-nums', effortColor)}>
                              {effortLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </motion.div>
  );
}
