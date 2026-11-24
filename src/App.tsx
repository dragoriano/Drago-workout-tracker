import { useState, useEffect, lazy, Suspense } from 'react';
import { Toaster } from 'sonner';
import { AppRouter } from './app/router';
import { applyThemeColor, applyThemeMode } from './utils/theme';
import { useAppStore } from './store/useAppStore';

const ThreeSplashScreen = lazy(() =>
  import('./components/ui/ThreeSplashScreen').then((m) => ({ default: m.ThreeSplashScreen })),
);

const THEME_CACHE_KEY = 'dragoriano_theme_cache';

function readCachedTheme(): { themeColor: string; theme: 'dark' | 'light' | 'system' } {
  try {
    const raw = localStorage.getItem(THEME_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        themeColor: typeof parsed.themeColor === 'string' ? parsed.themeColor : 'emerald',
        theme:
          parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'system'
            ? parsed.theme
            : 'dark',
      };
    }
  } catch {
    // ignore storage failures
  }
  return { themeColor: 'emerald', theme: 'dark' };
}

export default function App() {
  const [cachedTheme] = useState(readCachedTheme);
  const [splashFinished, setSplashFinished] = useState(false);
  const [forceDismissSplash, setForceDismissSplash] = useState(false);
  const hydrate = useAppStore((s) => s.hydrate);
  const settings = useAppStore((s) => s.settings);

  const showSplash = !forceDismissSplash && !splashFinished;
  const effectiveThemeColor = settings?.themeColor ?? cachedTheme.themeColor;
  const effectiveMode = settings?.theme ?? cachedTheme.theme;

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

  // Reactively apply theme settings and cache for instant splash sync on next launch
  useEffect(() => {
    applyThemeColor(effectiveThemeColor);
    applyThemeMode(effectiveMode);

    if (settings) {
      try {
        localStorage.setItem(
          THEME_CACHE_KEY,
          JSON.stringify({ themeColor: settings.themeColor, theme: settings.theme }),
        );
      } catch {
        // ignore storage quota errors
      }
    }

    const isDark =
      effectiveMode === 'dark' ||
      (effectiveMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

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
  }, [effectiveThemeColor, effectiveMode, settings]);

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
    const maxTimer = setTimeout(() => {
      console.log('[App] Safety fallback timer triggered - forcing splash end');
      setForceDismissSplash(true);
    }, 12000);
    return () => {
      clearTimeout(maxTimer);
    };
  }, []);

  const isLightMode =
    effectiveMode === 'light' ||
    (effectiveMode === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches);

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

      {/* Main Content Area (mounted behind splash so dismissal is instantaneous) */}
      <div className="relative z-10 h-full w-full">
        <div className="h-full w-full">
          <AppRouter />
        </div>

        {showSplash && (
          <Suspense
            fallback={
              <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-page/80 px-6 text-center backdrop-blur-2xl">
                <h1 className="text-3xl font-black uppercase tracking-[0.26em] text-primary-400">
                  DRAGORIANO
                </h1>
                <p className="mt-2 text-xs font-bold uppercase tracking-[0.38em] text-muted">
                  Workout Tracker
                </p>
              </div>
            }
          >
            <ThreeSplashScreen
              themeColor={effectiveThemeColor}
              isLightMode={isLightMode}
              durationMs={5000}
              onComplete={() => setSplashFinished(true)}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}

