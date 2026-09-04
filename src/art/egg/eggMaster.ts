/**
 * THE CANONICAL PREMIUM EGG MASTER (#134).
 *
 * ONE master, six derived stages. Not six eggs.
 *
 * WHY THIS FILE EXISTS AT ALL.
 *
 * `EggArt` currently draws a placeholder shell inline, and every earlier attempt at
 * production egg art produced a *set of unrelated images*: six generations of the
 * same brief, each with its own silhouette, its own light and its own idea of what
 * the object was. Issue #134 asks for the opposite - "one continuous object becoming
 * increasingly alive". A set of images cannot promise that. A single master geometry
 * composed with additive overlays can, and can be proved to, which is the whole
 * reason the artwork is generated from source here rather than drawn six times.
 *
 * WHY VECTOR.
 *
 * The six stages differ only in which fractures are present. In raster that is six
 * full re-renders and six chances for the shell to drift; in vector it is one shell
 * string emitted six times, byte-identical, and `src/test/eggProductionArt.test.ts`
 * checks exactly that. `.gitattributes` already says SVG "belongs under the text
 * rule, and it should diff as text" - so a future change to the egg shows up in
 * review as a readable diff instead of an opaque binary swap. It is also far inside
 * the payload budget: all six stages together are smaller than one background WebP.
 *
 * WHAT IS DELIBERATELY NOT HERE.
 *
 * No species. Not a colour, not a curve, not an identifier, not a filename. Nothing
 * in this module takes a path, a family or anything derived from the user, and the
 * generated files carry no `<text>`, `<title>`, `<desc>` or `<metadata>` that could
 * carry one either. The egg is the same object for everybody until it opens.
 *
 * This module is ART SOURCE. It is imported by the generator and by the guard, and
 * by nothing in the running application - `EggArt` is untouched by this slice, and a
 * test asserts that no runtime module imports this one. Wiring happens in a later
 * slice, after human visual approval, per `skills/ninfit-visual-asset-pipeline`.
 */

/**
 * The stage vocabulary, identical to the domain's `crackStage: 0-5`.
 *
 * Named rather than numbered in the art layer so a stage's *intent* survives the
 * trip from brief to file. The numbers stay the contract; these are the reasons.
 */
export const EGG_STAGE_INTENT = [
  'pristine',
  'hairline',
  'branching',
  'fracture',
  'separating',
  'hatch-ready',
] as const;

export type EggStageIntent = (typeof EGG_STAGE_INTENT)[number];

/** 0-5, mirroring `MAX_CRACK_STAGE` in `src/domain/game/egg.ts`. */
export const EGG_STAGES = [0, 1, 2, 3, 4, 5] as const;

/**
 * The viewBox is `EggArt`'s viewBox, exactly.
 *
 * Not a coincidence and not negotiable: the eventual swap from the inline placeholder
 * to these assets has to cause no layout shift, and the only way to guarantee that
 * without a compensating transform is for both to describe the same box. The pixel
 * canvas is the same box at 4:5, sized for a 420px-wide presentation on a 2x screen.
 */
export const EGG_VIEW_BOX = '0 0 80 100';
export const EGG_CANVAS = { width: 1024, height: 1280 } as const;

/**
 * The silhouette. THE single most protected string in this file.
 *
 * An ovoid rather than `EggArt`'s ellipse: narrow rounded apex, broad base, widest a
 * little below centre. Every stage emits this exact path, and the fracture layers are
 * clipped to it, so no stage can alter the outline even by accident. That is what
 * makes "same silhouette, camera, scale and lighting throughout" a structural fact
 * rather than an instruction somebody has to remember.
 */
const SHELL_PATH =
  'M40 15 C54.4 15 69 38.2 69 61.6 C69 81.8 56.2 96.4 40 96.4 '
  + 'C23.8 96.4 11 81.8 11 61.6 C11 38.2 25.6 15 40 15 Z';

/**
 * The light rules the whole object obeys.
 *
 * One key from the upper left, one cool bounce on the lower right, one warm glow from
 * inside. Stated once as numbers so the gold, the pearl and the escaping light cannot
 * disagree about where the light is - the specific failure that made previous
 * attempts read as six different objects photographed on six different days.
 */
const KEY = { x: 0.36, y: 0.3 } as const;

