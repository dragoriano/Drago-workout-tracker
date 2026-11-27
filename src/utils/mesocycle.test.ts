import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { startOfDay } from 'date-fns';
import {
  buildMesocycleWeeks,
  computeMesocycleProgress,
  createDefaultMesocycle,
} from './mesocycle.ts';
import type { WorkoutProgram, WorkoutSession } from '../types/index.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const BASE_DAY = startOfDay(new Date('2026-10-01T10:00:00Z')).getTime();

function makeBlockSession(
  id: string,
  dayOffset: number,
  benchWeight: number,
  totalVolume: number,
  prs = 0,
): WorkoutSession {
  return {
    id,
    programId: 'prog-1',
    dayId: 'day-1',
    workoutName: 'Push A',
    date: BASE_DAY + dayOffset * DAY_MS + 3_600_000,
    duration: 3600,
    totalVolume,
    PRs: Array.from({ length: prs }, (_, idx) => ({
      exerciseId: 'ex-bench',
      exerciseName: 'Barbell Flat Standard Bench Press',
      type: 'weight',
      value: benchWeight + idx,
      previousValue: benchWeight - 2.5,
    })),
    exercisesSnapshot: [
      {
        id: 'ex-bench',
        name: 'Barbell Flat Standard Bench Press',
        muscleGroup: ['Chest'],
        primaryMuscle: 'Mid Chest',
        notes: '',
        history: [],
        restTimerConfig: 90,
        lastUpdated: BASE_DAY,
        sets: [
          {
            id: `set-${id}`,
            weight: benchWeight,
            reps: 5,
            completed: true,
            setType: 'working',
          },
        ],
      },
    ],
  };
}

describe('buildMesocycleWeeks', () => {
  it('builds a 6-week hypertrophy block with accumulation, intensification, peak, and final deload', () => {
    const weeks = buildMesocycleWeeks({
      totalWeeks: 6,
      includeDeloadWeek: true,
      goalFocus: 'hypertrophy',
    });

    assert.equal(weeks.length, 6);
    assert.equal(weeks[0].phase, 'accumulation');
    assert.equal(weeks[3].phase, 'intensification');
    assert.equal(weeks[4].phase, 'peak');
    assert.equal(weeks[5].phase, 'deload');
    assert.equal(weeks[5].isDeload, true);
    assert.equal(weeks[0].isDeload, false);
  });

  it('omits deload week when includeDeloadWeek is false', () => {
    const weeks = buildMesocycleWeeks({
      totalWeeks: 4,
      includeDeloadWeek: false,
      goalFocus: 'strength',
    });

    assert.equal(weeks.length, 4);
    assert.equal(weeks.some((w) => w.isDeload), false);
    assert.equal(weeks[3].phase, 'peak');
  });
});

describe('computeMesocycleProgress', () => {
  it('returns null when program has no mesocycle', () => {
    const prog: Pick<WorkoutProgram, 'id' | 'mesocycle'> = { id: 'prog-1' };
    assert.equal(computeMesocycleProgress(prog, [], BASE_DAY), null);
  });

  it('tracks mid-block week, completion status, volume growth, and e1RM gains', () => {
    const mesocycle = createDefaultMesocycle('Upper Lower', 4, true, 'strength', BASE_DAY);
    const prog: Pick<WorkoutProgram, 'id' | 'mesocycle'> = { id: 'prog-1', mesocycle };

    const sessions = [
      makeBlockSession('s1', 1, 90, 4000, 0),   // Week 1
      makeBlockSession('s2', 8, 95, 4800, 1),   // Week 2
      makeBlockSession('s3', 15, 100, 5200, 1), // Week 3 (peak before W4 deload)
      // Out-of-program session must be ignored
      { ...makeBlockSession('other', 15, 140, 9000, 2), programId: 'prog-2' },
    ];

    const summary = computeMesocycleProgress(prog, sessions, BASE_DAY + 15 * DAY_MS);
    assert.ok(summary);
    assert.equal(summary.currentWeek, 3);
    assert.equal(summary.isCompleted, false);
    assert.equal(summary.currentWeekSpec.phase, 'peak');
    assert.equal(summary.blockSessionsCount, 3);
    assert.equal(summary.blockTotalVolume, 14000);
    assert.equal(summary.blockPRCount, 2);
    assert.equal(summary.recap.volumeGrowthPct, 30);
    assert.ok(summary.recap.topLiftGain && summary.recap.topLiftGain.delta > 10);
  });

  it('marks block completed once full duration elapses or completedAt is set', () => {
    const mesocycle = createDefaultMesocycle('PPL', 4, true, 'recomp', BASE_DAY);
    const prog: Pick<WorkoutProgram, 'id' | 'mesocycle'> = { id: 'prog-1', mesocycle };

    const finished = computeMesocycleProgress(prog, [], BASE_DAY + 29 * DAY_MS);
    assert.ok(finished);
    assert.equal(finished.isCompleted, true);
    assert.equal(finished.progressPct, 100);
    assert.equal(finished.daysRemaining, 0);
    assert.equal(finished.weeklyBreakdown.every((w) => w.status === 'completed'), true);
  });
});
