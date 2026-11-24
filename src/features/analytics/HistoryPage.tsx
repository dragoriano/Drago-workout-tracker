import React, { useState } from 'react';
import { Calendar, Download } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
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
    <div className="px-4 pt-5 pb-6">
      <div className="mb-5 flex items-center justify-between gap-3 pt-safe">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-400">
            Training Log
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-content">History</h1>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleExportCSV}
          disabled={sessions.length === 0}
        >
          <Download size={14} />
          <span>Export CSV</span>
        </Button>
      </div>

      {/* Workout Heatmap Calendar */}
      {sessions.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted">
            <Calendar size={14} className="text-primary-400" />
            Activity Calendar
          </h2>
          <Card className="p-4">
            <WorkoutHeatmap sessions={sessions} unit={unit} />
          </Card>
        </div>
      )}

      {sessions.length === 0 ? (
        <Card className="flex h-60 flex-col items-center justify-center text-center">
          <div className="mb-3 rounded-2xl bg-elevated p-4 text-muted">
            <Calendar size={28} />
          </div>
          <h3 className="text-base font-bold text-content">No history yet</h3>
          <p className="mt-1 text-xs text-muted">Complete a workout to see it logged here.</p>
        </Card>
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
