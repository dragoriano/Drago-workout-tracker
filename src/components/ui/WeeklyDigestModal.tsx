import React, { useMemo, useRef, useState } from 'react';
import { Award, Check, Download, Dumbbell, Flame, Share2, Trophy } from 'lucide-react';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import { AppDialog } from './Dialog';
import { Button } from './Button';
import { AnatomicalBodyMap } from './AnatomicalBodyMap';
import type { CustomExercise, Measurement, WorkoutSession } from '../../types';
import { getExerciseMuscleGroups } from '../../data/exercises';
import { computeWeeklyDigest } from '../../utils/weeklyDigest';
import type { WeightUnit } from '../../utils/strength';
import { cn } from '../../utils/cn';

type DigestRatio = 'post' | 'story';
type DigestThemeId = 'obsidian' | 'ember' | 'emerald' | 'steel';

const DIGEST_THEMES: ReadonlyArray<{
  id: DigestThemeId;
  label: string;
  gradientClass: string;
  swatchClass: string;
}> = [
  {
    id: 'obsidian',
    label: 'Obsidian',
    gradientClass: 'bg-gradient-to-br from-zinc-900 via-slate-900 to-black',
    swatchClass: 'bg-zinc-800',
  },
  {
    id: 'emerald',
    label: 'Emerald',
    gradientClass: 'bg-gradient-to-br from-emerald-950 via-zinc-900 to-black',
    swatchClass: 'bg-emerald-700',
  },
  {
    id: 'ember',
    label: 'Ember',
    gradientClass: 'bg-gradient-to-br from-orange-950 via-zinc-900 to-black',
    swatchClass: 'bg-orange-700',
  },
  {
    id: 'steel',
    label: 'Steel',
    gradientClass: 'bg-gradient-to-br from-slate-900 via-sky-950 to-black',
    swatchClass: 'bg-sky-800',
  },
];

interface WeeklyDigestModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: WorkoutSession[];
  measurements: Measurement[];
  customExercises?: CustomExercise[];
  unit?: WeightUnit;
}

