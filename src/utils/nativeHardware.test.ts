import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  acquireWorkoutWakeLock,
  cancelBackgroundRestAlert,
  canSendRestNotification,
  releaseWorkoutWakeLock,
  requestRestNotificationPermission,
  scheduleBackgroundRestAlert,
  triggerNativeHaptic,
} from './nativeHardware.ts';

describe('nativeHardware SSR/headless safety', () => {
  it('gracefully no-ops in Node/headless environments without window or plugins', async () => {
    assert.equal(await acquireWorkoutWakeLock(), false);
    await releaseWorkoutWakeLock();
    assert.equal(await requestRestNotificationPermission(), false);
    assert.equal(canSendRestNotification(), false);
    assert.equal(await scheduleBackgroundRestAlert(Date.now() + 10_000), false);
    await cancelBackgroundRestAlert();
    assert.equal(await triggerNativeHaptic('tap'), false);
  });

  it('invokes Capacitor KeepAwake / LocalNotifications / Haptics when mocked on window.Capacitor', async () => {
    const calls: string[] = [];
    (globalThis as Record<string, unknown>).window = {
      Capacitor: {
        isNativePlatform: () => true,
        Plugins: {
          KeepAwake: {
            keepAwake: async () => {
              calls.push('keepAwake');
            },
            allowSleep: async () => {
              calls.push('allowSleep');
            },
          },
          LocalNotifications: {
            requestPermissions: async () => ({ display: 'granted' }),
            schedule: async () => {
              calls.push('schedule');
            },
            cancel: async () => {
              calls.push('cancel');
            },
          },
          Haptics: {
            notification: async () => {
              calls.push('haptic-success');
            },
          },
        },
      },
    };

    try {
      assert.equal(await acquireWorkoutWakeLock(), true);
      await releaseWorkoutWakeLock();
      assert.equal(await requestRestNotificationPermission(), true);
      assert.equal(canSendRestNotification(), true);
      assert.equal(await scheduleBackgroundRestAlert(Date.now() + 5000, 'Done', 'Go'), true);
      await cancelBackgroundRestAlert();
      assert.equal(await triggerNativeHaptic('rest_done'), true);

      assert.deepEqual(calls, [
        'keepAwake',
        'allowSleep',
        'cancel',
        'schedule',
        'cancel',
        'haptic-success',
      ]);
    } finally {
      delete (globalThis as Record<string, unknown>).window;
    }
  });
});
