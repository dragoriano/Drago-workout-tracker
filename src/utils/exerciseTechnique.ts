import type {
  CustomExercise,
  ExerciseEquipment,
  WorkoutSession,
} from '../types';
import type { CatalogExerciseItem } from './customExercises';
import {
  MUSCLE_TARGETS,
  TRACKED_MUSCLE_GROUPS,
  getMuscleColor,
  mapToMuscleGroup,
  resolveExerciseBroadMuscles,
  type BroadMuscleGroup,
  type MuscleRecoveryStatus,
} from './muscleRecovery';
import { formatDurationCompact, getExerciseTrackingMode } from './exerciseModes';
import { isWarmupSet } from './strength';

export type MovementPattern =
  | 'horizontal_press'
  | 'vertical_press'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'curl'
  | 'tricep_ext'
  | 'delt_raise'
  | 'fly'
  | 'calf'
  | 'core'
  | 'general';

export interface SmartSwapCandidate {
  name: string;
  equipment: ExerciseEquipment;
  primaryMuscle: string;
  secondaryMuscles: string[];
  muscleGroups: string[];
  isCustom: boolean;
  matchScore: number;
  matchReason: 'Exact Match' | 'Same Muscle' | 'Synergist';
  lastBestLabel: string | null;
}

export interface ExerciseTechniqueProfile {
  name: string;
  equipment: ExerciseEquipment;
  movementPattern: MovementPattern;
  movementPatternLabel: string;
  setupCues: string[];
  executionCues: string[];
  breathingCue: string;
  commonMistake: string;
  primaryBroad: BroadMuscleGroup | null;
  secondaryBroad: BroadMuscleGroup[];
  previewRecoveryItems: MuscleRecoveryStatus[];
}

export const SWAP_EQUIPMENT_FILTERS: ReadonlyArray<ExerciseEquipment | 'All'> = [
  'All',
  'Dumbbell',
  'Machine',
  'Cable',
  'Barbell',
  'Bodyweight',
  'Kettlebell',
] as const;

const PATTERN_LABELS: Record<MovementPattern, string> = {
  horizontal_press: 'Horizontal Press',
  vertical_press: 'Vertical Press',
  horizontal_pull: 'Horizontal Row',
  vertical_pull: 'Vertical Pull',
  squat: 'Knee-Dominant Squat',
  hinge: 'Hip Hinge',
  lunge: 'Unilateral Lunge / Split',
  curl: 'Elbow Flexion (Curl)',
  tricep_ext: 'Elbow Extension',
  delt_raise: 'Shoulder Isolation',
  fly: 'Chest Fly / Adduction',
  calf: 'Calf Raise',
  core: 'Trunk Stability',
  general: 'Compound / Accessory',
};

export function inferExerciseEquipment(
  name: string,
  explicit?: ExerciseEquipment,
): ExerciseEquipment {
  if (explicit && explicit !== 'Other') return explicit;
  const lower = name.toLowerCase();

  if (/\b(kettlebell|kb)\b/.test(lower)) return 'Kettlebell';
  if (/\b(cable|pulldown|pushdown|face\s*pull|rope|crossover)\b/.test(lower)) return 'Cable';
  if (/\b(smith|machine|pec\s*deck|leg\s*press|hack\s*squat|leg\s*curl|leg\s*extension|seated\s*calf|assisted)\b/.test(lower)) {
    return 'Machine';
  }
  if (/\b(dumbbell|db|arnold|hammer\s*curl|goblet|concentration\s*curl)\b/.test(lower)) {
    return 'Dumbbell';
  }
  if (/\b(barbell|ez[\s-]?bar|t[\s-]?bar|pendlay|yates|deadlift|back\s*squat|front\s*squat|overhead\s*press|military\s*press|skullcrusher|hip\s*thrust|good\s*morning)\b/.test(lower)) {
    return 'Barbell';
  }
  if (/\b(pull[\s-]?up|chin[\s-]?up|push[\s-]?up|dip|plank|crunch|hang|leg\s*raise|lunge|nordic|calisthenics|bodyweight)\b/.test(lower)) {
    return 'Bodyweight';
  }
  return explicit ?? 'Other';
}

