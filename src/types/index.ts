export type WorkoutProgram = {
 id: string;
 name: string;
 goal?: string; // Muscle Building, Fat Loss, Strength
 theme: string; // splash color / gradient / animation
 status: 'active' | 'paused';
 createdAt: number;
 updatedAt: number;
 days: WorkoutDay[];
};

export type WorkoutDay = {
 id: string;
 name: string;
 order: number;
 exercises: Exercise[];
 isDeloadDay?: boolean;
};

export type Exercise = {
 id: string;
 name: string;
 muscleGroup?: string[];
 primaryMuscle?: string;
 secondaryMuscles?: string[];
 notes: string;
 sets: Set[];
 history: ExerciseHistory[];
 restTimerConfig: number; // in seconds
 lastUpdated: number;
 supersetId?: string; // Groups exercises into a superset
 supersetOrder?: number; // Order within the superset
};

export type SetType = 'working' | 'warmup' | 'drop' | 'failure';

export type EffortScale = 'rpe' | 'rir';

export type Set = {
 id: string;
 weight: number;
 reps: number;
 completed: boolean;
 setType?: SetType;
 rpe?: number;
};

export type ExerciseHistory = {
 sessionId: string;
 date: number;
 sets: Set[];
};

export type ExerciseEquipment =
 | 'Barbell'
 | 'Dumbbell'
 | 'Machine'
 | 'Cable'
 | 'Bodyweight'
 | 'Kettlebell'
 | 'Other';

export type CustomExercise = {
 id: string;
 name: string;
 primaryMuscle: string;
 secondaryMuscles: string[];
 muscleGroups: string[];
 equipment?: ExerciseEquipment;
 defaultRestTimer?: number;
 notes?: string;
 createdAt: number;
};

export type WorkoutSession = {
 id: string;
 programId: string;
 dayId: string;
 workoutName?: string;
 date: number;
 totalVolume: number;
 PRs: PR[];
 duration: number; // in seconds
 exercisesSnapshot: Exercise[];
};

export type PR = {
 exerciseId: string;
 exerciseName: string;
 type: 'weight' | 'reps' | 'volume' | '1rm';
 value: number;
 previousValue: number;
};

export type Analytics = {
 volumePerExercise: Record<string, number>;
 volumePerWorkout: Record<string, number>;
 weeklyVolume: Record<string, number>;
 streaks: {
 current: number;
 longest: number;
 lastWorkoutDate: number | null;
 };
 PRHistory: PR[];
};

export type AppSettings = {
 theme: 'light' | 'dark' | 'system';
 themeColor: string;
 smartSuggestions: boolean;
 overloadWarnings: boolean;
 autoDeload: boolean;
 soundEnabled: boolean;
 vibrateOnComplete?: boolean;
 voiceCountdownEnabled: boolean;
 syncEnabled: boolean;
 weightUnit?: 'kg' | 'lbs';
 effortScale?: EffortScale;
 barbellWeight?: number;
 availablePlates?: number[];
 hasSeenOnboarding?: boolean;
};

export type GoalTrackingType =
 | 'manual'
 | 'exercise_e1rm'
 | 'exercise_weight'
 | 'monthly_workouts'
 | 'weekly_volume'
 | 'streak_days'
 | 'body_weight';

export type GoalDirection = 'increase' | 'decrease';

export type Goal = {
 id: string;
 title: string;
 targetValue: number;
 currentValue: number;
 unit: string; // 'kg', 'reps', 'workouts', 'days', etc.
 deadline: number | null; // timestamp
 completed: boolean;
 createdAt: number;
 trackingType?: GoalTrackingType;
 linkedExerciseName?: string;
 startValue?: number;
 direction?: GoalDirection;
};

export type Measurement = {
  id: string;
  type: string;
  value: number;
  unit: string;
  date: number;
  note?: string;
};
