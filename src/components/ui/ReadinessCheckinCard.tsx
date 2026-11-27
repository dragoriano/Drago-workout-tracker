import React, { useState } from 'react';
import { Activity, BatteryCharging, Brain, CheckCircle2, Edit3, Flame, Moon } from 'lucide-react';
import { Card } from './Card';
import { Button } from './Button';
import type { ReadinessCheckin } from '../../types';
import {
  computeReadinessScore,
  evaluateReadinessPrescription,
  type ReadinessTier,
} from '../../utils/readinessCoach';
import type { MesocycleProgressSummary } from '../../utils/mesocycle';
import { cn } from '../../utils/cn';

interface ReadinessCheckinCardProps {
  todayCheckin: ReadinessCheckin | null;
  avg7dScore: number | null;
  mesocycle?: MesocycleProgressSummary | null;
  onSaveCheckin: (input: {
    id?: string;
    sleep: number;
    energy: number;
    soreness: number;
    stress: number;
    score: number;
  }) => Promise<void> | void;
}

const TIER_BADGES: Record<ReadinessTier, string> = {
  prime: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35',
  ready: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/35',
  moderate: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35',
  low: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/35',
};

const RATING_STEPS = [1, 2, 3, 4, 5] as const;

export const ReadinessCheckinCard: React.FC<ReadinessCheckinCardProps> = ({
  todayCheckin,
  avg7dScore,
  mesocycle,
  onSaveCheckin,
}) => {
  const [editing, setEditing] = useState(!todayCheckin);
  const [sleep, setSleep] = useState(todayCheckin?.sleep ?? 4);
  const [energy, setEnergy] = useState(todayCheckin?.energy ?? 4);
  const [soreness, setSoreness] = useState(todayCheckin?.soreness ?? 4);
  const [stress, setStress] = useState(todayCheckin?.stress ?? 4);
  const [saving, setSaving] = useState(false);

  const liveScore = computeReadinessScore({ sleep, energy, soreness, stress });
  const activePrescription = evaluateReadinessPrescription(todayCheckin, mesocycle);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSaveCheckin({
        id: todayCheckin?.id,
        sleep,
        energy,
        soreness,
        stress,
        score: liveScore,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (todayCheckin && !editing && activePrescription) {
    return (
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-black text-sm tabular-nums">
              {todayCheckin.score}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-extrabold text-content">
                  Today&apos;s Readiness
                </span>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                    TIER_BADGES[activePrescription.tier],
                  )}
                >
                  {activePrescription.label}
                </span>
                {avg7dScore !== null && (
                  <span className="text-[10px] font-bold text-muted tabular-nums">
                    · 7d avg {avg7dScore}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs font-bold text-content">{activePrescription.headline}</p>
              <p className="mt-0.5 text-[11px] text-muted leading-snug">
                {activePrescription.guidance}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSleep(todayCheckin.sleep);
              setEnergy(todayCheckin.energy);
              setSoreness(todayCheckin.soreness);
              setStress(todayCheckin.stress);
              setEditing(true);
            }}
            aria-label="Edit today readiness check-in"
            className="liquid-btn-glass flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-muted hover:text-content cursor-pointer"
          >
            <Edit3 size={14} />
          </button>
        </div>
      </Card>
    );
  }

  const metrics: Array<{
    label: string;
    value: number;
    setter: (v: number) => void;
    icon: React.ReactNode;
    lowHint: string;
    highHint: string;
  }> = [
    {
      label: 'Sleep',
      value: sleep,
      setter: setSleep,
      icon: <Moon size={13} className="text-sky-600 dark:text-sky-400" />,
      lowHint: 'Poor',
      highHint: 'Great',
    },
    {
      label: 'Energy',
      value: energy,
      setter: setEnergy,
      icon: <BatteryCharging size={13} className="text-emerald-600 dark:text-emerald-400" />,
      lowHint: 'Drained',
      highHint: 'Charged',
    },
    {
      label: 'Freshness',
      value: soreness,
      setter: setSoreness,
      icon: <Flame size={13} className="text-amber-700 dark:text-amber-400" />,
      lowHint: 'Very Sore',
      highHint: 'Fresh',
    },
    {
      label: 'Calmness',
      value: stress,
      setter: setStress,
      icon: <Brain size={13} className="text-orange-600 dark:text-orange-400" />,
      lowHint: 'Stressed',
      highHint: 'Calm',
    },
  ];

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-700 dark:text-sky-400">
            <Activity size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-content">Daily Readiness Check-In</h3>
            <p className="text-[11px] text-muted">5-second check to auto-tune session loads</p>
          </div>
        </div>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-xs font-black text-emerald-700 dark:text-emerald-300 tabular-nums shrink-0">
          {liveScore}/100
        </span>
      </div>

      <div className="space-y-2.5 mb-3.5">
        {metrics.map((m) => (
          <div key={m.label} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-[92px]">
              {m.icon}
              <span className="text-xs font-bold text-content">{m.label}</span>
            </div>
            <div className="flex items-center gap-1">
              {RATING_STEPS.map((n) => {
                const active = m.value === n;
                return (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${m.label} ${n} of 5`}
                    onClick={() => m.setter(n)}
                    className={cn(
                      'h-8 w-8 rounded-lg border text-xs font-black transition-all cursor-pointer tabular-nums',
                      active
                        ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                        : 'bg-page/30 text-muted border-content/10 hover:text-content',
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {todayCheckin && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing(false)}
            className="min-h-[38px]"
          >
            Cancel
          </Button>
        )}
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={saving}
          onClick={handleSave}
          className="flex-1 min-h-[38px]"
        >
          <CheckCircle2 size={14} />
          {saving ? 'Saving...' : 'Save Readiness'}
        </Button>
      </div>
    </Card>
  );
};
