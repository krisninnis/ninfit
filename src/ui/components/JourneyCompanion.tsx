import { journeyCompanionMessage } from '../../domain/game/journeyCompanionContext';
import type { MascotPersonality } from '../../domain/game/types';
import type { MascotStageArt } from '../mascotStageArt';
import { journeyCompanionPresentation } from '../journeyCompanionPresentation';
import type { JourneyCompanionPresence } from '../journeyCompanionPresentation';

/**
 * The path companion, present on Journey Home.
 *
 * A STRIP, NOT A SECOND CHARACTER CARD. Today already carries one permanent
 * companion surface, and Journey Home is not the place to build a rival to it. This
 * is a single low row: who is with you, and one reviewed line. No level, no XP bar,
 * no XP count, no stage, no trophy, no hatch or evolve control, no button of any
 * kind - none of which belongs on a screen whose job is going somewhere.
 *
 * OPAL IS NOT THIS COMPANION. Opal is the universal NinFit guide and appears through
 * `Opal.tsx` when there is a reason to explain something. The character walking with
 * you on Journey is your own path mascot, and nothing in this file can reach a
 * `CompanionId`, `COMPANION_PRESENTATION` or the `.opal` presentation primitive.
 *
 * IT DECIDES NOTHING. The context arrives already decided by
 * `journeyCompanionContext`; the family arrives already resolved by
 * `visibleMascotFamily`. This component's whole job is to look up the wording and the
 * atmosphere and render them.
 *
 * NO MOTION. There is no animation to collapse under reduced motion, because none was
 * added. The reaction attribute changes colour only, exactly as it does on Today.
 *
 * IT SHOWS THE ARTWORK IT IS HANDED AND LOOKS FOR NONE. The reviewed standing still
 * arrives already resolved from `mascotStageArt`, the same boundary Today asks. This
 * file therefore knows that a companion may have a picture, and never which picture,
 * which is what lets the remaining four species arrive without editing it. The wave
 * is deliberately not taken even where one exists: Journey Home is a compact strip
 * about going somewhere, and a character that moves in it would be the arcade
 * treatment this interface is not.
 */

interface JourneyCompanionProps {
  presence: JourneyCompanionPresence;
  personality: MascotPersonality;
  /**
   * Reviewed standing artwork for this companion's current stage, or `undefined`.
   *
   * `undefined` is the ordinary answer - fourteen of the fifteen species/stage pairs
   * have no reviewed art - and it keeps the temporary letter this strip has always
   * had. It is never a broken image and never another species.
   */
  art?: MascotStageArt;
}

export function JourneyCompanion({ presence, personality, art }: JourneyCompanionProps) {
  const message = journeyCompanionMessage(presence.context, personality);
  const reaction = journeyCompanionPresentation(presence.context);

  return (
    <section
      className="journey-home__companion"
      aria-label="Your companion"
      data-companion-reaction={reaction}
    >
      {/*
        THE COMPANION MARK, AND THE LETTER THAT IS STILL LOAD-BEARING BEHIND IT.

        Reviewed artwork wears the slot when it exists. When it does not - which is
        still the answer for four species and four of the five tortoise stages - the
        strip keeps `family.glyph`, a single letter that is not mascot artwork and
        that the art pipeline replaces rather than refines.

        Decorative either way. The name beside it is the real answer to "who is this",
        and nothing here states anything about what the user has done or earned.
      */}
      <span
        className="journey-home__companion-mark"
        data-art={art !== undefined ? 'true' : 'false'}
        aria-hidden="true"
      >
        {art !== undefined ? <img src={art.src} alt="" /> : presence.family.glyph}
      </span>

      <span className="journey-home__companion-body">
        <strong className="journey-home__companion-name">{presence.family.name}</strong>
        {message !== undefined ? (
          <small className="journey-home__companion-message">{message}</small>
        ) : null}
      </span>
    </section>
  );
}
