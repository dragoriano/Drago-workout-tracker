import React from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Dumbbell,
  Flame,
  Plus,
  Sparkles,
  Star,
  Timer,
  Users,
  Weight,
  X,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../../utils/cn';

export type WizardStep = 'goal' | 'days' | 'hours' | 'recommendation';

export interface WizardState {
  goal: string;
  daysPerWeek: number;
  hoursPerSession: number;
}

export interface SplitRecommendation {
  name: string;
  splitKey: string;
  daysCount: number;
  match: number;
  badge: string;
  reasoning: string;
  icon: React.ReactNode;
  accentColor: string;
  estimate: string;
}

export function getRecommendations(state: WizardState): SplitRecommendation[] {
  const { goal, daysPerWeek, hoursPerSession } = state;

  const allSplits: SplitRecommendation[] = [
    {
      name: 'Push / Pull / Legs',
      splitKey: 'Push/Pull/Legs (PPL)',
      daysCount: 3,
      match: 0,
      badge: '',
      reasoning: '',
      icon: <Dumbbell size={22} />,
      accentColor: 'text-emerald-400 bg-emerald-500/15',
      estimate: '60–75 min',
    },
    {
      name: 'Upper / Lower',
      splitKey: 'Upper/Lower',
      daysCount: 4,
      match: 0,
      badge: '',
      reasoning: '',
      icon: <Zap size={22} />,
      accentColor: 'text-sky-400 bg-sky-500/15',
      estimate: '50–65 min',
    },
    {
      name: 'Full Body',
      splitKey: 'Full Body',
      daysCount: 3,
      match: 0,
      badge: '',
      reasoning: '',
      icon: <Star size={22} />,
      accentColor: 'text-amber-400 bg-amber-500/15',
      estimate: '45–60 min',
    },
    {
      name: 'Bro Split',
      splitKey: 'Bro Split',
      daysCount: 5,
      match: 0,
      badge: '',
      reasoning: '',
      icon: <Flame size={22} />,
      accentColor: 'text-orange-400 bg-orange-500/15',
      estimate: '45–55 min',
    },
    {
      name: 'Powerbuilding',
      splitKey: 'Powerbuilding',
      daysCount: 4,
      match: 0,
      badge: '',
      reasoning: '',
      icon: <Weight size={22} />,
      accentColor: 'text-rose-400 bg-rose-500/15',
      estimate: '70–90 min',
    },
    {
      name: 'HIT (Mike Mentzer)',
      splitKey: 'HIT (Mike Mentzer)',
      daysCount: 2,
      match: 0,
      badge: '',
      reasoning: '',
      icon: <Timer size={22} />,
      accentColor: 'text-red-400 bg-red-500/15',
      estimate: '25–35 min',
    },
    {
      name: 'Bodyweight Only',
      splitKey: 'Bodyweight Only',
      daysCount: 3,
      match: 0,
      badge: '',
      reasoning: '',
      icon: <Users size={22} />,
      accentColor: 'text-teal-400 bg-teal-500/15',
      estimate: '30–45 min',
    },
  ];

  const scored = allSplits.map((split) => {
    let score = 50;
    const reasons: string[] = [];

    const dayDiff = Math.abs(split.daysCount - daysPerWeek);
    if (dayDiff === 0) {
      score += 30;
      reasons.push(`perfect for ${daysPerWeek} days/week`);
    } else if (dayDiff === 1) {
      score += 15;
      reasons.push(`fits ${daysPerWeek} days/week with minor adjustment`);
    } else if (dayDiff >= 2) {
      score -= 15 * dayDiff;
    }

    const isShortSession = hoursPerSession <= 1;
    const isLongSession = hoursPerSession >= 1.5;
    const sessionMin = {
      'Push/Pull/Legs (PPL)': 67,
      'Upper/Lower': 57,
      'Full Body': 52,
      'Bro Split': 50,
      Powerbuilding: 80,
      'HIT (Mike Mentzer)': 30,
      'Bodyweight Only': 37,
    };
    const targetMin = hoursPerSession * 60;
    const smDiff = Math.abs((sessionMin[split.splitKey as keyof typeof sessionMin] ?? 60) - targetMin);
    if (smDiff <= 10) {
      score += 20;
      reasons.push('session length is a perfect fit');
    } else if (smDiff <= 20) {
      score += 10;
    } else if (smDiff > 30) {
      score -= 10;
    }

    if (goal === 'Muscle Building') {
      if (['Push/Pull/Legs (PPL)', 'Bro Split', 'Upper/Lower'].includes(split.splitKey)) {
        score += 15;
        reasons.push('optimized for hypertrophy');
      }
    } else if (goal === 'Fat Loss') {
      if (['Full Body', 'Bodyweight Only', 'Upper/Lower'].includes(split.splitKey)) {
        score += 15;
        reasons.push('great for calorie burn');
      }
      if (isShortSession && split.splitKey === 'HIT (Mike Mentzer)') {
        score += 10;
        reasons.push('high intensity, time-efficient');
      }
    } else if (goal === 'Strength') {
      if (['Powerbuilding', 'Upper/Lower', 'Push/Pull/Legs (PPL)'].includes(split.splitKey)) {
        score += 15;
        reasons.push('structured for strength gains');
      }
    }

    if (isShortSession && ['HIT (Mike Mentzer)', 'Bodyweight Only', 'Full Body'].includes(split.splitKey)) {
      score += 8;
    }
    if (isLongSession && ['Powerbuilding', 'Bro Split'].includes(split.splitKey)) {
      score += 8;
      reasons.push('allows thorough volume');
    }

    const clampedScore = Math.max(10, Math.min(99, score));
    const reasoning =
      reasons.length > 0 ? reasons.slice(0, 2).join(', ') : 'Compatible with your schedule';

    return { ...split, match: clampedScore, reasoning };
  });

  return scored
    .sort((a, b) => b.match - a.match)
    .slice(0, 3)
    .map((s, i) => ({
      ...s,
      badge: i === 0 ? 'Best Match' : i === 1 ? 'Great Choice' : 'Also Good',
    }));
}

