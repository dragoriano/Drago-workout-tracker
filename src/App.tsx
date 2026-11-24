import { useState, useEffect } from 'react';
import { AppRouter } from './app/router';
import { applyThemeColor, applyThemeMode } from './utils/theme';
import { useAppStore } from './store/useAppStore';

export default function App() {
  const [minHoldDone, setMinHoldDone] = useState(false);
  const [forceDismissSplash, setForceDismissSplash] = useState(false);
  const hydrate = useAppStore((s) => s.hydrate);
  const isHydrated = useAppStore((s) => s.isHydrated);
  const settings = useAppStore((s) => s.settings);

  const showSplash = !forceDismissSplash && !(isHydrated && minHoldDone);

  useEffect(() => {
    console.log('App Initialized. Base URL:', import.meta.env.BASE_URL);
    hydrate().then(async () => {
      console.log('[App] Hydration finished in App.tsx');

      // Auto-sync on startup if online and authenticated
      if (navigator.onLine) {
        try {
          const { supabase } = await import('./supabase/supabaseClient');
          if (supabase) {
            const { data } = await supabase.auth.getSession();
            if (data.session?.user) {
              // Check if we have local data in the Zustand store
              const store = useAppStore.getState();
              const hasLocalData = store.programs.length > 0 || store.sessions.length > 0;

              if (!hasLocalData) {
                console.log('[App] Local database is empty. Attempting recovery pull from Supabase...');
                const { pullFromSupabase } = await import('./storage/supabaseSync');
                await pullFromSupabase(data.session.user.id);
                // Re-hydrate the store with the newly restored data
                await hydrate();
                console.log('[App] Recovery pull and hydration complete.');
              } else {
                console.log('[App] Local database contains data. Syncing backup to Supabase...');
                const { pushToSupabase } = await import('./storage/supabaseSync');
                await pushToSupabase(data.session.user.id);
                console.log('[App] Auto-sync backup push complete.');
              }
            }
          }
        } catch (err) {
          console.error('[App] Auto-sync failed on startup:', err);
        }
      }
    });
  }, [hydrate]);

  // Listen for online events to trigger auto-sync
  useEffect(() => {
    const handleOnline = async () => {
      console.log('[App] Device went online. Triggering auto-sync...');
      try {
        const { supabase } = await import('./supabase/supabaseClient');
        if (!supabase) return;
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          // Only push online updates if we actually have local data to backup
          const store = useAppStore.getState();
          const hasLocalData = store.programs.length > 0 || store.sessions.length > 0;
          if (hasLocalData) {
            const { pushToSupabase } = await import('./storage/supabaseSync');
            await pushToSupabase(data.session.user.id);
            console.log('[App] Auto-sync complete on online event.');
          }
        }
      } catch (err) {
        console.error('[App] Auto-sync failed on online event:', err);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Reactively apply theme settings whenever they change
  useEffect(() => {
    if (settings) {
      applyThemeColor(settings.themeColor);
      applyThemeMode(settings.theme);
    } else {
      // Fallback for pre-hydration or empty state
      applyThemeMode('dark');
    }
  }, [settings]);

  // Capacitor Native Integration
  useEffect(() => {
    // Only run on native platforms to prevent redundant console errors on web
    const isNative = (window as any).Capacitor?.isNativePlatform?.();
    if (!isNative) return;

    // 1. Status Bar Styling
    const setupNativeUI = async () => {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#09090b' });
      } catch (e) {
        console.debug('Native Status Bar error:', e);
      }
    };
    setupNativeUI();

    // 2. Hardware Back Button Handling
    let backListener: any;
    const setupBackBtn = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        backListener = await CapApp.addListener('backButton', () => {
          // Normalize pathname for different platform roots
          const path = window.location.pathname;
          if (path === '/' || path.endsWith('/index.html') || path === '') {
            CapApp.exitApp();
          } else {
            window.history.back();
          }
        });
      } catch (e) {
        console.debug('Native Back Button error:', e);
      }
    };
    setupBackBtn();

    return () => {
      if (backListener) backListener.remove();
    };
  }, []);

  useEffect(() => {
    const minTimer = setTimeout(() => setMinHoldDone(true), 250);
    const maxTimer = setTimeout(() => {
      console.log('[App] Fallback timer triggered - forcing splash end');
      setForceDismissSplash(true);
    }, 3000);
    return () => {
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
    };
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      {/* Global Ambient Backdrop */}
      <div
        aria-hidden="true"
        className="ambient-backdrop pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        <div className="ambient-orb-1" />
        <div className="ambient-orb-2" />
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 h-full w-full">
        {showSplash ? (
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black px-6 text-center">
            <div className="relative flex h-24 w-24 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-primary-500/20 blur-xl animate-pulse" />
              <div className="h-20 w-20 animate-spin rounded-full border-4 border-primary-500/30 border-t-primary-500" />
            </div>
            <h1 className="mt-6 text-2xl font-black uppercase tracking-[0.28em] text-primary-400">
              DRAGORIANO
            </h1>
            <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.35em] text-zinc-500">
              Workout Tracker
            </p>
          </div>
        ) : (
          <div className="h-full w-full">
            <AppRouter />
          </div>
        )}
      </div>
    </div>
  );
}