const PALETTE = {
  pearlHighlight: '#FFFCF6',
  pearlLight: '#FAF3E7',
  pearlMid: '#F0E5D3',
  pearlDeep: '#DBCAB0',
  pearlShadow: '#BEAB90',
  pearlCoolSheen: '#D8DAE6',
  pearlWarmSheen: '#F8DFC5',
  goldBright: '#FFF1C9',
  gold: '#E3C079',
  goldDeep: '#A17A21',
  innerCore: '#FFFAEC',
  innerWarm: '#FFD98C',
  innerDeep: '#C4842A',
  fracture: '#6F5636',
} as const;

/* ------------------------------------------------------------------------- *
 * Shared definitions.
 *
 * Every stage carries the identical `<defs>`, including the ones only the later
 * stages reference. Two reasons: the master block is then provably byte-identical
 * across the set, and a stage cannot acquire a private gradient that quietly
 * relights it. The unused ids cost a few hundred bytes across the whole set.
 * ------------------------------------------------------------------------- */
const DEFS = `  <defs>
    <clipPath id="eggShell">
      <path d="${SHELL_PATH}" />
    </clipPath>
    <radialGradient id="eggPearl" cx="${KEY.x}" cy="${KEY.y}" r="0.86">
      <stop offset="0" stop-color="${PALETTE.pearlHighlight}" />
      <stop offset="0.3" stop-color="${PALETTE.pearlLight}" />
      <stop offset="0.62" stop-color="${PALETTE.pearlMid}" />
      <stop offset="0.85" stop-color="${PALETTE.pearlDeep}" />
      <stop offset="1" stop-color="${PALETTE.pearlShadow}" />
    </radialGradient>
    <radialGradient id="eggSheenCool" cx="0.24" cy="0.72" r="0.5">
      <stop offset="0" stop-color="${PALETTE.pearlCoolSheen}" stop-opacity="0.5" />
      <stop offset="1" stop-color="${PALETTE.pearlCoolSheen}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="eggSheenWarm" cx="0.74" cy="0.34" r="0.46">
      <stop offset="0" stop-color="${PALETTE.pearlWarmSheen}" stop-opacity="0.55" />
      <stop offset="1" stop-color="${PALETTE.pearlWarmSheen}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="eggInner" cx="0.5" cy="0.68" r="0.56">
      <stop offset="0" stop-color="${PALETTE.innerWarm}" stop-opacity="0.42" />
      <stop offset="0.55" stop-color="${PALETTE.innerWarm}" stop-opacity="0.16" />
      <stop offset="1" stop-color="${PALETTE.innerWarm}" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="eggGold" x1="0.12" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="${PALETTE.goldBright}" />
      <stop offset="0.34" stop-color="${PALETTE.gold}" />
      <stop offset="0.72" stop-color="${PALETTE.goldDeep}" />
      <stop offset="1" stop-color="${PALETTE.gold}" />
    </linearGradient>
    <linearGradient id="eggGoldBand" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${PALETTE.goldDeep}" stop-opacity="0" />
      <stop offset="0.12" stop-color="${PALETTE.goldDeep}" stop-opacity="0.78" />
      <stop offset="0.34" stop-color="${PALETTE.goldBright}" stop-opacity="0.98" />
      <stop offset="0.62" stop-color="${PALETTE.gold}" stop-opacity="0.96" />
      <stop offset="0.88" stop-color="${PALETTE.goldDeep}" stop-opacity="0.72" />
      <stop offset="1" stop-color="${PALETTE.goldDeep}" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="eggGoldFine" x1="0" y1="0" x2="1" y2="0.6">
      <stop offset="0" stop-color="${PALETTE.gold}" stop-opacity="0.9" />
      <stop offset="0.5" stop-color="${PALETTE.goldBright}" stop-opacity="0.95" />
      <stop offset="1" stop-color="${PALETTE.goldDeep}" stop-opacity="0.85" />
    </linearGradient>
    <linearGradient id="eggGap" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="${PALETTE.innerCore}" />
      <stop offset="0.42" stop-color="${PALETTE.innerWarm}" />
      <stop offset="1" stop-color="${PALETTE.innerDeep}" />
    </linearGradient>
    <radialGradient id="eggBloom" cx="0.5" cy="0.56" r="0.5">
      <stop offset="0" stop-color="${PALETTE.innerWarm}" stop-opacity="0.9" />
      <stop offset="0.46" stop-color="${PALETTE.innerWarm}" stop-opacity="0.34" />
      <stop offset="1" stop-color="${PALETTE.innerWarm}" stop-opacity="0" />
    </radialGradient>
    <filter id="eggSoft" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="1.15" />
    </filter>
    <filter id="eggSofter" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.4" />
    </filter>
  </defs>`;

