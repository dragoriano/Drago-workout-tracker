import { create } from 'zustand';
import { db } from '../storage/db';
import {
  AppSettings,
  CustomExercise,
  Goal,
  Measurement,
  ProgressPhoto,
  ReadinessCheckin,
  WorkoutProgram,
  WorkoutSession,
} from '../types';
import { applyThemeColor, applyThemeMode } from '../utils/theme';
import { reconcileAutoGoals } from '../utils/goalsSync';

// ── App Store ────────────────────────────────────────────────────────
// Centralised state for the entire application. Every page reads from
// this store, and every mutation writes through it so that changes
// automatically propagate across tabs/pages without prop-drilling.

interface AppState {
  // ── Data ─────────────────────────────────────────────────────────
  programs: WorkoutProgram[];
  sessions: WorkoutSession[];
  settings: AppSettings | null;
  goals: Goal[];
  measurements: Measurement[];
  customExercises: CustomExercise[];
  readinessCheckins: ReadinessCheckin[];
  progressPhotos: ProgressPhoto[];
  isLoading: boolean;
  isHydrated: boolean;

  // ── Hydrate everything from IndexedDB ────────────────────────────
  hydrate: () => Promise<void>;

  // ── Program actions ──────────────────────────────────────────────
  loadPrograms: () => Promise<void>;
  saveProgram: (program: WorkoutProgram) => Promise<void>;
  deleteProgram: (id: string) => Promise<void>;

  // ── Session actions ──────────────────────────────────────────────
  loadSessions: () => Promise<void>;
  saveSession: (session: WorkoutSession) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;

  // ── Settings actions ─────────────────────────────────────────────
  loadSettings: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;

  // ── Goal actions ─────────────────────────────────────────────────
  loadGoals: () => Promise<void>;
  saveGoal: (goal: Goal) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  syncAutoGoals: () => Promise<Goal[]>;

  // ── Measurement actions ──────────────────────────────────────────
  loadMeasurements: () => Promise<void>;
  saveMeasurement: (m: Measurement) => Promise<void>;
  deleteMeasurement: (id: string) => Promise<void>;

  // ── Custom exercise actions ──────────────────────────────────────
  loadCustomExercises: () => Promise<void>;
  saveCustomExercise: (ex: CustomExercise) => Promise<void>;
  deleteCustomExercise: (id: string) => Promise<void>;

  // ── Readiness & Progress Photo actions ───────────────────────────
  saveReadinessCheckin: (checkin: ReadinessCheckin) => Promise<void>;
  deleteReadinessCheckin: (id: string) => Promise<void>;
  saveProgressPhoto: (photo: ProgressPhoto) => Promise<void>;
  deleteProgressPhoto: (id: string) => Promise<void>;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  themeColor: 'emerald',
  smartSuggestions: true,
  overloadWarnings: true,
  autoDeload: true,
  soundEnabled: true,
  vibrateOnComplete: true,
  voiceCountdownEnabled: false,
  keepAwakeDuringWorkout: true,
  restNotificationsEnabled: false,
  biologicalSex: 'male',
  syncEnabled: false,
  weightUnit: 'kg',
  effortScale: 'rpe',
  barbellWeight: 20,
};

