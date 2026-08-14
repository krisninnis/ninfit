import { nowTimestamp } from './dates';
import { newId, type IdFactory } from './ids';
import type {
  BaselineMeasurement,
  HealthContext,
  HealthNote,
  ISODateTime,
  UserProfile,
  UUID,
} from './types';

/**
 * Editing the profile, the baseline and the user's own health notes.
 *
 * All pure: each function returns a new object and never touches storage. Two rules
 * run through the lot:
 *
 *   - A patch key set to `undefined` clears that field. A key that is absent leaves it
 *     alone. Same contract as daily-log updates, so there is one rule to remember.
 *   - The baseline is a HISTORICAL record of where things started. Editing it corrects
 *     the record; it never becomes a new current measurement, and nothing derived from
 *     later logs may rewrite it.
 */

export interface EditOptions {
  now?: ISODateTime;
  makeId?: IdFactory;
}

type Patch<T> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;

function mergePatch<T extends object>(target: T, patch: Partial<T>): T {
  const next = { ...target } as Record<string, unknown>;
  for (const key of Object.keys(patch)) {
    const value = (patch as Record<string, unknown>)[key];
    if (value === undefined) delete next[key];
    else next[key] = value;
  }
  return next as T;
}

export function applyProfileUpdate(
  profile: UserProfile,
  patch: Patch<UserProfile>,
  options: EditOptions = {},
): UserProfile {
  if (Object.keys(patch).length === 0) return profile;
  return {
    ...mergePatch(profile, patch),
    id: profile.id,
    createdAt: profile.createdAt,
    updatedAt: options.now ?? nowTimestamp(),
  };
}

/**
 * Correct the starting record. `recordedOn` stays put unless explicitly changed, and
 * no later log or measurement may drive an edit here.
 */
export function applyBaselineUpdate(
  baseline: BaselineMeasurement,
  patch: Patch<BaselineMeasurement>,
): BaselineMeasurement {
  if (Object.keys(patch).length === 0) return baseline;
  return { ...mergePatch(baseline, patch), id: baseline.id };
}

// --- Health notes ----------------------------------------------------------

export interface CreateHealthNoteInput {
  label: string;
  detail?: string;
  /** Only when the date is genuinely known. */
  noticedOn?: string;
  /** Free text for vague timing, preserved exactly as written. */
  noticedNote?: string;
}

export function createHealthNote(
  input: CreateHealthNoteInput,
  options: EditOptions = {},
): HealthNote {
  const note: HealthNote = {
    id: (options.makeId ?? newId)(),
    label: input.label,
    // Always self-reported in v0.1. The app never authors a health note.
    source: 'self_reported',
  };
  if (input.detail !== undefined && input.detail !== '') note.detail = input.detail;
  if (input.noticedOn !== undefined && input.noticedOn !== '') note.noticedOn = input.noticedOn;
  if (input.noticedNote !== undefined && input.noticedNote !== '') {
    note.noticedNote = input.noticedNote;
  }
  return note;
}

export function addHealthNote(
  context: HealthContext,
  note: HealthNote,
  options: EditOptions = {},
): HealthContext {
  return {
    ...context,
    notes: [...context.notes, note],
    updatedAt: options.now ?? nowTimestamp(),
  };
}

export function updateHealthNote(
  context: HealthContext,
  noteId: UUID,
  patch: Partial<Omit<HealthNote, 'id' | 'source'>>,
  options: EditOptions = {},
): HealthContext {
  return {
    ...context,
    notes: context.notes.map((note) =>
      note.id === noteId ? { ...mergePatch(note, patch), id: note.id, source: note.source } : note,
    ),
    updatedAt: options.now ?? nowTimestamp(),
  };
}

export function removeHealthNote(
  context: HealthContext,
  noteId: UUID,
  options: EditOptions = {},
): HealthContext {
  return {
    ...context,
    notes: context.notes.filter((note) => note.id !== noteId),
    updatedAt: options.now ?? nowTimestamp(),
  };
}

/**
 * Would changing the programme start date alter how already-recorded days map onto
 * the programme?
 *
 * Daily logs are keyed by calendar date and are never rewritten, but the week and day
 * number a past date resolves to will shift. Worth saying plainly before saving
 * rather than letting the Week screen quietly renumber itself.
 */
export function startDateChangeAffectsHistory(
  currentStart: string,
  nextStart: string,
  hasExistingLogs: boolean,
): boolean {
  return hasExistingLogs && currentStart !== nextStart;
}
