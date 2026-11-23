import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { format } from 'date-fns';
import {
  escapeCsvField,
  formatSessionsToCSV,
  recalculateSessionMetrics,
} from './sessionExport.ts';
import { FREESTYLE_PROGRAM_ID } from './customExercises.ts';
import type { WorkoutProgram, WorkoutSession } from '../types/index.ts';

const DAY = 86_400_000;
const BASE_TS = new Date(2026, 4, 10, 9, 30).getTime();

function makeSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 'sess-1',
    programId: 'prog-1',
    dayId: 'day-1',
    date: BASE_TS,
    totalVolume: 0,
    PRs: [],
    duration: 2700,
    exercisesSnapshot: [],
    ...overrides,
  };
}

describe('recalculateSessionMetrics', () => {
  it('recomputes totalVolume excluding warmup and incomplete sets while including drop and failure sets', () => {
    const edited = makeSession({
      id: 's-edit',
      date: BASE_TS + DAY,
      totalVolume: 9999,
      exercisesSnapshot: [
        {
          id: 'ex-1',
          name: 'Bench Press',
          notes: '',
          restTimerConfig: 90,
          lastUpdated: BASE_TS,
          history: [],
          sets: [
            { id: 'w1', weight: 60, reps: 10, completed: true, setType: 'warmup' },
            { id: 's1', weight: 100, reps: 5, completed: true, setType: 'working' },
            { id: 'd1', weight: 80, reps: 8, completed: true, setType: 'drop' },
            { id: 'f1', weight: 70, reps: 10, completed: true, setType: 'failure' },
            { id: 'inc', weight: 120, reps: 5, completed: false, setType: 'working' },
          ],
        },
      ],
    });

    const result = recalculateSessionMetrics(edited, [edited]);
    assert.equal(result.totalVolume, 100 * 5 + 80 * 8 + 70 * 10);
  });

  it('recomputes weight and 1rm PRs case-insensitively against strictly earlier sessions and ignores earlier warmups/incomplete sets', () => {
    const earlier = makeSession({
      id: 's-early',
      date: BASE_TS,
      exercisesSnapshot: [
        {
          id: 'ex-early-bench',
          name: 'Bench Press',
          notes: '',
          restTimerConfig: 90,
          lastUpdated: BASE_TS,
          history: [],
          sets: [
            // Heavy warmup and incomplete sets must not block later PRs
            { id: 'ew1', weight: 140, reps: 5, completed: true, setType: 'warmup' },
            { id: 'ei1', weight: 150, reps: 3, completed: false, setType: 'working' },
            // Real best: 100 x 5 -> weight 100, e1RM 116.7
            { id: 'es1', weight: 100, reps: 5, completed: true, setType: 'working' },
          ],
        },
        {
          id: 'ex-early-squat',
          name: 'Squat',
          notes: '',
          restTimerConfig: 120,
          lastUpdated: BASE_TS,
          history: [],
          sets: [{ id: 'eq1', weight: 120, reps: 5, completed: true, setType: 'working' }], // e1RM 140
        },
      ],
    });

    const future = makeSession({
      id: 's-future',
      date: BASE_TS + 5 * DAY,
      exercisesSnapshot: [
        {
          id: 'ex-future-bench',
          name: 'Bench Press',
          notes: '',
          restTimerConfig: 90,
          lastUpdated: BASE_TS + 5 * DAY,
          history: [],
          sets: [{ id: 'fs1', weight: 200, reps: 5, completed: true, setType: 'working' }],
        },
      ],
    });

    const edited = makeSession({
      id: 's-target',
      date: BASE_TS + 2 * DAY,
      exercisesSnapshot: [
        {
          id: 'ex-target-bench',
          name: '  bench press ',
          notes: '',
          restTimerConfig: 90,
          lastUpdated: BASE_TS + 2 * DAY,
          history: [],
          sets: [
            // Beats weight (105 > 100), does not beat e1RM (105*1.1 = 115.5 < 116.7)
            { id: 'tb1', weight: 105, reps: 3, completed: true, setType: 'working' },
          ],
        },
        {
          id: 'ex-target-squat',
          name: 'squat',
          notes: '',
          restTimerConfig: 120,
          lastUpdated: BASE_TS + 2 * DAY,
          history: [],
          sets: [
            // Beats e1RM (120 * (1 + 8/30) = 152 > 140), does not beat weight (120 === 120)
            { id: 'ts1', weight: 120, reps: 8, completed: true, setType: 'working' },
          ],
        },
        {
          id: 'ex-target-ohp',
          name: 'Overhead Press',
          notes: '',
          restTimerConfig: 90,
          lastUpdated: BASE_TS + 2 * DAY,
          history: [],
          sets: [
            // Only warmup -> no PRs
            { id: 'to1', weight: 50, reps: 5, completed: true, setType: 'warmup' },
          ],
        },
      ],
    });

    const result = recalculateSessionMetrics(edited, [future, edited, earlier]);

    assert.equal(result.totalVolume, 105 * 3 + 120 * 8);
    assert.deepEqual(result.PRs, [
      {
        exerciseId: 'ex-target-bench',
        exerciseName: '  bench press ',
        type: 'weight',
        value: 105,
        previousValue: 100,
      },
      {
        exerciseId: 'ex-target-squat',
        exerciseName: 'squat',
        type: '1rm',
        value: 152,
        previousValue: 140,
      },
    ]);
  });

  it('clears previous PRs when edited session no longer exceeds earlier sessions', () => {
    const earlier = makeSession({
      id: 's1',
      date: BASE_TS,
      exercisesSnapshot: [
        {
          id: 'e1',
          name: 'Deadlift',
          notes: '',
          restTimerConfig: 120,
          lastUpdated: BASE_TS,
          history: [],
          sets: [{ id: 'st1', weight: 180, reps: 5, completed: true }],
        },
      ],
    });

    const edited = makeSession({
      id: 's2',
      date: BASE_TS + DAY,
      PRs: [{ exerciseId: 'e2', exerciseName: 'Deadlift', type: 'weight', value: 190, previousValue: 180 }],
      exercisesSnapshot: [
        {
          id: 'e2',
          name: 'Deadlift',
          notes: '',
          restTimerConfig: 120,
          lastUpdated: BASE_TS + DAY,
          history: [],
          sets: [{ id: 'st2', weight: 160, reps: 3, completed: true }],
        },
      ],
    });

    const result = recalculateSessionMetrics(edited, [earlier, edited]);
    assert.deepEqual(result.PRs, []);
    assert.equal(result.totalVolume, 480);
  });
});

