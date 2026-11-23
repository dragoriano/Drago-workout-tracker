import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { WorkoutProgram, WorkoutSession, Analytics, AppSettings, Goal, Measurement } from '../types';

interface WorkoutDB extends DBSchema {
  programs: {
    key: string;
    value: WorkoutProgram;
  };
  sessions: {
    key: string;
    value: WorkoutSession;
    indexes: {
      'by-date': number;
      'by-program': string;
    };
  };
  analytics: {
    key: string;
    value: Analytics;
  };
  settings: {
    key: string;
    value: AppSettings;
  };
  goals: {
    key: string;
    value: Goal;
  };
  measurements: {
    key: string;
    value: Measurement;
    indexes: {
      'by-type': string;
    };
  };
}

const DB_NAME = 'dragoriano-workout-tracker';
const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase<WorkoutDB>> | undefined;

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<WorkoutDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        // Version 1-3 migrations
        if (!db.objectStoreNames.contains('programs')) {
          db.createObjectStore('programs', { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('by-date', 'date');
          sessionStore.createIndex('by-program', 'programId');
        } else if (oldVersion < 3) {
          // Add missing indexes to existing sessions store if needed
          const sessionStore = transaction.objectStore('sessions');
          if (!sessionStore.indexNames.contains('by-date')) {
            sessionStore.createIndex('by-date', 'date');
          }
          if (!sessionStore.indexNames.contains('by-program')) {
            sessionStore.createIndex('by-program', 'programId');
          }
        }

        if (!db.objectStoreNames.contains('analytics')) {
          db.createObjectStore('analytics');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
        if (!db.objectStoreNames.contains('goals')) {
          db.createObjectStore('goals', { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains('measurements')) {
          const mStore = db.createObjectStore('measurements', { keyPath: 'id' });
          mStore.createIndex('by-type', 'type');
        } else if (oldVersion < 3) {
          const mStore = transaction.objectStore('measurements');
          if (!mStore.indexNames.contains('by-type')) {
            mStore.createIndex('by-type', 'type');
          }
        }
      },
    });
  }
  return dbPromise;
};

// Safe closing function for reloads/resets
export const closeDB = async () => {
  if (dbPromise) {
    const database = await dbPromise;
    database.close();
    dbPromise = undefined as any;
  }
};

export const db = {
  async getPrograms() {
    const db = await initDB();
    const programs = await db.getAll('programs');
    return programs.map(normalizeProgram);
  },
  async getProgram(id: string) {
    const db = await initDB();
    const program = await db.get('programs', id);
    return program ? normalizeProgram(program) : undefined;
  },
  async saveProgram(program: WorkoutProgram) {
    const db = await initDB();
    await db.put('programs', normalizeProgram(program));
  },
  async deleteProgram(id: string) {
    const db = await initDB();
    await db.delete('programs', id);
  },
  
  async getSessions() {
    const db = await initDB();
    const sessions = await db.getAll('sessions');
    return sessions.map(s => ({
      ...s,
      exercisesSnapshot: s.exercisesSnapshot?.map(normalizeExercise)
    }));
  },
  async getSession(id: string) {
    const db = await initDB();
    const session = await db.get('sessions', id);
    if (session) {
      session.exercisesSnapshot = session.exercisesSnapshot?.map(normalizeExercise);
    }
    return session;
  },
  async saveSession(session: WorkoutSession) {
    const db = await initDB();
    const sessionToSave = { ...session };
    if (sessionToSave.exercisesSnapshot) {
      sessionToSave.exercisesSnapshot = sessionToSave.exercisesSnapshot.map(normalizeExercise);
    }
    await db.put('sessions', sessionToSave);
  },
  async deleteSession(id: string) {
    const db = await initDB();
    await db.delete('sessions', id);
  },

  async getAnalytics() {
    const db = await initDB();
    return db.get('analytics', 'main');
  },
  async saveAnalytics(analytics: Analytics) {
    const db = await initDB();
    await db.put('analytics', analytics, 'main');
  },

  async getSettings() {
    const db = await initDB();
    return db.get('settings', 'user');
  },
  async saveSettings(settings: AppSettings) {
    const db = await initDB();
    await db.put('settings', settings, 'user');
  },

  async getGoals() {
    const db = await initDB();
    return db.getAll('goals');
  },
  async saveGoal(goal: Goal) {
    const db = await initDB();
    await db.put('goals', goal);
  },
  async deleteGoal(id: string) {
    const db = await initDB();
    await db.delete('goals', id);
  },

  async getMeasurements() {
    const db = await initDB();
    return db.getAll('measurements');
  },
  async saveMeasurement(measurement: Measurement) {
    const db = await initDB();
    await db.put('measurements', measurement);
  },
  async deleteMeasurement(id: string) {
    const db = await initDB();
    await db.delete('measurements', id);
  },

  async clearAll() {
    await closeDB();
    const { deleteDB } = await import('idb');
    await deleteDB(DB_NAME);
  }
};

function normalizeExercise(ex: any): any {
  if (!ex) return ex;
  let muscleGroup = ex.muscleGroup;
  if (typeof muscleGroup === 'string') {
    muscleGroup = muscleGroup ? [muscleGroup] : [];
  } else if (!Array.isArray(muscleGroup)) {
    muscleGroup = [];
  }
  return { ...ex, muscleGroup };
}

function normalizeProgram(p: WorkoutProgram): WorkoutProgram {
  return {
    ...p,
    days: p.days.map(d => ({
      ...d,
      exercises: d.exercises.map(normalizeExercise)
    }))
  };
}
