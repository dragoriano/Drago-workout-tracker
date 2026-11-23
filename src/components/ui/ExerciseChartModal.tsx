import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, Gauge } from 'lucide-react';
import { Exercise } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format } from 'date-fns';
import { getBestSet1RM, getTrainingPercentages } from '../../utils/strength';
import { cn } from '../../utils/cn';

interface ExerciseChartModalProps {
  isOpen: boolean;
  exercise: Exercise | null;
  onClose: () => void;
}

export function ExerciseChartModal({ isOpen, exercise, onClose }: ExerciseChartModalProps) {
  const settings = useAppStore((s) => s.settings);
  const [metric, setMetric] = useState<'e1rm' | 'weight'>('e1rm');

  if (!exercise) return null;

  const unit = settings?.weightUnit || 'kg';

  const chartData = (exercise.history || [])
    .map((h) => {
      let maxWeight = 0;
      h.sets.forEach((s) => {
        if (s.completed && s.weight > maxWeight) {
          maxWeight = s.weight;
        }
      });

      const bestSet = getBestSet1RM(h.sets);
      const dateObj = new Date(h.date);
      if (isNaN(dateObj.getTime())) return null;

      return {
        timestamp: dateObj.getTime(),
        date: format(dateObj, 'MMM d'),
        weight: maxWeight,
        e1rm: bestSet ? bestSet.e1rm : 0,
        bestSetLabel: bestSet ? `${bestSet.weight}×${bestSet.reps}` : '',
        fullDate: format(dateObj, 'MMM d, yyyy p'),
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null && (d.weight > 0 || d.e1rm > 0))
    .sort((a, b) => a.timestamp - b.timestamp);

  const currentBest = getBestSet1RM(exercise.sets);
  const allTimeBest1RM = Math.max(
    currentBest?.e1rm ?? 0,
    ...chartData.map((d) => d.e1rm),
    0,
  );
  const percentages = getTrainingPercentages(allTimeBest1RM).filter((p) =>
    [90, 85, 80, 75].includes(p.percent),
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-page/60 backdrop-blur-sm sm:items-center">
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-md rounded-t-3xl bg-card p-6 sm:rounded-3xl max-h-[90dvh] overflow-y-auto"
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-content flex items-center gap-2">
                  <TrendingUp size={20} className="text-primary-400" />
                  Progress
                </h2>
                <p className="text-sm text-muted">{exercise.name}</p>
              </div>
              <button
                onClick={onClose}
                className="rounded-full bg-page/10 dark:bg-content/10 p-2 text-content hover:bg-page/20 dark:bg-content/20"
              >
                <X size={20} />
              </button>
            </div>

            {/* All-Time Est. 1RM Highlight & Training Percentages */}
            {allTimeBest1RM > 0 && (
              <div className="mb-4 rounded-2xl bg-surface border border-content/10 p-3.5">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted flex items-center gap-1.5">
                    <Gauge size={13} className="text-emerald-400" />
                    All-Time Est. 1RM (Epley)
                  </span>
                  <span className="text-lg font-black text-emerald-400 tabular-nums">
                    {allTimeBest1RM} {unit}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-content/5">
                  {percentages.map((row) => (
                    <div
                      key={row.percent}
                      className="rounded-xl bg-page/40 px-2 py-1.5 text-center"
                    >
                      <span className="block text-[9px] font-bold text-muted">
                        {row.percent}%
                      </span>
                      <span className="block text-xs font-black text-content tabular-nums">
                        {row.weight}
                        {unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metric Switcher */}
            <div className="mb-4 flex gap-1.5 rounded-xl bg-surface p-1 border border-content/5">
              <button
                type="button"
                onClick={() => setMetric('e1rm')}
                className={cn(
                  'flex-1 rounded-lg py-1.5 text-xs font-bold transition-all',
                  metric === 'e1rm'
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'text-muted hover:text-content',
                )}
              >
                Est. 1RM
              </button>
              <button
                type="button"
                onClick={() => setMetric('weight')}
                className={cn(
                  'flex-1 rounded-lg py-1.5 text-xs font-bold transition-all',
                  metric === 'weight'
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'text-muted hover:text-content',
                )}
              >
                Max Weight
              </button>
            </div>

            {chartData.length < 2 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted">
                <TrendingUp size={48} className="mb-4 opacity-20" />
                <p className="text-sm font-bold">Keep working out!</p>
                <p className="text-xs mt-1">Need at least 2 sessions to see a trend line.</p>
              </div>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis
                      dataKey="timestamp"
                      stroke="#666"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(ts) => format(ts, 'MMM d')}
                    />
                    <YAxis
                      stroke="#666"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#18181b',
                        border: '1px solid #333',
                        borderRadius: '8px',
                      }}
                      itemStyle={{ color: metric === 'e1rm' ? '#10b981' : '#3b82f6' }}
                      labelStyle={{ color: '#a1a1aa', fontSize: '12px', marginBottom: '4px' }}
                      labelFormatter={(_, payload) => payload[0]?.payload.fullDate || ''}
                      formatter={(v, _name, item) => {
                        const setInfo =
                          metric === 'e1rm' && item?.payload?.bestSetLabel
                            ? ` (${item.payload.bestSetLabel})`
                            : '';
                        return [
                          `${Number(v ?? 0)} ${unit}${setInfo}`,
                          metric === 'e1rm' ? 'Est. 1RM' : 'Max Weight',
                        ];
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey={metric}
                      stroke={metric === 'e1rm' ? '#10b981' : '#3b82f6'}
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#18181b', strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
