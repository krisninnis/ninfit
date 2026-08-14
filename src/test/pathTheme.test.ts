import { describe, expect, it } from 'vitest';
import { FITNESS_PATHS } from '../domain/game/paths';
import {
  blockBodies,
  declarationsIn,
  readStyleFiles,
  resolveValue,
  tokensDeclaredIn,
} from './cssSource';
import {
  contrastRatio,
  isInSrgbGamut,
  oklchToLinearRgb,
  parseOklch,
  simulate,
  simulatedLuminance,
  type Oklch,
} from './colour';

/**
 * The Phase 4 theme contract.
 *
 * These tests read the real stylesheet and re-derive every claim made about it.
 * Nothing here trusts a hand-written number: the contrast ratios, the gamut checks
 * and the separation from the attention amber are all recomputed from the CSS on
 * every run, so a future tweak to a lightness fails the suite rather than quietly
 * dropping the app below AA.
 */

const files = readStyleFiles();

function file(name: string): string {
  const found = files.find((entry) => entry.name === name);
  if (found === undefined) throw new Error(`missing stylesheet: ${name}`);
  return found.code;
}

const palette = declarationsIn(blockBodies(file('tokens/palette.css'), /:root\s*\{/)[0] as string);

const semanticBodies = blockBodies(file('tokens/semantic.css'), /:root\s*\{/);
const semanticLight = declarationsIn(semanticBodies[0] as string);
const semanticDark = declarationsIn(
  blockBodies(file('tokens/semantic.css'), /:root\[data-theme='dark'\]\s*\{/)[0] as string,
);

const pathsCss = file('tokens/paths.css');

/** The five semantic tokens a path is permitted to change. */
const THEMEABLE = [
  '--ft-accent',
  '--ft-accent-strong',
  '--ft-accent-soft',
  '--ft-text-on-accent',
  '--ft-accent-ring',
] as const;

const PATH_IDS = FITNESS_PATHS.map((path) => path.id);

function pathBlock(id: string): Map<string, string> {
  const bodies = blockBodies(pathsCss, new RegExp(`\\[data-path='${id}'\\]\\s*\\{`));
  expect(bodies.length, `expected exactly one block for ${id}`).toBe(1);
  return declarationsIn(bodies[0] as string);
}

/** Resolves a token to a parsed colour, following var() through the palette. */
function colourOf(scope: Map<string, string>, token: string): Oklch {
  const raw = scope.get(token);
  expect(raw, `${token} is not declared in this scope`).toBeDefined();
  const resolved = resolveValue(raw as string, [scope, palette]);
  expect(resolved, `${token} did not resolve to a literal`).toBeDefined();

  // The one non-oklch literal in the palette is pure white.
  if ((resolved as string).startsWith('oklch(1 0 0')) return { l: 1, c: 0, h: 0 };

  const parsed = parseOklch(resolved as string);
  expect(parsed, `${token} resolved to "${resolved as string}", which is not oklch()`).toBeDefined();
  return parsed as Oklch;
}

function surface(mode: 'light' | 'dark', token: string): Oklch {
  const scope = mode === 'light' ? semanticLight : semanticDark;
  return colourOf(scope, token);
}

/** The accent set a given path resolves to in a given mode. */
function accentsFor(id: string, mode: 'light' | 'dark'): Record<string, Oklch> {
  const scope = pathBlock(id);
  const suffix = mode === 'light' ? 'light' : 'dark';
  return {
    accent: colourOf(scope, `--path-accent-${suffix}`),
    strong: colourOf(scope, `--path-accent-strong-${suffix}`),
    soft: colourOf(scope, `--path-accent-soft-${suffix}`),
    onAccent: colourOf(scope, `--path-on-accent-${suffix}`),
  };
}

describe('the neutral theme is a real state, not an absence', () => {
  it('declares every themeable token in light and in dark', () => {
    for (const token of THEMEABLE) {
      expect(semanticLight.has(token), `${token} missing from the light default`).toBe(true);
      expect(semanticDark.has(token), `${token} missing from the dark default`).toBe(true);
    }
  });

  it('resolves the neutral accent to a real colour in both modes', () => {
    expect(colourOf(semanticLight, '--ft-accent').c).toBeGreaterThan(0);
    expect(colourOf(semanticDark, '--ft-accent').c).toBeGreaterThan(0);
  });

  it('meets AA for the neutral accent on every surface, in both modes', () => {
    for (const mode of ['light', 'dark'] as const) {
      const scope = mode === 'light' ? semanticLight : semanticDark;
      const accent = colourOf(scope, '--ft-accent');
      for (const name of ['--ft-surface-page', '--ft-surface-raised', '--ft-surface-sunken']) {
        const ratio = contrastRatio(accent, surface(mode, name));
        expect(ratio, `neutral accent on ${name} in ${mode} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe('every path exists and exposes the whole contract', () => {
  it('has a CSS block for each of the five paths', () => {
    for (const id of PATH_IDS) expect(pathBlock(id).size).toBeGreaterThan(0);
    expect(PATH_IDS.length).toBe(5);
  });

  it('defines no block for a path the domain does not have', () => {
    const declared = [...pathsCss.matchAll(/\[data-path='([\w-]+)'\]/g)].map((match) => match[1]);
    const unknown = [...new Set(declared)].filter((id) => !PATH_IDS.includes(id as never));

    expect(unknown, `CSS themes a path the domain does not define: ${unknown.join(', ')}`).toEqual([]);
  });

  /**
   * This is what stops one path's colour surviving a switch to another. If every
   * block declares an identical set, selecting a new path necessarily overwrites
   * every value the old one set - there is nothing left to leak.
   */
  it('declares an identical token set in every path block', () => {
    const reference = [...tokensDeclaredIn(blockBodies(pathsCss, new RegExp(`\\[data-path='${PATH_IDS[0]}'\\]\\s*\\{`))[0] as string)].sort();

    expect(reference.length, 'a path should declare light and dark values for four roles').toBe(8);

    for (const id of PATH_IDS) {
      const tokens = [...pathBlock(id).keys()].sort();
      expect(tokens, `${id} does not declare the same tokens as ${PATH_IDS[0] as string}`).toEqual(reference);
    }
  });

  it('maps every themeable token once per mode, always with a fallback', () => {
    // One light mapping and two dark ones: system preference, and explicit choice.
    const mappings = blockBodies(pathsCss, /\[data-path\]\s*\{/);
    expect(mappings.length, 'expected three mode mapping blocks').toBe(3);

    for (const [index, body] of mappings.entries()) {
      const declared = declarationsIn(body);
      for (const token of THEMEABLE) {
        const value = declared.get(token);
        expect(value, `mapping block ${index} does not set ${token}`).toBeDefined();
        expect(
          /var\(\s*--path-[\w-]+\s*,\s*var\(/.test(value as string),
          `${token} in mapping block ${index} has no fallback: ${value as string}`,
        ).toBe(true);
      }
    }
  });

  it('changes nothing outside the accent contract', () => {
    const touched = [...tokensDeclaredIn(pathsCss)].filter((token) => token.startsWith('--ft-'));
    expect(touched.sort()).toEqual([...THEMEABLE].sort());
  });

  /**
   * The reason typography, layout, focus geometry and reduced motion cannot have
   * regressed in this phase: the theme layer sets custom properties and nothing
   * else. No padding, no font-size, no transition, no display. A path can change
   * what colour a thing is and has no vocabulary for changing where it sits.
   */
  it('declares custom properties only, never a real CSS property', () => {
    const offenders: string[] = [];

    for (const body of blockBodies(pathsCss, /[^{}]*\{/)) {
      for (const match of body.matchAll(/(^|[;{])\s*([a-z-]+)\s*:/g)) {
        const property = match[2];
        if (property !== undefined && !property.startsWith('--')) offenders.push(property);
      }
    }

    expect(
      [...new Set(offenders)],
      `the theme layer must only set tokens, but it also sets: ${[...new Set(offenders)].join(', ')}`,
    ).toEqual([]);
  });
});

describe('the mode selectors can actually match the real DOM', () => {
  /**
   * This exists because the Phase 4 proof sheet got exactly this wrong. It set
   * data-theme on a descendant div, where `:root[data-theme=dark]` can never
   * match, and every dark cell silently showed light tokens.
   *
   * The shape that matters: `data-theme` belongs on the document root and
   * `data-path` on `.app`, a DESCENDANT of it. So the dark rules must be written
   * with a descendant combinator. Written as a compound - `:root[...][data-path]` -
   * they would ask for one element that is both the root and carries the path, and
   * would never match anything.
   */
  const darkSelectors = [...pathsCss.matchAll(/([^{}]*\[data-path\])\s*\{/g)]
    .map((match) => (match[1] as string).trim())
    .filter((selector) => selector !== '[data-path]');

  it('has a dark rule for each of the two dark routes', () => {
    expect(darkSelectors.length, `found: ${darkSelectors.join(' | ')}`).toBe(2);
  });

  it('separates the root condition from the path with a descendant combinator', () => {
    for (const selector of darkSelectors) {
      // Whitespace is the whole assertion. The character before it varies -
      // `]` after an attribute, `)` after a :not() - so only the space matters.
      expect(
        /\S\s+\[data-path\]$/.test(selector),
        `"${selector}" joins the root condition to [data-path] without a space, so it can never match`,
      ).toBe(true);
    }
  });

  it('anchors both dark routes at the document root', () => {
    for (const selector of darkSelectors) {
      expect(selector.startsWith(':root'), `"${selector}" is not anchored at :root`).toBe(true);
    }
  });

  /**
   * Today nothing in the app writes data-theme, so the media query is the only
   * live route to dark mode and the attribute route is dormant, matching the
   * pattern semantic.css already established. Both must work: the first is what
   * ships, the second is what a Settings toggle will switch on.
   */
  it('covers both the system preference and an explicit choice', () => {
    expect(darkSelectors.some((selector) => selector.includes(":not([data-theme='light'])"))).toBe(true);
    expect(darkSelectors.some((selector) => selector.includes("[data-theme='dark']"))).toBe(true);
  });
});

describe('an unknown path falls back to neutral', () => {
  /**
   * A path value the CSS has never heard of - a future sixth path, or stale data
   * from an old export - leaves the --path-* tokens undeclared. The mapping then
   * falls through to the sage fallback rather than producing an invalid value,
   * which would drop the accent entirely.
   */
  it('falls back to exactly the value the neutral theme uses, in both modes', () => {
    const mappings = blockBodies(pathsCss, /\[data-path\]\s*\{/);

    // Block 0 is the light mapping; blocks 1 and 2 are the two dark routes.
    for (const [index, body] of mappings.entries()) {
      const neutralScope = index === 0 ? semanticLight : semanticDark;
      const mapping = declarationsIn(body);

      for (const token of THEMEABLE) {
        const fallback = /var\(\s*--path-[\w-]+\s*,\s*(var\([^)]*\))\s*\)/.exec(
          mapping.get(token) as string,
        );
        expect(fallback, `${token} in block ${index} has no recoverable fallback`).not.toBeNull();

        const recovered = resolveValue(fallback?.[1] as string, [palette]);
        const neutral = resolveValue(neutralScope.get(token) as string, [neutralScope, palette]);

        expect(
          recovered,
          `${token} in block ${index} falls back to "${recovered ?? 'nothing'}" but the neutral theme uses "${neutral ?? 'nothing'}"`,
        ).toBe(neutral);
      }
    }
  });
});

describe('accessibility, recomputed from the stylesheet', () => {
  const SURFACES = ['--ft-surface-page', '--ft-surface-raised', '--ft-surface-sunken'] as const;

  for (const path of FITNESS_PATHS) {
    for (const mode of ['light', 'dark'] as const) {
      describe(`${path.name} (${mode})`, () => {
        const accents = accentsFor(path.id, mode);

        it('keeps accent and strong at AA on every surface', () => {
          for (const role of ['accent', 'strong'] as const) {
            for (const name of SURFACES) {
              const ratio = contrastRatio(accents[role] as Oklch, surface(mode, name));
              expect(ratio, `${role} on ${name} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
            }
          }
        });

        it('keeps on-accent text readable over the accent', () => {
          const ratio = contrastRatio(accents.onAccent as Oklch, accents.accent as Oklch);
          expect(ratio, `on-accent over accent is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
        });

        it('keeps primary text readable over the soft tint', () => {
          const ratio = contrastRatio(surface(mode, '--ft-text-primary'), accents.soft as Oklch);
          expect(ratio, `primary text on soft is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
        });

        it('keeps the accent visible against its own soft tint', () => {
          // Graphical contrast: an accent glyph or rule drawn on the tinted panel.
          const ratio = contrastRatio(accents.accent as Oklch, accents.soft as Oklch);
          expect(ratio, `accent on soft is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
        });

        it('stays inside the sRGB gamut', () => {
          for (const [role, colour] of Object.entries(accents)) {
            expect(isInSrgbGamut(colour), `${role} is outside sRGB and will be clipped`).toBe(true);
          }
        });
      });
    }
  }
});

describe('attention stays independent of the path', () => {
  it('never redefines an attention token', () => {
    const attention = [...tokensDeclaredIn(pathsCss)].filter((token) => token.includes('attention'));
    expect(attention, 'a path must not be able to recolour attention').toEqual([]);
  });

  /**
   * Build Strength is the only path whose hue is near the attention amber, and the
   * two do appear on screen together. Hue alone is not enough at that distance, so
   * this asserts a luminance gap as well - the property that survives greyscale.
   */
  it('keeps Build Strength clearly distinct from attention amber', () => {
    for (const mode of ['light', 'dark'] as const) {
      const scope = mode === 'light' ? semanticLight : semanticDark;
      const amber = colourOf(scope, '--ft-attention');
      const strength = accentsFor('build_strength', mode).accent as Oklch;

      const ratio = contrastRatio(strength, amber);
      expect(ratio, `Build Strength vs amber in ${mode} is only ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(1.4);
    }
  });

  it('keeps every path separable from amber by hue or by luminance', () => {
    for (const path of FITNESS_PATHS) {
      for (const mode of ['light', 'dark'] as const) {
        const scope = mode === 'light' ? semanticLight : semanticDark;
        const amber = colourOf(scope, '--ft-attention');
        const accent = accentsFor(path.id, mode).accent as Oklch;

        const hueGap = Math.min(
          Math.abs(accent.h - amber.h),
          360 - Math.abs(accent.h - amber.h),
        );
        const luminanceGap = contrastRatio(accent, amber);

        expect(
          hueGap >= 60 || luminanceGap >= 1.4,
          `${path.name} in ${mode}: only ${hueGap.toFixed(0)} degrees and ${luminanceGap.toFixed(2)}:1 from amber`,
        ).toBe(true);
      }
    }
  });
});

describe('colour is never the only signal', () => {
  /**
   * Guard the guard. A dichromat still sees the neutral axis exactly as a
   * trichromat does, so any correct simulation must leave grey alone. The first
   * version of this simulation did not - it turned white into saturated green -
   * and every ratio derived from it was nonsense that looked plausible. This test
   * is what makes the ones below worth reading.
   */
  it('preserves the neutral axis, which is what makes the simulation trustworthy', () => {
    for (const lightness of [1, 0.75, 0.5, 0.25, 0.05]) {
      const grey: Oklch = { l: lightness, c: 0, h: 0 };
      for (const kind of ['deuteranopia', 'protanopia', 'tritanopia'] as const) {
        const [r, g, b] = simulate(grey, kind);
        const expected = oklchToLinearRgb(grey)[0] as number;

        for (const [channel, value] of Object.entries({ r, g, b })) {
          expect(
            Math.abs(value - expected),
            `${kind} shifted the ${channel} channel of a grey at L=${lightness}`,
          ).toBeLessThan(0.005);
        }
      }
    }
  });

  /**
   * A deliberately loose check. Simulation models dichromacy only, and says nothing
   * about anomalous trichromacy, which is far more common. Paths are named in text
   * everywhere they appear, so this only has to catch an accent that vanishes into
   * its background, not one that merely resembles another path.
   */
  it('keeps every accent visible against its page for simulated dichromacy', () => {
    for (const path of FITNESS_PATHS) {
      for (const mode of ['light', 'dark'] as const) {
        const accent = accentsFor(path.id, mode).accent as Oklch;
        const page = surface(mode, '--ft-surface-page');

        for (const kind of ['deuteranopia', 'protanopia', 'tritanopia'] as const) {
          const a = simulatedLuminance(accent, kind);
          const b = simulatedLuminance(page, kind);
          const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

          expect(
            ratio,
            `${path.name} ${mode} under ${kind} is ${ratio.toFixed(2)}:1 against the page`,
          ).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });
});