export function inferMovementPattern(name: string): MovementPattern {
  const lower = name.toLowerCase();

  if (/\b(fly|flies|crossover|pec\s*deck)\b/.test(lower)) return 'fly';
  if (/\b(lateral\s*raise|front\s*raise|rear\s*delt|reverse\s*fly|upright\s*row)\b/.test(lower)) return 'delt_raise';
  if (/\b(curl|bicep|preacher)\b/.test(lower) && !/leg\s*curl|nordic/i.test(lower)) return 'curl';
  if (/\b(tricep|pushdown|skullcrusher|overhead.*extension|kickback|close[\s-]?grip.*bench)\b/.test(lower)) {
    return 'tricep_ext';
  }
  if (/\b(bench\s*press|chest\s*press|push[\s-]?up|floor\s*press|dip)\b/.test(lower)) {
    return 'horizontal_press';
  }
  if (/\b(overhead\s*press|shoulder\s*press|military\s*press|ohp|arnold|landmine\s*press)\b/.test(lower)) {
    return 'vertical_press';
  }
  if (/\b(pulldown|pull[\s-]?up|chin[\s-]?up|pullover)\b/.test(lower)) return 'vertical_pull';
  if (/\b(row|face\s*pull|shrug)\b/.test(lower)) return 'horizontal_pull';
  if (/\b(lunge|split\s*squat|step[\s-]?up|bulgarian)\b/.test(lower)) return 'lunge';
  if (/\b(calf|calves)\b/.test(lower)) return 'calf';
  if (/\b(deadlift|rdl|romanian|hip\s*thrust|bridge|good\s*morning|hyperextension|leg\s*curl|swing)\b/.test(lower)) {
    return 'hinge';
  }
  if (/\b(squat|leg\s*press|leg\s*extension|wall\s*sit)\b/.test(lower)) return 'squat';
  if (/\b(plank|crunch|ab|oblique|sit[\s-]?up|leg\s*raise|dead\s*bug|hollow|woodchop)\b/.test(lower)) {
    return 'core';
  }
  return 'general';
}

function resolveLastBestLabel(
  exerciseName: string,
  sessions: WorkoutSession[],
  weightUnit: 'kg' | 'lbs' = 'kg',
): string | null {
  const key = exerciseName.toLowerCase().trim();
  const sorted = [...sessions]
    .filter((s) => s.date && !isNaN(new Date(s.date).getTime()))
    .sort((a, b) => b.date - a.date);

  for (const session of sorted) {
    const match = (session.exercisesSnapshot || []).find(
      (ex) => ex.name.toLowerCase().trim() === key,
    );
    if (!match) continue;
    const completed = (match.sets || []).filter((s) => s.completed && !isWarmupSet(s));
    if (completed.length === 0) continue;

    const mode = getExerciseTrackingMode(match);
    if (mode === 'timed') {
      const bestDur = Math.max(...completed.map((s) => s.duration || 0));
      return bestDur > 0 ? formatDurationCompact(bestDur) : null;
    }

    const bestSet = completed.reduce((best, cur) =>
      cur.weight * cur.reps > best.weight * best.reps ? cur : best,
    );
    if (mode === 'bodyweight_reps') {
      return bestSet.weight > 0
        ? `+${bestSet.weight} ${weightUnit} × ${bestSet.reps}`
        : `BW × ${bestSet.reps}`;
    }
    if (mode === 'assisted_reps') {
      return `-${bestSet.weight} ${weightUnit} × ${bestSet.reps}`;
    }
    return `${bestSet.weight} ${weightUnit} × ${bestSet.reps}`;
  }

  return null;
}

