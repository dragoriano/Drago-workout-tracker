import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Cloud, Moon, Palette, Sparkles, AlertTriangle, 
  TrendingDown, Download, RefreshCw, Trash2, ChevronRight, X, QrCode, Upload, Camera, ScanLine, Volume2, ShieldAlert, Activity,
  CloudUpload, CloudDownload, Mic, Calculator, Gauge, FileSpreadsheet
} from 'lucide-react';
import { PremiumIcon, FilledIcon } from '../../components/ui/PremiumIcon';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import { AppSettings, EffortScale } from '../../types';
import { db, closeDB } from '../../storage/db';
import { signInWithGoogle, signOutUser, onAuthChange, pushToSupabase, pullFromSupabase } from '../../storage/supabaseSync';
import { Button } from '../../components/ui/Button';
import { applyThemeColor, applyThemeMode } from '../../utils/theme';
import { useAppStore, DEFAULT_SETTINGS } from '../../store/useAppStore';
import { PullToRefresh } from '../../components/ui/PullToRefresh';
import { PlateCalculatorModal } from '../../components/ui/PlateCalculatorModal';
import { downloadCSV, formatSessionsToCSV } from '../../utils/sessionExport';
import {
  decodeProgramSharePayload,
  encodeProgramsShareCode,
  prepareImportedProgram,
} from '../../utils/programShare';
import { BARBELL_PRESETS, DEFAULT_BARBELL_WEIGHT, WeightUnit } from '../../utils/strength';
import type { User } from '@supabase/supabase-js';

const QRCodeScanner = React.lazy(() =>
  import('../../components/QRCodeScanner').then((m) => ({ default: m.QRCodeScanner })),
);

