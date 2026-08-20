/**
 * Where the startup cinematic's media lives. One place, no React, no DOM.
 *
 * WHY URLS AND NOT IMPORTS. The video is 718 kB. `import`ing it would hand the
 * bundler a reason to inline or fingerprint it into the JavaScript graph, so every
 * user - including the overwhelming majority who have already seen the intro once and
 * will never see it again - would pay for it on every load. Serving it from `public/`
 * means the browser fetches it exactly once, on the one launch that plays it, and
 * caches it normally.
 *
 * The brand wordmark is the opposite case and is deliberately imported by the
 * component: it is a 2 kB SVG, it must be the real asset rather than something
 * redrawn in CSS, and having the bundler track it means a rename cannot silently
 * produce a blank logo.
 *
 * BASE_URL rather than a leading slash, because `vite.config.ts` sets `base: './'`
 * so the built app stays portable to any host or sub-path. A hard `/intro/...` would
 * break the moment NinFit is served from anywhere other than a domain root.
 */

const BASE = import.meta.env?.BASE_URL ?? '/';

export const INTRO_VIDEO_URL = `${BASE}intro/ninfit-intro-v1.mp4`;

/**
 * Where the ElevenLabs voiceover is expected to land.
 *
 * NOT YET PRESENT. Nothing in the repository holds this recording, and no audio is
 * shipped in its place - a different take with a different script would be worse than
 * silence, because it would sound deliberate.
 *
 * To enable it: drop the file at `public/intro/ninfit-intro-voiceover-v1.mp3` and
 * flip `INTRO_VOICEOVER_AVAILABLE` to true. Nothing else needs to change; the audio
 * element, the playback attempt, the autoplay-blocked fallback control and the
 * failure handling are all written and tested below and in `StartupCinematic`.
 *
 * The flag exists so that a first launch does not fire a guaranteed 404 for a file we
 * know is absent. It is not a substitute for the asset and does not pretend to be.
 */
export const INTRO_VOICEOVER_URL = `${BASE}intro/ninfit-intro-voiceover-v1.mp3`;
export const INTRO_VOICEOVER_AVAILABLE = false;

/** The line the recording is expected to speak. Also the caption, for accessibility. */
export const INTRO_VOICEOVER_LINE =
  'Welcome to NinFit. Move, grow, evolve — one step at a time.';

/**
 * How long the cinematic may hold the screen before it gives up and lets the user in.
 *
 * The asset is 5.875 s. This is the backstop for everything that can go wrong with a
 * media element and produce no event at all: a stalled network, a decode failure, a
 * browser that refuses autoplay and never fires `ended`. Nobody may ever be left
 * looking at a frozen splash because a video did not load.
 */
export const INTRO_SAFETY_TIMEOUT_MS = 9000;

/**
 * How long the reduced-motion still card holds before moving on.
 *
 * The still card has no video to end it, so without this it would sit until the
 * safety timeout - nine seconds of a motionless logo, which is a worse experience
 * than the cinematic it replaces. Roughly the length of the clip's own logo card.
 */
export const INTRO_STILL_HOLD_MS = 2600;

export interface IntroVoiceover {
  url: string;
  /** False until the recording exists. The UI degrades silently when false. */
  available: boolean;
  /** What it says, for the visible caption and for assistive technology. */
  line: string;
}

export function introVoiceover(): IntroVoiceover {
  return {
    url: INTRO_VOICEOVER_URL,
    available: INTRO_VOICEOVER_AVAILABLE,
    line: INTRO_VOICEOVER_LINE,
  };
}