interface ProgramWizardModalProps {
  isOpen: boolean;
  wizardStep: WizardStep;
  wizardState: WizardState;
  recommendations: SplitRecommendation[];
  onClose: () => void;
  onStepChange: (step: WizardStep) => void;
  onUpdateState: (updater: (prev: WizardState) => WizardState) => void;
  onAdvance: (updates: Partial<WizardState>) => void;
  onPickRecommendation: (rec: SplitRecommendation) => void;
  onBuildCustom: () => void;
}

const STEPS: WizardStep[] = ['goal', 'days', 'hours', 'recommendation'];

export function ProgramWizardModal({
  isOpen,
  wizardStep,
  wizardState,
  recommendations,
  onClose,
  onStepChange,
  onUpdateState,
  onAdvance,
  onPickRecommendation,
  onBuildCustom,
}: ProgramWizardModalProps) {
  const stepIndex = STEPS.indexOf(wizardStep);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
          <motion.div
            key={wizardStep}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="w-full max-w-md rounded-t-3xl bg-card sm:rounded-3xl max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-card z-10 flex items-center justify-between p-5 pb-4 border-b border-content/5">
              <button
                onClick={() => {
                  if (wizardStep === 'goal') onClose();
                  else if (wizardStep === 'days') onStepChange('goal');
                  else if (wizardStep === 'hours') onStepChange('days');
                  else if (wizardStep === 'recommendation') onStepChange('hours');
                }}
                className="rounded-full bg-content/10 p-2 text-content hover:bg-content/20"
              >
                <ArrowLeft size={18} />
              </button>

              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={14} className="text-emerald-400" />
                  <span className="text-sm font-semibold text-content">AI-Guided Setup</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {STEPS.map((s, i) => (
                    <div
                      key={s}
                      className={cn(
                        'rounded-full transition-all duration-300',
                        i === stepIndex
                          ? 'w-5 h-1.5 bg-emerald-400'
                          : i < stepIndex
                          ? 'w-1.5 h-1.5 bg-emerald-400/60'
                          : 'w-1.5 h-1.5 bg-content/20',
                      )}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={onClose}
                className="rounded-full bg-content/10 p-2 text-content hover:bg-content/20"
              >
                <X size={18} />
              </button>
            </div>

            {wizardStep === 'goal' && (
              <div className="p-5 space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-content">What's your main goal?</h2>
                  <p className="text-sm text-muted mt-1">
                    This shapes every exercise recommendation we make.
                  </p>
                </div>

                <div className="grid gap-3">
                  {[
                    {
                      key: 'Muscle Building',
                      icon: <Dumbbell size={26} />,
                      color: 'text-orange-400 bg-orange-500/15 border-orange-500/30',
                      activeColor: 'bg-orange-500/20 border-orange-500/50',
                      desc: 'Grow muscle size through hypertrophy-focused training',
                    },
                    {
                      key: 'Fat Loss',
                      icon: <Flame size={26} />,
                      color: 'text-red-400 bg-red-500/15 border-red-500/30',
                      activeColor: 'bg-red-500/20 border-red-500/50',
                      desc: 'Burn calories with high-intensity metabolic workouts',
                    },
                    {
                      key: 'Strength',
                      icon: <Weight size={26} />,
                      color: 'text-sky-400 bg-sky-500/15 border-sky-500/30',
                      activeColor: 'bg-sky-500/20 border-sky-500/50',
                      desc: 'Build raw power through heavy compound lifts',
                    },
                  ].map(({ key, icon, color, activeColor, desc }) => (
                    <button
                      key={key}
                      onClick={() => onAdvance({ goal: key })}
                      className={cn(
                        'w-full flex items-center gap-4 rounded-2xl border p-4 text-left transition-all active:scale-95',
                        wizardState.goal === key ? activeColor : color,
                      )}
                    >
                      <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', color)}>
                        {icon}
                      </div>
                      <div>
                        <h3 className="font-bold text-content">{key}</h3>
                        <p className="text-xs text-muted mt-0.5 leading-snug">{desc}</p>
                      </div>
                      {wizardState.goal === key && (
                        <CheckCircle2 size={20} className="ml-auto shrink-0 text-emerald-400" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {wizardStep === 'days' && (
              <div className="p-5 space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-content">How many days per week?</h2>
                  <p className="text-sm text-muted mt-1">Be realistic — consistency beats intensity.</p>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {[2, 3, 4, 5, 6].map((d) => {
                    const labels: Record<number, string> = {
                      2: 'Minimal',
                      3: 'Balanced',
                      4: 'Dedicated',
                      5: 'Serious',
                      6: 'Elite',
                    };
                    const isSelected = wizardState.daysPerWeek === d;
                    return (
                      <button
                        key={d}
                        onClick={() => onUpdateState((p) => ({ ...p, daysPerWeek: d }))}
                        className={cn(
                          'flex flex-col items-center justify-center gap-1 rounded-2xl border py-4 transition-all active:scale-95',
                          isSelected
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                            : 'bg-content/5 border-content/10 text-content hover:border-emerald-500/30',
                        )}
                      >
                        <span className="text-2xl font-black">{d}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                          {labels[d]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-xl bg-content/5 border border-content/10 p-3 flex items-start gap-2.5">
                  <Sparkles size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-muted leading-relaxed">
                    {wizardState.daysPerWeek <= 2
                      ? "Great for busy schedules. We'll suggest high-efficiency, full-body sessions."
                      : wizardState.daysPerWeek <= 3
                      ? 'The sweet spot for most people — enough volume without burnout.'
                      : wizardState.daysPerWeek <= 4
                      ? 'Solid commitment. Allows for focused muscle group splits.'
                      : 'Advanced training frequency — ideal if you want maximum volume.'}
                  </p>
                </div>

                <button
                  onClick={() => onAdvance({})}
                  className="w-full rounded-2xl bg-emerald-500 py-3.5 text-sm font-bold text-white transition-all active:scale-[0.98] hover:bg-emerald-400"
                >
                  Continue →
                </button>
              </div>
            )}

            {wizardStep === 'hours' && (
              <div className="p-5 space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-content">Time per session?</h2>
                  <p className="text-sm text-muted mt-1">Including warm-up and cool-down.</p>
                </div>

                <div className="grid gap-2.5">
                  {[
                    { value: 0.5, label: '30 min', sub: 'Quick blast — focused and intense' },
                    { value: 1, label: '1 hour', sub: 'Most common — efficient and effective' },
                    { value: 1.5, label: '1.5 hours', sub: 'Room for volume + isolation work' },
                    { value: 2, label: '2+ hours', sub: 'Elite training — full muscle focus' },
                  ].map(({ value, label, sub }) => {
                    const isSelected = wizardState.hoursPerSession === value;
                    return (
                      <button
                        key={value}
                        onClick={() => onUpdateState((p) => ({ ...p, hoursPerSession: value }))}
                        className={cn(
                          'w-full flex items-center gap-4 rounded-2xl border px-4 py-3 text-left transition-all active:scale-[0.98]',
                          isSelected
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'bg-content/5 border-content/10 text-content hover:border-emerald-500/30',
                        )}
                      >
                        <div
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black',
                            isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-content/10 text-muted',
                          )}
                        >
                          <Clock size={18} />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-content">{label}</div>
                          <div className="text-xs text-muted leading-snug">{sub}</div>
                        </div>
                        {isSelected && (
                          <CheckCircle2 size={18} className="ml-auto shrink-0 text-emerald-400" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => onAdvance({})}
                  className="w-full rounded-2xl bg-emerald-500 py-3.5 text-sm font-bold text-white transition-all active:scale-[0.98] hover:bg-emerald-400"
                >
                  Get My Recommendations →
                </button>
              </div>
            )}

            {wizardStep === 'recommendation' && (
              <div className="p-5 space-y-4">
                <div className="rounded-2xl bg-gradient-to-r from-emerald-500/10 to-sky-500/10 border border-emerald-500/20 p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Sparkles size={14} className="text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      AI Analysis
                    </span>
                  </div>
                  <p className="text-sm text-content leading-relaxed">
                    Based on your <span className="font-semibold text-emerald-300">{wizardState.goal}</span>{' '}
                    goal, <span className="font-semibold text-emerald-300">{wizardState.daysPerWeek} days/week</span>,
                    and{' '}
                    <span className="font-semibold text-emerald-300">
                      {wizardState.hoursPerSession >= 1
                        ? `${wizardState.hoursPerSession}hr`
                        : `${wizardState.hoursPerSession * 60}min`}{' '}
                      sessions
                    </span>
                    , here are your personalized program recommendations:
                  </p>
                </div>

                <div className="space-y-3">
                  {recommendations.map((rec, i) => (
                    <motion.button
                      key={rec.splitKey}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.07 }}
                      onClick={() => onPickRecommendation(rec)}
                      className="w-full text-left rounded-2xl border border-content/10 bg-surface p-4 transition-all active:scale-[0.98] hover:border-emerald-500/30 hover:bg-surface/80 group"
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', rec.accentColor)}>
                          {rec.icon}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-content text-sm">{rec.name}</h3>
                            <span
                              className={cn(
                                'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                                i === 0
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : i === 1
                                  ? 'bg-sky-500/20 text-sky-400'
                                  : 'bg-zinc-500/20 text-zinc-400',
                              )}
                            >
                              {rec.badge}
                            </span>
                          </div>
                          <p className="text-xs text-muted mt-0.5 capitalize leading-snug">{rec.reasoning}</p>

                          <div className="flex items-center gap-3 mt-2">
                            <span className="flex items-center gap-1 text-[10px] text-muted/70 font-semibold uppercase tracking-widest">
                              <Calendar size={10} className="text-primary-400/60" />
                              {rec.daysCount}d/week
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-muted/70 font-semibold uppercase tracking-widest">
                              <Clock size={10} className="text-primary-400/60" />
                              {rec.estimate}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 flex flex-col items-center">
                          <div
                            className={cn(
                              'relative w-10 h-10 rounded-full flex items-center justify-center text-xs font-black',
                              rec.match >= 80
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : rec.match >= 65
                                ? 'bg-sky-500/20 text-sky-400'
                                : 'bg-zinc-500/15 text-zinc-400',
                            )}
                          >
                            {rec.match}
                          </div>
                          <span className="text-[8px] font-bold uppercase tracking-widest text-muted/60 mt-0.5">
                            match
                          </span>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>

                <div className="pt-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 h-px bg-content/10" />
                    <span className="text-xs text-muted font-semibold uppercase tracking-widest">or</span>
                    <div className="flex-1 h-px bg-content/10" />
                  </div>
                  <button
                    onClick={onBuildCustom}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl border border-content/10 bg-content/5 py-3.5 text-sm font-semibold text-muted hover:text-content hover:border-content/20 transition-all active:scale-[0.98]"
                  >
                    <Plus size={16} />
                    Build My Own from Scratch
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
