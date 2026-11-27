let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new Ctor();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

function playTone(
  ctx: AudioContext,
  freqStart: number,
  freqEnd: number,
  startOffsetSec: number,
  durationSec: number,
  peakGain: number,
  type: OscillatorType = 'sine',
): void {
  const startAt = ctx.currentTime + startOffsetSec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, startAt);
  if (freqEnd !== freqStart) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), startAt + durationSec);
  }
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.linearRampToValueAtTime(peakGain, startAt + Math.min(0.015, durationSec * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + durationSec + 0.02);
}

/**
 * Tactile two-note confirmation ping when completing a set.
 */
export function playSetCompleteCue(enabled: boolean): void {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    playTone(ctx, 587.33, 880, 0, 0.11, 0.28, 'triangle');
  } catch {
    // Ignore audio context errors on restricted browsers
  }
}

/**
 * Crisp quartz-style pulse for the final 3-2-1 seconds of rest.
 */
export function playCountdownTick(secondsLeft: number, enabled: boolean): void {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const freq = secondsLeft <= 1 ? 820 : 660;
    playTone(ctx, freq, freq, 0, 0.065, 0.24, 'triangle');
  } catch {
    // Ignore audio context errors
  }
}

/**
 * Ascending harmonic 3-note triad when rest or timed hold target completes.
 */
export function playRestFinishChime(enabled: boolean): void {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    playTone(ctx, 523.25, 523.25, 0.0, 0.16, 0.3, 'sine');
    playTone(ctx, 659.25, 659.25, 0.11, 0.18, 0.32, 'sine');
    playTone(ctx, 783.99, 783.99, 0.22, 0.26, 0.36, 'sine');
  } catch {
    // Ignore audio context errors
  }
}

/**
 * Bright 4-note arpeggio fanfare for live in-session Personal Records.
 */
export function playPRFanfare(enabled: boolean): void {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    playTone(ctx, 523.25, 523.25, 0.0, 0.14, 0.28, 'triangle');
    playTone(ctx, 659.25, 659.25, 0.09, 0.14, 0.3, 'triangle');
    playTone(ctx, 783.99, 783.99, 0.18, 0.16, 0.32, 'triangle');
    playTone(ctx, 1046.5, 1046.5, 0.27, 0.28, 0.36, 'sine');
  } catch {
    // Ignore audio context errors
  }
}

import { triggerNativeHaptic } from './nativeHardware';

export type HapticKind = 'set' | 'tick' | 'rest_done' | 'pr';

const HAPTIC_PATTERNS: Record<HapticKind, number | number[]> = {
  set: 35,
  tick: 18,
  rest_done: [160, 80, 160, 80, 240],
  pr: [70, 40, 70, 40, 180],
};

/**
 * Native Capacitor Haptics + Web navigator.vibrate wrapper for tactile gym feedback.
 */
export function triggerHaptic(kind: HapticKind, enabled: boolean): void {
  if (!enabled || typeof window === 'undefined') return;
  const pattern = kind === 'pr' ? 'pr' : kind === 'rest_done' ? 'rest_done' : 'tap';
  triggerNativeHaptic(pattern)
    .then((handled) => {
      if (handled) return;
      try {
        window.navigator.vibrate?.(HAPTIC_PATTERNS[kind]);
      } catch {
        // Ignore unsupported platforms
      }
    })
    .catch(() => {
      try {
        window.navigator.vibrate?.(HAPTIC_PATTERNS[kind]);
      } catch {
        // Ignore unsupported platforms
      }
    });
}
