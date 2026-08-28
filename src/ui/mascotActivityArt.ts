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
 * WHAT IS DECLARED TODAY. Two entries, both tortoise: the Walk/Run door and the
 * Cycle door. It went
 * through the pipeline in `skills/ninfit-visual-asset-pipeline/SKILL.md` - a reviewed
 * source sheet kept in `docs/brand/reference/mascots/`, converted once to a canonical
 * WebP under `public/`, and named for its species and family rather than for whatever
 * the generator called it. Reference is still not production: the runtime URL below
 * points at `public/`, never at `docs/`.
 *
 * EVERYTHING ELSE IS STILL `undefined`, AND THAT IS NOT A GAP TO PATCH. Four species
 * and the tortoise's own Swim door have no reviewed art, so they keep the same
 * temporary letter treatment the rest of the app uses. The tortoise having two
 * pictures changes nothing about how a bear is handled - callers must go on treating
 * `undefined` as ordinary, because it is still the answer thirteen times out of
 * fifteen. Nor may a door borrow its neighbour's art: Cycle got a picture by having
 * one drawn and reviewed, never by falling back to Walk/Run.
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
 * An entry here is a statement that a real reviewed file exists at that URL, so adding
 * one before the file lands would produce a broken image for every user of that
 * species - which is worse than the letter. Add the file first, then the line.
 */
export const MASCOT_ACTIVITY_ART: MascotActivityArtManifest = {
  'tortoise:walk-run': {
    src: '/mascots/tortoise/tortoise-journey-walk-run.webp',
    /*
     * Who is pictured, and nothing else. Not "ready for your run" - the picture does
     * not know whether this person is about to walk or run, and the screen must not
     * let it look as though it does. That choice is made by the user, explicitly.
     */
    alt: 'Tortoise in a vest and trainers, out on a trail',
  },
  'tortoise:cycle': {
    src: '/mascots/tortoise/tortoise-journey-cycle.webp',
    /*
     * Who is pictured, and nothing about how far or how fast. The bike is equipment
     * in the picture, not a claim about the ride the user is about to take.
     */
    alt: 'Tortoise in a helmet, riding a bike on a trail',
  },
};

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
