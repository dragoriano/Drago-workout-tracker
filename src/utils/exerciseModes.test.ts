import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSetWorkingVolume,
  formatDurationCompact,
  formatSetSummary,
  getExerciseTrackingMode,
  inferTrackingModeFromName,
  stepSetDuration,
  supportsEstimated1RM,
} from './exerciseModes.ts';

describe('getExerciseTrackingMode & inferTrackingModeFromName', () => {
  it('defaults omitted trackingMode to weight_reps', () => {
    assert.equal(getExerciseTrackingMode(undefined), 'weight_reps');
    assert.equal(getExerciseTrackingMode({}), 'weight_reps');
    assert.equal(getExerciseTrackingMode({ trackingMode: 'timed' }), 'timed');
  });

  it('infers timed, assisted, bodyweight, and weighted exercises accurately', () => {
    assert.equal(inferTrackingModeFromName('Forearm Plank'), 'timed');
    assert.equal(inferTrackingModeFromName('Dead Hang Hold'), 'timed');
    assert.equal(inferTrackingModeFromName('Farmers Walk'), 'timed');
    assert.equal(inferTrackingModeFromName('Machine Assisted Pull-Up'), 'assisted_reps');
    assert.equal(inferTrackingModeFromName('Band-Assisted Dip'), 'assisted_reps');
    assert.equal(inferTrackingModeFromName('Push-Up'), 'bodyweight_reps');
    assert.equal(inferTrackingModeFromName('Custom Movement', 'Bodyweight'), 'bodyweight_reps');
    assert.equal(inferTrackingModeFromName('Weighted Dip'), 'weight_reps');
    assert.equal(inferTrackingModeFromName('Barbell Pull-Up Row'), 'weight_reps');
    assert.equal(inferTrackingModeFromName('Barbell Back Squat'), 'weight_reps');
  });
});

describe('formatDurationCompact & formatSetSummary', () => {
  it('formats durations cleanly across seconds and minutes', () => {
    assert.equal(formatDurationCompact(0), '0s');
    assert.equal(formatDurationCompact(45), '45s');
    assert.equal(formatDurationCompact(60), '1:00');
    assert.equal(formatDurationCompact(95), '1:35');
  });

  it('formats set summaries per tracking mode', () => {
    assert.equal(
      formatSetSummary({ weight: 80, reps: 8 }, 'weight_reps', 'kg'),
      '80kg × 8',
    );
    assert.equal(
      formatSetSummary({ weight: 0, reps: 15 }, 'bodyweight_reps', 'kg'),
      'BW × 15',
    );
    assert.equal(
      formatSetSummary({ weight: 15, reps: 10 }, 'bodyweight_reps', 'kg'),
      'BW+15kg × 10',
    );
    assert.equal(
      formatSetSummary({ weight: 25, reps: 8 }, 'assisted_reps', 'lbs'),
      '-25lbs × 8',
    );
    assert.equal(
      formatSetSummary({ weight: 0, reps: 1, duration: 75 }, 'timed', 'kg'),
      '1:15',
    );
    assert.equal(
      formatSetSummary({ weight: 20, reps: 1, duration: 40 }, 'timed', 'kg'),
      '20kg · 40s',
    );
  });
});

describe('calculateSetWorkingVolume, supportsEstimated1RM, stepSetDuration', () => {
  it('excludes assisted, timed, warmup, and incomplete sets from working volume', () => {
    assert.equal(
      calculateSetWorkingVolume({ weight: 100, reps: 5, completed: true }, 'weight_reps'),
      500,
    );
    assert.equal(
      calculateSetWorkingVolume({ weight: 10, reps: 12, completed: true }, 'bodyweight_reps'),
      120,
    );
    assert.equal(
      calculateSetWorkingVolume({ weight: 0, reps: 12, completed: true }, 'bodyweight_reps'),
      0,
    );
    assert.equal(
      calculateSetWorkingVolume({ weight: 30, reps: 10, completed: true }, 'assisted_reps'),
      0,
    );
    assert.equal(
      calculateSetWorkingVolume({ weight: 20, reps: 1, completed: true }, 'timed'),
      0,
    );
    assert.equal(
      calculateSetWorkingVolume({ weight: 100, reps: 5, completed: true, setType: 'warmup' }, 'weight_reps'),
      0,
    );
    assert.equal(
      calculateSetWorkingVolume({ weight: 100, reps: 5, completed: false }, 'weight_reps'),
      0,
    );
  });

  it('restricts e1RM support to weight_reps and clamps duration steps at zero', () => {
    assert.equal(supportsEstimated1RM('weight_reps'), true);
    assert.equal(supportsEstimated1RM('bodyweight_reps'), false);
    assert.equal(supportsEstimated1RM('assisted_reps'), false);
    assert.equal(supportsEstimated1RM('timed'), false);

    assert.equal(stepSetDuration(45, 5), 50);
    assert.equal(stepSetDuration(3, -10), 0);
  });
});
