import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Brain,
  ChevronRight,
  Download,
  Dumbbell,
  Flame,
  LayoutGrid,
  Plus,
  Weight,
  X,
} from 'lucide-react';
import { cn } from '../../../utils/cn';

interface AddProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset: () => void;
  onSelectWizard: () => void;
  onSelectBlank: () => void;
  onSelectImport: () => void;
}

export function AddProgramModal({
  isOpen,
  onClose,
  onSelectPreset,
  onSelectWizard,
  onSelectBlank,
  onSelectImport,
}: AddProgramModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center p-4">
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl"
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-content">Add New Program</h2>
              <button
                onClick={onClose}
                className="rounded-full bg-content/10 p-2 text-content hover:bg-content/20"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 pb-2">
              <button
                onClick={onSelectPreset}
                className="w-full flex items-center gap-4 rounded-2xl bg-primary-500/10 p-4 text-left transition-all hover:bg-primary-500/20 group"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-500/20 text-primary-400 group-hover:scale-110 transition-transform">
                  <LayoutGrid size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-content">Preset Programs</h3>
                  <p className="text-xs text-muted">Ready-made plans for specific goals</p>
                </div>
              </button>

              <button
                onClick={onSelectWizard}
                className="w-full flex items-center gap-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-sky-500/10 border border-emerald-500/20 p-4 text-left transition-all hover:from-emerald-500/15 hover:to-sky-500/15 group"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
                  <Brain size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-content">AI-Guided Custom</h3>
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                      Smart
                    </span>
                  </div>
                  <p className="text-xs text-muted">Answer 3 questions, get personalized recommendations</p>
                </div>
              </button>

              <button
                onClick={onSelectBlank}
                className="w-full flex items-center gap-4 rounded-2xl bg-content/5 border border-content/5 p-4 text-left transition-all hover:bg-content/10 group"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-content/10 text-muted group-hover:scale-110 transition-transform">
                  <Plus size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-content">Blank Program</h3>
                  <p className="text-xs text-muted">Start from scratch, add your own days & exercises</p>
                </div>
              </button>

              <button
                onClick={onSelectImport}
                className="w-full flex items-center gap-4 rounded-2xl bg-sky-500/10 border border-sky-500/20 p-4 text-left transition-all hover:bg-sky-500/15 group"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 group-hover:scale-110 transition-transform">
                  <Download size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-content">Import Program</h3>
                  <p className="text-xs text-muted">Scan QR, paste share code, or upload JSON</p>
                </div>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface ChooseGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGoal: (goal: string) => void;
}

export function ChooseGoalModal({ isOpen, onClose, onSelectGoal }: ChooseGoalModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-md rounded-t-3xl bg-card p-6 sm:rounded-3xl"
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-content">Choose a Workout Goal</h2>
              <button
                onClick={onClose}
                className="rounded-full bg-content/10 p-2 text-content hover:bg-content/20"
              >
                <X size={20} />
              </button>
            </div>
            <div className="grid gap-3">
              {[
                {
                  key: 'Muscle Building',
                  icon: <Dumbbell size={24} />,
                  color: 'bg-orange-500/20 text-orange-400',
                  desc: 'Focus on hypertrophy and size',
                },
                {
                  key: 'Fat Loss',
                  icon: <Flame size={24} />,
                  color: 'bg-red-500/20 text-red-400',
                  desc: 'High intensity, calorie burning',
                },
                {
                  key: 'Strength',
                  icon: <Weight size={24} />,
                  color: 'bg-blue-500/20 text-blue-400',
                  desc: 'Focus on heavy compound lifts',
                },
              ].map(({ key, icon, color, desc }) => (
                <button
                  key={key}
                  onClick={() => onSelectGoal(key)}
                  className="flex items-center rounded-2xl bg-content/5 p-4 text-left transition-colors hover:bg-content/10"
                >
                  <div className={cn('mr-4 flex h-12 w-12 items-center justify-center rounded-full', color)}>
                    {icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-content">{key}</h3>
                    <p className="text-sm text-muted">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface ChooseSplitModalProps {
  isOpen: boolean;
  selectedGoal: string | null;
  onBack: () => void;
  onSelectSplit: (name: string, days: number, goal: string) => void;
}

const PRESET_SPLITS = [
  { name: 'Push/Pull/Legs (PPL)', days: 3, desc: '3 days/week • Push, pull, and legs on separate days', icon: <Dumbbell size={24} /> },
  { name: 'Upper/Lower', days: 4, desc: '4 days/week • 2x upper body, 2x lower body per week', icon: <ArrowLeft size={24} className="rotate-90" /> },
  { name: 'Bro Split', days: 5, desc: '5 days/week • One muscle group per day', icon: <Flame size={24} /> },
  { name: 'Full Body', days: 3, desc: '3 days/week • Hit all muscles each session', icon: <Weight size={24} /> },
  { name: 'HIT (Mike Mentzer)', days: 2, desc: '2 days/week • 1 set to failure per exercise', icon: <Flame size={24} /> },
  { name: 'Bodyweight Only', days: 3, desc: '3 days/week • No equipment needed', icon: <Dumbbell size={24} /> },
  { name: 'Powerbuilding', days: 4, desc: '4 days/week • Powerlifting + bodybuilding combined', icon: <Weight size={24} /> },
];

export function ChooseSplitModal({
  isOpen,
  selectedGoal,
  onBack,
  onSelectSplit,
}: ChooseSplitModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-md rounded-t-3xl bg-card p-6 sm:rounded-3xl max-h-[80vh] overflow-y-auto"
          >
            <div className="mb-6 flex items-center justify-between sticky top-0 bg-card z-10 pb-4">
              <button
                onClick={onBack}
                className="rounded-full bg-content/10 p-2 text-content hover:bg-content/20"
              >
                <ArrowLeft size={20} />
              </button>
              <h2 className="text-xl font-bold text-content">Choose Split</h2>
              <div className="w-10" />
            </div>
            <div className="grid gap-3">
              {PRESET_SPLITS.map((split) => (
                <button
                  key={split.name}
                  onClick={() =>
                    onSelectSplit(`${selectedGoal} - ${split.name}`, split.days, selectedGoal || '')
                  }
                  className="flex items-center justify-between rounded-2xl bg-content/5 p-4 text-left transition-colors hover:bg-content/10"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-500/20 text-primary-400">
                      {split.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-content">{split.name}</h3>
                      <p className="text-xs text-muted mt-1 leading-snug">{split.desc}</p>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-muted shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
