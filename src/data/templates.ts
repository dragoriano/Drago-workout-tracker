import { WorkoutProgram, Exercise } from '../types';

export const WORKOUT_TEMPLATES = [
  {
    id: 'ppl',
    name: 'Push Pull Legs (6 Days)',
    goal: 'Build Muscle',
    days: [
      {
        name: 'Push A',
        order: 0,
        exercises: [
          { name: 'Barbell Flat Standard Bench Press', sets: [{ weight: 0, reps: 8, completed: false }, { weight: 0, reps: 8, completed: false }, { weight: 0, reps: 8, completed: false }] },
          { name: 'Dumbbell Seated Overhead Press', sets: [{ weight: 0, reps: 10, completed: false }, { weight: 0, reps: 10, completed: false }, { weight: 0, reps: 10, completed: false }] },
          { name: 'Cable Triceps Pushdown', sets: [{ weight: 0, reps: 12, completed: false }, { weight: 0, reps: 12, completed: false }, { weight: 0, reps: 12, completed: false }] }
        ]
      },
      {
        name: 'Pull A',
        order: 1,
        exercises: [
          { name: 'Barbell Bent Over Row', sets: [{ weight: 0, reps: 8, completed: false }, { weight: 0, reps: 8, completed: false }, { weight: 0, reps: 8, completed: false }] },
          { name: 'Lat Pulldown', sets: [{ weight: 0, reps: 10, completed: false }, { weight: 0, reps: 10, completed: false }, { weight: 0, reps: 10, completed: false }] },
          { name: 'Dumbbell Hammer Curl', sets: [{ weight: 0, reps: 12, completed: false }, { weight: 0, reps: 12, completed: false }, { weight: 0, reps: 12, completed: false }] }
        ]
      },
      {
        name: 'Legs A',
        order: 2,
        exercises: [
          { name: 'Barbell Squat', sets: [{ weight: 0, reps: 6, completed: false }, { weight: 0, reps: 6, completed: false }, { weight: 0, reps: 6, completed: false }] },
          { name: 'Leg Press', sets: [{ weight: 0, reps: 10, completed: false }, { weight: 0, reps: 10, completed: false }, { weight: 0, reps: 10, completed: false }] },
          { name: 'Seated Leg Curl', sets: [{ weight: 0, reps: 12, completed: false }, { weight: 0, reps: 12, completed: false }, { weight: 0, reps: 12, completed: false }] }
        ]
      }
    ]
  },
  {
    id: 'upper-lower',
    name: 'Upper / Lower (4 Days)',
    goal: 'Get Stronger',
    days: [
      {
        name: 'Upper A',
        order: 0,
        exercises: [
          { name: 'Barbell Flat Standard Bench Press', sets: [{ weight: 0, reps: 5, completed: false }, { weight: 0, reps: 5, completed: false }, { weight: 0, reps: 5, completed: false }, { weight: 0, reps: 5, completed: false }] },
          { name: 'Barbell Bent Over Row', sets: [{ weight: 0, reps: 6, completed: false }, { weight: 0, reps: 6, completed: false }, { weight: 0, reps: 6, completed: false }] },
          { name: 'Barbell Overhead Press', sets: [{ weight: 0, reps: 8, completed: false }, { weight: 0, reps: 8, completed: false }, { weight: 0, reps: 8, completed: false }] }
        ]
      },
      {
        name: 'Lower A',
        order: 1,
        exercises: [
          { name: 'Barbell Squat', sets: [{ weight: 0, reps: 5, completed: false }, { weight: 0, reps: 5, completed: false }, { weight: 0, reps: 5, completed: false }] },
          { name: 'Barbell Romanian Deadlift', sets: [{ weight: 0, reps: 8, completed: false }, { weight: 0, reps: 8, completed: false }, { weight: 0, reps: 8, completed: false }] },
          { name: 'Leg Extension', sets: [{ weight: 0, reps: 12, completed: false }, { weight: 0, reps: 12, completed: false }, { weight: 0, reps: 12, completed: false }] }
        ]
      }
    ]
  },
  {
    id: 'full-body',
    name: 'Full Body (3 Days)',
    goal: 'Build Muscle',
    days: [
      {
        name: 'Full Body A',
        order: 0,
        exercises: [
          { name: 'Barbell Squat', sets: [{ weight: 0, reps: 8, completed: false }, { weight: 0, reps: 8, completed: false }, { weight: 0, reps: 8, completed: false }] },
          { name: 'Barbell Flat Standard Bench Press', sets: [{ weight: 0, reps: 8, completed: false }, { weight: 0, reps: 8, completed: false }, { weight: 0, reps: 8, completed: false }] },
          { name: 'Lat Pulldown', sets: [{ weight: 0, reps: 10, completed: false }, { weight: 0, reps: 10, completed: false }, { weight: 0, reps: 10, completed: false }] },
          { name: 'Dumbbell Lateral Raise', sets: [{ weight: 0, reps: 15, completed: false }, { weight: 0, reps: 15, completed: false }, { weight: 0, reps: 15, completed: false }] }
        ]
      }
    ]
  }
];
