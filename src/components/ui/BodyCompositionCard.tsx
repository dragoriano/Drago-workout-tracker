import React, { useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Camera, Columns, Ruler, Scale, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from './Card';
import { Button } from './Button';
import type {
  AppSettings,
  Measurement,
  ProgressPhoto,
  ProgressPhotoPose,
} from '../../types';
import {
  compressImageToDataUrl,
  estimateBodyFatNavy,
  extractLatestBodyweightKg,
} from '../../utils/bodyComposition';
import { computeMeasurementTrend } from '../../utils/bodyTrends';
import { generateId } from '../../utils/uuid';
import { cn } from '../../utils/cn';

interface BodyCompositionCardProps {
  measurements: Measurement[];
  photos: ProgressPhoto[];
  settings: AppSettings | null;
  onUpdateSettings: (patch: Partial<AppSettings>) => Promise<void> | void;
  onSaveMeasurement: (m: Measurement) => Promise<void> | void;
  onSavePhoto: (photo: ProgressPhoto) => Promise<void> | void;
  onDeletePhoto: (id: string) => Promise<void> | void;
}

const POSES: ReadonlyArray<{ id: ProgressPhotoPose; label: string }> = [
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side' },
  { id: 'back', label: 'Back' },
];

export const BodyCompositionCard: React.FC<BodyCompositionCardProps> = ({
  measurements,
  photos,
  settings,
  onUpdateSettings,
  onSaveMeasurement,
  onSavePhoto,
  onDeletePhoto,
}) => {
  const bwKg = useMemo(() => extractLatestBodyweightKg(measurements), [measurements]);
  const waistTrend = useMemo(() => computeMeasurementTrend(measurements, 'waist'), [measurements]);
  const neckTrend = useMemo(() => computeMeasurementTrend(measurements, 'neck'), [measurements]);
  const hipTrend = useMemo(() => computeMeasurementTrend(measurements, 'hip'), [measurements]);

  const [sex, setSex] = useState<'male' | 'female'>(settings?.biologicalSex || 'male');
  const [heightInput, setHeightInput] = useState(
    settings?.heightCm ? String(settings.heightCm) : '175',
  );
  const [waistInput, setWaistInput] = useState(
    waistTrend.latest ? String(waistTrend.latest.value) : '',
  );
  const [neckInput, setNeckInput] = useState(
    neckTrend.latest ? String(neckTrend.latest.value) : '',
  );
  const [hipInput, setHipInput] = useState(
    hipTrend.latest ? String(hipTrend.latest.value) : '',
  );
  const [showInputs, setShowInputs] = useState(false);

  // Progress Photos state
  const [pose, setPose] = useState<ProgressPhotoPose>('front');
  const [poseFilter, setPoseFilter] = useState<ProgressPhotoPose | 'all'>('all');
  const [sliderPct, setSliderPct] = useState(50);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredPhotos = useMemo(() => {
    const list = [...photos].sort((a, b) => b.date - a.date);
    if (poseFilter === 'all') return list;
    return list.filter((p) => p.pose === poseFilter);
  }, [photos, poseFilter]);

  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [afterId, setAfterId] = useState<string | null>(null);

  // Default comparison picks oldest ("before") vs newest ("after") when 2+ photos exist
  const defaultAfter = filteredPhotos[0] ?? null;
  const defaultBefore =
    filteredPhotos.length >= 2 ? filteredPhotos[filteredPhotos.length - 1] : null;
  const beforePhoto = filteredPhotos.find((p) => p.id === beforeId) ?? defaultBefore;
  const afterPhoto = filteredPhotos.find((p) => p.id === afterId) ?? defaultAfter;

  const heightCmVal = Number(settings?.heightCm ?? heightInput);
  const effectiveWaist = waistTrend.latest?.value ?? Number(waistInput);
  const effectiveNeck = neckTrend.latest?.value ?? Number(neckInput);
  const effectiveHip = hipTrend.latest?.value ?? (hipInput ? Number(hipInput) : undefined);

  const estimate = useMemo(() => {
    if (!bwKg || !effectiveWaist || !effectiveNeck || !heightCmVal) return null;
    return estimateBodyFatNavy({
      sex: settings?.biologicalSex || sex,
      heightCm: heightCmVal,
      waist: effectiveWaist,
      waistUnit: waistTrend.latest?.unit || 'cm',
      neck: effectiveNeck,
      neckUnit: neckTrend.latest?.unit || 'cm',
      hip: effectiveHip,
      hipUnit: hipTrend.latest?.unit || 'cm',
      bodyweightKg: bwKg.kg,
    });
  }, [
    bwKg,
    effectiveWaist,
    effectiveNeck,
    effectiveHip,
    heightCmVal,
    settings?.biologicalSex,
    sex,
    waistTrend.latest?.unit,
    neckTrend.latest?.unit,
    hipTrend.latest?.unit,
  ]);

  const handleSaveMetrics = async (e: React.FormEvent) => {
    e.preventDefault();
    const h = Number(heightInput);
    const w = Number(waistInput);
    const n = Number(neckInput);
    const hp = hipInput ? Number(hipInput) : 0;

    if (Number.isFinite(h) && h >= 120 && h <= 240) {
      await onUpdateSettings({ heightCm: h, biologicalSex: sex });
    }
    const now = Date.now();
    if (Number.isFinite(w) && w > 20) {
      await onSaveMeasurement({ id: generateId(), type: 'waist', value: w, unit: 'cm', date: now });
    }
    if (Number.isFinite(n) && n > 15) {
      await onSaveMeasurement({ id: generateId(), type: 'neck', value: n, unit: 'cm', date: now });
    }
    if (sex === 'female' && Number.isFinite(hp) && hp > 30) {
      await onSaveMeasurement({ id: generateId(), type: 'hip', value: hp, unit: 'cm', date: now });
    }
    setShowInputs(false);
    toast.success('Body composition metrics saved');
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || uploadingPhoto) return;

    setUploadingPhoto(true);
    try {
      const dataUrl = await compressImageToDataUrl(file, 900, 0.78);
      await onSavePhoto({
        id: generateId(),
        date: Date.now(),
        pose,
        dataUrl,
        weight: bwKg?.rawValue,
      });
      toast.success('Progress photo saved locally');
    } catch {
      toast.error('Failed to process selected image');
    } finally {
      setUploadingPhoto(false);
    }
  };

  return (
    <Card className="p-4 sm:p-5 mb-8">
      {/* Body Composition Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-700 dark:text-sky-400">
            <Ruler size={18} />
          </span>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-content">
              Body Comp &amp; Photos
            </h2>
            <p className="text-[11px] font-semibold text-muted">
              US Navy BF%, Lean Mass, FFMI &amp; Before/After Slider
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setShowInputs((v) => !v)}
          className="shrink-0 min-h-[36px]"
        >
          {showInputs ? 'Close' : estimate ? 'Update Tape' : 'Measure BF%'}
        </Button>
      </div>

      {/* Body Composition Metrics or Quick Form */}
      {estimate && !showInputs ? (
        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="rounded-2xl border border-content/10 bg-page/25 p-3 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Est. Body Fat
            </span>
            <p className="mt-0.5 font-mono text-base font-black text-sky-700 dark:text-sky-400 tabular-nums">
              {estimate.bodyFatPct}%
            </p>
            <span className="text-[10px] font-semibold text-muted">{estimate.category}</span>
          </div>
          <div className="rounded-2xl border border-content/10 bg-page/25 p-3 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Lean Mass
            </span>
            <p className="mt-0.5 font-mono text-base font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
              {estimate.leanMassKg} kg
            </p>
            <span className="text-[10px] font-semibold text-muted">Fat {estimate.fatMassKg} kg</span>
          </div>
          <div className="rounded-2xl border border-content/10 bg-page/25 p-3 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
              FFMI Index
            </span>
            <p className="mt-0.5 font-mono text-base font-black text-amber-800 dark:text-amber-400 tabular-nums">
              {estimate.ffmi}
            </p>
            <span className="text-[10px] font-semibold text-muted">Normalized</span>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSaveMetrics}
          className="rounded-2xl border border-content/10 bg-page/20 p-3.5 mb-5 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-content flex items-center gap-1.5">
              <Scale size={14} className="text-sky-600 dark:text-sky-400" />
              {bwKg ? `Weight: ${bwKg.kg} kg` : 'Log bodyweight above + tape below'}
            </span>
            <div className="flex rounded-lg border border-content/10 bg-page/30 p-0.5">
              {(['male', 'female'] as const).map((sOption) => (
                <button
                  key={sOption}
                  type="button"
                  onClick={() => setSex(sOption)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[11px] font-bold capitalize cursor-pointer transition-colors',
                    sex === sOption ? 'bg-primary-500 text-white' : 'text-muted',
                  )}
                >
                  {sOption}
                </button>
              ))}
            </div>
          </div>

          <div className={cn('grid gap-2', sex === 'female' ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3')}>
            <div>
              <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                Height (cm)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={heightInput}
                onChange={(e) => setHeightInput(e.target.value)}
                placeholder="175"
                className="w-full rounded-xl border border-content/15 bg-page/50 px-2.5 py-2 text-xs font-bold text-content outline-none focus:border-primary-500 tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                Waist (cm)
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                value={waistInput}
                onChange={(e) => setWaistInput(e.target.value)}
                placeholder="82"
                className="w-full rounded-xl border border-content/15 bg-page/50 px-2.5 py-2 text-xs font-bold text-content outline-none focus:border-primary-500 tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                Neck (cm)
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                value={neckInput}
                onChange={(e) => setNeckInput(e.target.value)}
                placeholder="39"
                className="w-full rounded-xl border border-content/15 bg-page/50 px-2.5 py-2 text-xs font-bold text-content outline-none focus:border-primary-500 tabular-nums"
              />
            </div>
            {sex === 'female' && (
              <div>
                <label className="block text-[10px] font-bold uppercase text-muted mb-1">
                  Hip (cm)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  value={hipInput}
                  onChange={(e) => setHipInput(e.target.value)}
                  placeholder="96"
                  className="w-full rounded-xl border border-content/15 bg-page/50 px-2.5 py-2 text-xs font-bold text-content outline-none focus:border-primary-500 tabular-nums"
                />
              </div>
            )}
          </div>

          <Button type="submit" size="sm" className="w-full">
            Calculate &amp; Save Body Comp
          </Button>
        </form>
      )}

      {/* Progress Photos & Before/After Comparison Slider */}
      <div className="border-t border-content/10 pt-4">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <div className="flex items-center gap-2">
            <Camera size={15} className="text-emerald-700 dark:text-emerald-400" />
            <h3 className="text-sm font-extrabold text-content">
              Progress Photos ({photos.length})
            </h3>
          </div>

          <div className="flex items-center gap-1.5">
            <select
              aria-label="Photo pose"
              value={pose}
              onChange={(e) => setPose(e.target.value as ProgressPhotoPose)}
              className="rounded-xl border border-content/15 bg-page/50 px-2.5 py-1.5 text-xs font-bold text-content outline-none"
            >
              {POSES.map((p) => (
                <option key={p.id} value={p.id} className="bg-card text-content">
                  {p.label}
                </option>
              ))}
            </select>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
            <Button
              type="button"
              size="sm"
              variant="primary"
              disabled={uploadingPhoto}
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[34px]"
            >
              <Upload size={13} />
              {uploadingPhoto ? 'Saving...' : 'Add Photo'}
            </Button>
          </div>
        </div>

        {/* Pose Filter Chips */}
        {photos.length > 0 && (
          <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-hide">
            {(['all', 'front', 'side', 'back'] as const).map((pf) => (
              <button
                key={pf}
                type="button"
                onClick={() => setPoseFilter(pf)}
                className={cn(
                  'rounded-full px-3 py-1 text-[11px] font-bold border capitalize cursor-pointer transition-colors',
                  poseFilter === pf
                    ? 'bg-primary-500 text-white border-primary-500'
                    : 'bg-surface/70 text-muted border-content/10 hover:text-content',
                )}
              >
                {pf}
              </button>
            ))}
          </div>
        )}

        {/* Before / After Comparison Slider */}
        {beforePhoto && afterPhoto && beforePhoto.id !== afterPhoto.id ? (
          <div className="rounded-2xl border border-content/10 bg-page/25 p-3 mb-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
              <span className="flex items-center gap-1 text-sky-700 dark:text-sky-400">
                <Columns size={13} /> Before ({format(beforePhoto.date, 'MMM d')})
              </span>
              <span className="text-emerald-700 dark:text-emerald-400">
                After ({format(afterPhoto.date, 'MMM d')})
              </span>
            </div>

            <div className="relative h-56 w-full overflow-hidden rounded-xl bg-black/40 select-none">
              <img
                src={afterPhoto.dataUrl}
                alt="After progress"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - sliderPct}% 0 0)` }}
              >
                <img
                  src={beforePhoto.dataUrl}
                  alt="Before progress"
                  className="h-full w-full object-cover"
                />
              </div>
              <div
                className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.8)]"
                style={{ left: `${sliderPct}%` }}
              />
            </div>

            <input
              type="range"
              aria-label="Before and after comparison slider"
              min={5}
              max={95}
              value={sliderPct}
              onChange={(e) => setSliderPct(Number(e.target.value))}
              className="w-full accent-primary-500 cursor-pointer"
            />
          </div>
        ) : (
          photos.length === 1 && (
            <p className="text-xs text-muted mb-3">
              Add one more photo to unlock the interactive Before / After comparison slider.
            </p>
          )
        )}

        {/* Thumbnail Strip */}
        {filteredPhotos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-content/15 py-6 px-4 text-center">
            <p className="text-xs font-semibold text-muted">
              Store compressed progress photos privately on your device to track physique changes over time.
            </p>
          </div>
        ) : (
          <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
            {filteredPhotos.map((p) => {
              const isBefore = beforePhoto?.id === p.id;
              const isAfter = afterPhoto?.id === p.id;
              return (
                <div
                  key={p.id}
                  className={cn(
                    'relative w-24 shrink-0 overflow-hidden rounded-xl border bg-page/40',
                    isBefore
                      ? 'border-sky-500 ring-1 ring-sky-500/40'
                      : isAfter
                        ? 'border-emerald-500 ring-1 ring-emerald-500/40'
                        : 'border-content/10',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (!isAfter) setBeforeId(p.id);
                    }}
                    onDoubleClick={() => {
                      if (!isBefore) setAfterId(p.id);
                    }}
                    className="block w-full cursor-pointer"
                    title="Tap to set Before · Double-tap to set After"
                  >
                    <img
                      src={p.dataUrl}
                      alt={`${p.pose} progress`}
                      className="h-24 w-full object-cover"
                    />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete progress photo"
                    onClick={() => onDeletePhoto(p.id)}
                    className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-red-500 transition-colors cursor-pointer"
                  >
                    <Trash2 size={10} />
                  </button>
                  <div className="px-1.5 py-1 text-[9px] font-bold text-content flex items-center justify-between gap-1">
                    <span className="capitalize truncate">{p.pose}</span>
                    <span className="text-muted tabular-nums">{format(p.date, 'M/d')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
};
