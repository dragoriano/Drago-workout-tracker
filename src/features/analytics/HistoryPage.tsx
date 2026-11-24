import React, { useState } from 'react';
import { Calendar, Download } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { WorkoutHeatmap } from '../../components/ui/WorkoutHeatmap';
import { useAppStore } from '../../store/useAppStore';
import type { WorkoutSession } from '../../types';
import { findPreviousComparableSession } from '../../utils/sessionComparison';
import { downloadCSV, formatSessionsToCSV } from '../../utils/sessionExport';
import { SessionCompareModal } from './SessionCompareModal';
import { SessionEditorModal } from './SessionEditorModal';
import { SessionHistoryCard } from './SessionHistoryCard';

export function HistoryPage() {
  const sessions = useAppStore((s) => s.sessions);
  const programs = useAppStore((s) => s.programs);
  const settings = useAppStore((s) => s.settings);
  const [compareState, setCompareState] = useState<{
    isOpen: boolean;
    session: WorkoutSession | null;
    baseline: WorkoutSession | null;
  }>({ isOpen: false, session: null, baseline: null });
  const [editingSession, setEditingSession] = useState<WorkoutSession | null>(null);

  const sortedSessions = React.useMemo(() => {
    return [...sessions].sort((a, b) => b.date - a.date);
  }, [sessions]);

  const unit = settings?.weightUnit || 'kg';

  const handleExportCSV = () => {
    if (sessions.length === 0) return;
    const csv = formatSessionsToCSV(sessions, programs, unit);
    downloadCSV(csv, `dragoriano-history-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="p-4 pt-8 pb-24">
      <div className="mb-8 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">History</h1>
        <button
          type="button"
          onClick={handleExportCSV}
          disabled={sessions.length === 0}
          className="inline-flex items-center gap-1.5 rounded-xl bg-surface border border-content/10 px-3 py-2 text-xs font-bold text-content hover:bg-content/10 transition-colors disabled:opacity-40 disabled:pointer-events-none shrink-0"
        >
          <Download size={14} />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Workout Heatmap Calendar */}
      {sessions.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-bold text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
            <Calendar size={16}/> Activity Calendar
          </h2>
          <Card className="p-4 bg-card/80 dark:bg-black/20 border border-content/5">
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
              onEdit={(target) => setEditingSession(target)}
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

      <SessionEditorModal
        isOpen={editingSession !== null}
        session={editingSession}
        allSessions={sessions}
        unit={unit}
        effortScale={settings?.effortScale || 'rpe'}
        onClose={() => setEditingSession(null)}
      />
    </div>
  );
}