export const useAppStore = create<AppState>((set, get) => ({
  // ── Initial state ────────────────────────────────────────────────
  programs: [],
  sessions: [],
  settings: null,
  goals: [],
  measurements: [],
  customExercises: [],
  readinessCheckins: [],
  progressPhotos: [],
  isLoading: false,
  isHydrated: false,

  // ── Hydrate ──────────────────────────────────────────────────────
  hydrate: async () => {
    console.log('[Store] Hydration started...');
    set({ isLoading: true });

    // Safety timeout: if hydration takes longer than 6s, proceed anyway
    // (Aligned with 5s splash video duration + 1s buffer)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Hydration timeout')), 6000)
    );

    try {
      console.log('[Store] Fetching data from IndexedDB...');
      
      // Wrap the hydration in a Race with the timeout
      const result = await Promise.race([
        Promise.all([
          db.getPrograms().then(res => { console.debug('[Store] Programs loaded'); return res; }).catch(() => [] as WorkoutProgram[]),
          db.getSessions().then(res => { console.debug('[Store] Sessions loaded'); return res; }).catch(() => [] as WorkoutSession[]),
          db.getSettings().then(res => { console.debug('[Store] Settings loaded'); return res; }).catch(() => null),
          db.getGoals().then(res => { console.debug('[Store] Goals loaded'); return res; }).catch(() => [] as Goal[]),
          db.getMeasurements().then(res => { console.debug('[Store] Measurements loaded'); return res; }).catch(() => [] as Measurement[]),
          db.getCustomExercises().then(res => { console.debug('[Store] Custom exercises loaded'); return res; }).catch(() => [] as CustomExercise[]),
          db.getReadinessCheckins().then(res => { console.debug('[Store] Readiness loaded'); return res; }).catch(() => [] as ReadinessCheckin[]),
          db.getProgressPhotos().then(res => { console.debug('[Store] Progress photos loaded'); return res; }).catch(() => [] as ProgressPhoto[]),
        ]),
        timeoutPromise
      ]) as [WorkoutProgram[], WorkoutSession[], AppSettings | null, Goal[], Measurement[], CustomExercise[], ReadinessCheckin[], ProgressPhoto[]];

      const [programs, sessions, settings, goals, measurements, customExercises, readinessCheckins, progressPhotos] = result;

      set({
        programs,
        sessions: sessions.sort((a, b) => a.date - b.date),
        settings: settings || DEFAULT_SETTINGS,
        goals,
        measurements: measurements.sort((a, b) => a.date - b.date),
        customExercises: [...customExercises].sort((a, b) => b.createdAt - a.createdAt),
        readinessCheckins: [...readinessCheckins].sort((a, b) => a.date - b.date),
        progressPhotos: [...progressPhotos].sort((a, b) => b.date - a.date),
      });
      await get().syncAutoGoals();
      console.log('[Store] Hydration complete');
    } catch (e) {
      console.error('[Store] Failed to hydrate app store or timed out:', e);
    } finally {
      set({ isLoading: false, isHydrated: true });
      console.log('[Store] isHydrated set to true');
    }
  },

  // ── Programs ─────────────────────────────────────────────────────
  loadPrograms: async () => {
    const programs = await db.getPrograms();
    set({ programs });
  },
  saveProgram: async (program) => {
    await db.saveProgram(program);
    // Optimistic update
    set((s) => ({
      programs: s.programs.some((p) => p.id === program.id)
        ? s.programs.map((p) => (p.id === program.id ? program : p))
        : [...s.programs, program],
    }));
  },
  deleteProgram: async (id) => {
    await db.deleteProgram(id);
    set((s) => ({ programs: s.programs.filter((p) => p.id !== id) }));
  },

  // ── Sessions ─────────────────────────────────────────────────────
  loadSessions: async () => {
    const sessions = await db.getSessions();
    set({ sessions: sessions.sort((a, b) => a.date - b.date) });
  },
  saveSession: async (session) => {
    await db.saveSession(session);
    set((s) => ({
      sessions: s.sessions.some((ss) => ss.id === session.id)
        ? s.sessions.map((ss) => (ss.id === session.id ? session : ss))
        : [...s.sessions, session].sort((a, b) => a.date - b.date),
    }));
    await get().syncAutoGoals();
  },
  deleteSession: async (id) => {
    await db.deleteSession(id);
    set((s) => ({ sessions: s.sessions.filter((ss) => ss.id !== id) }));
  },

  // ── Settings ─────────────────────────────────────────────────────
  loadSettings: async () => {
    const settings = await db.getSettings();
    set({ settings: settings || DEFAULT_SETTINGS });
  },
  updateSettings: async (patch) => {
    const current = get().settings || DEFAULT_SETTINGS;
    const updated = { ...current, ...patch };
    await db.saveSettings(updated);
    set({ settings: updated });
  },

  // ── Goals ────────────────────────────────────────────────────────
  loadGoals: async () => {
    const goals = await db.getGoals();
    set({ goals });
  },
  saveGoal: async (goal) => {
    await db.saveGoal(goal);
    set((s) => ({
      goals: s.goals.some((g) => g.id === goal.id)
        ? s.goals.map((g) => (g.id === goal.id ? goal : g))
        : [...s.goals, goal],
    }));
  },
  deleteGoal: async (id) => {
    await db.deleteGoal(id);
    set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }));
  },
  syncAutoGoals: async () => {
    const { goals, sessions, measurements } = get();
    if (goals.length === 0) return [];
    const { updatedGoals, changedGoals, newlyCompleted } = reconcileAutoGoals(
      goals,
      sessions,
      measurements,
    );
    if (changedGoals.length > 0) {
      await Promise.all(changedGoals.map((g) => db.saveGoal(g)));
      set({ goals: updatedGoals });
    }
    return newlyCompleted;
  },

  // ── Measurements ─────────────────────────────────────────────────
  loadMeasurements: async () => {
    const measurements = await db.getMeasurements();
    set({ measurements: measurements.sort((a, b) => a.date - b.date) });
  },
  saveMeasurement: async (m) => {
    await db.saveMeasurement(m);
    set((s) => ({
      measurements: s.measurements.some((mm) => mm.id === m.id)
        ? s.measurements.map((mm) => (mm.id === m.id ? m : mm))
        : [...s.measurements, m].sort((a, b) => a.date - b.date),
    }));
    await get().syncAutoGoals();
  },
  deleteMeasurement: async (id) => {
    await db.deleteMeasurement(id);
    set((s) => ({ measurements: s.measurements.filter((mm) => mm.id !== id) }));
  },

  // ── Custom Exercises ─────────────────────────────────────────────
  loadCustomExercises: async () => {
    const customExercises = await db.getCustomExercises();
    set({ customExercises: [...customExercises].sort((a, b) => b.createdAt - a.createdAt) });
  },
  saveCustomExercise: async (ex) => {
    await db.saveCustomExercise(ex);
    set((s) => ({
      customExercises: s.customExercises.some((c) => c.id === ex.id)
        ? s.customExercises.map((c) => (c.id === ex.id ? ex : c))
        : [ex, ...s.customExercises].sort((a, b) => b.createdAt - a.createdAt),
    }));
  },
  deleteCustomExercise: async (id) => {
    await db.deleteCustomExercise(id);
    set((s) => ({ customExercises: s.customExercises.filter((c) => c.id !== id) }));
  },

  // ── Readiness & Progress Photos ──────────────────────────────────
  saveReadinessCheckin: async (checkin) => {
    await db.saveReadinessCheckin(checkin);
    set((s) => ({
      readinessCheckins: s.readinessCheckins.some((r) => r.id === checkin.id)
        ? s.readinessCheckins.map((r) => (r.id === checkin.id ? checkin : r))
        : [...s.readinessCheckins, checkin].sort((a, b) => a.date - b.date),
    }));
  },
  deleteReadinessCheckin: async (id) => {
    await db.deleteReadinessCheckin(id);
    set((s) => ({ readinessCheckins: s.readinessCheckins.filter((r) => r.id !== id) }));
  },
  saveProgressPhoto: async (photo) => {
    await db.saveProgressPhoto(photo);
    set((s) => ({
      progressPhotos: s.progressPhotos.some((p) => p.id === photo.id)
        ? s.progressPhotos.map((p) => (p.id === photo.id ? photo : p))
        : [photo, ...s.progressPhotos].sort((a, b) => b.date - a.date),
    }));
  },
  deleteProgressPhoto: async (id) => {
    await db.deleteProgressPhoto(id);
    set((s) => ({ progressPhotos: s.progressPhotos.filter((p) => p.id !== id) }));
  },
}));
