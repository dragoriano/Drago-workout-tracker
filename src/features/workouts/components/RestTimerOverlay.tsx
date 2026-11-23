import { AnimatePresence, motion } from 'framer-motion';
import { Play } from 'lucide-react';

interface RestTimerOverlayProps {
  restTimer: number | null;
  initialRestTimer: number | null;
  onSubtract15: () => void;
  onAdd15: () => void;
  onSkip: () => void;
}

export function RestTimerOverlay({
  restTimer,
  initialRestTimer,
  onSubtract15,
  onAdd15,
  onSkip,
}: RestTimerOverlayProps) {
  return (
    <AnimatePresence>
      {restTimer !== null && restTimer > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-[120px] left-4 right-4 z-50 rounded-3xl border border-black/10 dark:border-content/10 bg-card/95 p-4 shadow-2xl backdrop-blur-xl flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                  className="text-page/10 dark:text-content/10"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                  className="text-primary-500 transition-all duration-1000 ease-linear"
                  strokeDasharray={2 * Math.PI * 28}
                  strokeDashoffset={
                    2 * Math.PI * 28 * (1 - restTimer / (initialRestTimer || restTimer || 1))
                  }
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute font-mono font-black text-content text-sm">
                {Math.floor(restTimer / 60)}:{(restTimer % 60).toString().padStart(2, '0')}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-0.5">
                Rest Timer
              </p>
              <p className="text-sm font-bold text-content leading-tight">Recovery</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-page/5 text-sm font-bold"
              onClick={onSubtract15}
            >
              -15
            </button>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-page/5 text-sm font-bold"
              onClick={onAdd15}
            >
              +15
            </button>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500 text-content"
              onClick={onSkip}
            >
              <Play size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
