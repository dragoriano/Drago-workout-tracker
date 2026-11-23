import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Activity, Dumbbell, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
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
    const template = WORKOUT_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      await useAppStore.getState().saveProgram({
        id: generateId(),
        name: template.name,
        goal: template.goal,
        theme: 'blue',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        days: template.days.map(d => ({
          ...d,
          id: generateId(),
          exercises: d.exercises.map(e => ({
            ...e,
            id: generateId(),
            history: [],
            lastUpdated: Date.now(),
            notes: '',
            restTimerConfig: 90, // Default 90 seconds
            muscleGroup: [],
            primaryMuscle: '',
            secondaryMuscles: [],
            sets: e.sets.map(s => ({ ...s, id: generateId() }))
          }))
        }))
      });
    }
    
    // Update settings to mark onboarding as complete
    await useAppStore.getState().updateSettings({ hasSeenOnboarding: true });
    
    onComplete();
  };

  const getRecommendations = () => {
    if (experience === 'beginner') {
      return WORKOUT_TEMPLATES.filter(t => t.id.includes('full-body'));
    }
    return WORKOUT_TEMPLATES.slice(0, 3);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-page text-content flex flex-col justify-between overflow-y-auto">
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="flex-1 flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="w-24 h-24 mb-6 rounded-full bg-primary-500/10 flex items-center justify-center">
              <Dumbbell size={48}className="text-primary-500" />
            </div>
            <h1 className="text-3xl font-black mb-4 leading-none">
              WELCOME TO<br />
              <span className="text-primary-500">DRAGORIANO WORKOUT TRACKER</span>
            </h1>
            <p className="text-muted mb-8 text-base">Your journey to peak fitness starts here. Let's set up your profile.</p>
            <Button
              className="w-full h-14 text-lg rounded-2xl bg-primary-500 hover:bg-primary-400 font-bold"
              onClick={() => setStep(2)}
            >
              Get Started
            </Button>
            <button
              className="mt-4 text-sm font-bold text-muted hover:text-content uppercase tracking-wider"
              onClick={() => handleFinish('')}
            >
              Skip Setup
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="flex-1 flex flex-col p-6"
          >
            <div className="mt-8 mb-8">
              <h2 className="text-sm font-bold text-primary-400 uppercase tracking-widest mb-2">Step 1 of 3</h2>
              <h1 className="text-3xl font-black">What's your main goal?</h1>
            </div>

            <div className="grid gap-4 mt-4">
              {[
                { id: 'muscle', title: 'Build Muscle', icon: Dumbbell, desc: 'Hypertrophy and strength' },
                { id: 'fat-loss', title: 'Lose Fat', icon: Activity, desc: 'Caloric burn and definition' },
                { id: 'strength', title: 'Get Stronger', icon: Trophy, desc: 'Max out your big lifts' }
              ].map(item => (
                <Card
                  key={item.id}
                  onClick={() => setGoal(item.id)}
                  className={`p-5 cursor-pointer transition-all border-2 ${
                    goal === item.id ? 'border-primary-500 bg-primary-500/10 shadow-lg shadow-primary-500/20' : 'border-content/5 hover:border-content/20'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${goal === item.id ? 'bg-primary-500 text-content' : 'bg-content/5 text-muted'}`}>
                      <item.icon size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{item.title}</h3>
                      <p className="text-sm text-muted">{item.desc}</p>
                    </div>
                    <div className="ml-auto">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${goal === item.id ? 'border-primary-500 bg-primary-500' : 'border-content/20'}`}>
                        {goal === item.id && <CheckCircle2 size={14} className="text-content" />}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="mt-auto pt-8">
              <Button
                disabled={!goal}
                className="w-full h-14 text-lg rounded-2xl bg-primary-500 hover:bg-primary-400 font-bold"
                onClick={() => setStep(3)}
              >
                Continue
              </Button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="flex-1 flex flex-col p-6"
          >
            <div className="mt-8 mb-8">
              <h2 className="text-sm font-bold text-primary-400 uppercase tracking-widest mb-2">Step 2 of 3</h2>
              <h1 className="text-3xl font-black">Experience Level?</h1>
            </div>

            <div className="grid gap-4 mt-4">
              {[
                { id: 'beginner', title: 'Beginner', desc: 'New to lifting' },
                { id: 'intermediate', title: 'Intermediate', desc: 'Lifting for 6+ months' },
                { id: 'advanced', title: 'Advanced', desc: 'Consistent lifting for years' }
              ].map(item => (
                <Card
                  key={item.id}
                  onClick={() => setExperience(item.id)}
                  className={`p-5 cursor-pointer transition-all border-2 ${
                    experience === item.id ? 'border-primary-500 bg-primary-500/10 shadow-lg shadow-primary-500/20' : 'border-content/5 hover:border-content/20'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <h3 className="font-bold text-lg">{item.title}</h3>
                      <p className="text-sm text-muted">{item.desc}</p>
                    </div>
                    <div className="ml-auto">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${experience === item.id ? 'border-primary-500 bg-primary-500' : 'border-content/20'}`}>
                        {experience === item.id && <CheckCircle2 size={14} className="text-content" />}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="mt-auto flex gap-3 pt-8">
              <Button
                variant="outline"
                className="h-14 px-6 rounded-2xl font-bold"
                onClick={() => setStep(2)}
              >
                Back
              </Button>
              <Button
                disabled={!experience}
                className="flex-1 h-14 text-lg rounded-2xl bg-primary-500 hover:bg-primary-400 font-bold"
                onClick={() => setStep(4)}
              >
                Continue
              </Button>
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="flex-1 flex flex-col p-6 pb-safe"
          >
            <div className="mt-8 mb-6">
              <h2 className="text-sm font-bold text-primary-400 uppercase tracking-widest mb-2">Step 3 of 3</h2>
              <h1 className="text-3xl font-black leading-tight">Recommended for you</h1>
            </div>

            <div className="grid gap-4">
              {getRecommendations().map(template => (
                <Card key={template.id} className="p-5 border-content/10">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-lg">{template.name}</h3>
                      <p className="text-sm text-primary-400 font-medium">{template.goal}</p>
                    </div>
                    <span className="text-xs font-bold text-muted bg-content/5 px-2 py-1 rounded">
                      {template.days.length} days/week
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-5">
                    {template.days.map((day, i) => (
                      <span key={i} className="text-xs text-muted border border-content/10 rounded px-2 py-1">
                        {day.name}
                      </span>
                    ))}
                  </div>

                  <Button
                    onClick={() => handleFinish(template.id)}
                    className="w-full bg-primary-500 hover:bg-primary-400 text-content font-bold rounded-xl py-6 flex items-center justify-center gap-2"
                  >
                    Start this Program <ArrowRight size={18}/>
                  </Button>
                </Card>
              ))}
            </div>

            <div className="mt-auto pt-8 flex justify-center">
              <button
                className="text-sm font-bold text-muted hover:text-content uppercase tracking-wider flex items-center gap-1"
                onClick={() => handleFinish('')}
              >
                I'll create my own
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
