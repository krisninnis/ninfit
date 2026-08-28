import type { MascotFamilyId } from '../domain/game/types';
import type { JourneyActivityFamilyId } from './journeyActivityFamilies';

/**
 * Which picture of your companion belongs on which Journey door.
 *
 * WHAT THIS IS FOR. Each path mascot will eventually have its own artwork for each
 * Journey activity family - the tortoise ready for a walk, on a bike, in the water.
 * That is five species times three families, so the one thing this must not become is
 * an image path typed into a screen. Screens ask this module; it is the only place
 * that knows a mascot has artwork at all.
 *
 * WHY THE MANIFEST IS EMPTY.
 *
 * Because no reviewed mascot artwork exists in this repository yet. NinFit's asset
 * pipeline is explicit that generated art is reference material until a human has
 * reviewed it, that only canonical assets are wired into runtime code, and that raw
 * generated filenames are never referenced directly - see
 * `skills/ninfit-visual-asset-pipeline/SKILL.md`. `docs/brand/reference/mascots/`
 * holds a tortoise reference PNG; reference is not production, and pointing runtime
 * code at it would break exactly the rule the pipeline exists to enforce.
 *
 * So this resolves to `undefined` for every species and every family today, and every
 * caller falls back to the same temporary letter treatment the rest of the app already
 * uses. When a reviewed asset is placed, it becomes one line here and nothing else
 * changes anywhere.
 *
 * WHERE THE FILES GO. `public/mascots/<familyId>/<familyId>-journey-<activityFamily>.webp`,
 * referenced by URL rather than imported - the same reasoning the backgrounds registry
 * documents. A user has one species, so importing fifteen would put fourteen mascots
 * into the bundle for no one.
 */

export interface MascotActivityArt {
  /** URL under `public/`. Never an import, so a missing file cannot break the build. */
  readonly src: string;
  /** Describes who is pictured. Never states a fact about the activity or the user. */
  readonly alt: string;
}

export type MascotActivityArtManifest = Readonly<
  Partial<Record<`${MascotFamilyId}:${JourneyActivityFamilyId}`, MascotActivityArt>>
>;

/**
 * Reviewed, canonical mascot activity artwork.
 *
 * Deliberately empty. An entry here is a statement that a real reviewed file exists at
 * that URL, so adding one before the file lands would produce a broken image for every
 * user of that species - which is worse than the letter.
 */
export const MASCOT_ACTIVITY_ART: MascotActivityArtManifest = {};

/**
 * The intended home for a species/family asset, for whoever places the real file.
 *
 * Exported so the path is written down once and can be asserted, NOT so that callers
 * can build a src from it. Callers use `mascotActivityArt`, which answers only for
 * artwork that has actually been reviewed and declared.
 */
export function mascotActivityArtPath(
  familyId: MascotFamilyId,
  activityFamily: JourneyActivityFamilyId,
): string {
  return `/mascots/${familyId}/${familyId}-journey-${activityFamily}.webp`;
}

/**
 * The artwork for this species on this door, or `undefined` when there is none.
 *
 * `undefined` is the normal answer today and callers must treat it as ordinary rather
 * than exceptional: show the existing fallback, never a broken image and never a
 * different species.
 */
export function mascotActivityArt(
  familyId: MascotFamilyId,
  activityFamily: JourneyActivityFamilyId,
  manifest: MascotActivityArtManifest = MASCOT_ACTIVITY_ART,
): MascotActivityArt | undefined {
  return manifest[`${familyId}:${activityFamily}`];
}
