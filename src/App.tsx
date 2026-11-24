import { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
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
    const mode = settings?.theme ?? 'dark';
    applyThemeColor(settings?.themeColor ?? 'emerald');
    applyThemeMode(mode);

    const isDark =
      mode === 'dark' ||
      (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', isDark ? '#070a10' : '#e8eef6');
    }

    const isNative = (window as any).Capacitor?.isNativePlatform?.();
    if (isNative) {
      import('@capacitor/status-bar')
        .then(async ({ StatusBar, Style }) => {
          await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
          await StatusBar.setBackgroundColor({ color: isDark ? '#070a10' : '#e8eef6' });
        })
        .catch(() => {});
    }
  }, [settings]);

  // Capacitor Native Back Button Integration
  useEffect(() => {
    const isNative = (window as any).Capacitor?.isNativePlatform?.();
    if (!isNative) return;

    let backListener: any;
    const setupBackBtn = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        backListener = await CapApp.addListener('backButton', () => {
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

  const isLightMode =
    settings?.theme === 'light' ||
    (settings?.theme === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div className="fixed inset-0 overflow-hidden bg-page">
      {/* Blurred Atmospheric Liquid Mesh Backdrop */}
      <div
        aria-hidden="true"
        className="liquid-mesh pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <div className="liquid-blob-1" />
        <div className="liquid-blob-2" />
        <div className="liquid-blob-3" />
      </div>

      <Toaster
        position="top-center"
        theme={isLightMode ? 'light' : 'dark'}
        toastOptions={{
          style: {
            background: 'var(--bg-elevated)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
            borderRadius: '1rem',
          },
        }}
      />

      {/* Main Content Area */}
      <div className="relative z-10 h-full w-full">
        {showSplash ? (
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-page/75 backdrop-blur-2xl px-6 text-center">
            <div className="relative flex h-24 w-24 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-primary-500/25 blur-xl animate-pulse" />
              <div className="h-20 w-20 animate-spin rounded-full border-4 border-primary-500/30 border-t-primary-500" />
            </div>
            <h1 className="mt-6 text-2xl font-black uppercase tracking-[0.28em] text-primary-400">
              DRAGORIANO
            </h1>
            <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.35em] text-muted">
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

