import type { ActivityType } from '../types';

/**
 * The TEMPORARY half of the mascot: how it looks right now, and nothing more.
 *
 * WHY THIS IS ITS OWN MODULE.
 *
 * Permanent progression and temporary condition are different kinds of thing, and
 * the cheapest way to keep them different is to keep them apart. `mascot.ts` holds
 * what was earned; this holds what is merely current. Nothing here is persisted,
 * nothing here is a reward, and nothing here may be written back into `MascotState`.
 *
 * `src/test/mascotDomain.test.ts` asserts that `mascot.ts`, `xp.ts`, `rewards.ts`
 * and `trophies.ts` do not import this file, so the separation is enforced by the
 * build rather than by memory.
 *
 * WHY IT IS NEVER STORED.
 *
 * A condition that is written down can get stuck. It survives a reload, rides along
 * in an export, comes back from a stale backup, and is eventually read by some
 * future feature as a fact about the person rather than a fact about last fortnight.
 * Deriving it on read means it is always current and always disposable: one
 * completed activity and it is simply gone.
 *
 * M1 DEFINES THE VOCABULARY ONLY. There is deliberately no derivation here yet -
 * the rules for it are the highest-risk part of the whole mascot programme and they
 * get their own milestone, with their own copy review.
 */

// --- Condition --------------------------------------------------------------

/**
 * How lively the mascot looks. A description of recent activity, never a verdict on
 * the person.
 *
 * The rules the derivation must obey when it arrives in M6:
 *
 *   - measured against the user's OWN planned frequency, never a fixed target
 *   - acknowledged rest counts as adherence, so a rest day can never push it down
 *   - one missed session moves nothing
 *   - absent data is absent, not evidence of inactivity
 *   - fully reversible, immediately, with no decay curve
 *
 * `slouch` and `max_chill` are affectionate, never accusing. They may change
 * posture, clothing and props. They may not change stage, XP, skills, trophies, or
 * any copy that evaluates the user. There is no state below `max_chill`, and there
 * is deliberately no "neglected", "sad" or "unwell" state to reach.
 */
export type MascotCondition = 'energised' | 'normal' | 'resting' | 'slouch' | 'max_chill';

export const MASCOT_CONDITIONS: readonly MascotCondition[] = [
  'energised',
  'normal',
  'resting',
  'slouch',
  'max_chill',
] as const;

/**
 * The condition every mascot sits at until a derivation says otherwise.
 *
 * Normal rather than energised, so the lively state stays something that happens
 * rather than something to fall from.
 */
export const DEFAULT_CONDITION: MascotCondition = 'normal';

/**
 * Wording that must never appear near a condition.
 *
 * Kept as data rather than as a note in a document, so a test can check it. The
 * comedy in `max_chill` is about a mascot enjoying the sofa, never about the user
 * having failed at something.
 */
export const FORBIDDEN_CONDITION_LANGUAGE: readonly string[] = [
  'fat',
  'lazy',
  'unhealthy',
  'failure',
  'failed',
  'neglected',
  'abandoned',
  'starving',
  'sad',
  'disappointed',
  'guilty',
  'shame',
] as const;

// --- Activity pose ----------------------------------------------------------

/**
 * Activity poses are grouped, not per-activity.
 *
 * One pose per activity type would multiply the art matrix by eight; grouping puts
 * it at four and loses nothing a viewer would notice. `idle` is the fallback and
 * always exists, so pose lookup can never fail to return something.
 */
export type ActivityPoseGroup = 'idle' | 'mobility' | 'cardio' | 'strength' | 'recovery';

export const ACTIVITY_POSE_GROUPS: readonly ActivityPoseGroup[] = [
  'idle',
  'mobility',
  'cardio',
  'strength',
  'recovery',
] as const;

/**
 * Which pose group an activity belongs to.
 *
 * Total over `ActivityType`, so adding an activity type is a compile error here
 * rather than a silent fallback to `idle` somewhere in the UI.
 */
export const POSE_GROUP_FOR_ACTIVITY: Readonly<Record<ActivityType, ActivityPoseGroup>> = {
  yoga: 'mobility',
  walk: 'cardio',
  rest: 'recovery',
  other: 'idle',
};

// --- Mood -------------------------------------------------------------------

/**
 * Everything temporary about the mascot, in one object.
 *
 * Deliberately NOT assignable to `MascotState`: it shares no field names with it, so
 * a mistaken assignment is a type error rather than a silent overwrite. That is the
 * whole reason this is a separate type instead of extra optional fields on the
 * mascot.
 */
export interface MascotMood {
  condition: MascotCondition;
  pose: ActivityPoseGroup;
}

export function defaultMood(): MascotMood {
  return { condition: DEFAULT_CONDITION, pose: 'idle' };
}
