import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, Disc, Minus, Plus, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { cn } from '../../utils/cn';
import {
  BARBELL_PRESETS,
  calculateBarbellPlates,
  DEFAULT_BARBELL_WEIGHT,
  DEFAULT_PLATES,
  getPlateVisualSpec,
  WeightUnit,
} from '../../utils/strength';

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
  const barbellWeight = settings?.barbellWeight ?? DEFAULT_BARBELL_WEIGHT[unit];
  const availablePlates =
    settings?.availablePlates && settings.availablePlates.length > 0
      ? settings.availablePlates
      : DEFAULT_PLATES[unit];

  const step = unit === 'kg' ? 2.5 : 5;
  const [targetInput, setTargetInput] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const defaultTarget =
      initialWeight && initialWeight > 0
        ? initialWeight
        : barbellWeight + (unit === 'kg' ? 40 : 90);
    setTargetInput(String(defaultTarget));
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

  const visualDiscs = breakdown.platesPerSide.flatMap((entry) =>
    Array.from({ length: Math.min(entry.count, 8) }, (_, idx) => ({
      weight: entry.weight,
      key: `${entry.weight}-${idx}`,
    })),
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-page/70 backdrop-blur-sm sm:items-center">
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className="w-full max-w-md rounded-t-3xl bg-card p-6 sm:rounded-3xl border border-content/10 shadow-2xl max-h-[92dvh] overflow-y-auto"
          >
            {/* Header */}
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-content flex items-center gap-2">
                  <Disc size={20} className="text-primary-400" />
                  Plate Calculator
                </h2>
                <p className="text-xs text-muted mt-0.5 truncate max-w-[260px]">
                  {exerciseName || `Configure bar & ${unit} plates per side`}
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close plate calculator"
                className="rounded-full bg-page/10 dark:bg-content/10 p-2 text-content hover:bg-page/20 dark:hover:bg-content/20 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Target weight input */}
            <div className="mb-5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted block mb-2">
                Target Total Weight ({unit})
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => adjustTarget(-step)}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface border border-content/10 text-content font-bold active:scale-95 transition-transform"
                  aria-label={`Decrease by ${step} ${unit}`}
                >
                  <Minus size={18} />
                </button>
                <div className="relative flex-1">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    className="h-12 w-full rounded-2xl bg-surface border border-content/10 px-4 pr-12 text-center text-2xl font-black text-content outline-none focus:ring-2 focus:ring-primary-500 tabular-nums"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold uppercase text-muted">
                    {unit}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => adjustTarget(step)}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface border border-content/10 text-content font-bold active:scale-95 transition-transform"
                  aria-label={`Increase by ${step} ${unit}`}
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            {/* Visual Barbell Sleeve */}
            <div className="mb-4 rounded-2xl bg-surface border border-content/10 p-4">
              <div className="flex items-center justify-between text-xs mb-3">
                <span className="font-bold text-muted uppercase tracking-wider">
                  Per Side:{' '}
                  <span className="text-primary-400">
                    {breakdown.perSideWeight} {unit}
                  </span>
                </span>
                <span className="font-bold text-muted uppercase tracking-wider">
                  Loaded:{' '}
                  <span className="text-content">
                    {breakdown.achievableWeight} {unit}
                  </span>
                </span>
              </div>

              <div className="relative flex items-center h-28 overflow-x-auto py-1">
                {/* Bar shaft */}
                <div className="h-3 w-10 shrink-0 rounded-l bg-zinc-500" />
                {/* Sleeve collar */}
                <div className="h-10 w-3 shrink-0 rounded-sm bg-zinc-300 dark:bg-zinc-400 border-r border-zinc-600" />
                {/* Loaded sleeve + plates */}
                <div className="relative flex flex-1 items-center gap-1 pl-1 min-w-0">
                  <div className="absolute left-0 right-0 h-2.5 bg-zinc-500/60 rounded-r" />
                  {visualDiscs.length === 0 ? (
                    <span className="relative z-10 ml-3 text-xs font-semibold text-muted bg-surface/90 px-2 py-0.5 rounded">
                      Bar only
                    </span>
                  ) : (
                    visualDiscs.map((disc) => {
                      const spec = getPlateVisualSpec(disc.weight, unit);
                      return (
                        <div
                          key={disc.key}
                          className={cn(
                            'relative z-10 flex w-7 shrink-0 items-center justify-center rounded-md shadow-md border border-black/25 font-black text-[10px] tracking-tighter select-none',
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

              {/* Text summary chips */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-3 border-t border-content/5">
                {breakdown.platesPerSide.length === 0 ? (
                  <span className="text-xs text-muted">No plates needed on each side</span>
                ) : (
                  breakdown.platesPerSide.map((p) => (
                    <span
                      key={p.weight}
                      className="rounded-lg bg-primary-500/15 border border-primary-500/20 px-2.5 py-1 text-xs font-bold text-primary-300 tabular-nums"
                    >
                      {p.count}×{p.weight} {unit}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Exactness warning */}
            {!breakdown.isExact && (
              <div className="mb-4 flex items-center gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 px-3.5 py-2.5 text-xs text-amber-300">
                <AlertTriangle size={16} className="shrink-0 text-amber-400" />
                <span>
                  {safeTarget < barbellWeight
                    ? `Target is below bar weight (${barbellWeight} ${unit}).`
                    : `Closest loadable: ${breakdown.achievableWeight} ${unit}`}
                </span>
              </div>
            )}

            {/* Barbell presets */}
            <div className="mb-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">
                Barbell Weight
              </p>
              <div className="grid grid-cols-4 gap-2">
                {BARBELL_PRESETS[unit].map((preset) => {
                  const active = barbellWeight === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => updateSettings({ barbellWeight: preset })}
                      className={cn(
                        'rounded-xl py-2 text-xs font-bold border transition-all',
                        active
                          ? 'bg-primary-500 text-white border-primary-500 shadow-sm shadow-primary-500/30'
                          : 'bg-surface text-muted border-content/10 hover:text-content',
                      )}
                    >
                      {preset} {unit}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Available plates inventory */}
            <div className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">
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
                        'flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold border transition-all',
                        enabled
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-surface border-content/10 text-muted opacity-60 hover:opacity-100',
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
              <button
                type="button"
                onClick={() => {
                  onApplyWeight(breakdown.achievableWeight);
                  onClose();
                }}
                className="w-full rounded-2xl bg-primary-500 py-3.5 text-sm font-black text-white shadow-lg shadow-primary-500/30 hover:bg-primary-400 active:scale-[0.98] transition-all"
              >
                Use {breakdown.achievableWeight} {unit}
              </button>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
