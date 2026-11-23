import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp } from 'lucide-react';
import { Exercise } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format } from 'date-fns';

interface ExerciseChartModalProps {
  isOpen: boolean;
  exercise: Exercise | null;
  onClose: () => void;
}

export function ExerciseChartModal({ isOpen, exercise, onClose }: ExerciseChartModalProps) {
  const settings = useAppStore(s => s.settings);

  if (!exercise) return null;

  // Compute max weight per session from history
  const chartData = (exercise.history || []).map(h => {
    let maxWeight = 0;
    h.sets.forEach(s => {
      if (s.completed && s.weight > maxWeight) {
        maxWeight = s.weight;
      }
    });
    
    const dateObj = new Date(h.date);
    if (isNaN(dateObj.getTime())) return null;

    return {
      timestamp: dateObj.getTime(), // Use raw timestamp as unique key
      date: format(dateObj, 'MMM d'),
      weight: maxWeight,
      fullDate: format(dateObj, 'MMM d, yyyy p') // Include time for disambiguation
    };
  })
  .filter((d): d is NonNullable<typeof d> => d !== null && d.weight > 0)
  .sort((a, b) => a.timestamp - b.timestamp);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-page/60 backdrop-blur-sm sm:items-center">
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-md rounded-t-3xl bg-card p-6 sm:rounded-3xl"
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-content flex items-center gap-2">
                  <TrendingUp size={20}className="text-primary-400" />
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

            {chartData.length < 2 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted">
                <TrendingUp size={48}className="mb-4 opacity-20" />
                <p className="text-sm font-bold">Keep working out!</p>
                <p className="text-xs mt-1">Need at least 2 sessions to see a trend line.</p>
              </div>
            ) : (
              <div className="h-64 w-full">
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
                    <YAxis stroke="#666" fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #333', borderRadius: '8px' }}
                      itemStyle={{ color: '#3b82f6' }}
                      labelStyle={{ color: '#a1a1aa', fontSize: '12px', marginBottom: '4px' }}
                      labelFormatter={(_, payload) => payload[0]?.payload.fullDate || ''}
                      formatter={(v) => [`${Number(v ?? 0)} ${settings?.weightUnit || 'kg'}`, 'Max Weight']}
                    />
                    <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#18181b', strokeWidth: 2 }} activeDot={{ r: 6 }} />
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
