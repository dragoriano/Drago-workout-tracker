import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Disc, Minus, Plus, RotateCcw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { cn } from '../../utils/cn';
import {
  BARBELL_PRESETS,
  calculateBarbellPlates,
  DEFAULT_BARBELL_WEIGHT,
  DEFAULT_PLATES,
  getPlateVisualSpec,
  resolveBarbellWeight,
  WeightUnit,
} from '../../utils/strength';
import { AppDialog } from './Dialog';
import { Button } from './Button';
import { Badge } from './Badge';

interface PlateCalculatorModalProps {
  isOpen: boolean;
  initialWeight?: number;
  exerciseName?: string;
  onApplyWeight?: (weight: number) => void;
  onClose: () => void;
}

export function PlateCalculatorModal({
  isOpen,
  initialWeight,
  exerciseName,
  onApplyWeight,
  onClose,
}: PlateCalculatorModalProps) {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const unit: WeightUnit = settings?.weightUnit === 'lbs' ? 'lbs' : 'kg';
  const standardBarWeight = DEFAULT_BARBELL_WEIGHT[unit];
  const barbellWeight = resolveBarbellWeight(settings?.barbellWeight, unit);
  const availablePlates =
    settings?.availablePlates && settings.availablePlates.length > 0
      ? settings.availablePlates
      : DEFAULT_PLATES[unit];

  const step = unit === 'kg' ? 2.5 : 5;
  const quickTargets = unit === 'kg' ? [40, 60, 80, 100, 120, 140] : [95, 135, 185, 225, 275, 315];

  const [targetInput, setTargetInput] = useState('');
  const wasOpenRef = useRef(false);

  // Initialize target weight when the modal opens without clobbering user input if barbell preset changes.
  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      const defaultTarget =
        initialWeight && initialWeight > 0
          ? initialWeight
          : barbellWeight + (unit === 'kg' ? 40 : 90);
      setTargetInput(String(defaultTarget));
    }
  }, [isOpen, initialWeight, barbellWeight, unit]);

  const parsedTarget = Number(targetInput);
  const safeTarget = Number.isFinite(parsedTarget) && parsedTarget >= 0 ? parsedTarget : 0;
  const breakdown = calculateBarbellPlates(safeTarget, barbellWeight, availablePlates);

  const adjustTarget = (delta: number) => {
    const next = Math.max(0, Math.round((safeTarget + delta) * 100) / 100);
    setTargetInput(String(next));
  };

  const togglePlate = (plate: number) => {
    const exists = availablePlates.includes(plate);
    if (exists && availablePlates.length <= 1) return;
    const next = exists
      ? availablePlates.filter((p) => p !== plate)
      : [...availablePlates, plate].sort((a, b) => b - a);
    updateSettings({ availablePlates: next });
  };

  // Visual discs ordered from collar outward (heaviest closest to collar)
  const rightDiscs = breakdown.platesPerSide.flatMap((entry) =>
    Array.from({ length: Math.min(entry.count, 7) }, (_, idx) => ({
      weight: entry.weight,
      key: `${entry.weight}-${idx}`,
    })),
  );
  const leftDiscs = [...rightDiscs].reverse();

  return (
    <AppDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={
        <span className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-500/15 text-primary-400">
            <Disc size={18} />
          </span>
          Plate Calculator
        </span>
      }
      description={exerciseName || `Standard Olympic bar (${standardBarWeight} ${unit}) & plates per side`}
      layout="sheet"
      size="md"
    >
      <div className="space-y-4">
        {/* Non-standard bar notice */}
        {barbellWeight !== standardBarWeight && (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs">
            <span className="font-semibold text-amber-300">
              Using {barbellWeight} {unit} bar (standard is {standardBarWeight} {unit})
            </span>
            <button
              type="button"
              onClick={() => updateSettings({ barbellWeight: standardBarWeight })}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-zinc-950 hover:bg-amber-400 transition-colors cursor-pointer"
            >
              <RotateCcw size={12} />
              Reset {standardBarWeight} {unit}
            </button>
          </div>
        )}

        {/* Target Weight Control */}
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted">
            Target Total Weight ({unit})
          </label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => adjustTarget(-step)}
              className="h-12 w-12 shrink-0 rounded-2xl"
              aria-label={`Decrease by ${step} ${unit}`}
            >
              <Minus size={18} />
            </Button>
            <div className="relative flex-1">
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                className="liquid-input h-12 w-full rounded-2xl px-4 pr-12 text-center font-mono text-2xl font-bold text-content outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/25 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold uppercase text-muted">
                {unit}
              </span>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => adjustTarget(step)}
              className="h-12 w-12 shrink-0 rounded-2xl"
              aria-label={`Increase by ${step} ${unit}`}
            >
              <Plus size={18} />
            </Button>
          </div>

          {/* Quick Weight Chips */}
          <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {quickTargets.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setTargetInput(String(q))}
                className={cn(
                  'shrink-0 rounded-xl px-3 py-1.5 font-mono text-xs font-bold transition-all cursor-pointer tabular-nums',
                  Math.round(safeTarget * 10) === Math.round(q * 10)
                    ? 'liquid-btn-subtle text-primary-400'
                    : 'liquid-btn-glass text-muted hover:text-content',
                )}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Barbell Presets (near top for immediate visibility) */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
              Barbell Weight
            </p>
            <span className="text-[11px] font-semibold text-muted">
              Standard: {standardBarWeight} {unit}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {BARBELL_PRESETS[unit].map((preset) => {
              const active = barbellWeight === preset;
              const isStd = preset === standardBarWeight;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => updateSettings({ barbellWeight: preset })}
                  className={cn(
                    'flex min-h-[48px] flex-col items-center justify-center rounded-2xl py-2 text-xs font-bold transition-all cursor-pointer tabular-nums',
                    active
                      ? 'liquid-btn-primary text-white'
                      : 'liquid-btn-glass text-muted hover:text-content',
                  )}
                >
                  <span>{preset} {unit}</span>
                  {isStd && (
                    <span
                      className={cn(
                        'mt-0.5 text-[9px] font-bold uppercase tracking-wider',
                        active ? 'text-white/85' : 'text-primary-400',
                      )}
                    >
                      Olympic
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3-Metric Breakdown + Symmetrical Barbell Visual */}
        <div className="liquid-glass rounded-3xl p-4">
          <div className="mb-3 grid grid-cols-3 gap-2 rounded-2xl border border-content/10 bg-content/5 p-2.5 text-center backdrop-blur-md">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Per Side</p>
              <p className="font-mono text-base font-bold text-primary-400 tabular-nums">
                {breakdown.perSideWeight} {unit}
              </p>
            </div>
            <div className="border-x border-content/10">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Barbell</p>
              <p className="font-mono text-base font-bold text-content tabular-nums">
                {breakdown.barbellWeight} {unit}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Total</p>
              <p className="font-mono text-base font-bold text-content tabular-nums">
                {breakdown.achievableWeight} {unit}
              </p>
            </div>
          </div>

          {/* Symmetrical Full-Barbell View */}
          <div className="relative flex h-28 items-center justify-center overflow-x-auto py-1">
            {/* Left sleeve */}
            <div className="relative flex flex-1 items-center justify-end gap-0.5 pr-1 min-w-[64px]">
              <div className="absolute left-2 right-0 h-2.5 rounded-l bg-zinc-500/55" />
              {leftDiscs.map((disc) => {
                const spec = getPlateVisualSpec(disc.weight, unit);
                return (
                  <div
                    key={`l-${disc.key}`}
                    className={cn(
                      'relative z-10 flex w-6 shrink-0 items-center justify-center rounded-md border border-black/25 font-mono text-[9px] font-bold shadow-md select-none',
                      spec.heightClass,
                      spec.colorClass,
                      spec.textClass,
                    )}
                  >
                    {disc.weight}
                  </div>
                );
              })}
            </div>

            {/* Left collar */}
            <div className="h-9 w-2.5 shrink-0 rounded-sm border-r border-zinc-600 bg-zinc-300 dark:bg-zinc-400" />

            {/* Center shaft showing bar weight */}
            <div className="relative flex h-3.5 w-20 shrink-0 items-center justify-center bg-zinc-500 dark:bg-zinc-400">
              <span className="rounded-full border border-content/15 bg-card px-2 py-0.5 font-mono text-[10px] font-bold text-content shadow-sm whitespace-nowrap tabular-nums">
                {breakdown.barbellWeight} {unit}
              </span>
            </div>

            {/* Right collar */}
            <div className="h-9 w-2.5 shrink-0 rounded-sm border-l border-zinc-600 bg-zinc-300 dark:bg-zinc-400" />

            {/* Right sleeve */}
            <div className="relative flex flex-1 items-center justify-start gap-0.5 pl-1 min-w-[64px]">
              <div className="absolute left-0 right-2 h-2.5 rounded-r bg-zinc-500/55" />
              {rightDiscs.length === 0 ? (
                <span className="relative z-10 ml-2 rounded bg-elevated px-2 py-0.5 text-[10px] font-semibold text-muted">
                  Bar only
                </span>
              ) : (
                rightDiscs.map((disc) => {
                  const spec = getPlateVisualSpec(disc.weight, unit);
                  return (
                    <div
                      key={`r-${disc.key}`}
                      className={cn(
                        'relative z-10 flex w-6 shrink-0 items-center justify-center rounded-md border border-black/25 font-mono text-[9px] font-bold shadow-md select-none',
                        spec.heightClass,
                        spec.colorClass,
                        spec.textClass,
                      )}
                    >
                      {disc.weight}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Explicit equation & chips */}
          <div className="mt-3 border-t border-content/8 pt-3 space-y-2">
            <p className="text-[11px] font-semibold text-muted font-mono tabular-nums">
              {breakdown.barbellWeight} bar + {breakdown.perSideWeight}L + {breakdown.perSideWeight}R ={' '}
              <span className="font-bold text-content">{breakdown.achievableWeight} {unit}</span>
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {breakdown.platesPerSide.length === 0 ? (
                <span className="text-xs text-muted">No plates needed on each side</span>
              ) : (
                breakdown.platesPerSide.map((p) => (
                  <Badge key={p.weight} variant="primary" className="font-mono tabular-nums">
                    {p.count}×{p.weight} {unit} / side
                  </Badge>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Exactness warning */}
        {!breakdown.isExact && (
          <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-300">
            <AlertTriangle size={16} className="shrink-0 text-amber-400" />
            <span>
              {safeTarget < barbellWeight
                ? `Target is below bar weight (${barbellWeight} ${unit}).`
                : `Closest loadable weight: ${breakdown.achievableWeight} ${unit}`}
            </span>
          </div>
        )}

        {/* Available plates inventory */}
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted">
            Available Gym Plates ({unit})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {DEFAULT_PLATES[unit].map((plate) => {
              const enabled = availablePlates.includes(plate);
              return (
                <button
                  key={plate}
                  type="button"
                  onClick={() => togglePlate(plate)}
                  className={cn(
                    'liquid-pill flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold transition-all cursor-pointer tabular-nums',
                    enabled
                      ? 'border-emerald-500/40 bg-emerald-500/18 text-emerald-700 dark:text-emerald-300'
                      : 'border-content/10 bg-surface text-muted opacity-60 hover:opacity-100',
                  )}
                >
                  {enabled && <Check size={12} />}
                  {plate}
                </button>
              );
            })}
          </div>
        </div>

        {onApplyWeight && (
          <Button
            type="button"
            size="lg"
            onClick={() => {
              onApplyWeight(breakdown.achievableWeight);
              onClose();
            }}
            className="w-full font-bold"
          >
            Use {breakdown.achievableWeight} {unit}
          </Button>
        )}
      </div>
    </AppDialog>
  );
}