/* ------------------------------------------------------------------------- *
 * The master.
 *
 * Shell, pearl depth, iridescence, the restrained gold, and the warm light already
 * living inside a pristine egg. Emitted verbatim into all six files.
 * ------------------------------------------------------------------------- */
const MASTER = `  <g data-egg-layer="master">
    <path d="${SHELL_PATH}" fill="url(#eggPearl)" />
    <g clip-path="url(#eggShell)">
      <ellipse cx="26" cy="70" rx="26" ry="30" fill="url(#eggSheenCool)" />
      <ellipse cx="55" cy="36" rx="22" ry="26" fill="url(#eggSheenWarm)" />
      <ellipse cx="40" cy="66" rx="27" ry="31" fill="url(#eggInner)" />
      <path
        d="M29.6 32.8 C24.4 39.4 21.6 47.2 21.4 55.4 C21.3 60.2 22 64.4 23.4 68.4"
        fill="none" stroke="${PALETTE.pearlHighlight}" stroke-opacity="0.62"
        stroke-width="3.4" stroke-linecap="round" filter="url(#eggSoft)" />
      <path
        d="M33.4 27.4 C30.6 30 28.4 32.8 26.6 35.8"
        fill="none" stroke="#FFFFFF" stroke-opacity="0.72"
        stroke-width="2.2" stroke-linecap="round" filter="url(#eggSoft)" />
      <path
        d="M62.4 52.6 C63.6 62.8 60.8 73.4 54.4 81.6 C50.6 86.4 46 89.8 41.2 91.4"
        fill="none" stroke="${PALETTE.pearlWarmSheen}" stroke-opacity="0.55"
        stroke-width="3" stroke-linecap="round" filter="url(#eggSoft)" />
      <path
        d="M17.6 66.2 C19.4 78 26.4 87.6 36 91.4"
        fill="none" stroke="${PALETTE.pearlShadow}" stroke-opacity="0.34"
        stroke-width="4.6" stroke-linecap="round" filter="url(#eggSofter)" />
    </g>
    <path d="${SHELL_PATH}" fill="none" stroke="${PALETTE.pearlShadow}"
      stroke-opacity="0.5" stroke-width="0.7" />
    <g data-egg-layer="inlay" clip-path="url(#eggShell)">
      <path
        d="M12.2 53.8 C21.2 61.4 30.8 64.6 40 64.6 C49.2 64.6 58.8 61.4 67.8 53.8"
        fill="none" stroke="url(#eggGoldBand)" stroke-width="1.3" stroke-linecap="round" />
      <path
        d="M13.2 49.8 C21.8 56.4 31 59.2 40 59.2 C49 59.2 58.2 56.4 66.8 49.8"
        fill="none" stroke="url(#eggGoldBand)" stroke-width="0.4"
        stroke-linecap="round" stroke-opacity="0.62" />
      <path
        d="M14.8 63.4 C22.6 69 31.4 71.4 40 71.4 C48.6 71.4 57.4 69 65.2 63.4"
        fill="none" stroke="url(#eggGoldBand)" stroke-width="0.32"
        stroke-linecap="round" stroke-opacity="0.4" />
      <path d="M40 61.9 L41.7 63.8 L40 65.7 L38.3 63.8 Z" fill="url(#eggGold)" />
      <circle cx="27.8" cy="61.6" r="0.55" fill="url(#eggGold)" fill-opacity="0.72" />
      <circle cx="52.2" cy="61.6" r="0.55" fill="url(#eggGold)" fill-opacity="0.72" />
      <path
        d="M40 20.2 C43.6 24.2 43.8 28.6 40 32.4 C36.2 28.6 36.4 24.2 40 20.2 Z"
        fill="none" stroke="url(#eggGoldFine)" stroke-width="0.5"
        stroke-linecap="round" stroke-opacity="0.88" />
      <path
        d="M40 23.8 C41.6 26.2 41.6 28.4 40 30.4"
        fill="none" stroke="url(#eggGoldFine)" stroke-width="0.28"
        stroke-linecap="round" stroke-opacity="0.5" />
      <path
        d="M40 34.6 C40 40.2 40 45.4 40 49.6"
        fill="none" stroke="url(#eggGoldFine)" stroke-width="0.26"
        stroke-linecap="round" stroke-opacity="0.26" />
      <path
        d="M22.8 44.4 C20.6 49 19.4 53.8 19.2 58.6"
        fill="none" stroke="url(#eggGoldFine)" stroke-width="0.26"
        stroke-linecap="round" stroke-opacity="0.24" />
      <path
        d="M57.2 44.4 C59.4 49 60.6 53.8 60.8 58.6"
        fill="none" stroke="url(#eggGoldFine)" stroke-width="0.26"
        stroke-linecap="round" stroke-opacity="0.24" />
    </g>
  </g>`;

