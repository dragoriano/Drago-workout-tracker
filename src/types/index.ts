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

export type Set = {
 id: string;
 weight: number;
 reps: number;
 completed: boolean;
};

export type ExerciseHistory = {
 sessionId: string;
 date: number;
 sets: Set[];
};

export type WorkoutSession = {
 id: string;
 programId: string;
 dayId: string;
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
 barbellWeight?: number;
 availablePlates?: number[];
 hasSeenOnboarding?: boolean;
};

export type Goal = {
 id: string;
 title: string;
 targetValue: number;
 currentValue: number;
 unit: string; // 'kg', 'reps', 'workouts', 'days', etc.
 deadline: number | null; // timestamp
 completed: boolean;
 createdAt: number;
};

export type Measurement = {
  id: string;
  type: string;
  value: number;
  unit: string;
  date: number;
  note?: string;
};
