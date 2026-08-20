import { COMPANION_PRESENTATION } from '../../domain/game/companionPresentation';

/**
 * Opal, presented.
 *
 * A presentation primitive and nothing else: it renders the companion's name and
 * description and holds a slot for artwork. It owns no state, reads no game data,
 * and knows nothing about paths, progression or accounts.
 *
 * ALL COPY COMES FROM `COMPANION_PRESENTATION`. Nothing here is hard-coded, so the
 * companion's wording is changed in one place and this component never becomes a
 * second, competing source of product copy.
 *
 * OPAL IS NOT A PATH MASCOT. Nothing here reads a `MascotFamilyId` or a path, and
 * the stylesheet is barred from the accent tokens a path can change - so Opal looks
 * the same for every user, which is the entire point of a shared companion.
 *
 * THE ARTWORK SLOT. `.opal__portrait` is the container real artwork drops into. The
 * letter inside it today is a temporary fallback, not a drawing of Opal, and it is
 * `aria-hidden` because the section already carries a name.
 */
export function Opal() {
  return (
    <section className="opal" aria-label={COMPANION_PRESENTATION.ariaLabel}>
      {/*
        Future artwork goes inside this element. It is aria-hidden as a whole: the
        portrait is decorative, and the section's label is the accessible name, so
        nothing in here should announce itself and duplicate it.
      */}
      <div className="opal__portrait" aria-hidden="true">
        {/* TEMPORARY PRESENTATION FALLBACK. Not Opal artwork - see opal.css. */}
        <span className="opal__placeholder">N</span>
      </div>

      <div className="opal__body">
        <strong className="opal__name t-body-strong">{COMPANION_PRESENTATION.name}</strong>

        <span className="opal__description t-small">
          {COMPANION_PRESENTATION.description}
        </span>
      </div>
    </section>
  );
}