describe('escapeCsvField', () => {
  it('handles nullish values, plain values, commas, double quotes, and newlines per RFC-4180', () => {
    assert.equal(escapeCsvField(undefined), '');
    assert.equal(escapeCsvField(null), '');
    assert.equal(escapeCsvField('Bench Press'), 'Bench Press');
    assert.equal(escapeCsvField(102.5), '102.5');
    assert.equal(escapeCsvField('Push, Pull'), '"Push, Pull"');
    assert.equal(escapeCsvField('Say "Heavy"'), '"Say ""Heavy"""');
    assert.equal(escapeCsvField('Line 1\nLine 2'), '"Line 1\nLine 2"');
    assert.equal(escapeCsvField('Line 1\r\nLine 2'), '"Line 1\r\nLine 2"');
  });
});

describe('formatSessionsToCSV', () => {
  const programs: WorkoutProgram[] = [
    {
      id: 'prog-ppl',
      name: 'PPL, 6-Day',
      theme: 'from-primary-500 to-primary-700',
      status: 'active',
      createdAt: BASE_TS,
      updatedAt: BASE_TS,
      days: [
        {
          id: 'day-push',
          name: 'Push Day',
          order: 0,
          exercises: [],
        },
      ],
    },
  ];

  it('returns only the expected header when sessions list is empty', () => {
    const csv = formatSessionsToCSV([], programs, 'kg');
    assert.equal(
      csv,
      'Date,Time,Workout,Program,Duration (min),Exercise,Set #,Set Type,Weight,Unit,Reps,RPE,Completed,Volume',
    );
  });

  it('sorts sessions descending by date, resolves program/freestyle names, and sets warmup/incomplete volume to 0', () => {
    const olderProgramSession = makeSession({
      id: 's-old',
      programId: 'prog-ppl',
      dayId: 'day-push',
      date: BASE_TS,
      duration: 3000, // 50 min
      exercisesSnapshot: [
        {
          id: 'ex-bench',
          name: 'Bench Press',
          notes: '',
          restTimerConfig: 90,
          lastUpdated: BASE_TS,
          history: [],
          sets: [
            { id: 'w1', weight: 60, reps: 8, completed: true, setType: 'warmup' },
            { id: 's1', weight: 100, reps: 5, completed: true, setType: 'working', rpe: 8.5 },
            { id: 's2', weight: 100, reps: 5, completed: false, setType: 'failure' },
          ],
        },
      ],
    });

    const newerFreestyleTs = BASE_TS + 2 * DAY;
    const newerFreestyleSession = makeSession({
      id: 's-new',
      programId: FREESTYLE_PROGRAM_ID,
      dayId: FREESTYLE_PROGRAM_ID,
      workoutName: 'Arm "Blaster"',
      date: newerFreestyleTs,
      duration: 1800, // 30 min
      exercisesSnapshot: [
        {
          id: 'ex-curl',
          name: 'Bicep Curl',
          notes: '',
          restTimerConfig: 60,
          lastUpdated: newerFreestyleTs,
          history: [],
          sets: [{ id: 'c1', weight: 15, reps: 12, completed: true, setType: 'drop', rpe: 9 }],
        },
      ],
    });

    const csv = formatSessionsToCSV([olderProgramSession, newerFreestyleSession], programs, 'lbs');
    const lines = csv.split('\n');

    assert.equal(lines.length, 5);
    assert.equal(
      lines[0],
      'Date,Time,Workout,Program,Duration (min),Exercise,Set #,Set Type,Weight,Unit,Reps,RPE,Completed,Volume',
    );

    const newDate = format(new Date(newerFreestyleTs), 'yyyy-MM-dd');
    const newTime = format(new Date(newerFreestyleTs), 'HH:mm');
    assert.equal(
      lines[1],
      `${newDate},${newTime},"Arm ""Blaster""",Freestyle,30,Bicep Curl,1,drop,15,lbs,12,9,Yes,180`,
    );

    const oldDate = format(new Date(BASE_TS), 'yyyy-MM-dd');
    const oldTime = format(new Date(BASE_TS), 'HH:mm');
    // Warmup set -> Volume = 0
    assert.equal(
      lines[2],
      `${oldDate},${oldTime},Push Day,"PPL, 6-Day",50,Bench Press,1,warmup,60,lbs,8,,Yes,0`,
    );
    // Working completed set -> Volume = 500
    assert.equal(
      lines[3],
      `${oldDate},${oldTime},Push Day,"PPL, 6-Day",50,Bench Press,2,working,100,lbs,5,8.5,Yes,500`,
    );
    // Incomplete set -> Volume = 0
    assert.equal(
      lines[4],
      `${oldDate},${oldTime},Push Day,"PPL, 6-Day",50,Bench Press,3,failure,100,lbs,5,,No,0`,
    );
  });

  it('uses Quick Workout fallback when freestyle workoutName is omitted', () => {
    const freestyleNoName = makeSession({
      id: 's-fs',
      programId: FREESTYLE_PROGRAM_ID,
      dayId: FREESTYLE_PROGRAM_ID,
      date: BASE_TS,
      duration: 900,
      exercisesSnapshot: [
        {
          id: 'ex-1',
          name: 'Plank',
          notes: '',
          restTimerConfig: 60,
          lastUpdated: BASE_TS,
          history: [],
          sets: [{ id: 'p1', weight: 0, reps: 60, completed: true }],
        },
      ],
    });

    const csv = formatSessionsToCSV([freestyleNoName], programs, 'kg');
    const row = csv.split('\n')[1];
    assert.ok(row.includes(',Quick Workout,Freestyle,15,Plank,1,working,0,kg,60,,Yes,0'));
  });
});
