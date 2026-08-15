import { isValidISODate } from '../dates';

/**
 * The opal egg's progress, derived rather than stored.
 *
 * WHY THIS READS REWARD KEYS AND NOT THE ACTIVITY LOGS.
 *
 * `deriveRewards()` recomputes `distinctActiveDays` from the live logs every sync.
 * That number can go DOWN: un-tick a completed activity and the day stops counting.
 * A crack stage built on it would heal the shell whenever somebody corrected a
 * mistake in yesterday's record, which is precisely what cracking must never do.
 *
 * `awardedKeys` has the opposite property. It is append-only by construction -
 * `grantRewards` only ever adds to it and `sealRewardKeys` only ever unions into it,
 * and nothing anywhere removes a key. Counting distinct dates in it therefore gives
 * a number that can only rise. Monotonicity is not enforced here by a `Math.max`
 * against some stored high-water mark; it falls out of the data source, which is why
 * there is no second progression counter to keep in step.
 *
 * Two further properties come free:
 *
 *   - No timezone handling. Keys already carry local `YYYY-MM-DD` day strings, so
 *     this counts distinct substrings and never constructs a `Date`.
 *   - No schema change. Nothing new is persisted; the egg's progress is a pure
 *     function of state that is already on disk.
 *
 * SPECIES SECRECY. Nothing in this module knows or can learn which animal is inside.
 * `EggProgress` carries three numbers and a boolean; there is no species field, no
 * path input, and no branch anywhere below that varies by family.
 */

/** The heaviest crack the shell shows before it is offered for hatching. */
export const MAX_CRACK_STAGE = 5;

/**
 * Distinct qualifying days needed before the egg is offered.
 *
 * Six, so the five crack stages each land on their own day and the shell visibly
 * travels somewhere before it opens. Reaching this makes the egg READY. It never
 * hatches it - see `hatchEgg`, which only a user action reaches.
 */
export const HATCH_QUALIFYING_DAYS = 6;

/**
 * Only completed activity earns a crack.
 *
 * Acknowledged rest (`rest:<date>`) is genuine programme adherence and is rewarded
 * as such elsewhere, but it does not advance the egg. That keeps the egg a record of
 * activity rather than of attendance, and it means nobody has to choose between
 * resting properly and moving the shell along - rest simply does nothing here, and
 * can never take anything away.
 */
const ACTIVITY_KEY_PREFIX = 'activity:';

/** What the egg looks like right now. Generic by design: no species, ever. */
export interface EggProgress {
  /** Distinct local dates on which at least one activity was completed. */
  qualifyingDays: number;
  /** 0 (pristine) to MAX_CRACK_STAGE (heavily cracked). Never decreases. */
  crackStage: number;
  /** True once the egg may be offered. Never hatches anything by itself. */
  hatchEligible: boolean;
}

/**
 * Distinct dates represented by activity reward keys.
 *
 * Keys look like `activity:2026-08-15:<activityId>`. Collapsing to a set of dates is
 * what makes five workouts in one day count once: the date is the unit, not the
 * activity. An id containing a colon is harmless, because only the second segment is
 * read.
 *
 * Anything that is not a well-formed date in the second position is ignored rather
 * than trusted - a malformed key from a hand-edited backup should be inert, not a
 * free crack.
 */
export function qualifyingActiveDays(awardedKeys: readonly string[]): number {
  const days = new Set<string>();

  for (const key of awardedKeys) {
    if (!key.startsWith(ACTIVITY_KEY_PREFIX)) continue;
    const date = key.slice(ACTIVITY_KEY_PREFIX.length).split(':')[0];
    if (date !== undefined && isValidISODate(date)) days.add(date);
  }

  return days.size;
}

/**
 * One crack per qualifying day, up to the maximum.
 *
 * Deliberately linear. A curve would make the later cracks feel earned by volume
 * rather than by turning up, and turning up is the thing this product rewards.
 */
export function crackStageForDays(qualifyingDays: number): number {
  // `Number.isFinite` rather than a bare `<= 0`, because `NaN <= 0` is false and
  // `Math.min(NaN, 5)` is NaN - which would eventually paint a shell with NaN
  // cracks on it. Anything that is not a real, positive count is pristine.
  if (!Number.isFinite(qualifyingDays) || qualifyingDays <= 0) return 0;
  return Math.min(Math.floor(qualifyingDays), MAX_CRACK_STAGE);
}

export function isHatchEligibleFromDays(qualifyingDays: number): boolean {
  return qualifyingDays >= HATCH_QUALIFYING_DAYS;
}

/**
 * The whole projection, from the one append-only source.
 *
 * Pure and total: the same keys always give the same answer, in any order, with no
 * clock, no timezone and no I/O.
 */
export function eggProgress(awardedKeys: readonly string[]): EggProgress {
  const qualifyingDays = qualifyingActiveDays(awardedKeys);
  return {
    qualifyingDays,
    crackStage: crackStageForDays(qualifyingDays),
    hatchEligible: isHatchEligibleFromDays(qualifyingDays),
  };
}