/* ------------------------------------------------------------------------- *
 * Fractures.
 *
 * HOW A CRACK IS DRAWN, ONCE, EVERYWHERE.
 *
 * Three passes over the same path: a wide blurred warm glow (light finding a way
 * out), the dark broken edge itself, and a fine bright lip on the key-lit side. The
 * order matters - glow first, so the light reads as coming from behind the shell
 * rather than painted on the front of it - and it is the same idiom the placeholder
 * already uses in `egg.css`, so the eventual swap changes the fidelity and not the
 * language.
 *
 * The fracture colour is a warm brown, never black. Black is a hole; this is a shell
 * an amount of light is getting through.
 */
function crack(d: string, weight: number, glow: number): string {
  const path = d.replace(/\s+/g, ' ').trim();
  return `      <path d="${path}" fill="none" stroke="${PALETTE.innerWarm}"`
    + ` stroke-opacity="${glow}" stroke-width="${(weight * 3.6).toFixed(2)}"`
    + ` stroke-linecap="round" stroke-linejoin="round" filter="url(#eggSoft)" />
      <path d="${path}" fill="none" stroke="${PALETTE.fracture}"`
    + ` stroke-opacity="0.86" stroke-width="${weight.toFixed(2)}"`
    + ` stroke-linecap="round" stroke-linejoin="round" />
      <path d="${path}" fill="none" stroke="${PALETTE.pearlHighlight}"`
    + ` stroke-opacity="0.5" stroke-width="${(weight * 0.42).toFixed(2)}"`
    + ` stroke-linecap="round" stroke-linejoin="round"`
    + ` transform="translate(-0.42 -0.42)" />`;
}

/**
 * An opening: shell that has actually parted, with the inside showing.
 *
 * Neutral warm light and nothing else. There is no anatomy, no second colour and no
 * shape behind the gap that could be read as a creature - a silhouette glimpsed
 * through a stage-5 fissure would leak the species as surely as a filename would.
 */
function opening(d: string, opacity: number): string {
  const path = d.replace(/\s+/g, ' ').trim();
  return `      <path d="${path}" fill="${PALETTE.innerWarm}"`
    + ` fill-opacity="${(opacity * 0.8).toFixed(2)}" filter="url(#eggSofter)" />
      <path d="${path}" fill="url(#eggGap)" fill-opacity="${opacity}" />
      <path d="${path}" fill="none" stroke="${PALETTE.fracture}"`
    + ` stroke-opacity="0.24" stroke-width="0.28" stroke-linejoin="round" />`;
}

/**
 * The fractures added AT each stage - never a re-description of the whole shell.
 *
 * Index 0 is what stage 1 adds, index 4 is what stage 5 adds. Stage n renders
 * `FRACTURE_LAYERS.slice(0, n)`, so cumulativeness is a property of the composition
 * rather than a promise about six separately drawn pictures. Each layer starts where
 * the previous one ended: the junction coordinates are shared literals, which is why
 * the crack looks like it grew rather than like a new crack appeared beside it.
 */
