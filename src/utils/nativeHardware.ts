export interface HardwareWakeLockSentinel {
  release?: () => Promise<void> | void;
  released?: boolean;
}

let activeWakeLock: HardwareWakeLockSentinel | null = null;
let pendingRestNotificationTimeout: ReturnType<typeof setTimeout> | null = null;
const REST_NOTIFICATION_ID = 9001;

function getCapacitorPlugins(): Record<string, any> | null {
  if (typeof window === 'undefined') return null;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: Record<string, any> } }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins ?? null;
}

export async function acquireWorkoutWakeLock(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const plugins = getCapacitorPlugins();
  if (plugins?.KeepAwake?.keepAwake) {
    try {
      await plugins.KeepAwake.keepAwake();
      return true;
    } catch {
      // fall back to Web Screen Wake Lock API
    }
  }

  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<HardwareWakeLockSentinel> };
    };
    if (!nav.wakeLock?.request) return false;
    if (activeWakeLock && activeWakeLock.released === false) return true;
    activeWakeLock = await nav.wakeLock.request('screen');
    return true;
  } catch {
    return false;
  }
}

export async function releaseWorkoutWakeLock(): Promise<void> {
  const plugins = getCapacitorPlugins();
  if (plugins?.KeepAwake?.allowSleep) {
    try {
      await plugins.KeepAwake.allowSleep();
    } catch {
      // ignore native cleanup errors
    }
  }

  if (activeWakeLock?.release) {
    try {
      await activeWakeLock.release();
    } catch {
      // ignore browser cleanup errors
    }
    activeWakeLock = null;
  }
}

export async function requestRestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const plugins = getCapacitorPlugins();
  if (plugins?.LocalNotifications?.requestPermissions) {
    try {
      const res = await plugins.LocalNotifications.requestPermissions();
      return res?.display === 'granted';
    } catch {
      return false;
    }
  }

  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  try {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  } catch {
    return false;
  }
}

export function canSendRestNotification(): boolean {
  if (typeof window === 'undefined') return false;
  const plugins = getCapacitorPlugins();
  if (plugins?.LocalNotifications) return true;
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

export async function cancelBackgroundRestAlert(): Promise<void> {
  if (pendingRestNotificationTimeout !== null) {
    clearTimeout(pendingRestNotificationTimeout);
    pendingRestNotificationTimeout = null;
  }

  const plugins = getCapacitorPlugins();
  if (plugins?.LocalNotifications?.cancel) {
    try {
      await plugins.LocalNotifications.cancel({
        notifications: [{ id: REST_NOTIFICATION_ID }],
      });
    } catch {
      // ignore cancel errors
    }
  }
}

export async function scheduleBackgroundRestAlert(
  endTimeMs: number,
  title = 'Rest Complete',
  body = 'Time to hit your next set.',
): Promise<boolean> {
  await cancelBackgroundRestAlert();
  if (typeof window === 'undefined') return false;

  const delayMs = endTimeMs - Date.now();
  if (!Number.isFinite(delayMs) || delayMs <= 500) return false;

  const plugins = getCapacitorPlugins();
  if (plugins?.LocalNotifications?.schedule) {
    try {
      await plugins.LocalNotifications.schedule({
        notifications: [
          {
            id: REST_NOTIFICATION_ID,
            title,
            body,
            schedule: { at: new Date(endTimeMs), allowWhileIdle: true },
          },
        ],
      });
      return true;
    } catch {
      // fall through to Web Notification API
    }
  }

  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return false;
  }

  pendingRestNotificationTimeout = setTimeout(() => {
    pendingRestNotificationTimeout = null;
    if (typeof document !== 'undefined' && document.hidden) {
      try {
        new Notification(title, {
          body,
          tag: 'dragoriano-rest-timer',
        });
      } catch {
        // ignore restricted browser notifications
      }
    }
  }, delayMs);

  return true;
}

export async function triggerNativeHaptic(pattern: 'tap' | 'pr' | 'rest_done'): Promise<boolean> {
  const plugins = getCapacitorPlugins();
  if (plugins?.Haptics) {
    try {
      if (pattern === 'pr' || pattern === 'rest_done') {
        if (plugins.Haptics.notification) {
          await plugins.Haptics.notification({ type: 'SUCCESS' });
          return true;
        }
      } else if (plugins.Haptics.impact) {
        await plugins.Haptics.impact({ style: 'LIGHT' });
        return true;
      }
    } catch {
      // fall through to navigator.vibrate
    }
  }
  return false;
}
