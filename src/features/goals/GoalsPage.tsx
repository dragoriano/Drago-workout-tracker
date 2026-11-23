import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Plus, X, Trash2, CheckCircle2, Trophy, Calendar, ChevronRight, Edit2 } from 'lucide-react';
import { PremiumIcon } from '../../components/ui/PremiumIcon';
import { useAppStore } from '../../store/useAppStore';
import { Goal } from '../../types';
import { generateId } from '../../utils/uuid';

interface GoalFormData {
  title: string;
  targetValue: string;
  currentValue: string;
  unit: string;
  deadline: string;
}

const GOAL_COLORS = [
  'from-primary-500 to-primary-700',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-red-600',
  'from-pink-500 to-rose-600',
  'from-cyan-500 to-blue-600',
  'from-yellow-500 to-amber-600',
];

export function GoalsPage() {
  const settings = useAppStore(s => s.settings);
  const storeGoals = useAppStore(s => s.goals);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const weightUnit = settings?.weightUnit || 'kg';

  const goals = useMemo(
    () =>
      [...storeGoals].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return b.createdAt - a.createdAt;
      }),
    [storeGoals],
  );

  const UNITS = [weightUnit, 'reps', 'workouts', 'km', 'min', 'days'];
  const UNIT_ICONS: Record<string, string> = {
    [weightUnit]: '🏋️',
    reps: '🔁',
    workouts: '💪',
    km: '🏃',
    min: '⏱️',
    days: '📅',
  };

  const [form, setForm] = useState<GoalFormData>({
    title: '',
    targetValue: '',
    currentValue: '0',
    unit: weightUnit,
    deadline: '',
  });

  const openCreateModal = () => {
    setEditingGoal(null);
    setForm({
      title: '',
      targetValue: '',
      currentValue: '0',
      unit: weightUnit,
      deadline: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (goal: Goal) => {
    setEditingGoal(goal);
    setForm({
      title: goal.title,
      targetValue: String(goal.targetValue),
      currentValue: String(goal.currentValue),
      unit: goal.unit,
      deadline: goal.deadline ? new Date(goal.deadline).toISOString().split('T')[0] : '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.targetValue) return;

    const goal: Goal = {
      id: editingGoal?.id ?? generateId(),
      title: form.title.trim(),
      targetValue: Number(form.targetValue),
      currentValue: Number(form.currentValue),
      unit: form.unit,
      deadline: form.deadline ? new Date(form.deadline).getTime() : null,
      completed: editingGoal?.completed ?? false,
      createdAt: editingGoal?.createdAt ?? Date.now(),
    };

    await useAppStore.getState().saveGoal(goal);
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    await useAppStore.getState().deleteGoal(id);
  };

  const handleToggleComplete = async (goal: Goal) => {
    await useAppStore.getState().saveGoal({ ...goal, completed: !goal.completed });
  };

  const handleUpdateProgress = async (goal: Goal, newValue: number) => {
    const clamped = Math.min(Math.max(0, newValue), goal.targetValue);
    await useAppStore.getState().saveGoal({ ...goal, currentValue: clamped, completed: clamped >= goal.targetValue });
  };

  const formatDeadline = (ts: number | null) => {
    if (!ts) return null;
    const d = new Date(ts);
    const now = new Date();
    const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (diff < 0) return { label, color: 'text-red-400', text: `${Math.abs(diff)}d overdue` };
    if (diff === 0) return { label, color: 'text-yellow-400', text: 'Due today' };
    if (diff <= 7) return { label, color: 'text-orange-400', text: `${diff}d left` };
    return { label, color: 'text-muted', text: `${diff}d left` };
  };

  const activeGoals = goals.filter(g => !g.completed);
  const completedGoals = goals.filter(g => g.completed);

  return (
    <div className="min-h-screen bg-page pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-page/80 backdrop-blur-md px-4 pt-12 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-content ">Goals</h1>
            <p className="text-sm text-muted mt-0.5">{activeGoals.length} active</p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-2xl bg-primary-500 px-4 py-2.5 text-sm font-bold text-content shadow-lg shadow-primary-500/40 transition-all hover:bg-primary-400 active:scale-95"
          >
            <Plus size={18}/> New Goal
          </button>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* Empty state */}
        {goals.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-500/20 to-primary-500/20">
              <Target size={36}className="text-primary-400" />
            </div>
            <h3 className="text-xl font-bold text-content ">No goals yet</h3>
            <p className="mt-2 text-sm text-muted max-w-xs">
              Set a fitness goal and track your progress. Every champion was once a beginner.
            </p>
            <button
              onClick={openCreateModal}
              className="mt-6 flex items-center gap-2 rounded-2xl bg-primary-500 px-6 py-3 text-sm font-bold text-content shadow-lg shadow-primary-500/40 transition-all hover:bg-primary-400"
            >
              <Plus size={18}/> Set Your First Goal
            </button>
          </motion.div>
        )}

        {/* Active goals */}
        {activeGoals.map((goal, i) => {
          const pct = Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
          const deadline = formatDeadline(goal.deadline);
          const colorClass = GOAL_COLORS[i % GOAL_COLORS.length];

          return (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative overflow-hidden rounded-3xl bg-surface border border-content/5 p-5"
            >
              {/* Background gradient blob */}
              <div className={`absolute -top-8 -right-8 h-32 w-32 rounded-full bg-gradient-to-br ${colorClass} opacity-10 blur-2xl pointer-events-none`} />

              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{UNIT_ICONS[goal.unit] || '🎯'}</div>
                  <div>
                    <h3 className="font-bold text-content leading-tight">{goal.title}</h3>
                    <p className="text-xs text-muted mt-0.5">
                      {goal.currentValue} / {goal.targetValue} {goal.unit}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(goal)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-muted hover:text-content hover:bg-page/10 dark:bg-content/10 transition-colors"
                  >
                    <Edit2 size={15}/>
                  </button>
                  <button
                    onClick={() => handleDelete(goal.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-muted hover:text-red-500 hover:bg-page/10 dark:bg-content/10 transition-colors"
                  >
                    <Trash2 size={15}/>
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-muted">{pct}%</span>
                  {deadline && (
                    <span className={`flex items-center gap-1 text-xs font-medium ${deadline.color}`}>
                      <Calendar size={11} />
                      {deadline.text}
                    </span>
                  )}
                </div>
                <div className="h-2 w-full rounded-full bg-page/5 dark:bg-content/5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className={`h-full rounded-full bg-gradient-to-r ${colorClass}`}
                  />
                </div>
              </div>

              {/* Quick progress update */}
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={() => handleUpdateProgress(goal, goal.currentValue - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-page/5 dark:bg-content/5 text-content font-bold hover:bg-page/10 dark:bg-content/10 transition-colors text-sm"
                >
                  −
                </button>
                <div className="flex-1 text-center">
                  <span className="text-sm font-bold text-muted">{goal.currentValue} {goal.unit}</span>
                </div>
                <button
                  onClick={() => handleUpdateProgress(goal, goal.currentValue + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-page/5 dark:bg-content/5 text-content font-bold hover:bg-page/10 dark:bg-content/10 transition-colors text-sm"
                >
                  +
                </button>
                <button
                  onClick={() => handleToggleComplete(goal)}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                >
                  <CheckCircle2 size={14}/> Done
                </button>
              </div>
            </motion.div>
          );
        })}

        {/* Completed goals */}
        {completedGoals.length > 0 && (
          <>
            <div className="flex items-center gap-2 pt-2">
              <Trophy size={16}className="text-yellow-500" />
              <h2 className="text-sm font-bold text-muted uppercase tracking-widest">Achieved</h2>
            </div>
            {completedGoals.map((goal, i) => (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 rounded-2xl bg-surface border border-content/5 p-4 opacity-60"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 size={18}/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-content line-through truncate">{goal.title}</p>
                  <p className="text-xs text-muted">{goal.targetValue} {goal.unit}</p>
                </div>
                <button
                  onClick={() => handleToggleComplete(goal)}
                  className="text-xs text-muted hover:text-muted transition-colors font-medium"
                >
                  Undo
                </button>
                <button
                  onClick={() => handleDelete(goal.id)}
                  className="text-zinc-700 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={15}/>
                </button>
              </motion.div>
            ))}
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-page/60 backdrop-blur-sm sm:items-center">
            <motion.div
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md rounded-t-3xl bg-card p-6 sm:rounded-3xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-content ">
                  {editingGoal ? 'Edit Goal' : 'New Goal'}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full bg-page/10 dark:bg-content/10 p-2 text-content hover:bg-page/20 dark:bg-content/20"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="text-xs font-bold text-muted uppercase tracking-wider">Goal Title</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Bench Press 100kg"
                    className="mt-2 w-full rounded-2xl bg-page/5 dark:bg-content/5 px-4 py-3 text-content placeholder-zinc-600 outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>

                {/* Target + Unit */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-muted uppercase tracking-wider">Target</label>
                    <input
                      type="number"
                      value={form.targetValue}
                      onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))}
                      placeholder="100"
                      className="mt-2 w-full rounded-2xl bg-page/5 dark:bg-content/5 px-4 py-3 text-content placeholder-zinc-600 outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted uppercase tracking-wider">Unit</label>
                    <select
                      value={form.unit}
                      onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                      className="mt-2 w-full rounded-2xl bg-page/5 dark:bg-content/5 px-4 py-3 text-content outline-none focus:ring-2 focus:ring-primary-500 transition-all appearance-none"
                    >
                      {UNITS.map(u => (
                        <option key={u} value={u} className="bg-content dark:bg-card">{u}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Current Value */}
                <div>
                  <label className="text-xs font-bold text-muted uppercase tracking-wider">Current Progress</label>
                  <input
                    type="number"
                    value={form.currentValue}
                    onChange={e => setForm(f => ({ ...f, currentValue: e.target.value }))}
                    placeholder="0"
                    className="mt-2 w-full rounded-2xl bg-page/5 dark:bg-content/5 px-4 py-3 text-content placeholder-zinc-600 outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>

                {/* Deadline */}
                <div>
                  <label className="text-xs font-bold text-muted uppercase tracking-wider">Deadline (optional)</label>
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                    className="mt-2 w-full rounded-2xl bg-page/5 dark:bg-content/5 px-4 py-3 text-content outline-none focus:ring-2 focus:ring-primary-500 transition-all [color-scheme:dark]"
                  />
                </div>

                <button
                  onClick={handleSave}
                  disabled={!form.title.trim() || !form.targetValue}
                  className="w-full rounded-2xl bg-primary-500 py-4 text-base font-black text-content shadow-lg shadow-primary-500/40 transition-all hover:bg-primary-400 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                >
                  {editingGoal ? 'Save Changes' : 'Create Goal'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
