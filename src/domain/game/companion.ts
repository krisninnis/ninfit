import type { MascotFamilyId } from './types';

/**
 * Opal: the NinFit companion, and deliberately NOT a sixth fitness path.
 *
 * WHY THIS IS A SEPARATE FILE AND A SEPARATE TYPE.
 *
 * The five path mascots answer "which programme did you choose" - one per fitness
 * path, earned by hatching, evolving through five stages, owned by the user. Opal
 * answers nothing about the user at all: Opal is the character who explains NinFit,
 * and everybody has the same one from the moment they open the app.
 *
 * Those are different jobs, so they are different types. `CompanionId` and
 * `MascotFamilyId` share no members, which means `'opal'` cannot be assigned where a
 * family is expected and a family cannot be assigned where the companion is expected.
 * The compiler enforces the product decision; nobody has to remember it. See the
 * `@ts-expect-error` assertions in mascotArchitecture.test.ts, which fail to compile
 * if the two unions are ever merged.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO.
 *
 * No behaviour, no dialogue, no personality model, no artwork, no animation, no
 * rewards, no cosmetics, no persistence, no schema. It is a declaration of who Opal
 * is and what Opal is for, so the rest of the system has something correct to point
 * at. `roles` is documentation with a type attached - nothing dispatches on it yet,
 * and nothing should until there is a milestone that says so.
 *
 * ON THE NAME. "Opal" already appears in the product in two other places, and this
 * type is neither of them:
 *
 *   - the Opal Egg, named for its milky-opal material (see egg.ts) - an object;
 *   - the `--ninfit-opal` gradient in the brand marks - a colour.
 *
 * The companion is the character. The overlap is a brand-vocabulary choice rather
 * than a modelling one, and no code should infer a relationship between them.
 */

export const COMPANION_ID = 'opal';

export type CompanionId = typeof COMPANION_ID;

/**
 * What the companion is for.
 *
 * Taken from the roadmap's companion roles rather than invented here. These are
 * labels for a decision already made, not a dispatch table: nothing reads them to
 * choose behaviour, because there is no behaviour in this slice.
 */
export type CompanionRole =
  | 'onboarding_guide'
  | 'account_guide'
  | 'assistant'
  | 'coach_interface'
  | 'achievement_companion'
  | 'celebration'
  | 'return_companion';

export const COMPANION_ROLES: readonly CompanionRole[] = [
  'onboarding_guide',
  'account_guide',
  'assistant',
  'coach_interface',
  'achievement_companion',
  'celebration',
  'return_companion',
] as const;

export interface Companion {
  readonly id: CompanionId;
  /** Shown to the user. The one character name that is not a surprise. */
  readonly name: string;
  readonly roles: readonly CompanionRole[];
}

/**
 * The single companion. There is exactly one, and it is not chosen, earned or
 * hatched - which is the whole difference between Opal and a path mascot.
 */
export const OPAL: Companion = {
  id: COMPANION_ID,
  name: 'Opal',
  roles: COMPANION_ROLES,
};

export function isCompanionId(value: unknown): value is CompanionId {
  return value === COMPANION_ID;
}

/**
 * A companion id is never a fitness-path mascot family.
 *
 * Runtime counterpart to the compile-time separation above, for anything arriving
 * from outside the type system - an imported backup, a hand-edited value, a future
 * API. It answers with the type narrowed rather than a bare boolean so callers get
 * the benefit at the call site.
 */
export function isPathMascotFamily(
  value: string,
  families: readonly MascotFamilyId[],
): value is MascotFamilyId {
  return (families as readonly string[]).includes(value);
}
