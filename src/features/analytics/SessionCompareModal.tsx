import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, GitCompareArrows, Minus, X } from 'lucide-react';
import type { WorkoutSession } from '../../types';
import { cn } from '../../utils/cn';
import { FREESTYLE_PROGRAM_ID } from '../../utils/customExercises';
import { compareSessions } from '../../utils/sessionComparison';

interface SessionCompareModalProps {
  isOpen: boolean;
  session: WorkoutSession | null;
  initialBaseline: WorkoutSession | null;
  allSessions: WorkoutSession[];
  unit: string;
  onClose: () => void;
}

function formatSigned(val: number, suffix = ''): string {
  if (val > 0) return `+${val}${suffix}`;
  return `${val}${suffix}`;
}

export function SessionCompareModal({
  isOpen,
  session,
  initialBaseline,
  allSessions,
  unit,
  onClose,
}: SessionCompareModalProps) {
  const candidates = session
    ? allSessions
        .filter((s) => s.id !== session.id && s.date && s.date < session.date)
        .sort((a, b) => b.date - a.date)
    : [];

  const [selectedBaselineId, setSelectedBaselineId] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !session) return;
    if (initialBaseline?.id) {
      setSelectedBaselineId(initialBaseline.id);
    } else if (candidates.length > 0) {
      setSelectedBaselineId(candidates[0].id);
    } else {
      setSelectedBaselineId('');
    }
  }, [isOpen, session?.id, initialBaseline?.id]);

  if (!session) return null;

  const baseline =
    candidates.find((c) => c.id === selectedBaselineId) ?? initialBaseline ?? candidates[0] ?? null;
  const comparison = compareSessions(session, baseline);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[105] flex items-end justify-center bg-page/75 backdrop-blur-sm sm:items-center">
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="w-full max-w-md rounded-t-3xl bg-card sm:rounded-3xl max-h-[92dvh] flex flex-col border border-content/10 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 pb-3 border-b border-content/5 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
                  <GitCompareArrows size={18} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-content truncate">Session Comparison</h2>
                  <p className="text-xs text-muted truncate">
                    {format(session.date, 'MMM d, yyyy')}
                    {session.workoutName ? ` · ${session.workoutName}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-page/10 dark:bg-content/10 p-2 text-content hover:bg-page/20 shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Baseline Picker */}
              {candidates.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1.5">
                    Compare Against
                  </label>
                  <select
                    value={baseline?.id || ''}
                    onChange={(e) => setSelectedBaselineId(e.target.value)}
                    className="w-full rounded-xl bg-surface border border-content/10 px-3 py-2.5 text-sm font-bold text-content outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {candidates.map((cand) => (
                      <option key={cand.id} value={cand.id} className="bg-card text-content">
                        {format(cand.date, 'MMM d, yyyy · h:mm a')}
                        {cand.workoutName
                          ? ` — ${cand.workoutName}`
                          : cand.programId === FREESTYLE_PROGRAM_ID
                            ? ' — Quick Workout'
                            : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!comparison ? (
                <div className="py-12 text-center text-muted text-sm">
                  Complete at least one earlier session to view side-by-side comparison.
                </div>
              ) : (
                <>
                  {/* Top Summary Tiles */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-2xl bg-surface border border-content/5 p-3 text-center">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                        Volume
                      </span>
                      <p
                        className={cn(
                          'mt-1 text-sm font-black tabular-nums',
                          comparison.volumeDelta > 0
                            ? 'text-emerald-400'
                            : comparison.volumeDelta < 0
                              ? 'text-red-400'
                              : 'text-content',
                        )}
                      >
                        {formatSigned(comparison.volumeDelta, ` ${unit}`)}
                      </p>
                      <span className="block text-[10px] text-muted mt-0.5 tabular-nums">
                        {comparison.volumeDeltaPct !== null
                          ? `${formatSigned(comparison.volumeDeltaPct, '%')}`
                          : 'vs 0'}
                      </span>
                    </div>

                    <div className="rounded-2xl bg-surface border border-content/5 p-3 text-center">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                        Work Sets
                      </span>
                      <p
                        className={cn(
                          'mt-1 text-sm font-black tabular-nums',
                          comparison.setsDelta > 0
                            ? 'text-emerald-400'
                            : comparison.setsDelta < 0
                              ? 'text-red-400'
                              : 'text-content',
                        )}
                      >
                        {formatSigned(comparison.setsDelta)}
                      </p>
                      <span className="block text-[10px] text-muted mt-0.5 tabular-nums">
                        {comparison.workingSetsPrevious} → {comparison.workingSetsCurrent}
                      </span>
                    </div>

                    <div className="rounded-2xl bg-surface border border-content/5 p-3 text-center">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                        Duration
                      </span>
                      <p className="mt-1 text-sm font-black text-content tabular-nums">
                        {formatSigned(Math.round(comparison.durationDeltaSec / 60), 'm')}
                      </p>
                      <span className="block text-[10px] text-muted mt-0.5 tabular-nums">
                        {Math.floor(comparison.durationPreviousSec / 60)}m →{' '}
                        {Math.floor(comparison.durationCurrentSec / 60)}m
                      </span>
                    </div>
                  </div>

                  {/* Per-Exercise Diffs */}
                  <div className="space-y-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                      Exercises ({comparison.improvedCount} improved)
                    </p>
                    {comparison.exerciseDiffs.map((diff) => {
                      const badgeSpec =
                        diff.status === 'improved'
                          ? { label: 'Improved', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: ArrowUpRight }
                          : diff.status === 'regressed'
                            ? { label: 'Lower', cls: 'bg-red-500/15 text-red-400 border-red-500/30', icon: ArrowDownRight }
                            : diff.status === 'new'
                              ? { label: 'New', cls: 'bg-sky-500/15 text-sky-400 border-sky-500/30', icon: ArrowUpRight }
                              : { label: 'Matched', cls: 'bg-page/20 text-muted border-content/10', icon: Minus };
                      const Icon = badgeSpec.icon;

                      return (
                        <div
                          key={diff.exerciseName}
                          className="rounded-2xl bg-surface border border-content/5 p-3.5 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-bold text-content truncate">{diff.exerciseName}</h3>
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold shrink-0',
                                badgeSpec.cls,
                              )}
                            >
                              <Icon size={11} />
                              {badgeSpec.label}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-content/5">
                            <div>
                              <span className="block text-[9px] font-bold uppercase text-muted">Top Wt</span>
                              <span className="text-xs font-bold text-content tabular-nums">
                                {diff.currentMaxWeight}
                                {unit}
                              </span>
                              {diff.status !== 'new' && diff.maxWeightDelta !== 0 && (
                                <span
                                  className={cn(
                                    'block text-[10px] font-bold tabular-nums',
                                    diff.maxWeightDelta > 0 ? 'text-emerald-400' : 'text-red-400',
                                  )}
                                >
                                  {formatSigned(diff.maxWeightDelta)}
                                </span>
                              )}
                            </div>

                            <div>
                              <span className="block text-[9px] font-bold uppercase text-muted">Est. 1RM</span>
                              <span className="text-xs font-bold text-content tabular-nums">
                                {diff.currentBest1RM}
                                {unit}
                              </span>
                              {diff.status !== 'new' && diff.e1rmDelta !== 0 && (
                                <span
                                  className={cn(
                                    'block text-[10px] font-bold tabular-nums',
                                    diff.e1rmDelta > 0 ? 'text-emerald-400' : 'text-red-400',
                                  )}
                                >
                                  {formatSigned(diff.e1rmDelta)}
                                </span>
                              )}
                            </div>

                            <div>
                              <span className="block text-[9px] font-bold uppercase text-muted">Volume</span>
                              <span className="text-xs font-bold text-content tabular-nums">
                                {diff.currentVolume.toLocaleString()}
                              </span>
                              {diff.status !== 'new' && diff.volumeDelta !== 0 && (
                                <span
                                  className={cn(
                                    'block text-[10px] font-bold tabular-nums',
                                    diff.volumeDelta > 0 ? 'text-emerald-400' : 'text-red-400',
                                  )}
                                >
                                  {formatSigned(diff.volumeDelta)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