export function SettingsPage() {
  const navigate = useNavigate();
  const settings = useAppStore((s) => s.settings) || DEFAULT_SETTINGS;
  const sessions = useAppStore((s) => s.sessions);
  const programs = useAppStore((s) => s.programs);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const hydrate = useAppStore((s) => s.hydrate);

  const [showDataModal, setShowDataModal] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrData, setQrData] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{title: string, message: string} | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showPlateCalc, setShowPlateCalc] = useState(false);

  useEffect(() => {
    return onAuthChange((newUser) => {
      setUser(newUser);
    });
  }, []);

  const updateSetting = async (key: keyof AppSettings, value: any) => {
    await updateSettings({ [key]: value });
  };

  const handleWeightUnitChange = async (nextUnit: WeightUnit) => {
    if (settings.weightUnit === nextUnit) return;
    await updateSettings({
      weightUnit: nextUnit,
      barbellWeight: undefined,
      availablePlates: undefined,
    });
  };

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error('Error signing in:', error);
      setAlertMessage({ 
        title: 'Sign-In Error', 
        message: error?.message || 'Failed to sign in via Supabase.' 
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleSync = async () => {
    if (!user) {
      setAlertMessage({ title: 'Sign In Required', message: 'Please sign in to sync data.' });
      return;
    }
    setIsSyncing(true);
    try {
      await pushToSupabase(user.id);
      setAlertMessage({ title: 'Success', message: 'Data synced successfully to Supabase!' });
    } catch (error: any) {
      console.error('Error syncing data:', error);
      const detail = error?.message || error?.code || 'Unknown network error.';
      setAlertMessage({ 
        title: 'Cloud Sync Failed', 
        message: `Reason: ${detail}` 
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  const handleRestore = async () => {
    if (!user) {
      setAlertMessage({ title: 'Sign In Required', message: 'Please sign in to restore data.' });
      return;
    }
    setShowRestoreConfirm(true);
  };

  const confirmRestore = async () => {
    setShowRestoreConfirm(false);
    if (!user) return;
    setIsSyncing(true);
    try {
      await pullFromSupabase(user.id);
      setAlertMessage({ title: 'Success', message: 'Data restored successfully from Supabase!' });
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      console.error('Error restoring data:', error);
      setAlertMessage({ 
        title: 'Restore Failed', 
        message: error?.message || 'Failed to pull data from Supabase.' 
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExport = async () => {
    const programs = await db.getPrograms();
    const sessions = await db.getSessions();
    const goals = await db.getGoals();
    const measurements = await db.getMeasurements();
    const customExercises = await db.getCustomExercises();
    const analytics = await db.getAnalytics();
    const settings = await db.getSettings();
    
    const data = {
      programs,
      sessions,
      goals,
      measurements,
      customExercises,
      analytics,
      settings,
      exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dragoriano-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = async () => {
    const exportSessions = sessions.length > 0 ? sessions : await db.getSessions();
    const exportPrograms = programs.length > 0 ? programs : await db.getPrograms();

    if (exportSessions.length === 0) {
      setAlertMessage({
        title: 'No History to Export',
        message: 'Complete at least one workout session before exporting your history as CSV.',
      });
      return;
    }

    const unit = settings.weightUnit || 'kg';
    const csv = formatSessionsToCSV(exportSessions, exportPrograms, unit);
    downloadCSV(csv, `dragoriano-history-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        
        if (data.programs) {
          for (const program of data.programs) {
            await db.saveProgram(program);
          }
        }
        if (data.sessions) {
          for (const session of data.sessions) {
            await db.saveSession(session);
          }
        }
        if (Array.isArray(data.goals)) {
          for (const goal of data.goals) {
            await db.saveGoal(goal);
          }
        }
        if (Array.isArray(data.measurements)) {
          for (const m of data.measurements) {
            await db.saveMeasurement(m);
          }
        }
        if (Array.isArray(data.customExercises)) {
          for (const ce of data.customExercises) {
            await db.saveCustomExercise(ce);
          }
        }
        if (data.analytics) await db.saveAnalytics(data.analytics);
        if (data.settings) await db.saveSettings(data.settings);
        
        await useAppStore.getState().hydrate();
        setAlertMessage({ title: 'Success', message: 'Backup imported successfully!' });
      } catch (error) {
        console.error('Error importing backup:', error);
        setAlertMessage({ title: 'Error', message: 'Failed to import backup. Invalid file format.' });
      }
    };
    reader.readAsText(file);
  };

  const handleShareQR = async () => {
    const programs = await db.getPrograms();

    try {
      const { code, fitsQR } = await encodeProgramsShareCode(programs);

      if (!fitsQR) {
        setAlertMessage({
          title: 'Data Too Large',
          message: `Your ${programs.length} program(s) exceed QR capacity even after compression. Share individual programs from the Programs page or use Export Data (JSON) instead.`
        });
        return;
      }

      setQrData(code);
      setShowDataModal(false);
      setShowQR(true);
    } catch (err) {
      console.error('QR compression failed:', err);
      setAlertMessage({ title: 'Error', message: 'Failed to generate QR code. Please use the Export Data (JSON) option.' });
    }
  };

  const handleResetApp = async () => {
    setShowResetConfirm(true);
  };

  const confirmResetApp = async () => {
    setIsSyncing(true);
    try {
      await closeDB();
      // indexedDB.databases() is not supported in Firefox/Safari/older WebViews
      if (window.indexedDB.databases) {
        const dbs = await window.indexedDB.databases();
        const deletePromises = dbs.map(database => {
          return new Promise<void>((resolve, reject) => {
            const req = window.indexedDB.deleteDatabase(database.name!);
            req.onsuccess = () => resolve();
            req.onerror = reject;
            // If blocked, wait and retry once instead of silently succeeding
            req.onblocked = () => {
              setTimeout(() => {
                const retry = window.indexedDB.deleteDatabase(database.name!);
                retry.onsuccess = () => resolve();
                retry.onerror = reject;
              }, 500);
            };
          });
        });
        await Promise.all(deletePromises);
      } else {
        // Fallback: delete the known database by name
        await new Promise<void>((resolve) => {
          const req = window.indexedDB.deleteDatabase('dragoriano-workout-tracker');
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
        });
      }
      localStorage.clear();
      const baseUrl = import.meta.env.BASE_URL;
      window.location.href = !baseUrl || baseUrl === './' ? '/' : baseUrl; // Force clear all UI state
    } catch (error) {
      console.error('Failed to reset app:', error);
      // Last-resort fallback: clear localStorage and reload
      localStorage.clear();
      window.location.reload();
    }
  };

  const Switch = ({ checked, onChange }: { checked: boolean; onChange: (c: boolean) => void }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        checked ? 'bg-primary-500' : 'bg-zinc-700'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-content shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );

  return (
    <>
      <PullToRefresh onRefresh={async () => hydrate()} className="flex min-h-[100dvh] flex-col bg-page text-content pb-20 font-sans">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-center bg-page/90 px-4 py-4 backdrop-blur-md">
          <button onClick={() => navigate(-1)} className="absolute left-4 text-muted hover:text-content transition-transform active:scale-90">
            <ArrowLeft size={24}/>
          </button>
          <h1 className="text-xl font-bold text-primary-400">Settings</h1>
        </div>

        <div className="px-4 space-y-6 mt-4">
          {/* PREFERENCES */}
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Preferences</h2>
            <div className="rounded-2xl bg-card divide-y divide-content/5">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <PremiumIcon icon={ShieldAlert} color="primary" variant="soft" size="sm" />
                  <div>
                    <h3 className="font-bold text-content ">Weight Unit</h3>
                    <p className="text-xs text-muted">Metric or imperial</p>
                  </div>
                </div>
                <div className="flex rounded-lg bg-page/10 p-1">
                  <button
                    onClick={() => handleWeightUnitChange('kg')}
                    className={`rounded-md px-3 py-1 text-sm font-bold transition-all ${settings.weightUnit !== 'lbs' ? 'bg-card text-content shadow-sm' : 'text-muted'}`}
                  >kg</button>
                  <button
                    onClick={() => handleWeightUnitChange('lbs')}
                    className={`rounded-md px-3 py-1 text-sm font-bold transition-all ${settings.weightUnit === 'lbs' ? 'bg-card text-content shadow-sm' : 'text-muted'}`}
                  >lbs</button>
                </div>
              </div>

              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <PremiumIcon icon={Gauge} color="amber" variant="soft" size="sm" />
                  <div>
                    <h3 className="font-bold text-content">Effort Scale</h3>
                    <p className="text-xs text-muted">RPE (6–10) or RIR (0–4 reps in reserve)</p>
                  </div>
                </div>
                <div className="flex rounded-lg bg-page/10 p-1">
                  {(['rpe', 'rir'] as EffortScale[]).map((scale) => (
                    <button
                      key={scale}
                      onClick={() => updateSetting('effortScale', scale)}
                      className={`rounded-md px-3 py-1 text-sm font-bold uppercase transition-all ${
                        (settings.effortScale || 'rpe') === scale
                          ? 'bg-card text-content shadow-sm'
                          : 'text-muted'
                      }`}
                    >
                      {scale}
                    </button>
                  ))}
                </div>
              </div>

              {(() => {
                const unit: WeightUnit = settings.weightUnit === 'lbs' ? 'lbs' : 'kg';
                const currentBar = settings.barbellWeight ?? DEFAULT_BARBELL_WEIGHT[unit];
                return (
                  <>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <PremiumIcon icon={Calculator} color="primary" variant="soft" size="sm" />
                          <div>
                            <h3 className="font-bold text-content">Barbell Weight</h3>
                            <p className="text-xs text-muted">Default bar used for plate loading</p>
                          </div>
                        </div>
                        <span className="text-sm font-black text-primary-400">
                          {currentBar} {unit}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {BARBELL_PRESETS[unit].map((preset) => (
                          <button
                            key={preset}
                            onClick={() => updateSetting('barbellWeight', preset)}
                            className={`rounded-xl py-2 text-xs font-bold border transition-all ${
                              currentBar === preset
                                ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                                : 'bg-surface text-muted border-content/10 hover:text-content'
                            }`}
                          >
                            {preset} {unit}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => setShowPlateCalc(true)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-content/5 transition-colors rounded-b-2xl"
                    >
                      <div>
                        <h3 className="font-bold text-content text-sm">Configure Plate Calculator</h3>
                        <p className="text-xs text-muted">Customize available gym plates & preview loads</p>
                      </div>
                      <ChevronRight size={18} className="text-muted" />
                    </button>
                  </>
                );
              })()}
            </div>
          </section>

          {/* ACCOUNT */}
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Account</h2>
            <div className="rounded-2xl bg-card p-4">
              {user ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 overflow-hidden rounded-full bg-zinc-100 dark:bg-elevated">
                        <img src={user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${user.user_metadata?.full_name || 'User'}`} alt="Profile" className="h-full w-full object-cover" />
                      </div>
                      <div>
                        <h3 className="font-bold text-content ">{user.user_metadata?.full_name || 'User'}</h3>
                        <p className="text-sm text-muted">{user.email}</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleSignOut} 
                      className="flex shrink-0 items-center justify-center rounded-xl bg-red-500/10 px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-500/20 transition-colors"
                    >
                      SIGN OUT
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={handleSync} disabled={isSyncing} className="flex items-center justify-center gap-2 rounded-xl bg-primary-500/10 border border-primary-500/20 py-3 text-sm font-bold text-primary-400 hover:bg-primary-500/20 transition-all disabled:opacity-50 active:scale-95 shadow-sm">
                      <CloudUpload size={22}/> {isSyncing ? 'Syncing...' : 'Sync Now'}
                    </button>
                    <button onClick={handleRestore} disabled={isSyncing} className="flex items-center justify-center gap-2 rounded-xl bg-primary-500/10 border border-primary-500/20 py-3 text-sm font-bold text-primary-400 hover:bg-primary-500/20 transition-all disabled:opacity-50 active:scale-95 shadow-sm">
                      <CloudDownload size={22}/> Restore
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-4 text-center">
                  <div className="mb-3 h-16 w-16 rounded-full bg-zinc-100 dark:bg-elevated flex items-center justify-center">
                    <Cloud className="text-muted" size={32}/>
                  </div>
                  <h3 className="font-bold text-content mb-1">Cloud Sync</h3>
                  <p className="text-sm text-muted mb-4">Sign in with Supabase to backup and restore your workout data.</p>
                  <button onClick={handleSignIn} className="w-full rounded-xl bg-primary-500 py-3 text-sm font-bold text-content hover:bg-primary-600 transition-colors">
                    Sign In with Google
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* APPEARANCE */}
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Appearance</h2>
            <div className="rounded-2xl bg-card divide-y divide-content/5">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <PremiumIcon icon={Moon} color="primary" variant="soft" size="sm" />
                  <div>
                    <h3 className="font-bold text-content ">Dark Mode</h3>
                    <p className="text-xs text-muted">Use dark theme</p>
                  </div>
                </div>
                <Switch 
                  checked={settings.theme === 'dark'} 
                  onChange={(c) => updateSetting('theme', c ? 'dark' : 'light')} 
                />
              </div>
              <div className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <PremiumIcon icon={Palette} color="primary" variant="soft" size="sm" />
                  <div>
                    <h3 className="font-bold text-content ">Theme Color</h3>
                    <p className="text-xs text-muted">Choose your accent color</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 pl-8">
                  {['indigo', 'emerald', 'orange', 'blue', 'pink', 'amber'].map(color => (
                    <button
                      key={color}
                      onClick={() => updateSetting('themeColor', color)}
                      className={`h-8 w-8 rounded-full border-2 transition-all ${settings.themeColor === color ? 'border-content scale-110' : 'border-transparent hover:scale-105'} ${
                        color === 'indigo' ? 'bg-indigo-500' :
                        color === 'emerald' ? 'bg-emerald-500' :
                        color === 'orange' ? 'bg-orange-500' :
                        color === 'blue' ? 'bg-blue-500' :
                        color === 'pink' ? 'bg-pink-500' :
                        'bg-amber-500'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* AUDIO & FEEDBACK */}
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Audio & Feedback</h2>
            <div className="rounded-2xl bg-card divide-y divide-content/5">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <PremiumIcon icon={Volume2} color="primary" variant="soft" size="sm" />
                  <div>
                    <h3 className="font-bold text-content ">Timer Sound</h3>
                    <p className="text-xs text-muted">Beep when rest timer finishes</p>
                  </div>
                </div>
                <Switch 
                  checked={settings.soundEnabled} 
                  onChange={(c) => updateSetting('soundEnabled', c)} 
                />
              </div>
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <PremiumIcon icon={Activity} color="primary" variant="soft" size="sm" />
                  <div>
                    <h3 className="font-bold text-content ">Vibration</h3>
                    <p className="text-xs text-muted">Haptic feedback on set completion</p>
                  </div>
                </div>
                <Switch 
                  checked={!!settings.vibrateOnComplete} 
                  onChange={(c) => updateSetting('vibrateOnComplete', c)} 
                />
              </div>
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <PremiumIcon icon={Mic} color="primary" variant="soft" size="sm" />
                  <div>
                    <h3 className="font-bold text-content ">Voice Countdown</h3>
                    <p className="text-xs text-muted">Speak the last 5 seconds of rest</p>
                  </div>
                </div>
                <Switch 
                  checked={!!settings.voiceCountdownEnabled} 
                  onChange={(c) => updateSetting('voiceCountdownEnabled', c)} 
                />
              </div>
            </div>
          </section>

          {/* SMART COACH */}
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Smart Coach</h2>
            <div className="rounded-2xl bg-card divide-y divide-content/5">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <PremiumIcon icon={Sparkles} color="amber" variant="soft" size="sm" />
                  <div>
                    <h3 className="font-bold text-content ">Smart Suggestions</h3>
                    <p className="text-xs text-muted">AI-powered weight suggestions</p>
                  </div>
                </div>
                <Switch 
                  checked={settings.smartSuggestions} 
                  onChange={(c) => updateSetting('smartSuggestions', c)} 
                />
              </div>
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <PremiumIcon icon={AlertTriangle} color="orange" variant="soft" size="sm" />
                  <div>
                    <h3 className="font-bold text-content ">Overload Warnings</h3>
                    <p className="text-xs text-muted">Warn on excessive volume</p>
                  </div>
                </div>
                <Switch 
                  checked={settings.overloadWarnings} 
                  onChange={(c) => updateSetting('overloadWarnings', c)} 
                />
              </div>
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <PremiumIcon icon={TrendingDown} color="emerald" variant="soft" size="sm" />
                  <div>
                    <h3 className="font-bold text-content ">Auto Deload</h3>
                    <p className="text-xs text-muted">Suggest lighter weights on plateau</p>
                  </div>
                </div>
                <Switch 
                  checked={settings.autoDeload} 
                  onChange={(c) => updateSetting('autoDeload', c)} 
                />
              </div>
            </div>
          </section>

          {/* DATA */}
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Data</h2>
            <div className="space-y-3">
              <button onClick={handleExport} className="w-full flex items-center gap-3 rounded-2xl bg-card p-4 text-left glow-card group">
                <PremiumIcon icon={Download} color="primary" variant="soft" size="sm" className="group-hover:scale-110" />
                <div>
                  <h3 className="font-bold text-content">Export Data</h3>
                  <p className="text-xs text-muted">Download your workout data</p>
                </div>
              </button>
              <button onClick={handleExportCSV} className="w-full flex items-center gap-3 rounded-2xl bg-card p-4 text-left glow-card group">
                <PremiumIcon icon={FileSpreadsheet} color="emerald" variant="soft" size="sm" className="group-hover:scale-110" />
                <div>
                  <h3 className="font-bold text-content">Export History (CSV)</h3>
                  <p className="text-xs text-muted">Download workout sets as a spreadsheet</p>
                </div>
              </button>
              <button onClick={() => setShowDataModal(true)} className="w-full flex items-center justify-between rounded-2xl bg-card p-4 text-left glow-card group">
                <div className="flex items-center gap-3">
                  <PremiumIcon icon={RefreshCw} color="sky" variant="soft" size="sm" className="group-hover:rotate-180 transition-transform duration-500" />
                  <div>
                    <h3 className="font-bold text-content">Data Transfer</h3>
                    <p className="text-xs text-muted">Import or export backup files</p>
                  </div>
                </div>
                <ChevronRight className="text-muted group-hover:translate-x-1 transition-transform" size={20}/>
              </button>
              <button onClick={handleResetApp} className="w-full flex items-center gap-3 rounded-2xl bg-card p-4 text-left glow-card group border-transparent hover:border-red-500 shadow-none hover:shadow-red-500/10">
                <PremiumIcon icon={Trash2} color="red" variant="soft" size="sm" className="group-hover:scale-110" />
                <div>
                  <h3 className="font-bold text-red-500">Reset App</h3>
                  <p className="text-xs text-muted">Delete all data and start fresh</p>
                </div>
              </button>
            </div>
          </section>

          {/* ABOUT */}
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">About</h2>
            <div className="rounded-2xl bg-card p-6 text-center">
              <h3 className="font-black text-primary-400 tracking-widest uppercase">Dragoriano</h3>
              <p className="text-sm text-muted mt-1">Workout Tracker v1.8.0</p>
            </div>
          </section>
        </div>
      </PullToRefresh>

      {/* Data Transfer Modal */}
      {showDataModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-page/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-content ">Data Transfer</h3>
              <button onClick={() => setShowDataModal(false)} className="text-muted hover:text-content ">
                <X size={20} />
              </button>
            </div>
            <div className="grid gap-3">
              <label className="relative block rounded-xl glow-card cursor-pointer">
                <input 
                  type="file" 
                  accept=".json" 
                  onChange={handleImport} 
                  className="hidden" 
                />
                <div className="w-full flex items-center gap-3 rounded-xl bg-surface border border-content/10 p-4 text-left transition-all">
                  <Upload className="text-muted" size={20}/>
                  <div>
                    <h4 className="font-bold text-content">Import Backup</h4>
                    <p className="text-xs text-muted font-medium">Restore from JSON file</p>
                  </div>
                </div>
              </label>
              <button onClick={handleShareQR} className="w-full flex items-center gap-3 rounded-xl bg-surface border border-content/10 p-4 text-left transition-all glow-card">
                <QrCode className="text-muted" size={20}/>
                <div>
                  <h4 className="font-bold text-content">Share via QR Code</h4>
                  <p className="text-xs text-muted font-medium">Share programs with another device</p>
                </div>
              </button>
              <button onClick={() => { setShowDataModal(false); setShowQRScanner(true); }} className="w-full flex items-center gap-3 rounded-xl bg-surface border border-content/10 p-4 text-left transition-all glow-card">
                <Camera className="text-muted" size={20}/>
                <div>
                  <h4 className="font-bold text-content">Scan QR Code</h4>
                  <p className="text-xs text-muted font-medium">Import programs by scanning a QR code</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-page/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 text-center">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-content ">Share Programs</h3>
              <button onClick={() => setShowQR(false)} className="text-muted hover:text-content ">
                <X size={20} />
              </button>
            </div>
            <div className="mx-auto mb-4 flex aspect-square w-full max-w-[250px] items-center justify-center rounded-xl bg-white border border-black/10 p-4">
              <QRCodeSVG value={qrData} size={200} />
            </div>
            <p className="text-sm text-muted">Scan this code with another device running Dragoriano to import your workout programs.</p>
          </div>
        </div>
      )}
      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-page/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 text-center">
            <h3 className="text-lg font-bold text-red-500 mb-2">Reset App Data</h3>
            <p className="text-muted mb-6">Are you sure you want to delete all data and start fresh? This cannot be undone.</p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setShowResetConfirm(false)}>
                Cancel
              </Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={confirmResetApp}>
                Reset
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Restore Confirmation Modal */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-page/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 text-center">
            <h3 className="text-lg font-bold text-red-500 mb-2">Restore Data</h3>
            <p className="text-muted mb-6">This will overwrite your current local data. Are you sure?</p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setShowRestoreConfirm(false)}>
                Cancel
              </Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={confirmRestore}>
                Restore
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Alert Modal */}
      {alertMessage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-page/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 text-center">
            <h3 className="text-lg font-bold text-content mb-2">{alertMessage.title}</h3>
            <p className="text-muted mb-6">{alertMessage.message}</p>
            <Button variant="primary" className="w-full" onClick={() => setAlertMessage(null)}>
              OK
            </Button>
          </div>
        </div>
      )}

      {/* QR Code Scanner */}
      {showQRScanner && (
        <React.Suspense fallback={null}>
          <QRCodeScanner
            isOpen={showQRScanner}
            onClose={() => setShowQRScanner(false)}
            onScanSuccess={async (decodedText) => {
              setShowQRScanner(false);
              try {
                const { programs: decodedPrograms } = await decodeProgramSharePayload(decodedText);
                const hasActive = programs.some((p) => p.status === 'active');
                for (let i = 0; i < decodedPrograms.length; i++) {
                  const prepared = prepareImportedProgram(decodedPrograms[i], {
                    status: !hasActive && i === 0 ? 'active' : 'paused',
                  });
                  await db.saveProgram(prepared);
                }
                await useAppStore.getState().hydrate();
                setAlertMessage({
                  title: 'Success',
                  message: `Imported ${decodedPrograms.length} program(s) successfully!`,
                });
              } catch (err: unknown) {
                setAlertMessage({
                  title: 'Invalid QR',
                  message:
                    err instanceof Error
                      ? err.message
                      : 'Could not parse QR code data. Make sure it was generated by Dragoriano.',
                });
              }
            }}
          />
        </React.Suspense>
      )}

      <PlateCalculatorModal
        isOpen={showPlateCalc}
        onClose={() => setShowPlateCalc(false)}
      />
    </>
  );
}
