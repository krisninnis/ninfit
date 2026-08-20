import type { CSSProperties } from 'react';
import { BACKDROPS, type BackdropId } from '../backgrounds/registry';

/**
 * The world behind the app.
 *
 * THREE LAYERS, IN THIS ORDER, ALWAYS:
 *
 *   art      the illustration, or a token-derived wash until one exists
 *   veil     a contrast layer between art and content
 *   content  cards and text, on their own opaque surfaces, above this element
 *
 * The veil is not optional and not decorative. Illustration behind body text is the
 * single way an atmospheric background turns into an unreadable one, so the veil is
 * part of the primitive rather than something each screen remembers to add.
 *
 * DECORATIVE, AND ONLY DECORATIVE. `aria-hidden` and no alt text, because every
 * screen already says what it is in words. A screen that would become ambiguous with
 * the artwork removed is a screen with a missing heading.
 *
 * IT NAMES A REGION, NOT A FILE. The only prop is a `BackdropId`; the URL, focal
 * point and veil strength are read from the registry. Nothing here can be pointed at
 * arbitrary CSS by a caller.
 *
 * IT IS NOT A PATH. This sets `data-backdrop`. The fitness path accent is
 * `data-path` on `.app`, set once in App.tsx from game state, and this component
 * neither reads nor writes it.
 *
 * COST WHEN THERE IS NO ARTWORK: nothing is fetched. The placeholder is a gradient
 * built from existing surface tokens, so an unfinished region is quiet rather than
 * broken, and no unrelated stock image ever stands in for missing art.
 */

interface PageBackdropProps {
  id: BackdropId;
}

/** Custom properties the stylesheet reads. Values only; no colour decided here. */
interface BackdropStyle extends CSSProperties {
  '--backdrop-focal-x': string;
  '--backdrop-focal-y': string;
  '--backdrop-veil-light': string;
  '--backdrop-veil-dark': string;
  '--backdrop-art-mobile'?: string;
  '--backdrop-art-desktop'?: string;
}

export function PageBackdrop({ id }: PageBackdropProps) {
  const definition = BACKDROPS[id];

  const style: BackdropStyle = {
    '--backdrop-focal-x': `${definition.focal.x * 100}%`,
    '--backdrop-focal-y': `${definition.focal.y * 100}%`,
    '--backdrop-veil-light': `${definition.veil.light}`,
    '--backdrop-veil-dark': `${definition.veil.dark}`,
    // Only set when real artwork exists. The stylesheet falls back to the
    // placeholder wash when these are absent, so there is never a broken request.
    ...(definition.art
      ? {
          '--backdrop-art-mobile': `url("${definition.art.mobile}")`,
          '--backdrop-art-desktop': `url("${definition.art.desktop}")`,
        }
      : {}),
  };

  return (
    <div
      className="backdrop"
      data-backdrop={id}
      data-artwork={definition.art ? 'production' : 'placeholder'}
      style={style}
      aria-hidden="true"
    >
      <div className="backdrop__art" />
      <div className="backdrop__veil" />
    </div>
  );
}
