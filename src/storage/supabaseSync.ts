import { supabase } from '../supabase/supabaseClient';
import { db } from './db';

// ── Auth helpers ───────────────────────────────────────────────────
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + window.location.pathname
    }
  });
  if (error) throw error;
  return data;
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuthChange(cb: (user: any) => void) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session?.user ?? null);
  });
  return () => subscription.unsubscribe();
}

// ── Push: local → Supabase ────────────────────────────────────────
export async function pushToSupabase(uid: string): Promise<void> {
  const programs = await db.getPrograms();
  const sessions = await db.getSessions();
  const goals = await db.getGoals();
  const measurements = await db.getMeasurements();
  const settings = await db.getSettings();
  const analytics = await db.getAnalytics();

  const backupData = {
    programs,
    sessions,
    goals,
    measurements,
    settings,
    analytics,
    lastSync: new Date().toISOString()
  };

  const { error } = await supabase
    .from('user_backups')
    .upsert({ 
      user_id: uid, 
      data: backupData,
      updated_at: new Date().toISOString()
    });

  if (error) throw error;
}

// ── Pull: Supabase → local ────────────────────────────────────────
export async function pullFromSupabase(uid: string): Promise<void> {
  const { data, error } = await supabase
    .from('user_backups')
    .select('data')
    .eq('user_id', uid)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return; // No data found
    throw error;
  }

  const backup = data.data;
  
  if (backup.programs) {
    for (const p of backup.programs) await db.saveProgram(p);
  }
  if (backup.sessions) {
    for (const s of backup.sessions) await db.saveSession(s);
  }
  if (backup.goals) {
    for (const g of backup.goals) await db.saveGoal(g);
  }
  if (backup.measurements) {
    for (const m of backup.measurements) await db.saveMeasurement(m);
  }
  if (backup.settings) await db.saveSettings(backup.settings);
  if (backup.analytics) await db.saveAnalytics(backup.analytics);
}
