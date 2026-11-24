import type { WorkoutProgram } from '../types';
import { formatSetSummary, getExerciseTrackingMode } from './exerciseModes';
import { cleanupOrphanSupersets } from './supersets';
import { generateId } from './uuid';

export const QR_MAX_PAYLOAD_LENGTH = 4200;

/**
 * Compresses a UTF-8 string into URL-safe base64 using gzip CompressionStream.
 */
export async function compressToBase64Url(str: string): Promise<string> {
  const bytes = new TextEncoder().encode(str);
  const stream = new CompressionStream('gzip');
  const writer = stream.writable.getWriter();
  await writer.write(bytes);
  await writer.close();
  const compressed = await new Response(stream.readable).arrayBuffer();
  const uint8 = new Uint8Array(compressed);
  let binary = '';
  uint8.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Decompresses URL-safe base64 gzip data back into a UTF-8 string.
 */
export async function decompressFromBase64Url(b64: string): Promise<string> {
  const padded = b64
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const stream = new DecompressionStream('gzip');
  const writer = stream.writable.getWriter();
  await writer.write(bytes);
  await writer.close();
  const decompressed = await new Response(stream.readable).arrayBuffer();
  return new TextDecoder().decode(decompressed);
}

/**
 * Produces a lightweight shareable copy of a program with workout history removed and sets reset.
 */
export function stripProgramForShare(program: WorkoutProgram): WorkoutProgram {
  return {
    id: program.id,
    name: program.name,
    goal: program.goal,
    theme: program.theme || 'from-primary-500 to-primary-700',
    status: program.status || 'paused',
    createdAt: program.createdAt,
    updatedAt: program.updatedAt,
    days: (program.days || []).map((d, dayIdx) => ({
      id: d.id,
      name: d.name,
      order: d.order ?? dayIdx,
      ...(d.isDeloadDay ? { isDeloadDay: true } : {}),
      exercises: (d.exercises || []).map((e) => ({
        id: e.id,
        name: e.name,
        ...(e.muscleGroup && e.muscleGroup.length > 0 ? { muscleGroup: e.muscleGroup } : {}),
        ...(e.primaryMuscle ? { primaryMuscle: e.primaryMuscle } : {}),
        ...(e.secondaryMuscles && e.secondaryMuscles.length > 0
          ? { secondaryMuscles: e.secondaryMuscles }
          : {}),
        notes: e.notes || '',
        restTimerConfig: e.restTimerConfig || 90,
        lastUpdated: e.lastUpdated,
        ...(e.supersetId ? { supersetId: e.supersetId } : {}),
        ...(typeof e.supersetOrder === 'number' ? { supersetOrder: e.supersetOrder } : {}),
        ...(e.trackingMode && e.trackingMode !== 'weight_reps'
          ? { trackingMode: e.trackingMode }
          : {}),
        history: [],
        sets: (e.sets || []).map((s) => ({
          id: s.id,
          weight: Number.isFinite(s.weight) ? s.weight : 0,
          reps: Number.isFinite(s.reps) ? s.reps : 0,
          ...(typeof s.duration === 'number' && Number.isFinite(s.duration)
            ? { duration: s.duration }
            : {}),
          completed: false,
          ...(s.setType && s.setType !== 'working' ? { setType: s.setType } : {}),
        })),
      })),
    })),
  };
}

/**
 * Encodes a single program into a compact `DRG2:` share code and checks QR capacity.
 */
export async function encodeProgramShareCode(
  program: WorkoutProgram,
): Promise<{ code: string; fitsQR: boolean; byteLength: number }> {
  const payload = JSON.stringify({
    type: 'dragoriano-program',
    v: 3,
    data: stripProgramForShare(program),
  });
  const compressed = await compressToBase64Url(payload);
  const code = `DRG2:${compressed}`;
  return {
    code,
    fitsQR: code.length <= QR_MAX_PAYLOAD_LENGTH,
    byteLength: code.length,
  };
}

/**
 * Encodes multiple programs into a legacy-compatible `DRG2:` multi-program share code.
 */
export async function encodeProgramsShareCode(
  programs: WorkoutProgram[],
): Promise<{ code: string; fitsQR: boolean; byteLength: number }> {
  const payload = JSON.stringify({
    type: 'dragoriano-programs',
    v: 2,
    data: programs.map(stripProgramForShare),
  });
  const compressed = await compressToBase64Url(payload);
  const code = `DRG2:${compressed}`;
  return {
    code,
    fitsQR: code.length <= QR_MAX_PAYLOAD_LENGTH,
    byteLength: code.length,
  };
}

function assertValidProgram(candidate: unknown): WorkoutProgram {
  if (!candidate || typeof candidate !== 'object') {
    throw new Error('Program entry must be an object.');
  }
  const obj = candidate as Partial<WorkoutProgram>;
  if (typeof obj.name !== 'string' || !obj.name.trim()) {
    throw new Error('Shared program is missing a valid name.');
  }
  if (!Array.isArray(obj.days)) {
    throw new Error('Shared program is missing workout days.');
  }
  return obj as WorkoutProgram;
}

/**
 * Decodes a `DRG2:` share code or JSON payload into validated program template(s).
 */
export async function decodeProgramSharePayload(rawText: string): Promise<{
  programs: WorkoutProgram[];
  sourceType: 'single' | 'multi';
}> {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('Paste a Dragoriano share code or JSON program payload.');
  }

  let jsonText = trimmed;
  if (trimmed.startsWith('DRG2:')) {
    try {
      jsonText = await decompressFromBase64Url(trimmed.slice(5).trim());
    } catch {
      throw new Error('Could not decompress share code. Make sure nothing was truncated.');
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('Invalid share code or JSON format.');
  }

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) throw new Error('Shared list contains no programs.');
    return {
      programs: parsed.map(assertValidProgram),
      sourceType: parsed.length === 1 ? 'single' : 'multi',
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Unsupported program share payload.');
  }

  const record = parsed as Record<string, unknown>;
  if (record.type === 'dragoriano-program' && record.data) {
    return { programs: [assertValidProgram(record.data)], sourceType: 'single' };
  }
  if (record.type === 'dragoriano-programs' && Array.isArray(record.data)) {
    if (record.data.length === 0) throw new Error('Shared payload contains no programs.');
    return {
      programs: record.data.map(assertValidProgram),
      sourceType: 'multi',
    };
  }
  if (Array.isArray(record.programs)) {
    if (record.programs.length === 0) throw new Error('Backup JSON contains no programs.');
    return {
      programs: record.programs.map(assertValidProgram),
      sourceType: 'multi',
    };
  }
  if (typeof record.name === 'string' && Array.isArray(record.days)) {
    return { programs: [assertValidProgram(record)], sourceType: 'single' };
  }

  throw new Error('Unrecognized Dragoriano program payload.');
}

