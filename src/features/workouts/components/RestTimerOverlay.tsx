import { AnimatePresence, motion } from 'framer-motion';
import { FastForward } from 'lucide-react';
import { Progress } from '../../../components/ui/Progress';
import { Button } from '../../../components/ui/Button';

interface RestTimerOverlayProps {
  restTimer: number | null;
  initialRestTimer: number | null;
  subtitle?: string;
  onSubtract15: () => void;
  onAdd15: () => void;
  onSkip: () => void;
}

export function RestTimerOverlay({
  restTimer,
  initialRestTimer,
  subtitle,
  onSubtract15,
  onAdd15,
  onSkip,
}: RestTimerOverlayProps) {
  const total = initialRestTimer || restTimer || 1;
  const pct = restTimer !== null ? Math.round((restTimer / Math.max(total, 1)) * 100) : 0;

  return (
    <AnimatePresence>
      {restTimer !== null && restTimer > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="liquid-glass-strong fixed bottom-[122px] left-1/2 z-50 w-[calc(100%-2rem)] max-w-[428px] -translate-x-1/2 overflow-hidden rounded-3xl p-3.5"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="liquid-glass flex h-12 shrink-0 items-center justify-center rounded-2xl px-3">
                <span className="font-mono text-lg font-extrabold text-primary-400 tabular-nums">
                  {Math.floor(restTimer / 60)}:{(restTimer % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                  Rest Timer
                </p>
                <p className="truncate text-sm font-bold text-content">
                  {subtitle || 'Recovery'}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={onSubtract15}
                className="h-10 px-2.5 font-mono"
              >
                -15s
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={onAdd15}
                className="h-10 px-2.5 font-mono"
              >
                +15s
              </Button>
              <Button
                type="button"
                variant="primary"
                size="xs"
                onClick={onSkip}
                className="h-10 px-3"
                aria-label="Skip rest timer"
              >
                <FastForward size={15} />
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
