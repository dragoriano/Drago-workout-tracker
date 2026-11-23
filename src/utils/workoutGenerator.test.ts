import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateWorkoutDays } from './workoutGenerator.ts';

const ALL_SPLITS = [
  { name: 'Push/Pull/Legs (PPL)', days: 6 },
  { name: 'Upper/Lower', days: 4 },
  { name: 'Full Body', days: 3 },
  { name: 'Bro Split', days: 5 },
  { name: 'HIT (Mike Mentzer)', days: 2 },
  { name: 'Bodyweight Only', days: 3 },
  { name: 'Powerbuilding', days: 4 },
  { name: 'Custom', days: 3 },
];

describe('generateWorkoutDays', () => {
  it('generates expected day counts with populated exercises for all supported splits', () => {
    for (const split of ALL_SPLITS) {
      const days = generateWorkoutDays('Muscle Building', split.name, split.days);

      assert.equal(days.length, split.days, `${split.name} day count mismatch`);
      for (const day of days) {
        assert.ok(day.id.length > 0);
        assert.ok(day.exercises.length > 0, `${split.name} day ${day.name} has no exercises`);
      }
    }
  });

  it('produces unique day/exercise/set IDs and distinct references across repeated days and calls', () => {
    const programA = generateWorkoutDays('Muscle Building', 'Push/Pull/Legs (PPL)', 6);
    const programB = generateWorkoutDays('Muscle Building', 'Push/Pull/Legs (PPL)', 6);
    const allDays = [...programA, ...programB];

    const dayIds = allDays.map((d) => d.id);
    const exerciseIds = allDays.flatMap((d) => d.exercises.map((e) => e.id));
    const setIds = allDays.flatMap((d) => d.exercises.flatMap((e) => e.sets.map((s) => s.id)));

    assert.equal(new Set(dayIds).size, dayIds.length);
    assert.equal(new Set(exerciseIds).size, exerciseIds.length);
    assert.equal(new Set(setIds).size, setIds.length);
    assert.notEqual(programA[0].exercises[0], programA[3].exercises[0]);
    assert.notEqual(programA[0].exercises[0].sets[0], programB[0].exercises[0].sets[0]);
  });

  it('hydrates muscle metadata from exercises catalog', () => {
    const days = generateWorkoutDays('Strength', 'Push/Pull/Legs (PPL)', 3);
    const bench = days[0].exercises[0];

    assert.equal(bench.name, 'Barbell Flat Standard Bench Press');
    assert.equal(bench.primaryMuscle, 'Mid Chest');
    assert.ok(Array.isArray(bench.muscleGroup) && bench.muscleGroup.includes('Mid Chest'));
  });
});