const FRACTURE_LAYERS: readonly string[] = [
  // 1 - one hairline, off the vertical axis on purpose. A crack down the middle
  // reads as a moulding seam, and a seam is a manufacturing fact, not an event.
  `    <g data-egg-fracture="1">
${crack('M35.8 28.6 L35 31.4 L36.8 33.8 L35.9 36.9 L37.6 39.6', 0.52, 0.34)}
    </g>`,

  // 2 - it forks at 37.6,39.6, unevenly. Two equal branches would read as a drawing
  // of a crack; one long, one short and a whisker read as a crack.
  `    <g data-egg-fracture="2">
${crack('M37.6 39.6 L33.6 42 L34.8 45.2 L31 47.6 L32.2 50.8', 0.64, 0.38)}
${crack('M37.6 39.6 L41.6 41 L41 44.4 L44.8 46.2', 0.54, 0.34)}
${crack('M35.9 36.9 L32.6 35.4 L30.2 33.2', 0.34, 0.24)}
    </g>`,

  // 3 - both branches travel around the flanks rather than straight down, because a
  // fracture on a curved shell follows the curve. A cross-link closes the first
  // plate, which is the moment the lines stop being lines.
  `    <g data-egg-fracture="3">
${crack('M32.2 50.8 L28.8 53.6 L30 57 L26.6 59.8', 0.78, 0.44)}
${crack('M44.8 46.2 L47.4 49 L46 52.6 L49.8 55', 0.72, 0.42)}
${crack('M37.6 39.6 L40.8 37 L43.6 34.6 L45.2 31.4', 0.4, 0.28)}
${crack('M32.2 50.8 L27.6 49.4 L23.8 51.4', 0.44, 0.3)}
    </g>`,

  // 4 - the network crosses the gold band and the first hairlines widen into gaps
  // with light behind them. The shell is beginning to part; it has not opened.
  `    <g data-egg-fracture="4">
${crack('M26.6 59.8 L25.4 63.6 L27.8 66.8 L25.4 70.6', 0.92, 0.5)}
${crack('M49.8 55 L49 59 L52.4 61.6 L51 65.6', 0.88, 0.48)}
${crack('M26.6 59.8 L32.8 62.4 L40.4 62.6 L46.6 60.6 L49.8 55', 0.84, 0.48)}
${opening(
    'M35.8 28.6 L35 31.4 L36.8 33.8 L35.9 36.9 L37.6 39.6 L39.4 38.6 '
      + 'L37.6 35.9 L38.7 33.1 L36.9 30.6 L37.6 28.1 Z',
    0.54,
  )}
${opening(
    'M37.6 39.6 L33.6 42 L34.8 45.2 L31 47.6 L32.2 50.8 L34.2 50.2 '
      + 'L33 47.2 L36.8 44.8 L35.6 41.6 L38.9 40.4 Z',
    0.48,
  )}
    </g>`,

  // 5 - hatch-ready. A seam has closed around the crown, the band plate has parted
  // and the light is loud. The OUTLINE has not moved: the fracture group is clipped
  // to the shell, so no stage can move it even if its coordinates are wrong.
  `    <g data-egg-fracture="5">
${crack('M30.2 33.2 L34 30.4 L40.2 29 L45.2 31.4', 0.86, 0.5)}
${crack('M25.4 70.6 L26.8 74.6 L30.4 77.4 L29.4 81.2', 1.04, 0.54)}
${crack('M51 65.6 L48.8 69.8 L51.2 73.6 L49.4 77.2', 0.98, 0.52)}
${crack('M25.4 70.6 L31.6 72.6 L37.4 71.4', 0.74, 0.42)}
${crack('M51 65.6 L46.4 68.4 L43.4 67.2', 0.68, 0.4)}
${opening(
    'M30.2 33.2 L34 30.4 L40.2 29 L45.2 31.4 L46.1 33.8 L40.4 31.4 '
      + 'L34.9 32.8 L31.2 35.6 Z',
    0.72,
  )}
${opening(
    'M26.6 59.8 L32.8 62.4 L40.4 62.6 L46.6 60.6 L49.8 55 L48.2 52.9 '
      + 'L45.6 58.2 L40.2 60.2 L33.6 60 L27.8 57.5 Z',
    0.78,
  )}
${opening(
    'M32.2 50.8 L28.8 53.6 L30 57 L26.6 59.8 L28.2 60.4 L31.4 57.2 '
      + 'L30.2 53.8 L33.6 51.2 Z',
    0.6,
  )}
${opening(
    'M35.8 28.6 L37.6 28.1 L36.9 30.6 L38.7 33.1 L37.6 35.9 L39.4 38.6 '
      + 'L41.6 38.1 L39.5 35.4 L40.7 32.6 L38.8 30 L39.6 27.2 Z',
    0.7,
  )}
    </g>`,
];

