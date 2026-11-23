import { Exercise, WorkoutDay } from '../types';
import { getExerciseMetadata } from '../data/exercises';
import { generateId } from './uuid';

interface ExerciseTemplate {
  name: string;
  sets: number;
  reps: number;
  rest: number;
}

const ex = (name: string, sets: number, reps: number, rest: number): ExerciseTemplate => ({
  name,
  sets,
  reps,
  rest,
});

function buildExercise(tpl: ExerciseTemplate): Exercise {
  const metadata = getExerciseMetadata(tpl.name);
  return {
    id: generateId(),
    name: tpl.name,
    muscleGroup: metadata?.muscleGroups || [],
    primaryMuscle: metadata?.primaryMuscle || '',
    secondaryMuscles: metadata?.secondaryMuscles || [],
    notes: '',
    sets: Array.from({ length: tpl.sets }).map(() => ({
      id: generateId(),
      weight: 0,
      reps: tpl.reps,
      completed: false,
    })),
    history: [],
    restTimerConfig: tpl.rest,
    lastUpdated: Date.now(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUSH / PULL / LEGS — Goal-specific exercise selection
// ─────────────────────────────────────────────────────────────────────────────
const PPL: Record<string, Record<string, ExerciseTemplate[]>> = {
  'Muscle Building': {
    Push: [
      ex('Barbell Flat Standard Bench Press', 4, 8, 120),
      ex('Dumbbell Incline Standard Bench Press', 4, 10, 90),
      ex('Machine Chest Press', 3, 12, 90),
      ex('Dumbbell Lateral Raise', 4, 15, 60),
      ex('Cable Overhead Tricep Extension', 3, 12, 75),
      ex('Cable Tricep Pushdown', 3, 15, 60),
    ],
    Pull: [
      ex('Barbell Bent Over Row', 4, 8, 120),
      ex('Cable Front Lat Pulldown', 4, 10, 90),
      ex('Dumbbell Single Arm Row', 3, 12, 90),
      ex('Cable Face Pull', 4, 15, 60),
      ex('Barbell Standard Curl', 4, 12, 75),
      ex('Dumbbell Hammer Curl', 3, 15, 60),
    ],
    Legs: [
      ex('Barbell Squat', 4, 10, 120),
      ex('Leg Press Machine', 4, 12, 90),
      ex('Dumbbell Romanian Deadlift', 3, 12, 90),
      ex('Leg Extension Machine', 4, 15, 60),
      ex('Seated Leg Curl Machine', 4, 15, 60),
      ex('Standing Calf Raise Machine', 5, 15, 60),
    ],
  },
  'Fat Loss': {
    Push: [
      ex('Push-Up', 4, 20, 30),
      ex('Dumbbell Incline Standard Bench Press', 3, 15, 45),
      ex('Dumbbell Lateral Raise', 4, 20, 30),
      ex('Dumbbell Front Raise', 3, 15, 30),
      ex('Tricep Dip', 3, 15, 45),
      ex('Cable Tricep Pushdown', 3, 20, 30),
    ],
    Pull: [
      ex('Pull-Up', 4, 12, 45),
      ex('Cable Front Lat Pulldown', 3, 15, 45),
      ex('Cable Seated Row', 3, 15, 45),
      ex('Cable Face Pull', 4, 20, 30),
      ex('Dumbbell Hammer Curl', 4, 15, 30),
      ex('Dumbbell Concentration Curl', 3, 15, 30),
    ],
    Legs: [
      ex('Bodyweight Squat', 4, 20, 30),
      ex('Barbell Romanian Deadlift', 3, 15, 60),
      ex('Barbell Bulgarian Split Squat', 3, 15, 45),
      ex('Leg Extension Machine', 3, 20, 30),
      ex('Seated Leg Curl Machine', 3, 20, 30),
      ex('Standing Calf Raise Machine', 4, 25, 30),
    ],
  },
  Strength: {
    Push: [
      ex('Barbell Flat Standard Bench Press', 5, 5, 210),
      ex('Barbell Overhead Press', 5, 5, 180),
      ex('Dumbbell Incline Standard Bench Press', 3, 6, 150),
      ex('Dumbbell Lateral Raise', 3, 10, 90),
      ex('Cable Tricep Pushdown', 3, 8, 90),
    ],
    Pull: [
      ex('Barbell Deadlift', 5, 4, 240),
      ex('Barbell Bent Over Row', 5, 5, 180),
      ex('Pull-Up', 4, 6, 150),
      ex('Cable Seated Row', 3, 6, 120),
      ex('Barbell Standard Curl', 3, 8, 90),
    ],
    Legs: [
      ex('Barbell Squat', 5, 5, 210),
      ex('Leg Press Machine', 4, 6, 150),
      ex('Barbell Romanian Deadlift', 4, 6, 150),
      ex('Seated Leg Curl Machine', 3, 8, 90),
      ex('Standing Calf Raise Machine', 4, 10, 75),
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// UPPER / LOWER
// ─────────────────────────────────────────────────────────────────────────────
const UPPER_LOWER: Record<string, Record<string, ExerciseTemplate[]>> = {
  'Muscle Building': {
    Upper: [
      ex('Barbell Flat Standard Bench Press', 4, 8, 120),
      ex('Barbell Bent Over Row', 4, 8, 120),
      ex('Dumbbell Overhead Press', 3, 10, 90),
      ex('Cable Front Lat Pulldown', 3, 12, 90),
      ex('Dumbbell Lateral Raise', 3, 15, 60),
      ex('Barbell Standard Curl', 3, 12, 75),
      ex('Cable Overhead Tricep Extension', 3, 12, 75),
    ],
    Lower: [
      ex('Barbell Squat', 4, 10, 120),
      ex('Barbell Romanian Deadlift', 4, 10, 90),
      ex('Leg Press Machine', 3, 12, 90),
      ex('Barbell Bulgarian Split Squat', 3, 12, 90),
      ex('Leg Extension Machine', 3, 15, 60),
      ex('Seated Leg Curl Machine', 3, 15, 60),
      ex('Standing Calf Raise Machine', 4, 15, 60),
    ],
  },
  'Fat Loss': {
    Upper: [
      ex('Push-Up', 4, 15, 30),
      ex('Cable Front Lat Pulldown', 4, 15, 45),
      ex('Dumbbell Overhead Press', 3, 15, 45),
      ex('Cable Seated Row', 3, 15, 45),
      ex('Dumbbell Lateral Raise', 3, 20, 30),
      ex('Dumbbell Hammer Curl', 3, 15, 30),
      ex('Tricep Dip', 3, 15, 30),
    ],
    Lower: [
      ex('Barbell Squat', 4, 15, 60),
      ex('Barbell Romanian Deadlift', 3, 15, 60),
      ex('Barbell Bulgarian Split Squat', 3, 15, 45),
      ex('Leg Extension Machine', 3, 20, 30),
      ex('Seated Leg Curl Machine', 3, 20, 30),
      ex('Standing Calf Raise Machine', 4, 25, 30),
    ],
  },
  Strength: {
    Upper: [
      ex('Barbell Flat Standard Bench Press', 5, 5, 210),
      ex('Barbell Bent Over Row', 5, 5, 180),
      ex('Barbell Overhead Press', 4, 5, 180),
      ex('Pull-Up', 4, 5, 150),
      ex('Dumbbell Lateral Raise', 2, 10, 75),
      ex('Barbell Standard Curl', 2, 8, 90),
    ],
    Lower: [
      ex('Barbell Squat', 5, 5, 210),
      ex('Barbell Deadlift', 5, 3, 240),
      ex('Leg Press Machine', 3, 8, 120),
      ex('Seated Leg Curl Machine', 3, 8, 90),
      ex('Standing Calf Raise Machine', 3, 10, 75),
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// FULL BODY
// ─────────────────────────────────────────────────────────────────────────────
const FULL_BODY: Record<string, ExerciseTemplate[][]> = {
  'Muscle Building': [
    [
      ex('Barbell Squat', 4, 8, 120),
      ex('Barbell Flat Standard Bench Press', 4, 8, 120),
      ex('Barbell Bent Over Row', 4, 8, 120),
      ex('Dumbbell Lateral Raise', 3, 15, 60),
      ex('Barbell Standard Curl', 3, 12, 75),
      ex('Cable Tricep Pushdown', 3, 12, 75),
    ],
    [
      ex('Barbell Deadlift', 4, 6, 150),
      ex('Dumbbell Incline Standard Bench Press', 4, 10, 90),
      ex('Cable Front Lat Pulldown', 4, 10, 90),
      ex('Barbell Bulgarian Split Squat', 3, 12, 90),
      ex('Cable Face Pull', 3, 15, 60),
      ex('Dumbbell Hammer Curl', 3, 12, 60),
    ],
    [
      ex('Barbell Front Squat', 4, 8, 120),
      ex('Barbell Overhead Press', 4, 8, 120),
      ex('Cable Seated Row', 4, 10, 90),
      ex('Dumbbell Romanian Deadlift', 3, 12, 90),
      ex('Leg Extension Machine', 3, 15, 60),
      ex('Cable Overhead Tricep Extension', 3, 12, 75),
    ],
  ],
  'Fat Loss': [
    [
      ex('Bodyweight Squat', 4, 20, 30),
      ex('Push-Up', 4, 15, 30),
      ex('Pull-Up', 3, 10, 45),
      ex('Bodyweight Lunge', 3, 20, 30),
      ex('Dumbbell Lateral Raise', 3, 15, 30),
      ex('Plank', 3, 45, 30),
    ],
    [
      ex('Barbell Romanian Deadlift', 4, 15, 60),
      ex('Dumbbell Incline Standard Bench Press', 3, 15, 45),
      ex('Cable Front Lat Pulldown', 3, 15, 45),
      ex('Barbell Bulgarian Split Squat', 3, 15, 45),
      ex('Cable Face Pull', 3, 20, 30),
      ex('Mountain Climber', 3, 40, 30),
    ],
    [
      ex('Barbell Squat', 3, 15, 60),
      ex('Dumbbell Bent Over Row', 3, 15, 45),
      ex('Barbell Overhead Press', 3, 12, 60),
      ex('Leg Extension Machine', 3, 20, 30),
      ex('Seated Leg Curl Machine', 3, 20, 30),
      ex('Plank', 3, 60, 30),
    ],
  ],
  Strength: [
    [
      ex('Barbell Squat', 5, 5, 210),
      ex('Barbell Flat Standard Bench Press', 5, 5, 180),
      ex('Barbell Bent Over Row', 4, 5, 150),
      ex('Dumbbell Lateral Raise', 2, 10, 75),
    ],
    [
      ex('Barbell Deadlift', 5, 3, 240),
      ex('Barbell Overhead Press', 5, 5, 180),
      ex('Pull-Up', 4, 6, 150),
      ex('Barbell Standard Curl', 2, 8, 75),
    ],
    [
      ex('Barbell Front Squat', 5, 5, 210),
      ex('Barbell Flat Standard Bench Press', 5, 5, 180),
      ex('Barbell Bent Over Row', 4, 5, 150),
      ex('Tricep Dip', 3, 6, 120),
    ],
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// BRO SPLIT
// ─────────────────────────────────────────────────────────────────────────────
const BRO_SPLIT: Record<string, Record<string, ExerciseTemplate[]>> = {
  'Muscle Building': {
    Chest: [
      ex('Barbell Flat Standard Bench Press', 4, 8, 120),
      ex('Dumbbell Incline Standard Bench Press', 4, 10, 90),
      ex('Dumbbell Decline Press', 3, 10, 90),
      ex('Dumbbell Flat Chest Fly', 3, 12, 75),
      ex('Machine Chest Press', 3, 12, 75),
      ex('Cable Crossover', 3, 15, 60),
    ],
    Back: [
      ex('Barbell Deadlift', 4, 6, 180),
      ex('Barbell Bent Over Row', 4, 8, 120),
      ex('Cable Front Lat Pulldown', 4, 10, 90),
      ex('Dumbbell Single Arm Row', 3, 12, 90),
      ex('Cable Seated Row', 3, 12, 90),
      ex('Cable Face Pull', 3, 15, 60),
    ],
    Shoulders: [
      ex('Barbell Overhead Press', 4, 8, 120),
      ex('Dumbbell Seated Overhead Press', 3, 10, 90),
      ex('Dumbbell Lateral Raise', 5, 15, 60),
      ex('Dumbbell Front Raise', 3, 12, 60),
      ex('Dumbbell Bent Over Rear Delt Raise', 3, 15, 60),
      ex('Cable Face Pull', 4, 15, 60),
    ],
    Legs: [
      ex('Barbell Squat', 4, 10, 120),
      ex('Leg Press Machine', 4, 12, 90),
      ex('Barbell Romanian Deadlift', 3, 10, 90),
      ex('Leg Extension Machine', 4, 15, 60),
      ex('Seated Leg Curl Machine', 4, 15, 60),
      ex('Standing Calf Raise Machine', 5, 15, 60),
    ],
    Arms: [
      ex('Barbell Standard Curl', 4, 10, 90),
      ex('Dumbbell Incline Curl', 3, 12, 75),
      ex('Dumbbell Hammer Curl', 3, 12, 75),
      ex('Cable Tricep Pushdown', 4, 12, 75),
      ex('Cable Overhead Tricep Extension', 3, 12, 75),
      ex('Dumbbell Overhead Tricep Extension', 3, 12, 75),
    ],
  },
  'Fat Loss': {
    Chest: [
      ex('Push-Up', 5, 20, 30),
      ex('Dumbbell Incline Standard Bench Press', 4, 15, 45),
      ex('Dumbbell Flat Chest Fly', 4, 15, 45),
      ex('Cable Crossover', 3, 20, 30),
      ex('Tricep Dip', 3, 15, 30),
    ],
    Back: [
      ex('Pull-Up', 5, 12, 45),
      ex('Cable Front Lat Pulldown', 4, 15, 45),
      ex('Cable Seated Row', 4, 15, 45),
      ex('Dumbbell Single Arm Row', 3, 15, 30),
      ex('Cable Face Pull', 4, 20, 30),
    ],
    Shoulders: [
      ex('Dumbbell Overhead Press', 4, 15, 45),
      ex('Dumbbell Lateral Raise', 5, 20, 30),
      ex('Dumbbell Front Raise', 3, 15, 30),
      ex('Dumbbell Bent Over Rear Delt Raise', 4, 20, 30),
      ex('Cable Face Pull', 3, 20, 30),
    ],
    Legs: [
      ex('Bodyweight Squat', 4, 20, 30),
      ex('Barbell Romanian Deadlift', 3, 15, 60),
      ex('Barbell Bulgarian Split Squat', 4, 15, 45),
      ex('Leg Extension Machine', 4, 20, 30),
      ex('Seated Leg Curl Machine', 4, 20, 30),
      ex('Standing Calf Raise Machine', 5, 25, 30),
    ],
    Arms: [
      ex('Dumbbell Hammer Curl', 4, 15, 30),
      ex('Cable Bicep Curl', 3, 20, 30),
      ex('Dumbbell Concentration Curl', 3, 15, 30),
      ex('Cable Tricep Pushdown', 4, 20, 30),
      ex('Tricep Dip', 3, 15, 30),
      ex('Dumbbell Kickback', 3, 15, 30),
    ],
  },
  Strength: {
    Chest: [
      ex('Barbell Flat Standard Bench Press', 5, 5, 210),
      ex('Barbell Incline Standard Bench Press', 4, 5, 180),
      ex('Dumbbell Incline Standard Bench Press', 3, 6, 150),
      ex('Cable Tricep Pushdown', 2, 10, 75),
    ],
    Back: [
      ex('Barbell Deadlift', 5, 4, 240),
      ex('Barbell Bent Over Row', 5, 5, 180),
      ex('Pull-Up', 4, 5, 150),
      ex('Cable Seated Row', 3, 6, 120),
    ],
    Shoulders: [
      ex('Barbell Overhead Press', 5, 5, 180),
      ex('Dumbbell Seated Overhead Press', 4, 6, 150),
      ex('Dumbbell Lateral Raise', 3, 12, 75),
      ex('Dumbbell Bent Over Rear Delt Raise', 3, 10, 75),
    ],
    Legs: [
      ex('Barbell Squat', 5, 5, 210),
      ex('Barbell Deadlift', 5, 3, 240),
      ex('Leg Press Machine', 4, 6, 150),
      ex('Seated Leg Curl Machine', 3, 8, 90),
      ex('Standing Calf Raise Machine', 3, 10, 75),
    ],
    Arms: [
      ex('Barbell Standard Curl', 4, 8, 90),
      ex('Dumbbell Hammer Curl', 3, 8, 75),
      ex('Cable Overhead Tricep Extension', 4, 8, 90),
      ex('Tricep Dip', 3, 8, 90),
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HIT (MIKE MENTZER)
// ─────────────────────────────────────────────────────────────────────────────
const HIT_MENTZER: Record<string, Record<string, ExerciseTemplate[]>> = {
  'Muscle Building': {
    'Workout A': [
      ex('Pec Deck Fly', 1, 8, 180),
      ex('Barbell Incline Standard Bench Press', 1, 8, 180),
      ex('Cable Front Lat Pulldown', 1, 8, 180),
      ex('Cable Seated Row', 1, 8, 180),
      ex('Barbell Deadlift', 1, 8, 180),
    ],
    'Workout B': [
      ex('Leg Extension Machine', 1, 8, 180),
      ex('Leg Press Machine', 1, 8, 180),
      ex('Standing Calf Raise Machine', 1, 10, 180),
      ex('Dumbbell Lateral Raise', 1, 8, 180),
      ex('Barbell Standard Curl', 1, 8, 180),
      ex('Cable Tricep Pushdown', 1, 8, 180),
    ],
  },
  'Fat Loss': {
    'Workout A': [
      ex('Barbell Flat Standard Bench Press', 1, 12, 120),
      ex('Pull-Up', 1, 12, 120),
      ex('Barbell Overhead Press', 1, 12, 120),
      ex('Barbell Bent Over Row', 1, 12, 120),
      ex('Barbell Deadlift', 1, 12, 120),
    ],
    'Workout B': [
      ex('Barbell Squat', 1, 15, 120),
      ex('Leg Extension Machine', 1, 15, 120),
      ex('Standing Calf Raise Machine', 1, 15, 120),
      ex('Dumbbell Lateral Raise', 1, 15, 120),
      ex('Barbell Standard Curl', 1, 15, 120),
    ],
  },
  Strength: {
    'Workout A': [
      ex('Pec Deck Fly', 1, 6, 240),
      ex('Barbell Incline Standard Bench Press', 1, 6, 240),
      ex('Cable Front Lat Pulldown', 1, 6, 240),
      ex('Cable Seated Row', 1, 6, 240),
      ex('Barbell Deadlift', 1, 5, 240),
    ],
    'Workout B': [
      ex('Leg Extension Machine', 1, 6, 240),
      ex('Leg Press Machine', 1, 6, 240),
      ex('Standing Calf Raise Machine', 1, 8, 180),
      ex('Dumbbell Lateral Raise', 1, 8, 180),
      ex('Barbell Standard Curl', 1, 6, 180),
      ex('Cable Tricep Pushdown', 1, 6, 180),
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// POWERBUILDING
// ─────────────────────────────────────────────────────────────────────────────
const POWERBUILDING: Record<string, Record<string, ExerciseTemplate[]>> = {
  'Muscle Building': {
    'Heavy Lower': [
      ex('Barbell Squat', 5, 5, 210),
      ex('Barbell Romanian Deadlift', 4, 8, 120),
      ex('Leg Press Machine', 3, 10, 90),
      ex('Seated Leg Curl Machine', 3, 12, 90),
      ex('Standing Calf Raise Machine', 4, 15, 60),
    ],
    'Heavy Upper': [
      ex('Barbell Flat Standard Bench Press', 5, 5, 210),
      ex('Barbell Bent Over Row', 5, 5, 180),
      ex('Barbell Overhead Press', 3, 8, 120),
      ex('Cable Front Lat Pulldown', 3, 10, 90),
      ex('Barbell Standard Curl', 3, 12, 90),
    ],
    'Hypertrophy Lower': [
      ex('Barbell Deadlift', 5, 5, 180),
      ex('Barbell Front Squat', 3, 8, 120),
      ex('Barbell Bulgarian Split Squat', 3, 10, 90),
      ex('Leg Extension Machine', 3, 12, 90),
      ex('Standing Calf Raise Machine', 4, 15, 60),
    ],
    'Hypertrophy Upper': [
      ex('Dumbbell Incline Standard Bench Press', 4, 8, 120),
      ex('Pull-Up', 4, 8, 120),
      ex('Dumbbell Overhead Press', 3, 10, 90),
      ex('Cable Seated Row', 3, 10, 90),
      ex('Cable Overhead Tricep Extension', 3, 12, 90),
      ex('Dumbbell Lateral Raise', 3, 15, 60),
    ],
  },
  'Fat Loss': {
    'Heavy Lower': [
      ex('Barbell Squat', 4, 10, 90),
      ex('Barbell Romanian Deadlift', 3, 12, 75),
      ex('Barbell Bulgarian Split Squat', 3, 12, 60),
      ex('Leg Extension Machine', 3, 15, 45),
      ex('Seated Leg Curl Machine', 3, 15, 45),
    ],
    'Heavy Upper': [
      ex('Barbell Flat Standard Bench Press', 4, 10, 75),
      ex('Barbell Bent Over Row', 4, 10, 75),
      ex('Barbell Overhead Press', 3, 12, 60),
      ex('Pull-Up', 3, 10, 60),
      ex('Dumbbell Lateral Raise', 3, 15, 30),
    ],
    'Hypertrophy Lower': [
      ex('Barbell Deadlift', 4, 12, 75),
      ex('Bodyweight Squat', 3, 20, 30),
      ex('Barbell Bulgarian Split Squat', 3, 15, 45),
      ex('Leg Extension Machine', 3, 20, 30),
      ex('Standing Calf Raise Machine', 4, 25, 30),
    ],
    'Hypertrophy Upper': [
      ex('Push-Up', 4, 20, 30),
      ex('Cable Front Lat Pulldown', 4, 15, 45),
      ex('Dumbbell Overhead Press', 3, 15, 45),
      ex('Cable Seated Row', 3, 15, 45),
      ex('Cable Tricep Pushdown', 3, 15, 30),
    ],
  },
  Strength: {
    'Heavy Lower': [
      ex('Barbell Squat', 5, 3, 240),
      ex('Barbell Deadlift', 5, 3, 240),
      ex('Leg Press Machine', 3, 6, 150),
      ex('Seated Leg Curl Machine', 3, 8, 90),
    ],
    'Heavy Upper': [
      ex('Barbell Flat Standard Bench Press', 5, 3, 240),
      ex('Barbell Bent Over Row', 5, 4, 210),
      ex('Barbell Overhead Press', 4, 5, 180),
      ex('Pull-Up', 4, 5, 150),
    ],
    'Hypertrophy Lower': [
      ex('Barbell Deadlift', 5, 4, 210),
      ex('Barbell Front Squat', 4, 5, 180),
      ex('Barbell Bulgarian Split Squat', 3, 6, 150),
      ex('Seated Leg Curl Machine', 3, 8, 90),
    ],
    'Hypertrophy Upper': [
      ex('Barbell Flat Standard Bench Press', 4, 6, 150),
      ex('Barbell Bent Over Row', 4, 6, 150),
      ex('Barbell Overhead Press', 3, 6, 150),
      ex('Cable Seated Row', 3, 8, 120),
      ex('Barbell Standard Curl', 3, 8, 90),
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// BODYWEIGHT ONLY
// ─────────────────────────────────────────────────────────────────────────────
const BODYWEIGHT: Record<string, ExerciseTemplate[][]> = {
  'Muscle Building': [
    [
      ex('Push-Up', 4, 15, 60),
      ex('Pull-Up', 4, 10, 90),
      ex('Bodyweight Squat', 4, 20, 60),
      ex('Tricep Dip', 3, 12, 75),
      ex('Bodyweight Lunge', 3, 15, 60),
      ex('Plank', 3, 60, 60),
    ],
    [
      ex('Diamond Push-Up', 4, 12, 60),
      ex('Pull-Up', 4, 8, 90),
      ex('Bodyweight Split Squat', 4, 12, 60),
      ex('Tricep Dip', 3, 12, 75),
      ex('Bodyweight Single Leg Romanian Deadlift', 3, 12, 60),
      ex('Side Plank', 3, 45, 45),
    ],
    [
      ex('Wide Push-Up', 4, 15, 60),
      ex('Chin-Up', 4, 10, 90),
      ex('Jump Squat', 4, 15, 60),
      ex('Tricep Dip', 3, 12, 75),
      ex('Bodyweight Glute Bridge', 4, 20, 45),
      ex('Plank', 3, 60, 60),
    ],
  ],
  'Fat Loss': [
    [
      ex('Push-Up', 4, 20, 30),
      ex('Bodyweight Squat', 4, 25, 30),
      ex('Pull-Up', 3, 12, 45),
      ex('Bodyweight Lunge', 3, 20, 30),
      ex('Mountain Climber', 3, 40, 30),
      ex('Plank', 3, 45, 30),
    ],
    [
      ex('Jump Squat', 4, 20, 30),
      ex('Push-Up', 4, 20, 30),
      ex('Tricep Dip', 3, 15, 30),
      ex('Bodyweight Split Squat', 3, 20, 30),
      ex('Mountain Climber', 3, 40, 30),
      ex('Side Plank', 3, 30, 30),
    ],
    [
      ex('Burpee', 4, 15, 30),
      ex('Wide Push-Up', 3, 15, 30),
      ex('Pull-Up', 3, 10, 45),
      ex('Jump Squat', 3, 20, 30),
      ex('Bodyweight Lunge', 3, 20, 30),
      ex('Plank', 3, 60, 30),
    ],
  ],
  Strength: [
    [
      ex('Push-Up', 5, 20, 90),
      ex('Pull-Up', 5, 12, 120),
      ex('Bodyweight Squat', 4, 25, 90),
      ex('Tricep Dip', 4, 15, 90),
      ex('Plank', 3, 90, 60),
    ],
    [
      ex('Diamond Push-Up', 5, 15, 90),
      ex('Chin-Up', 5, 12, 120),
      ex('Bodyweight Split Squat', 4, 15, 90),
      ex('Tricep Dip', 4, 15, 90),
      ex('Side Plank', 3, 60, 60),
    ],
    [
      ex('Wide Push-Up', 5, 20, 90),
      ex('Pull-Up', 5, 12, 120),
      ex('Jump Squat', 4, 20, 90),
      ex('Bodyweight Glute Bridge', 4, 20, 75),
      ex('Plank', 3, 90, 60),
    ],
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN GENERATOR
// ─────────────────────────────────────────────────────────────────────────────
export const generateWorkoutDays = (goal: string, splitName: string, daysCount: number): WorkoutDay[] => {
  const days: WorkoutDay[] = [];
  const g = goal || 'Muscle Building';

  for (let i = 0; i < daysCount; i++) {
    let dayName = `Day ${i + 1}`;
    let templates: ExerciseTemplate[] = [];

    if (splitName === 'Push/Pull/Legs (PPL)') {
      const types = ['Push', 'Pull', 'Legs'];
      const key = types[i % 3];
      dayName = key;
      templates = PPL[g]?.[key] ?? PPL['Muscle Building'][key];

    } else if (splitName === 'Upper/Lower') {
      const key = i % 2 === 0 ? 'Upper' : 'Lower';
      dayName = key;
      templates = UPPER_LOWER[g]?.[key] ?? UPPER_LOWER['Muscle Building'][key];

    } else if (splitName === 'Full Body') {
      dayName = `Full Body ${String.fromCharCode(65 + i)}`;
      const variants = FULL_BODY[g] ?? FULL_BODY['Muscle Building'];
      templates = variants[i % variants.length];

    } else if (splitName === 'Bro Split') {
      const types = ['Chest', 'Back', 'Shoulders', 'Legs', 'Arms'];
      const key = types[i % 5];
      dayName = key;
      templates = BRO_SPLIT[g]?.[key] ?? BRO_SPLIT['Muscle Building'][key];

    } else if (splitName === 'HIT (Mike Mentzer)') {
      const key = i % 2 === 0 ? 'Workout A' : 'Workout B';
      dayName = key;
      templates = HIT_MENTZER[g]?.[key] ?? HIT_MENTZER['Muscle Building'][key];

    } else if (splitName === 'Bodyweight Only') {
      dayName = `Full Body ${String.fromCharCode(65 + i)}`;
      const variants = BODYWEIGHT[g] ?? BODYWEIGHT['Muscle Building'];
      templates = variants[i % variants.length];

    } else if (splitName === 'Powerbuilding') {
      const types = ['Heavy Lower', 'Heavy Upper', 'Hypertrophy Lower', 'Hypertrophy Upper'];
      const key = types[i % 4];
      dayName = key;
      templates = POWERBUILDING[g]?.[key] ?? POWERBUILDING['Muscle Building'][key];

    } else if (splitName === 'Custom') {
      dayName = `Full Body ${String.fromCharCode(65 + i)}`;
      const variants = FULL_BODY[g] ?? FULL_BODY['Muscle Building'];
      templates = variants[i % variants.length];
    }

    days.push({ id: generateId(), name: dayName, order: i, exercises: templates.map(buildExercise) });
  }

  return days;
};
