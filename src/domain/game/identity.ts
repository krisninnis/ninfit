import type { ISODate, ISODateTime } from '../types';
import type { MascotFamilyId, MascotPersonality } from './types';

/**
 * Who a mascot IS, and the lineage record that outlives it.
 *
 * M1 defines these types and nothing reads them yet. That is deliberate: the shape
 * has to exist before the egg state machine, the hatch and the evolution branch all
 * start writing to it, or each of those milestones invents its own half of the model
 * and they have to be reconciled afterwards.
 *
 * TWO RULES GOVERN THIS FILE.
 *
 * 1. NOTHING HERE MAY AFFECT PROGRESSION. Rarity, variant and presentation are
 *    decoration. No function that computes XP, level, stage, evolution eligibility
 *    or trophies may import this module - `src/test/mascotDomain.test.ts` asserts
 *    that as an import-level invariant, so it cannot rot quietly.
 *
 * 2. A PASSPORT IS APPEND-ONLY. Once written it is never deleted and never
 *    rewritten, except to record what it passed on. The whole point of the legacy
 *    system is that a mascot you finished with two years ago is still there.
 */

// --- Presentation -----------------------------------------------------------

/**
 * How a mascot presents. NOT derived from the user's gender, ever.
 *
 * The user's own gender identity, if it is ever collected, is optional profile data
 * and has no relationship to this field. Keeping them in separate types is the
 * cheapest way to make the wrong join impossible to write by accident.
 */
export type MascotPresentation = 'masculine' | 'feminine' | 'neutral';

export const MASCOT_PRESENTATIONS: readonly MascotPresentation[] = [
  'masculine',
  'feminine',
  'neutral',
] as const;

/**
 * What the user asked for, which is a different question from what a mascot is.
 *
 * `surprise_me` is a real answer rather than the absence of one, so the selection
 * code never has to guess whether an undefined value means "no opinion" or "not
 * asked yet". Undefined means not asked.
 */
export type MascotPresentationPreference = MascotPresentation | 'surprise_me';

/**
 * All presentations are equal in rarity, capability, progression and prestige.
 * There is no ordering here on purpose - anything that sorts or ranks these would
 * be a bug.
 */

// --- Rarity -----------------------------------------------------------------

/**
 * Cosmetic rarity, and cosmetic only.
 *
 * This exists to make a variant feel special to look at. It must never gate an
 * ability, alter a number, or change how fast anything progresses. The vocabulary
 * matches the approved cosmetic ladder; `CosmeticItem` will adopt the same names so
 * there is one rarity language rather than two.
 */
export type MascotRarity = 'normal' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export const MASCOT_RARITIES: readonly MascotRarity[] = [
  'normal',
  'uncommon',
  'rare',
  'epic',
  'legendary',
] as const;

// --- Identity ---------------------------------------------------------------

/**
 * The permanent facts about one mascot.
 *
 * `speciesId` reuses `MascotFamilyId` rather than introducing a parallel vocabulary:
 * the five species are already named in `paths.ts` and a second enum would drift.
 *
 * Everything optional is optional because the app genuinely cannot know it yet.
 * `variantId` and `rarity` wait for cosmetic variants; `selectionSeed` waits for
 * curated-random selection in M4.
 */
export interface MascotIdentity {
  speciesId: MascotFamilyId;
  presentation: MascotPresentation;
  personality: MascotPersonality;
  /** The name in use. Renameable at any time, by the user, forever. */
  name: string;
  /** What it was called on the day it hatched, kept so a rename can be undone. */
  defaultName: string;
  /** Cosmetic variant, once variants exist. */
  variantId?: string;
  rarity?: MascotRarity;
  /**
   * Recorded so a reveal is reproducible.
   *
   * Curated-random selection lands in M4. Persisting the seed means a hatch can be
   * replayed and audited - "why did I get this one" has an answer - and it makes
   * the selection testable without mocking randomness.
   */
  selectionSeed?: string;
}

// --- Passport ---------------------------------------------------------------

/**
 * One mascot's permanent record: what it was, when, and what it handed on.
 *
 * Written at hatch, not retrospectively. Building it later would mean inventing
 * lineage for mascots that existed before the record did, and invented history is
 * worse than none.
 *
 * Nothing in here is populated speculatively in M1. The optional fields are the
 * ones a future milestone fills in when the corresponding event actually happens.
 */
export interface MascotPassport {
  id: string;
  identity: MascotIdentity;
  hatchedAt: ISODateTime;
  /** Set when this mascot reached the final stage. */
  championAt?: ISODateTime;
  /** The mascot this one came from, if any. */
  predecessorId?: string;
  /** The mascot this one became. Set once, when evolution completes. */
  passedOnTo?: string;

  /**
   * Inheritance. All three are decoration or flavour - none of them confers any
   * capability, and nothing in the progression model may read them.
   */
  inheritedVisualToken?: string;
  inheritedTrait?: MascotPersonality;
  legacyBadgeId?: string;

  /** Activity types this mascot did most of. Filled in from logs, later. */
  favouriteActivities?: readonly string[];
  /** Trophy ids earned during this mascot's tenure. */
  trophies?: readonly string[];
  /** One reroll per mascot, ever. Recorded so it cannot be repeated. */
  rerollUsed?: boolean;
  /** The day the record was opened, for the collection's ordering. */
  recordedOn?: ISODate;
}

// --- Collection -------------------------------------------------------------

/**
 * Every mascot the user has ever had, plus a pointer to the current one.
 *
 * Append-only. `passports` is never filtered, reordered destructively or pruned;
 * the only mutation a milestone may make to an existing entry is setting
 * `passedOnTo` or `championAt` on the mascot that just finished.
 *
 * Not persisted in M1. Storage moves here in M4, when the hatch writes the first
 * passport, and that is the migration that earns schema v2.
 */
export interface MascotCollection {
  passports: readonly MascotPassport[];
  /** Which passport is the living mascot. Undefined before the first hatch. */
  activeMascotId?: string;
}

export function emptyCollection(): MascotCollection {
  return { passports: [] };
}

/** The active passport, or undefined if nothing has hatched yet. */
export function activePassport(collection: MascotCollection): MascotPassport | undefined {
  if (collection.activeMascotId === undefined) return undefined;
  return collection.passports.find((passport) => passport.id === collection.activeMascotId);
}

/**
 * Add a passport without disturbing any existing one.
 *
 * Returns a new collection; refuses to overwrite an id that is already present,
 * because silently replacing a lineage record is the one thing this structure
 * exists to prevent.
 */
export function addPassport(
  collection: MascotCollection,
  passport: MascotPassport,
): MascotCollection {
  if (collection.passports.some((entry) => entry.id === passport.id)) return collection;
  return {
    passports: [...collection.passports, passport],
    activeMascotId: passport.id,
  };
}
