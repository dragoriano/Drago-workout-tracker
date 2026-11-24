import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Target, Plus, Trash2, CheckCircle2, Trophy, Calendar, Edit2, RefreshCw, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AutocompleteInput } from '../../components/ui/AutocompleteInput';
import { AppDialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Progress } from '../../components/ui/Progress';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useAppStore } from '../../store/useAppStore';
import { Goal, GoalDirection, GoalTrackingType } from '../../types';
import { computeMeasurementTrend } from '../../utils/bodyTrends';
import {
  computeGoalMetricValue,
  computeGoalProgressPercent,
  isGoalAchieved,
} from '../../utils/goalsSync';
import { generateId } from '../../utils/uuid';

interface GoalFormData {
  title: string;
  targetValue: string;
  currentValue: string;
  unit: string;
  deadline: string;
  trackingType: GoalTrackingType;
  linkedExerciseName: string;
  startValue: string;
}

const TRACKING_MODES: Array<{ id: GoalTrackingType; label: string }> = [
  { id: 'manual', label: 'Manual' },
  { id: 'exercise_e1rm', label: 'Exercise 1RM' },
  { id: 'exercise_weight', label: 'Exercise Weight' },
  { id: 'monthly_workouts', label: 'Monthly Workouts' },
  { id: 'weekly_volume', label: '7d Volume' },
  { id: 'streak_days', label: 'Streak' },
  { id: 'body_weight', label: 'Body Weight' },
];

