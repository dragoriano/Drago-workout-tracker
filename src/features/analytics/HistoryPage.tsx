import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { WorkoutHeatmap } from '../../components/ui/WorkoutHeatmap';
import { useAppStore } from '../../store/useAppStore';
import { WorkoutSession } from '../../types';
import { findPreviousComparableSession } from '../../utils/sessionComparison';
import { SessionCompareModal } from './SessionCompareModal';
import { SessionHistoryCard } from './SessionHistoryCard';

export function HistoryPage() {
  const sessions = useAppStore((s) => s.sessions);
  const settings = useAppStore((s) => s.settings);
  const [compareState, setCompareState] = useState<{
    isOpen: boolean;
    session: WorkoutSession | null;
    baseline: WorkoutSession | null;
  }>({ isOpen: false, session: null, baseline: null });

  const sortedSessions = React.useMemo(() => {
    return [...sessions].sort((a, b) => b.date - a.date);
  }, [sessions]);

  const unit = settings?.weightUnit || 'kg';

  return (
    <div className="p-4 pt-8 pb-24">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">History</h1>

      {/* Workout Heatmap Calendar */}
      {sessions.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-bold text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
            <Calendar size={16}/> Activity Calendar
          </h2>
          <Card className="p-4 bg-black/20 border border-content/5">
            <WorkoutHeatmap sessions={sessions} unit={unit} />
          </Card>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center text-center">
          <div className="mb-4 rounded-full bg-content dark:bg-card p-4">
            <Calendar size={32}className="text-muted" />
          </div>
          <h3 className="text-lg font-medium">No history yet</h3>
          <p className="mt-2 text-sm text-muted">Complete a workout to see it here.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sortedSessions.map((session, index) => (
            <SessionHistoryCard
              key={session.id}
              session={session}
              index={index}
              unit={unit}
              effortScale={settings?.effortScale || 'rpe'}
              previousSession={findPreviousComparableSession(session, sessions)}
              onCompare={(target, baseline) =>
                setCompareState({ isOpen: true, session: target, baseline })
              }
            />
          ))}
        </div>
      )}

      <SessionCompareModal
        isOpen={compareState.isOpen}
        session={compareState.session}
        initialBaseline={compareState.baseline}
        allSessions={sessions}
        unit={unit}
        onClose={() => setCompareState({ isOpen: false, session: null, baseline: null })}
      />
    </div>
  );
}