/**
 * Clones a decoded program with fresh IDs while preserving superset groups within each day.
 */
export function prepareImportedProgram(
  program: WorkoutProgram,
  options: { status?: 'active' | 'paused'; createId?: () => string } = {},
): WorkoutProgram {
  const createId = options.createId ?? generateId;
  const now = Date.now();

  return {
    id: createId(),
    name: program.name.trim(),
    goal: program.goal || 'Custom',
    theme: program.theme || 'from-primary-500 to-primary-700',
    status: options.status ?? 'paused',
    createdAt: now,
    updatedAt: now,
    days: (program.days || []).map((day, dayIdx) => {
      const supersetIdMap = new Map<string, string>();
      const remappedExercises = (day.exercises || []).map((ex) => {
        let nextSupersetId: string | undefined;
        if (ex.supersetId) {
          nextSupersetId = supersetIdMap.get(ex.supersetId);
          if (!nextSupersetId) {
            nextSupersetId = createId();
            supersetIdMap.set(ex.supersetId, nextSupersetId);
          }
        }

        const primaryMuscle = ex.primaryMuscle || ex.muscleGroup?.[0] || '';
        const secondaryMuscles = ex.secondaryMuscles || [];
        const muscleGroup =
          ex.muscleGroup && ex.muscleGroup.length > 0
            ? ex.muscleGroup
            : [primaryMuscle, ...secondaryMuscles].filter(Boolean);

        return {
          ...ex,
          id: createId(),
          primaryMuscle,
          secondaryMuscles,
          muscleGroup,
          notes: ex.notes || '',
          restTimerConfig: ex.restTimerConfig || 90,
          lastUpdated: now,
          history: [],
          supersetId: nextSupersetId,
          sets: (ex.sets || []).map((s) => ({
            id: createId(),
            weight: Number.isFinite(s.weight) ? Math.max(0, s.weight) : 0,
            reps: Number.isFinite(s.reps) ? Math.max(0, s.reps) : 0,
            ...(typeof s.duration === 'number' && Number.isFinite(s.duration)
              ? { duration: Math.max(0, s.duration) }
              : {}),
            completed: false,
            ...(s.setType ? { setType: s.setType } : {}),
          })),
        };
      });

      return {
        id: createId(),
        name: day.name?.trim() || `Day ${dayIdx + 1}`,
        order: day.order ?? dayIdx,
        ...(day.isDeloadDay ? { isDeloadDay: true } : {}),
        exercises: cleanupOrphanSupersets(remappedExercises),
      };
    }),
  };
}

/**
 * Formats a workout program into clean plain text suitable for pasting into notes or chat.
 */
export function formatProgramPlainText(
  program: WorkoutProgram,
  unit = 'kg',
): string {
  const lines: string[] = [
    `${program.name}${program.goal ? ` (${program.goal})` : ''}`,
  ];

  (program.days || []).forEach((day, idx) => {
    lines.push('');
    lines.push(`Day ${idx + 1}: ${day.name}${day.isDeloadDay ? ' [Deload]' : ''}`);
    (day.exercises || []).forEach((ex, exIdx) => {
      const mode = getExerciseTrackingMode(ex);
      const firstSet = ex.sets?.[0];
      const setPreview = firstSet
        ? formatSetSummary(firstSet, mode, unit)
        : mode === 'timed'
          ? '45s'
          : '10 reps';
      lines.push(`  ${exIdx + 1}. ${ex.name} — ${ex.sets?.length || 0} sets (${setPreview})`);
    });
  });

  return lines.join('\n');
}