function getAutoLabel(goal: Goal): string {
  switch (goal.trackingType) {
    case 'exercise_e1rm':
      return `Auto · ${goal.linkedExerciseName || 'Exercise'} e1RM`;
    case 'exercise_weight':
      return `Auto · ${goal.linkedExerciseName || 'Exercise'} Max`;
    case 'monthly_workouts':
      return 'Auto · Monthly Workouts';
    case 'weekly_volume':
      return 'Auto · Weekly Volume';
    case 'streak_days':
      return 'Auto · Day Streak';
    case 'body_weight':
      return 'Auto · Body Weight';
    default:
      return '';
  }
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
  const navigate = useNavigate();
  const settings = useAppStore(s => s.settings);
  const storeGoals = useAppStore(s => s.goals);
  const sessions = useAppStore(s => s.sessions);
  const measurements = useAppStore(s => s.measurements);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [goalToDelete, setGoalToDelete] = useState<string | null>(null);

  const weightUnit = settings?.weightUnit || 'kg';
  const weightTrend = useMemo(
    () => computeMeasurementTrend(measurements, 'weight'),
    [measurements],
  );

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
    trackingType: 'manual',
    linkedExerciseName: '',
    startValue: '',
  });

  const openCreateModal = () => {
    setEditingGoal(null);
    setForm({
      title: '',
      targetValue: '',
      currentValue: '0',
      unit: weightUnit,
      deadline: '',
      trackingType: 'manual',
      linkedExerciseName: '',
      startValue: weightTrend.latest ? String(weightTrend.latest.value) : '',
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
      trackingType: goal.trackingType || 'manual',
      linkedExerciseName: goal.linkedExerciseName || '',
      startValue:
        typeof goal.startValue === 'number'
          ? String(goal.startValue)
          : weightTrend.latest
            ? String(weightTrend.latest.value)
            : '',
    });
    setIsModalOpen(true);
  };

  const handleSelectTrackingMode = (mode: GoalTrackingType) => {
    setForm((prev) => {
      let nextUnit = prev.unit;
      let nextTitle = prev.title;
      const startVal =
        prev.startValue || (weightTrend.latest ? String(weightTrend.latest.value) : '');

      if (mode === 'exercise_e1rm' || mode === 'exercise_weight' || mode === 'weekly_volume' || mode === 'body_weight') {
        nextUnit = weightUnit;
      } else if (mode === 'monthly_workouts') {
        nextUnit = 'workouts';
        if (!nextTitle.trim()) nextTitle = 'Workouts This Month';
      } else if (mode === 'streak_days') {
        nextUnit = 'days';
        if (!nextTitle.trim()) nextTitle = 'Workout Streak';
      }

      if (mode === 'weekly_volume' && !nextTitle.trim()) {
        nextTitle = 'Weekly Volume';
      } else if (mode === 'body_weight' && !nextTitle.trim()) {
        nextTitle = 'Target Body Weight';
      }

      return {
        ...prev,
        trackingType: mode,
        unit: nextUnit,
        title: nextTitle,
        startValue: startVal,
      };
    });
  };

  const previewMetric = useMemo(() => {
    if (form.trackingType === 'manual') return null;
    return computeGoalMetricValue(
      { trackingType: form.trackingType, linkedExerciseName: form.linkedExerciseName },
      sessions,
      measurements,
    );
  }, [form.trackingType, form.linkedExerciseName, sessions, measurements]);

  const needsExercise = form.trackingType === 'exercise_e1rm' || form.trackingType === 'exercise_weight';
  const canSave =
    Boolean(form.title.trim()) &&
    Boolean(form.targetValue) &&
    Number(form.targetValue) > 0 &&
    (!needsExercise || Boolean(form.linkedExerciseName.trim()));

  const handleSave = async () => {
    if (!canSave) return;

    const targetNum = Number(form.targetValue);
    const parsedStart =
      form.trackingType === 'body_weight' && form.startValue && !isNaN(Number(form.startValue))
        ? Number(form.startValue)
        : undefined;
    const direction: GoalDirection =
      form.trackingType === 'body_weight' && parsedStart !== undefined && targetNum < parsedStart
        ? 'decrease'
        : 'increase';

    const baseGoal: Goal = {
      id: editingGoal?.id ?? generateId(),
      title: form.title.trim(),
      targetValue: targetNum,
      currentValue: Number(form.currentValue || 0),
      unit: form.unit,
      deadline: form.deadline ? new Date(form.deadline).getTime() : null,
      completed: editingGoal?.completed ?? false,
      createdAt: editingGoal?.createdAt ?? Date.now(),
      trackingType: form.trackingType,
      ...(needsExercise ? { linkedExerciseName: form.linkedExerciseName.trim() } : {}),
      ...(parsedStart !== undefined ? { startValue: parsedStart } : {}),
      ...(form.trackingType !== 'manual' ? { direction } : {}),
    };

    if (form.trackingType !== 'manual') {
      const liveVal = computeGoalMetricValue(baseGoal, sessions, measurements);
      if (liveVal !== null && Number.isFinite(liveVal)) {
        baseGoal.currentValue = Math.round(liveVal * 10) / 10;
        baseGoal.completed = editingGoal?.completed || isGoalAchieved(baseGoal, baseGoal.currentValue);
      }
    }

    await useAppStore.getState().saveGoal(baseGoal);
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
    <div className="min-h-full bg-transparent">
      <div className="px-4 pt-5 pb-6">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between gap-3 pt-safe">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-400">
              Milestones
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight text-content">Goals</h1>
            <p className="mt-0.5 text-xs font-medium text-muted">{activeGoals.length} active</p>
          </div>
          <Button onClick={openCreateModal} size="sm">
            <Plus size={16} />
            New Goal
          </Button>
        </div>

        <div className="space-y-4">
          {weightTrend.latest && (
            <Card
              interactive
              onClick={() => navigate('/stats')}
              className="flex items-center justify-between gap-3 p-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
                  <TrendingUp size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                    Body Weight Trend
                  </p>
                  <p className="mt-0.5 font-mono text-sm font-bold text-content tabular-nums">
                    {weightTrend.latest.value} {weightTrend.latest.unit}
                    {weightTrend.movingAvg7d !== null && (
                      <span className="ml-2 text-xs font-semibold text-emerald-400">
                        · 7d avg {weightTrend.movingAvg7d} {weightTrend.latest.unit}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              {weightTrend.weeklyRate !== null && (
                <Badge variant={weightTrend.weeklyRate === 0 ? 'outline' : 'info'} className="font-mono tabular-nums">
                  {weightTrend.weeklyRate > 0 ? '+' : ''}
                  {weightTrend.weeklyRate}/wk
                </Badge>
              )}
            </Card>
          )}

          {/* Empty state */}
          {goals.length === 0 && (
            <Card className="flex flex-col items-center justify-center py-14 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-500/20 text-primary-400">
                <Target size={30} />
              </div>
              <h3 className="text-lg font-bold text-content">No goals yet</h3>
              <p className="mt-1.5 max-w-xs text-xs text-muted">
                Set a strength, volume, or body weight goal and track progress automatically.
              </p>
              <Button onClick={openCreateModal} className="mt-5">
                <Plus size={16} />
                Set Your First Goal
              </Button>
            </Card>
          )}

          {/* Active goals — single column */}
          <div className="grid grid-cols-1 gap-3.5">
            {activeGoals.map((goal, i) => {
              const pct = computeGoalProgressPercent(goal);
              const deadline = formatDeadline(goal.deadline);
              const colorClass = GOAL_COLORS[i % GOAL_COLORS.length];
              const isAuto = Boolean(goal.trackingType && goal.trackingType !== 'manual');
              const autoLabel = getAutoLabel(goal);

          return (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="liquid-glass relative overflow-hidden rounded-3xl p-5"
            >
              {/* Background gradient blob */}
              <div className={`absolute -top-8 -right-8 h-32 w-32 rounded-full bg-gradient-to-br ${colorClass} opacity-10 blur-2xl pointer-events-none`} />

              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className="text-2xl shrink-0">{UNIT_ICONS[goal.unit] || '🎯'}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold text-content leading-tight truncate">{goal.title}</h3>
                      {isAuto && (
                        <span className="inline-flex items-center gap-1 rounded bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.5 text-[9px] font-black uppercase text-sky-400">
                          <RefreshCw size={9} /> Auto
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted mt-0.5 tabular-nums">
                      {goal.direction === 'decrease' && typeof goal.startValue === 'number'
                        ? `Now ${goal.currentValue} · Start ${goal.startValue} → ${goal.targetValue} ${goal.unit}`
                        : `${goal.currentValue} / ${goal.targetValue} ${goal.unit}`}
                    </p>
                    {isAuto && autoLabel && (
                      <p className="text-[10px] font-semibold text-sky-400/80 mt-0.5 truncate">
                        {autoLabel}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
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

              {/* Quick progress update / Auto-sync indicator */}
              {isAuto ? (
                <div className="flex items-center justify-between gap-2 mt-4">
                  <span className="text-[11px] font-semibold text-muted">
                    Syncs automatically with workouts &amp; logs
                  </span>
                  <button
                    onClick={() => handleToggleComplete(goal)}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 transition-colors shrink-0"
                  >
                    <CheckCircle2 size={14}/> Done
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => handleUpdateProgress(goal, goal.currentValue - 1)}
                    aria-label="Decrease goal value"
                    className="liquid-btn-glass flex h-10 w-10 items-center justify-center rounded-xl text-content font-bold text-base cursor-pointer"
                  >
                    −
                  </button>
                  <div className="flex-1 text-center">
                    <span className="font-mono text-sm font-bold text-muted tabular-nums">{goal.currentValue} {goal.unit}</span>
                  </div>
                  <button
                    onClick={() => handleUpdateProgress(goal, goal.currentValue + 1)}
                    aria-label="Increase goal value"
                    className="liquid-btn-glass flex h-10 w-10 items-center justify-center rounded-xl text-content font-bold text-base cursor-pointer"
                  >
                    +
                  </button>
                  <button
                    onClick={() => handleToggleComplete(goal)}
                    className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/18 px-3.5 py-2 text-xs font-bold text-emerald-400 backdrop-blur-md hover:bg-emerald-500/25 transition-colors cursor-pointer"
                  >
                    <CheckCircle2 size={14} /> Done
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}
          </div>

          {/* Completed goals */}
          {completedGoals.length > 0 && (
            <>
              <div className="flex items-center gap-2 pt-2">
                <Trophy size={16} className="text-yellow-500" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted">Achieved</h2>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {completedGoals.map((goal, i) => (
                  <motion.div
                    key={goal.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="liquid-glass flex items-center gap-3 rounded-2xl p-4 opacity-75"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                      <CheckCircle2 size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-content line-through">{goal.title}</p>
                      <p className="font-mono text-xs text-muted tabular-nums">{goal.targetValue} {goal.unit}</p>
                    </div>
                    <button
                      onClick={() => handleToggleComplete(goal)}
                      className="text-xs font-semibold text-muted hover:text-content transition-colors cursor-pointer"
                    >
                      Undo
                    </button>
                    <button
                      onClick={() => setGoalToDelete(goal.id)}
                      className="text-muted hover:text-red-400 transition-colors cursor-pointer"
                      aria-label="Delete achieved goal"
                    >
                      <Trash2 size={15} />
                    </button>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      <AppDialog
        open={isModalOpen}
        onOpenChange={(open) => {
          if (!open) setIsModalOpen(false);
        }}
        title={editingGoal ? 'Edit Goal' : 'New Goal'}
        layout="sheet"
        size="md"
      >
        <div className="space-y-4">
          {/* Tracking Mode */}
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-muted">
              Tracking Mode
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TRACKING_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectTrackingMode(m.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    form.trackingType === m.id
                      ? 'border-sky-500/40 bg-sky-500/20 text-sky-400'
                      : 'border-content/10 bg-surface text-muted hover:text-content'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Linked Exercise */}
          {needsExercise && (
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
                Linked Exercise
              </label>
              <AutocompleteInput
                value={form.linkedExerciseName}
                onChange={(val) => setForm((f) => ({ ...f, linkedExerciseName: val }))}
                onSelect={(ex) =>
                  setForm((f) => ({
                    ...f,
                    linkedExerciseName: ex.name,
                    title:
                      f.title.trim() === ''
                        ? `${ex.name} ${f.trackingType === 'exercise_e1rm' ? '1RM' : 'Max'}`
                        : f.title,
                  }))
                }
                placeholder="Select exercise to auto-track..."
              />
            </div>
          )}

          {/* Title */}
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
              Goal Title
            </label>
            <Input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Bench Press 100kg"
            />
          </div>

          {/* Target + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
                Target
              </label>
              <Input
                type="number"
                value={form.targetValue}
                onChange={(e) => setForm((f) => ({ ...f, targetValue: e.target.value }))}
                placeholder="100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
                Unit
              </label>
              <select
                value={form.unit}
                disabled={form.trackingType !== 'manual'}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                className="liquid-input flex h-11 w-full rounded-2xl px-3.5 text-sm font-medium text-content outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/25 disabled:opacity-60"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u} className="bg-card text-content">
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Body weight starting weight */}
          {form.trackingType === 'body_weight' && (
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
                Starting Weight ({weightUnit})
              </label>
              <Input
                type="number"
                value={form.startValue}
                onChange={(e) => setForm((f) => ({ ...f, startValue: e.target.value }))}
                placeholder={weightTrend.latest ? String(weightTrend.latest.value) : '75'}
              />
              {form.startValue && form.targetValue && (
                <p className="mt-1 text-[11px] font-semibold text-sky-400">
                  Direction: {Number(form.targetValue) < Number(form.startValue) ? 'Weight Loss ↓' : 'Weight Gain ↑'}
                </p>
              )}
            </div>
          )}

          {/* Current Value (manual) or Live Metric Preview (auto) */}
          {form.trackingType === 'manual' ? (
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
                Current Progress
              </label>
              <Input
                type="number"
                value={form.currentValue}
                onChange={(e) => setForm((f) => ({ ...f, currentValue: e.target.value }))}
                placeholder="0"
              />
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3">
              <span className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                <RefreshCw size={13} /> Current Synced Value
              </span>
              <span className="font-mono text-sm font-black text-content tabular-nums">
                {previewMetric !== null ? `${Math.round(previewMetric * 10) / 10} ${form.unit}` : 'No data yet'}
              </span>
            </div>
          )}

          {/* Deadline */}
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
              Deadline (optional)
            </label>
            <Input
              type="date"
              value={form.deadline}
              onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
              className="dark:[color-scheme:dark]"
            />
          </div>

          <Button onClick={handleSave} disabled={!canSave} size="lg" className="w-full">
            {editingGoal ? 'Save Changes' : 'Create Goal'}
          </Button>
        </div>
      </AppDialog>

      <ConfirmModal
        isOpen={goalToDelete !== null}
        title="Delete Goal"
        message="Remove this goal from your list?"
        confirmText="Delete"
        isDestructive
        onCancel={() => setGoalToDelete(null)}
        onConfirm={() => {
          if (goalToDelete) {
            handleDelete(goalToDelete);
            toast.success('Goal deleted');
          }
          setGoalToDelete(null);
        }}
      />
    </div>
  );
}