/**
 * The halo of light escaping the shell, drawn BEHIND it.
 *
 * Behind is the point. In front it would be a glow pasted over the artwork; behind,
 * the opaque shell hides all of it except the rim, which is what light leaking out of
 * a closed object actually looks like. It also means the bloom can never change how
 * the shell itself reads, only how much light surrounds it.
 *
 * The element is emitted for every stage and only its opacity moves, so the six files
 * differ in a number rather than in the presence of a layer.
 */
const BLOOM_OPACITY: readonly number[] = [0, 0.06, 0.13, 0.26, 0.5, 0.9];

/** Defensive, and the same clamp `EggArt` already applies to `crackStage`. */
function clampStage(stage: number): number {
  if (!Number.isFinite(stage)) return 0;
  return Math.max(0, Math.min(5, Math.floor(stage)));
}

/** The bloom layer for a stage. Always present; only the opacity is a variable. */
export function eggBloomBlock(stage: number): string {
  const opacity = BLOOM_OPACITY[clampStage(stage)] ?? 0;
  return `  <g data-egg-layer="bloom" opacity="${opacity}">
    <ellipse cx="40" cy="60" rx="39" ry="47" fill="url(#eggBloom)" />
  </g>`;
}

/**
 * The fractures visible at a stage: every layer up to and including it.
 *
 * Clipped to the shell, which is what makes the silhouette guarantee structural. A
 * fracture layer cannot draw outside the egg however wrong its coordinates are, so
 * "same silhouette at every stage" survives future edits by people who have not read
 * this comment.
 */
export function eggFractureBlock(stage: number): string {
  const visible = FRACTURE_LAYERS.slice(0, clampStage(stage));
  if (visible.length === 0) return '  <g data-egg-layer="fracture" clip-path="url(#eggShell)" />';
  return `  <g data-egg-layer="fracture" clip-path="url(#eggShell)">
${visible.join('\n')}
  </g>`;
}

/**
 * The shared, invariant part of every stage file.
 *
 * Exported so the guard can assert it appears verbatim in all six rather than
 * comparing pictures and hoping. If this string is present unmodified in a file, that
 * file is the same egg, lit the same way, at the same scale, in the same camera.
 */
export const EGG_MASTER_BLOCK = `${DEFS}\n${MASTER}`;

/** The silhouette, exported for the guard. Nothing may redraw it. */
export const EGG_SHELL_PATH = SHELL_PATH;

/** How many layers a stage adds; used by the cumulative guard. */
export const EGG_FRACTURE_LAYER_COUNT = FRACTURE_LAYERS.length;

/**
 * One complete production stage file.
 *
 * Deterministic by construction: no randomness, no date, no environment, no counter.
 * Calling this twice on any machine produces identical bytes, which is what lets the
 * guard regenerate the set and compare it to what is committed.
 *
 * `role="presentation"` plus `aria-hidden` because the egg is decorative wherever it
 * appears - the surrounding copy tells a screen-reader user what is happening, and an
 * accessible name here would be one more place a species could escape.
 */
export function eggStageSvg(stage: number): string {
  const value = clampStage(stage);
  const intent = EGG_STAGE_INTENT[value] ?? EGG_STAGE_INTENT[0];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${EGG_CANVAS.width}" height="${EGG_CANVAS.height}" viewBox="${EGG_VIEW_BOX}" preserveAspectRatio="xMidYMid meet" role="presentation" aria-hidden="true" data-egg-stage="${value}" data-egg-intent="${intent}">
${eggBloomBlock(value)}
${EGG_MASTER_BLOCK}
${eggFractureBlock(value)}
</svg>
`;
}

/** The canonical master on its own: stage 0 is the pristine egg, by definition. */
export function eggMasterSvg(): string {
  return eggStageSvg(0);
}

/** `/egg/egg-stage-<n>-v1.svg`. No family, no path, no species anywhere in it. */
export function eggStageAssetPath(stage: number): string {
  return `/egg/egg-stage-${clampStage(stage)}-v1.svg`;
}
