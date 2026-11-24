import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { WorkoutProgram } from '../types/index.ts';
import {
  decodeProgramSharePayload,
  encodeProgramShareCode,
  encodeProgramsShareCode,
  formatProgramPlainText,
  prepareImportedProgram,
} from './programShare.ts';

const SAMPLE_PROGRAM: WorkoutProgram = {
  id: 'prog-orig',
  name: 'Upper Lower Power',
  goal: 'Strength',
  theme: 'from-primary-500 to-primary-700',
  status: 'active',
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  days: [
    {
      id: 'day-1',
      name: 'Upper A',
      order: 0,
      isDeloadDay: false,
      exercises: [
        {
          id: 'ex-1',
          name: 'Pull-Up',
          primaryMuscle: 'Lats',
          secondaryMuscles: ['Biceps'],
          muscleGroup: ['Lats', 'Biceps'],
          trackingMode: 'bodyweight_reps',
          supersetId: 'sup-a',
          supersetOrder: 0,
          notes: 'Chest to bar',
          restTimerConfig: 90,
          lastUpdated: 1_700_000_000_000,
          history: [
            {
              sessionId: 'old-sess',
              date: 1_699_000_000_000,
              sets: [{ id: 'hs-1', weight: 10, reps: 8, completed: true }],
            },
          ],
          sets: [{ id: 's-1', weight: 10, reps: 8, completed: true }],
        },
        {
          id: 'ex-2',
          name: 'Forearm Plank',
          primaryMuscle: 'Abdominals',
          secondaryMuscles: [],
          trackingMode: 'timed',
          supersetId: 'sup-a',
          supersetOrder: 1,
          notes: '',
          restTimerConfig: 60,
          lastUpdated: 1_700_000_000_000,
          history: [],
          sets: [{ id: 's-2', weight: 0, reps: 1, duration: 45, completed: true }],
        },
      ],
    },
  ],
};

describe('programShare encode/decode roundtrip', () => {
  it('encodes single program with DRG2: and preserves trackingMode, duration, and supersetId while stripping history', async () => {
    const encoded = await encodeProgramShareCode(SAMPLE_PROGRAM);
    assert.ok(encoded.code.startsWith('DRG2:'));
    assert.equal(encoded.fitsQR, true);

    const decoded = await decodeProgramSharePayload(encoded.code);
    assert.equal(decoded.sourceType, 'single');
    assert.equal(decoded.programs.length, 1);

    const prog = decoded.programs[0];
    assert.equal(prog.name, 'Upper Lower Power');
    assert.equal(prog.days[0].exercises[0].history.length, 0);
    assert.equal(prog.days[0].exercises[0].trackingMode, 'bodyweight_reps');
    assert.equal(prog.days[0].exercises[0].sets[0].completed, false);
    assert.equal(prog.days[0].exercises[1].trackingMode, 'timed');
    assert.equal(prog.days[0].exercises[1].sets[0].duration, 45);
    assert.equal(prog.days[0].exercises[0].supersetId, prog.days[0].exercises[1].supersetId);
  });

  it('decodes legacy multi-program DRG2 payloads and plain JSON payloads', async () => {
    const multi = await encodeProgramsShareCode([SAMPLE_PROGRAM]);
    const decodedMulti = await decodeProgramSharePayload(multi.code);
    assert.equal(decodedMulti.sourceType, 'multi');
    assert.equal(decodedMulti.programs.length, 1);

    const decodedRawJson = await decodeProgramSharePayload(JSON.stringify(SAMPLE_PROGRAM));
    assert.equal(decodedRawJson.sourceType, 'single');
    assert.equal(decodedRawJson.programs[0].name, 'Upper Lower Power');
  });

  it('rejects empty or malformed payloads with descriptive errors', async () => {
    await assert.rejects(() => decodeProgramSharePayload('   '), /Paste a Dragoriano/);
    await assert.rejects(() => decodeProgramSharePayload('DRG2:not-valid-base64!!!'), /decompress/);
    await assert.rejects(() => decodeProgramSharePayload('{"foo":"bar"}'), /Unrecognized/);
  });
});

describe('prepareImportedProgram & formatProgramPlainText', () => {
  it('generates fresh UUIDs while keeping superset relationships intact', () => {
    let n = 0;
    const imported = prepareImportedProgram(SAMPLE_PROGRAM, {
      status: 'paused',
      createId: () => `new-${++n}`,
    });

    assert.notEqual(imported.id, SAMPLE_PROGRAM.id);
    assert.equal(imported.status, 'paused');
    const [ex1, ex2] = imported.days[0].exercises;
    assert.notEqual(ex1.id, 'ex-1');
    assert.ok(ex1.supersetId);
    assert.notEqual(ex1.supersetId, 'sup-a');
    assert.equal(ex1.supersetId, ex2.supersetId);
    assert.equal(ex2.supersetOrder, 1);
    assert.equal(ex1.sets[0].completed, false);
  });

  it('formats a readable plain-text program summary', () => {
    const text = formatProgramPlainText(SAMPLE_PROGRAM, 'kg');
    assert.ok(text.includes('Upper Lower Power (Strength)'));
    assert.ok(text.includes('Pull-Up'));
    assert.ok(text.includes('45s'));
  });
});
