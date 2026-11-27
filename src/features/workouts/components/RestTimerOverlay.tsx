import { AnimatePresence, motion } from 'framer-motion';
import { FastForward, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Progress } from '../../../components/ui/Progress';
import { cn } from '../../../utils/cn';

interface RestTimerOverlayProps {
  restTimer: number | null;
  initialRestTimer: number | null;
  subtitle?: string;
  isPaused: boolean;
  soundEnabled: boolean;
  onTogglePause: () => void;
  onToggleSound: () => void;
  onSubtract15: () => void;
  onAdd15: () => void;
  onSelectPreset: (seconds: number) => void;
  onSkip: () => void;
}

const OVERLAY_PRESETS = [60, 90, 120, 180] as const;

export function RestTimerOverlay({
  restTimer,
  initialRestTimer,
  subtitle,
  isPaused,
  soundEnabled,
  onTogglePause,
  onToggleSound,
  onSubtract15,
  onAdd15,
  onSelectPreset,
  onSkip,
}: RestTimerOverlayProps) {
  const isVisible = restTimer !== null && (restTimer > 0 || isPaused);
  const total = Math.max(initialRestTimer || restTimer || 1, 1);
  const remaining = Math.max(0, restTimer ?? 0);
  const pct = Math.max(0, Math.min(100, Math.round((remaining / total) * 100)));

  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct / 100);

  const isCritical = !isPaused && remaining <= 3 && remaining > 0;
  const isFinalTen = !isPaused && remaining <= 10 && remaining > 0;
  const ringStroke = isPaused
    ? '#38bdf8'
    : isFinalTen
      ? '#f59e0b'
      : 'var(--theme-400)';

  const minutes = Math.floor(remaining / 60);
  const seconds = (remaining % 60).toString().padStart(2, '0');

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          className={cn(
            'liquid-glass-strong fixed bottom-[122px] left-1/2 z-50 w-[calc(100%-2rem)] max-w-[428px] -translate-x-1/2 overflow-hidden rounded-3xl p-3.5 transition-colors',
            isFinalTen && 'border-amber-500/45',
            isCritical && 'ring-2 ring-amber-400/55',
          )}
        >
          {/* Top Row: Circular SVG Ring + Subtitle + Pause/Mute Icons */}
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={cn(
                  'relative flex h-12 w-12 shrink-0 items-center justify-center',
                  isCritical && 'animate-pulse',
                )}
              >
                <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90" aria-hidden="true">
                  <circle
                    cx="24"
                    cy="24"
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity={0.14}
                    strokeWidth="3.5"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r={radius}
                    fill="none"
                    stroke={ringStroke}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    className="transition-[stroke-dashoffset,stroke] duration-300 ease-linear"
                  />
                </svg>
                <span
                  className={cn(
                    'absolute font-mono text-xs font-extrabold tabular-nums',
                    isPaused
                      ? 'text-sky-400'
                      : isFinalTen
                        ? 'text-amber-400'
                        : 'text-primary-400',
                  )}
                >
                  {minutes}:{seconds}
                </span>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                    Rest Timer
                  </p>
                  {isPaused ? (
                    <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-sky-400">
                      Paused
                    </span>
                  ) : remaining <= 5 ? (
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-400">
                      Final Countdown
                    </span>
                  ) : null}
                </div>
                <p className="truncate text-sm font-bold text-content">
                  {subtitle || 'Recovery'}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleSound}
                aria-label={soundEnabled ? 'Mute rest timer sound' : 'Unmute rest timer sound'}
                title={soundEnabled ? 'Sound on' : 'Sound muted'}
                className={cn(
                  'liquid-btn-glass flex h-10 w-10 items-center justify-center rounded-xl transition-colors cursor-pointer',
                  soundEnabled ? 'text-primary-400' : 'text-muted',
                )}
              >
                {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
              </button>
              <button
                type="button"
                onClick={onTogglePause}
                aria-label={isPaused ? 'Resume rest timer' : 'Pause rest timer'}
                title={isPaused ? 'Resume' : 'Pause'}
                className={cn(
                  'liquid-btn-glass flex h-10 w-10 items-center justify-center rounded-xl transition-colors cursor-pointer',
                  isPaused ? 'border-sky-500/40 bg-sky-500/15 text-sky-400' : 'text-content',
                )}
              >
                {isPaused ? <Play size={17} /> : <Pause size={17} />}
              </button>
            </div>
          </div>

          {/* Controls + Quick Presets */}
          <div className="mt-2.5 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              {OVERLAY_PRESETS.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => onSelectPreset(sec)}
                  className={cn(
                    'h-8 rounded-lg border px-2 text-[11px] font-bold tabular-nums transition-all cursor-pointer active:scale-95',
                    total === sec
                      ? 'border-primary-500/50 bg-primary-500/20 text-primary-400'
                      : 'border-content/10 bg-surface/60 text-muted hover:text-content',
                  )}
                >
                  {sec}s
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={onSubtract15}
                className="h-9 px-2.5 font-mono"
              >
                -15s
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={onAdd15}
                className="h-9 px-2.5 font-mono"
              >
                +15s
              </Button>
              <Button
                type="button"
                variant="primary"
                size="xs"
                onClick={onSkip}
                className="h-9 px-3"
                aria-label="Skip rest timer"
              >
                <FastForward size={14} />
                <span>Skip</span>
              </Button>
            </div>
          </div>

          <Progress value={pct} className="mt-2.5 h-1.5" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
