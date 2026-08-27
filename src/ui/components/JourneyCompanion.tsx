import { journeyCompanionMessage } from '../../domain/game/journeyCompanionContext';
import type { MascotPersonality } from '../../domain/game/types';
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
 */

interface JourneyCompanionProps {
  presence: JourneyCompanionPresence;
  personality: MascotPersonality;
}

export function JourneyCompanion({ presence, personality }: JourneyCompanionProps) {
  const message = journeyCompanionMessage(presence.context, personality);
  const reaction = journeyCompanionPresentation(presence.context);

  return (
    <section
      className="journey-home__companion"
      aria-label="Your companion"
      data-companion-reaction={reaction}
    >
      {/*
        TEMPORARY PRESENTATION FALLBACK - the same placeholder Today uses.

        `family.glyph` is a single letter, not mascot artwork, and it is aria-hidden
        because the name beside it is the real answer to "who is this". It should be
        replaced by the art pipeline rather than refined here.
      */}
      <span className="journey-home__companion-mark" aria-hidden="true">
        {presence.family.glyph}
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
