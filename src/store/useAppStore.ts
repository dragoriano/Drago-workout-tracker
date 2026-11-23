import { create } from 'zustand';
import { db } from '../storage/db';
import { WorkoutProgram, WorkoutSession, AppSettings, Goal, Measurement } from '../types';
import { applyThemeColor, applyThemeMode } from '../utils/theme';

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

  // ── Measurement actions ──────────────────────────────────────────
  loadMeasurements: () => Promise<void>;
  saveMeasurement: (m: Measurement) => Promise<void>;
  deleteMeasurement: (id: string) => Promise<void>;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  themeColor: 'indigo',
  smartSuggestions: true,
  overloadWarnings: true,
  autoDeload: true,
  soundEnabled: true,
  vibrateOnComplete: true,
  voiceCountdownEnabled: false,
  syncEnabled: false,
  weightUnit: 'kg',
};

export const useAppStore = create<AppState>((set, get) => ({
  // ── Initial state ────────────────────────────────────────────────
  programs: [],
  sessions: [],
  settings: null,
  goals: [],
  measurements: [],
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
        ]),
        timeoutPromise
      ]) as [WorkoutProgram[], WorkoutSession[], AppSettings | null, Goal[], Measurement[]];

      const [programs, sessions, settings, goals, measurements] = result;

      set({
        programs,
        sessions: sessions.sort((a, b) => a.date - b.date),
        settings: settings || DEFAULT_SETTINGS,
        goals,
        measurements: measurements.sort((a, b) => a.date - b.date),
      });
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
  },
  deleteMeasurement: async (id) => {
    await db.deleteMeasurement(id);
    set((s) => ({ measurements: s.measurements.filter((mm) => mm.id !== id) }));
  },
}));