export function WeeklyDigestModal({
  isOpen,
  onClose,
  sessions,
  measurements,
  customExercises = [],
  unit = 'kg',
}: WeeklyDigestModalProps) {
  const [ratio, setRatio] = useState<DigestRatio>('post');
  const [themeId, setThemeId] = useState<DigestThemeId>('emerald');
  const [exporting, setExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const digest = useMemo(
    () =>
      computeWeeklyDigest(sessions, measurements, {
        unit,
        customExercises,
        resolveFallbackMuscles: getExerciseMuscleGroups,
      }),
    [sessions, measurements, unit, customExercises],
  );

  const activeTheme = DIGEST_THEMES.find((t) => t.id === themeId) || DIGEST_THEMES[0];

  const generatePngDataUrl = async (): Promise<string | null> => {
    if (!cardRef.current) return null;
    return toPng(cardRef.current, { cacheBust: true, pixelRatio: 2 });
  };

  const handleDownload = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const dataUrl = await generatePngDataUrl();
      if (!dataUrl) return;
      const link = document.createElement('a');
      link.download = `dragoriano-weekly-recap.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Weekly recap PNG downloaded');
    } catch {
      toast.error('Could not generate image');
    } finally {
      setExporting(false);
    }
  };

  const handleShare = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const dataUrl = await generatePngDataUrl();
      if (!dataUrl) return;
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'dragoriano-weekly-recap.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Dragoriano Weekly Training Digest',
          text: `${digest.headline} — ${digest.sessionsCount} workouts · ${digest.totalVolume.toLocaleString('en-US')} ${unit}`,
          files: [file],
        });
      } else {
        const link = document.createElement('a');
        link.download = `dragoriano-weekly-recap.png`;
        link.href = dataUrl;
        link.click();
        toast.success('Weekly recap saved to Downloads');
      }
    } catch {
      // User dismissed share sheet or browser restricted share
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Weekly Training Digest"
      description="Shareable 7-day volume, anatomy & PR snapshot"
      layout="sheet"
      size="md"
    >
      <div className="space-y-4">
        {/* Aspect Ratio + Theme Controls */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1 rounded-xl border border-content/10 bg-page/30 p-1">
            <button
              type="button"
              onClick={() => setRatio('post')}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer',
                ratio === 'post' ? 'bg-primary-500 text-white' : 'text-muted hover:text-content',
              )}
            >
              4:5 Post
            </button>
            <button
              type="button"
              onClick={() => setRatio('story')}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer',
                ratio === 'story' ? 'bg-primary-500 text-white' : 'text-muted hover:text-content',
              )}
            >
              9:16 Story
            </button>
          </div>

          <div className="flex items-center gap-2">
            {DIGEST_THEMES.map((theme) => {
              const selected = theme.id === themeId;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setThemeId(theme.id)}
                  title={theme.label}
                  aria-label={`Select ${theme.label} theme`}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full border transition-all cursor-pointer',
                    theme.swatchClass,
                    selected ? 'border-white ring-2 ring-primary-400 scale-110' : 'border-white/20 opacity-75 hover:opacity-100',
                  )}
                >
                  {selected && <Check size={12} className="text-white" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Rendered Capture Card */}
        <div className="flex justify-center">
          <div
            ref={cardRef}
            id="weekly-digest-capture-card"
            className={cn(
              'relative w-full max-w-[340px] overflow-hidden rounded-3xl border border-white/15 p-5 text-white shadow-2xl flex flex-col justify-between',
              activeTheme.gradientClass,
              ratio === 'story' ? 'min-h-[540px]' : 'min-h-[420px]',
            )}
          >
            {/* Ambient Highlight */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-20 -right-16 h-48 w-48 rounded-full bg-emerald-400/15 blur-3xl"
            />

            {/* Header */}
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
                  Dragoriano · Weekly Digest
                </span>
                <span className="text-[10px] font-bold text-white/70 tabular-nums">
                  {digest.dateRangeLabel}
                </span>
              </div>
              <h3 className="text-xl font-black tracking-tight text-white leading-tight">
                {digest.headline}
              </h3>
            </div>

            {/* 4 KPI Tiles */}
            <div className="relative z-10 grid grid-cols-2 gap-2 my-3">
              <div className="rounded-2xl border border-white/10 bg-white/8 p-2.5">
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/65">
                  <Dumbbell size={11} className="text-emerald-300" /> Workouts
                </span>
                <p className="mt-0.5 text-lg font-black tabular-nums">
                  {digest.sessionsCount}
                  {digest.sessionsDelta !== 0 && (
                    <span
                      className={cn(
                        'ml-1.5 text-[10px] font-bold',
                        digest.sessionsDelta > 0 ? 'text-emerald-300' : 'text-amber-300',
                      )}
                    >
                      {digest.sessionsDelta > 0 ? `+${digest.sessionsDelta}` : digest.sessionsDelta} vs last wk
                    </span>
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/8 p-2.5">
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/65">
                  <Flame size={11} className="text-orange-300" /> Volume
                </span>
                <p className="mt-0.5 text-lg font-black tabular-nums">
                  {digest.totalVolume >= 1000
                    ? `${(digest.totalVolume / 1000).toFixed(1)}k`
                    : digest.totalVolume}{' '}
                  <span className="text-xs font-bold text-white/70">{unit}</span>
                  {digest.volumeDeltaPct !== null && (
                    <span
                      className={cn(
                        'ml-1.5 text-[10px] font-bold',
                        digest.volumeDeltaPct >= 0 ? 'text-emerald-300' : 'text-amber-300',
                      )}
                    >
                      {digest.volumeDeltaPct >= 0 ? '+' : ''}
                      {digest.volumeDeltaPct}%
                    </span>
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/8 p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/65">
                  Working Sets
                </span>
                <p className="mt-0.5 text-sm font-black tabular-nums">
                  {digest.totalWorkingSets} sets · {digest.totalDurationMinutes}m
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/8 p-2.5">
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/65">
                  <Trophy size={11} className="text-amber-300" /> PRs &amp; Streak
                </span>
                <p className="mt-0.5 text-sm font-black tabular-nums">
                  {digest.prCount} PRs · {digest.currentStreak}d
                </p>
              </div>
            </div>

            {/* Anatomical Volume Heatmap Snapshot */}
            <div className="relative z-10 rounded-2xl border border-white/10 bg-black/25 p-2.5 mb-3">
              <div className="max-w-[215px] mx-auto">
                <AnatomicalBodyMap
                  items={digest.muscleRecovery}
                  mode="volume"
                  view="both"
                  selectedMuscle={null}
                  onSelectMuscle={() => {}}
                  isLightMode={false}
                />
              </div>
            </div>

            {/* Footer: Top Muscles + Milestones */}
            <div className="relative z-10 flex items-center justify-between gap-2 pt-2 border-t border-white/12 text-[10px]">
              <div className="min-w-0 truncate font-bold text-white/80">
                {digest.topMuscles.length > 0
                  ? `Focus: ${digest.topMuscles.map((m) => `${m.muscle} (${m.workingSets}s)`).join(' · ')}`
                  : 'Log sessions to fill your muscle map'}
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 font-extrabold text-amber-200 shrink-0 tabular-nums">
                <Award size={10} />
                {digest.milestonesUnlocked}/{digest.milestonesTotal}
              </span>
            </div>
          </div>
        </div>

        {/* Share & Download Actions */}
        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={exporting}
            onClick={handleShare}
            className="flex-1"
          >
            <Share2 size={15} />
            {exporting ? 'Rendering...' : 'Share Image'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={exporting}
            onClick={handleDownload}
            className="flex-1"
          >
            <Download size={15} />
            Download PNG
          </Button>
        </div>
      </div>
    </AppDialog>
  );
}
