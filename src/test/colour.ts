/**
 * Colour maths for the accessibility tests.
 *
 * WHY THIS IS IN THE TEST SUITE AND NOT A ONE-OFF SCRIPT.
 * The Phase 4 palette was derived by solving for contrast ratios. If those figures
 * only ever lived in a report, the next person to nudge a lightness would have no
 * way of knowing they had broken AA - the build would still pass and the app would
 * still look fine to someone with ordinary vision on a good screen.
 *
 * So the ratios are re-derived here, from the CSS source, every time the suite runs.
 * Nothing below trusts a comment or a committed number.
 *
 * OKLCH -> linear sRGB uses the standard Bjorn Ottosson matrices. Contrast is
 * WCAG 2.x relative luminance.
 */

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

/** Parses `oklch(0.52 0.078 145)`. Returns undefined for any other syntax. */
export function parseOklch(value: string): Oklch | undefined {
  const match = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/.exec(value);
  if (match === null) return undefined;
  const [, l, c, h] = match;
  if (l === undefined || c === undefined || h === undefined) return undefined;
  return { l: Number(l), c: Number(c), h: Number(h) };
}

const LMS_FROM_OKLAB = [
  [1, 0.3963377774, 0.2158037573],
  [1, -0.1055613458, -0.0638541728],
  [1, -0.0894841775, -1.291485548],
] as const;

const LINEAR_RGB_FROM_LMS = [
  [4.0767416621, -3.3077115913, 0.2309699292],
  [-1.2684380046, 2.6097574011, -0.3413193965],
  [-0.0041960863, -0.7034186147, 1.707614701],
] as const;

/** Linear-light sRGB, not clamped, so out-of-gamut colours stay detectable. */
export function oklchToLinearRgb({ l, c, h }: Oklch): [number, number, number] {
  const radians = (h * Math.PI) / 180;
  const lab = [l, c * Math.cos(radians), c * Math.sin(radians)] as const;

  const lms = LMS_FROM_OKLAB.map((row) =>
    (row[0] * lab[0] + row[1] * lab[1] + row[2] * lab[2]) ** 3,
  );

  return LINEAR_RGB_FROM_LMS.map(
    (row) => row[0] * (lms[0] as number) + row[1] * (lms[1] as number) + row[2] * (lms[2] as number),
  ) as [number, number, number];
}

/** True when the colour survives the trip to sRGB without a channel being clipped. */
export function isInSrgbGamut(colour: Oklch, tolerance = 0.001): boolean {
  return oklchToLinearRgb(colour).every(
    (channel) => channel >= -tolerance && channel <= 1 + tolerance,
  );
}

/**
 * WCAG 2.x relative luminance, of the colour as it will actually be displayed.
 *
 * The quantisation to 8 bits is deliberate and it matters. An oklch() value is
 * continuous, but what reaches the eye is an 8-bit-per-channel pixel, and the two
 * do not have the same luminance: the sunken dark surface differs by about 13% in
 * luminance between its exact oklch value and the byte it renders as, which moves
 * a contrast ratio by around 0.17. Measuring the unrounded value would fail colours
 * that are fine on screen, and - more dangerously - could pass ones that are not.
 */
export function relativeLuminance(colour: Oklch): number {
  const [r, g, b] = oklchToLinearRgb(colour).map(toDisplayedChannel);
  return 0.2126 * (r as number) + 0.7152 * (g as number) + 0.0722 * (b as number);
}

/** Linear channel -> the 8-bit value a display shows -> back to linear light. */
function toDisplayedChannel(linear: number): number {
  const clipped = Math.min(1, Math.max(0, linear));
  const encoded = clipped <= 0.0031308 ? 12.92 * clipped : 1.055 * clipped ** (1 / 2.4) - 0.055;
  const byte = Math.round(encoded * 255) / 255;
  return byte <= 0.04045 ? byte / 12.92 : ((byte + 0.055) / 1.055) ** 2.4;
}

export function contrastRatio(a: Oklch, b: Oklch): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

/**
 * Dichromat simulation, Vienot, Brettel and Mollon (1999).
 *
 * THE COEFFICIENTS BELOW SUM TO 1, AND THAT IS THE WHOLE CORRECTNESS CONDITION.
 * A first attempt at this used the widely-copied coefficients (0.494207 / 1.24827
 * for deuteranopia and so on), which belong to a differently normalised LMS space.
 * Paired with this matrix they summed to 1.74, so they did not preserve the neutral
 * axis: white simulated to saturated green, and every ratio derived from it was
 * meaningless. The `preserves the neutral axis` test below exists so that cannot
 * happen again silently - if a coefficient is ever edited, that test fails first.
 *
 * Approximate by nature: it models dichromacy and says nothing about anomalous
 * trichromacy, which is far more common. The assertions built on it are therefore
 * deliberately loose, and are used to catch an accent that disappears into its
 * background, not to certify the palette.
 */
export type ColourVision = 'deuteranopia' | 'protanopia' | 'tritanopia';

const RGB_TO_LMS = [
  [0.31399022, 0.63951294, 0.04649755],
  [0.15537241, 0.75789446, 0.08670142],
  [0.01775239, 0.10944209, 0.87256922],
] as const;

const LMS_TO_RGB = [
  [5.47221206, -4.6419601, 0.16963708],
  [-1.1252419, 2.29317094, -0.1678952],
  [0.02980165, -0.19318073, 1.16364789],
] as const;

/** Each pair reconstructs the missing channel from the other two. Both sum to 1. */
const PROJECTION: Readonly<Record<ColourVision, readonly [number, number]>> = {
  protanopia: [1.05118294, -0.05116099],
  deuteranopia: [0.9509204, 0.0490796],
  tritanopia: [-0.86744736, 1.86727089],
};

export function simulate(colour: Oklch, kind: ColourVision): [number, number, number] {
  const rgb = oklchToLinearRgb(colour).map((channel) => Math.min(1, Math.max(0, channel)));

  const lms = RGB_TO_LMS.map(
    (row) => row[0] * (rgb[0] as number) + row[1] * (rgb[1] as number) + row[2] * (rgb[2] as number),
  );

  const [first, second] = PROJECTION[kind];
  if (kind === 'protanopia') lms[0] = first * (lms[1] as number) + second * (lms[2] as number);
  else if (kind === 'deuteranopia') lms[1] = first * (lms[0] as number) + second * (lms[2] as number);
  else lms[2] = first * (lms[0] as number) + second * (lms[1] as number);

  return LMS_TO_RGB.map((row) =>
    Math.min(1, Math.max(0, row[0] * (lms[0] as number) + row[1] * (lms[1] as number) + row[2] * (lms[2] as number))),
  ) as [number, number, number];
}

export function simulatedLuminance(colour: Oklch, kind: ColourVision): number {
  const [r, g, b] = simulate(colour, kind);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