export function findSmartEquipmentSwaps(
  current: {
    name: string;
    primaryMuscle?: string;
    secondaryMuscles?: string[];
    muscleGroups?: string[];
    equipment?: ExerciseEquipment;
  },
  catalog: CatalogExerciseItem[],
  options?: {
    equipmentFilter?: ExerciseEquipment | 'All';
    searchQuery?: string;
    sessions?: WorkoutSession[];
    customExercises?: CustomExercise[];
    weightUnit?: 'kg' | 'lbs';
    limit?: number;
  },
): SmartSwapCandidate[] {
  const currentKey = current.name.toLowerCase().trim();
  const currentPattern = inferMovementPattern(current.name);
  const currentPrimaryLower = (current.primaryMuscle || '').toLowerCase().trim();
  const currentGroupSet = new Set(
    [
      ...(current.muscleGroups || []),
      ...(current.primaryMuscle ? [current.primaryMuscle] : []),
      ...(current.secondaryMuscles || []),
    ]
      .map((g) => g.toLowerCase().trim())
      .filter(Boolean),
  );
  const currentBroad = resolveExerciseBroadMuscles(
    {
      name: current.name,
      primaryMuscle: current.primaryMuscle,
      secondaryMuscles: current.secondaryMuscles,
      muscleGroup: current.muscleGroups,
    },
    options?.customExercises,
  );

  const equipmentFilter = options?.equipmentFilter ?? 'All';
  const queryLower = (options?.searchQuery || '').toLowerCase().trim();
  const sessions = options?.sessions || [];
  const weightUnit = options?.weightUnit ?? 'kg';
  const limit = options?.limit ?? 24;

  const results: SmartSwapCandidate[] = [];

  for (const item of catalog) {
    const itemKey = item.name.toLowerCase().trim();
    if (!itemKey || itemKey === currentKey) continue;
    if (queryLower && !itemKey.includes(queryLower)) continue;

    const equipment = inferExerciseEquipment(item.name, item.equipment);
    if (equipmentFilter !== 'All' && equipment !== equipmentFilter) continue;

    const candidatePrimaryLower = (item.primaryMuscle || '').toLowerCase().trim();
    const candidatePattern = inferMovementPattern(item.name);
    const candidateBroad = resolveExerciseBroadMuscles({
      name: item.name,
      primaryMuscle: item.primaryMuscle,
      secondaryMuscles: item.secondaryMuscles,
      muscleGroup: item.muscleGroups,
    });

    let score = 0;
    const primaryExact = Boolean(
      currentPrimaryLower && candidatePrimaryLower && currentPrimaryLower === candidatePrimaryLower,
    );
    const broadMatch = Boolean(
      currentBroad.primary && candidateBroad.primary && currentBroad.primary === candidateBroad.primary,
    );
    const patternMatch =
      currentPattern !== 'general' && candidatePattern === currentPattern;

    if (primaryExact) score += 50;
    else if (broadMatch) score += 28;

    if (patternMatch) score += 32;

    const itemGroupsLower = item.muscleGroups.map((g) => g.toLowerCase().trim());
    let sharedGroups = 0;
    for (const g of itemGroupsLower) {
      if (currentGroupSet.has(g)) sharedGroups++;
    }
    score += Math.min(20, sharedGroups * 6);

    // If user typed a specific search query, still allow non-matching muscle exercises with lower rank
    if (!primaryExact && !broadMatch && !patternMatch && sharedGroups === 0 && !queryLower) {
      continue;
    }

    const lastBestLabel =
      sessions.length > 0 ? resolveLastBestLabel(item.name, sessions, weightUnit) : null;
    if (lastBestLabel) score += 12;

    const matchReason: SmartSwapCandidate['matchReason'] =
      (primaryExact && patternMatch) || score >= 75
        ? 'Exact Match'
        : primaryExact || broadMatch || patternMatch
          ? 'Same Muscle'
          : 'Synergist';

    results.push({
      name: item.name,
      equipment,
      primaryMuscle: item.primaryMuscle || item.muscleGroups[0] || '',
      secondaryMuscles: item.secondaryMuscles || [],
      muscleGroups: item.muscleGroups || [],
      isCustom: Boolean(item.isCustom),
      matchScore: score,
      matchReason,
      lastBestLabel,
    });
  }

  return results
    .sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      if (a.isCustom !== b.isCustom) return a.isCustom ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

const PATTERN_CUES: Record<
  MovementPattern,
  {
    setupCues: string[];
    executionCues: string[];
    breathingCue: string;
    commonMistake: string;
  }
> = {
  horizontal_press: {
    setupCues: [
      'Retract and depress shoulder blades into the bench before unracking.',
      'Plant feet flat and create a modest, stable upper-back arch.',
    ],
    executionCues: [
      'Lower under control toward mid/lower sternum with elbows tucked ~45°.',
      'Drive up cleanly without losing scapular tension at lockout.',
    ],
    breathingCue: 'Inhale deeply into the brace at the top; exhale past the sticking point.',
    commonMistake: 'Flaring elbows to 90° or bouncing the weight off the chest.',
  },
  vertical_press: {
    setupCues: [
      'Stack wrists directly over forearms; squeeze glutes and brace ribs down.',
      'Keep chin slightly tucked out of the vertical bar/handle path.',
    ],
    executionCues: [
      'Press straight up and finish with biceps alongside ears at lockout.',
      'Lower with control back to upper-chest/shoulder level.',
    ],
    breathingCue: 'Big brace before initiating off the shoulders; reset breath at top or bottom.',
    commonMistake: 'Hyperextending the lower back by flaring the ribcage instead of squeezing glutes.',
  },
  horizontal_pull: {
    setupCues: [
      'Brace core with a neutral spine; let shoulders protract slightly on stretch.',
      'Set torso angle steady before initiating the first rep.',
    ],
    executionCues: [
      'Initiate by driving elbows back toward your hips rather than shrugging.',
      'Pause briefly at peak contraction, then control a full eccentric stretch.',
    ],
    breathingCue: 'Exhale while pulling to torso; inhale smoothly on the eccentric return.',
    commonMistake: 'Using lower-back momentum or curling wrists at the top.',
  },
  vertical_pull: {
    setupCues: [
      'Grip slightly wider than shoulder width and depress shoulders away from ears.',
      'Cross ankles or lock knees securely under pads for a rigid anchor.',
    ],
    executionCues: [
      'Drive elbows down toward your front pockets, proud chest meeting bar.',
      'Extend arms to a dead stretch without snapping the shoulders up.',
    ],
    breathingCue: 'Inhale at full stretch overhead; exhale as elbows drive down.',
    commonMistake: 'Pulling mostly with forearms or leaning excessively backward.',
  },
  squat: {
    setupCues: [
      'Screw feet into the floor (big toe, little toe, heel balanced).',
      'Brace 360° through the torso before unlocking hips and knees together.',
    ],
    executionCues: [
      'Track knees aligned over toes to full depth without pelvic wink.',
      'Drive through mid-foot cleanly out of the hole keeping chest angle steady.',
    ],
    breathingCue: 'Big abdominal brace before descent; hold tension through the bottom.',
    commonMistake: 'Knees caving inward or heels lifting on the ascent.',
  },
  hinge: {
    setupCues: [
      'Keep weight close to mid-foot and pull slack out of the load before lifting.',
      'Lock lats downward ("oranges in armpits") with a neutral neck.',
    ],
    executionCues: [
      'Push hips straight back while maintaining a slight, fixed knee bend.',
      'Snap hips through to lockout with glutes without leaning back.',
    ],
    breathingCue: 'Deep belly brace before each pull; exhale after clearing the knees.',
    commonMistake: 'Rounding the lumbar spine or drifting the bar away from the shins.',
  },
  lunge: {
    setupCues: [
      'Take a hip-width stance (train tracks, not tightrope) for lateral stability.',
      'Shift ~75% of load onto the lead mid-foot with slight forward torso lean.',
    ],
    executionCues: [
      'Lower back knee softly toward the floor under a 2–3 second eccentric.',
      'Push powerfully through the front mid-foot without pushing off the rear toes.',
    ],
    breathingCue: 'Inhale on the descent; exhale forcefully as you stand.',
    commonMistake: 'Front knee collapsing inward or stepping on a narrow balance beam.',
  },
  curl: {
    setupCues: [
      'Pin upper arms softly against ribs with chest tall and shoulders neutral.',
      'Start each rep with triceps engaged for a true full range of motion.',
    ],
    executionCues: [
      'Curl smoothly through peak supination without swinging the torso forward.',
      'Lower for a full 2 seconds to keep tension on the biceps.',
    ],
    breathingCue: 'Exhale while curling up; inhale cleanly during the controlled lower.',
    commonMistake: 'Heaving elbows forward or dropping weights quickly on the negative.',
  },
  tricep_ext: {
    setupCues: [
      'Lock upper arms in space alongside ribs or overhead before moving the forearm.',
      'Keep wrists neutral and brace your trunk slightly upright or hinged.',
    ],
    executionCues: [
      'Extend cleanly through the elbow until full triceps squeeze.',
      'Control the return past 90° elbow flexion without shoulders rolling forward.',
    ],
    breathingCue: 'Exhale into full lockout; inhale steadily as elbows flex.',
    commonMistake: 'Letting elbows flare wide and turn into shoulder/lat momentum.',
  },
  delt_raise: {
    setupCues: [
      'Soft bend in elbows with shoulders depressed away from your ears.',
      'Lead with the pinky/side forearm in the scapular plane (~25–30° forward).',
    ],
    executionCues: [
      'Sweep weights outward in an arc rather than lifting straight up with traps.',
      'Control the lowering phase before plates/handles clack at your sides.',
    ],
    breathingCue: 'Exhale smoothly into the raise; inhale slowly on the descent.',
    commonMistake: 'Shrugging upper traps or using heavy body English to swing weights.',
  },
  fly: {
    setupCues: [
      'Set sternum proud and keep a consistent soft elbow bend throughout.',
      'Anchor shoulders down so chest fibers stretch instead of front delts.',
    ],
    executionCues: [
      'Arc arms wide until a deep chest stretch, then hug inward across torso.',
      'Squeeze pecs for 1 second at peak contraction.',
    ],
    breathingCue: 'Inhale smoothly into the deep stretch; exhale as hands converge.',
    commonMistake: 'Turning the fly into a press by bending elbows more each rep.',
  },
  calf: {
    setupCues: [
      'Place balls of feet squarely on platform with heels free for full stretch.',
      'Keep knees softly locked (standing) or ~90° (seated) consistently.',
    ],
    executionCues: [
      'Pause 1–2 seconds at the bottom stretch to remove Achilles bounce.',
      'Drive high onto the big-toe ball and hold Peak plantarflexion for 1 second.',
    ],
    breathingCue: 'Exhale as you press to peak height; inhale during the bottom pause.',
    commonMistake: 'Bouncing rapidly through the bottom half without pausing at the stretch.',
  },
  core: {
    setupCues: [
      'Tuck ribs gently toward pelvis ("hollow brace") before starting.',
      'Avoid pulling on neck or straining hip flexors.',
    ],
    executionCues: [
      'Move deliberately through spinal flexion or resist rotation slowly.',
      'Keep continuous abdominal tension without resting fully between reps.',
    ],
    breathingCue: 'Forcefully exhale at peak contraction to deepen ribcage engagement.',
    commonMistake: 'Swinging legs with momentum or arching the lower back off the floor.',
  },
  general: {
    setupCues: [
      'Establish a stable stance/seat and brace your core before starting the set.',
      'Select a load that allows clean, repeatable range of motion.',
    ],
    executionCues: [
      'Control a 2-second lowering phase and move powerfully on the concentric.',
      'Keep joints aligned along their natural mechanical path throughout.',
    ],
    breathingCue: 'Inhale into brace during setup/eccentric; exhale cleanly on exertion.',
    commonMistake: 'Cutting range of motion short under heavier loads.',
  },
};

export function getExerciseTechniqueProfile(
  name: string,
  primaryMuscle?: string,
  secondaryMuscles: string[] = [],
  muscleGroups: string[] = [],
  explicitEquipment?: ExerciseEquipment,
): ExerciseTechniqueProfile {
  const equipment = inferExerciseEquipment(name, explicitEquipment);
  const pattern = inferMovementPattern(name);
  const cues = PATTERN_CUES[pattern];

  const { primary: resolvedPrimary, secondary: resolvedSecondary } =
    resolveExerciseBroadMuscles({
      name,
      primaryMuscle,
      secondaryMuscles,
      muscleGroup: muscleGroups,
    });

  // Fallback mapping when direct muscle names aren't provided
  const primaryBroad =
    resolvedPrimary ||
    (primaryMuscle ? (mapToMuscleGroup(primaryMuscle) as BroadMuscleGroup) : null);

  const secondarySet = new Set<BroadMuscleGroup>(resolvedSecondary);
  if (primaryBroad) secondarySet.delete(primaryBroad);
  const secondaryBroad = Array.from(secondarySet);

  // Build synthetic MuscleRecoveryStatus array so <AnatomicalBodyMap mode="readiness" />
  // highlights Primary (fatigued crimson/emerald pop -> let's map Primary = fatigued red highlight? Wait: let's make it crisp!)
  // Wait: in AnatomicalBodyMap readiness mode:
  // fatigued = red (#ef4444 bright glow), recovering = amber (#f59e0b glow), ready untrained = soft muted green (0.42).
  // Wait: even better, in mode="volume":
  // over = red/orange? Let's make Primary = fatigued (high-visibility focus glow), Secondary = recovering (amber), Unused = dimmed!
  const previewRecoveryItems: MuscleRecoveryStatus[] = TRACKED_MUSCLE_GROUPS.map((muscle) => {
    const target = MUSCLE_TARGETS[muscle];
    const isPrimary = muscle === primaryBroad;
    const isSecondary = secondaryBroad.includes(muscle);

    return {
      muscle,
      color: getMuscleColor(muscle),
      directSets: isPrimary ? target.maxSets : isSecondary ? target.minSets : 0,
      effectiveSets: isPrimary ? target.maxSets : isSecondary ? target.minSets : 0,
      weeklyVolume: 0,
      minTarget: target.minSets,
      maxTarget: target.maxSets,
      volumeZone: isPrimary ? 'optimal' : isSecondary ? 'under' : 'untrained',
      lastTrainedAt: isPrimary || isSecondary ? Date.now() : null,
      hoursSinceTrained: isPrimary || isSecondary ? 0 : null,
      neededRecoveryHours: target.baseRecoveryHours,
      recoveryPercent: isPrimary ? 10 : isSecondary ? 55 : 100,
      readiness: isPrimary ? 'fatigued' : isSecondary ? 'recovering' : 'ready',
    };
  });

  return {
    name,
    equipment,
    movementPattern: pattern,
    movementPatternLabel: PATTERN_LABELS[pattern],
    setupCues: cues.setupCues,
    executionCues: cues.executionCues,
    breathingCue: cues.breathingCue,
    commonMistake: cues.commonMistake,
    primaryBroad,
    secondaryBroad,
    previewRecoveryItems,
  };
}
