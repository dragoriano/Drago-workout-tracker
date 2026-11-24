import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Activity, Dumbbell, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Progress } from '../../components/ui/Progress';
import { WORKOUT_TEMPLATES } from '../../data/templates';
import { useAppStore } from '../../store/useAppStore';
import { generateId } from '../../utils/uuid';

interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState<string | null>(null);
  const [experience, setExperience] = useState<string | null>(null);

  const handleFinish = async (templateId: string) => {
    const template = WORKOUT_TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      await useAppStore.getState().saveProgram({
        id: generateId(),
        name: template.name,
        goal: template.goal,
        theme: 'emerald',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        days: template.days.map((d) => ({
          ...d,
          id: generateId(),
          exercises: d.exercises.map((e) => ({
            ...e,
            id: generateId(),
            history: [],
            lastUpdated: Date.now(),
            notes: '',
            restTimerConfig: 90,
            muscleGroup: [],
            primaryMuscle: '',
            secondaryMuscles: [],
            sets: e.sets.map((s) => ({ ...s, id: generateId() })),
          })),
        })),
      });
    }

    await useAppStore.getState().updateSettings({ hasSeenOnboarding: true });
    onComplete();
  };

  const getRecommendations = () => {
    if (experience === 'beginner') {
      return WORKOUT_TEMPLATES.filter((t) => t.id.includes('full-body'));
    }
    return WORKOUT_TEMPLATES.slice(0, 3);
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-page/75 backdrop-blur-2xl text-content">
      <div className="mx-auto flex min-h-full w-full max-w-[460px] flex-col justify-between p-6">
        {step > 1 && (
          <div className="mb-2">
            <Progress value={((step - 1) / 3) * 100} className="h-1.5" />
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="flex flex-1 flex-col items-center justify-center py-8 text-center"
            >
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary-500/15 text-primary-400">
                <Dumbbell size={40} />
              </div>
              <h1 className="mb-3 text-3xl font-extrabold tracking-tight leading-tight">
                Welcome to{' '}
                <span className="text-primary-400">DragoTracker</span>
              </h1>
              <p className="mb-8 max-w-sm text-sm text-muted">
                Local-first strength logging with smart progression, plate math, and recovery insights.
              </p>
              <Button size="lg" className="w-full" onClick={() => setStep(2)}>
                Get Started
                <ArrowRight size={18} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 uppercase tracking-wider text-xs"
                onClick={() => handleFinish('')}
              >
                Skip Setup
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="flex flex-1 flex-col py-4"
            >
              <div className="mb-6">
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary-400">
                  Step 1 of 3
                </p>
                <h1 className="text-2xl font-extrabold tracking-tight">What's your main goal?</h1>
              </div>

              <div className="grid gap-3">
                {[
                  { id: 'muscle', title: 'Build Muscle', icon: Dumbbell, desc: 'Hypertrophy and progressive volume' },
                  { id: 'fat-loss', title: 'Lose Fat', icon: Activity, desc: 'Maintain strength while cutting' },
                  { id: 'strength', title: 'Get Stronger', icon: Trophy, desc: 'Push peak compound lifts' },
                ].map((item) => {
                  const selected = goal === item.id;
                  return (
                    <Card
                      key={item.id}
                      interactive
                      onClick={() => setGoal(item.id)}
                      className={`p-4 border-2 ${
                        selected
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-content/8 hover:border-content/20'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`rounded-xl p-3 ${
                            selected ? 'bg-primary-500 text-white' : 'bg-elevated text-muted'
                          }`}
                        >
                          <item.icon size={22} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-base font-bold text-content">{item.title}</h3>
                          <p className="text-xs text-muted">{item.desc}</p>
                        </div>
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                            selected ? 'border-primary-500 bg-primary-500 text-white' : 'border-content/20'
                          }`}
                        >
                          {selected && <CheckCircle2 size={14} />}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              <div className="mt-auto pt-8">
                <Button disabled={!goal} size="lg" className="w-full" onClick={() => setStep(3)}>
                  Continue
                </Button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="flex flex-1 flex-col py-4"
            >
              <div className="mb-6">
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary-400">
                  Step 2 of 3
                </p>
                <h1 className="text-2xl font-extrabold tracking-tight">Experience Level?</h1>
              </div>

              <div className="grid gap-3">
                {[
                  { id: 'beginner', title: 'Beginner', desc: 'New to structured lifting' },
                  { id: 'intermediate', title: 'Intermediate', desc: 'Consistent training for 6+ months' },
                  { id: 'advanced', title: 'Advanced', desc: 'Multiple years of progressive overload' },
                ].map((item) => {
                  const selected = experience === item.id;
                  return (
                    <Card
                      key={item.id}
                      interactive
                      onClick={() => setExperience(item.id)}
                      className={`p-4 border-2 ${
                        selected
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-content/8 hover:border-content/20'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <h3 className="text-base font-bold text-content">{item.title}</h3>
                          <p className="text-xs text-muted">{item.desc}</p>
                        </div>
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                            selected ? 'border-primary-500 bg-primary-500 text-white' : 'border-content/20'
                          }`}
                        >
                          {selected && <CheckCircle2 size={14} />}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              <div className="mt-auto flex gap-3 pt-8">
                <Button variant="secondary" size="lg" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button disabled={!experience} size="lg" className="flex-1" onClick={() => setStep(4)}>
                  Continue
                </Button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="flex flex-1 flex-col py-4"
            >
              <div className="mb-6">
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary-400">
                  Step 3 of 3
                </p>
                <h1 className="text-2xl font-extrabold tracking-tight leading-tight">
                  Recommended for you
                </h1>
              </div>

              <div className="grid gap-3">
                {getRecommendations().map((template) => (
                  <Card key={template.id} className="p-4">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold text-content">{template.name}</h3>
                        <p className="text-xs font-semibold text-primary-400">{template.goal}</p>
                      </div>
                      <Badge>{template.days.length} days/wk</Badge>
                    </div>

                    <div className="mb-4 flex flex-wrap gap-1.5">
                      {template.days.map((day, i) => (
                        <Badge key={i} variant="outline">
                          {day.name}
                        </Badge>
                      ))}
                    </div>

                    <Button onClick={() => handleFinish(template.id)} className="w-full">
                      Start this Program
                      <ArrowRight size={16} />
                    </Button>
                  </Card>
                ))}
              </div>

              <div className="mt-auto flex justify-center pt-6">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs uppercase tracking-wider"
                  onClick={() => handleFinish('')}
                >
                  I'll create my own
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
