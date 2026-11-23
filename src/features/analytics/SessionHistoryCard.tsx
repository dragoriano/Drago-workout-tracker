import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Clock, Dumbbell, Trophy } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { WorkoutSession } from '../../types';

interface SessionHistoryCardProps {
  key?: string | number;
  session: WorkoutSession;
  index: number;
  unit: string;
}

export function SessionHistoryCard({ session, index, unit }: SessionHistoryCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.3) }}
    >
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between border-b border-content/5 pb-4">
          <div>
            <h3 className="font-bold text-lg">{format(session.date, 'EEEE, MMM d')}</h3>
            <p className="text-sm text-muted">{format(session.date, 'h:mm a')}</p>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-primary-500/10 px-3 py-1 text-primary-400">
            <Clock size={14} />
            <span className="text-sm font-medium">{Math.floor(session.duration / 60)}m</span>
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

            return (
              <div key={ex.id} className="rounded-xl bg-page/5 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-content">{ex.name.replace(/_/g, ' ')}</span>
                  <span className="text-[10px] font-black tracking-widest text-muted uppercase">
                    {completedSets.length} Sets
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {completedSets.map((set, sIdx) => (
                    <div
                      key={set.id}
                      className="flex flex-col items-center justify-center rounded-lg bg-card/50 border border-content/5 px-2.5 py-1.5 min-w-[50px]"
                    >
                      <span className="text-[10px] font-bold text-muted uppercase mb-0.5">S{sIdx + 1}</span>
                      <div className="flex flex-col items-center leading-tight">
                        <span className="text-xs font-black text-primary-400">
                          {set.weight}
                          <span className="text-[10px] text-muted font-normal ml-0.5">{unit}</span>
                        </span>
                        <span className="text-[10px] font-bold text-content mt-0.5">{set.reps} reps</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </motion.div>
  );
}
