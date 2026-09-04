import { describe, expect, it } from 'vitest';
import {
  blockBodies,
  declarationsIn,
  leafRules,
  propertiesIn,
  readStyleFiles,
  resolveValue,
} from './cssSource';

/**
 * The Phase 5 onboarding journey, asserted structurally.
 *
 * Structural rather than snapshot on purpose: a screenshot of onboarding would fail
 * on every copy tweak and teach everyone to re-bless it without looking. These test
 * the handful of properties that actually have to hold - that the energy arc cannot
 * change hue, that selecting an answer cannot move the page, and that nothing
 * outside the reveal panel can take a path colour.
 */

const files = readStyleFiles();

function css(name: string): string {
  const found = files.find((entry) => entry.name === name);
  if (found === undefined) throw new Error(`missing stylesheet: ${name}`);
  return found.code;
}

const onboarding = css('screens/onboarding.css');
const egg = css('components/egg.css');
const palette = declarationsIn(blockBodies(css('tokens/palette.css'), /:root\s*\{/)[0] as string);
const semanticLight = declarationsIn(blockBodies(css('tokens/semantic.css'), /:root\s*\{/)[0] as string);

/** The five path families. None of these may reach onboarding before the reveal. */
const PATH_FAMILIES = ['moss', 'clay', 'azure', 'teal', 'iris'];

/**
 * The declarations of one rule, matched on its EXACT selector.
 *
 * Exact, because `.step__option` must not pick up `.step__option--selected` or
 * `.step__reveal .step__path`. Where a selector legitimately appears more than once
 * - a base rule plus a media-query override - the declarations are merged in source
 * order, which is what the browser resolves to at the wider breakpoint.
 */
function rule(source: string, selector: string): Map<string, string> {
  const matches = leafRules(source).filter((entry) => entry.selector === selector);
  expect(matches.length, `no rule found for "${selector}"`).toBeGreaterThan(0);

  const merged = new Map<string, string>();
  for (const match of matches) {
    for (const [property, value] of propertiesIn(match.body)) merged.set(property, value);
  }
  return merged;
}

/** Just the base rule, ignoring any responsive override. */
function baseRule(source: string, selector: string): Map<string, string> {
  const first = leafRules(source).find((entry) => entry.selector === selector);
  expect(first, `no rule found for "${selector}"`).toBeDefined();
  return propertiesIn((first as { body: string }).body);
}

describe('the energy arc cannot change hue', () => {
  /**
   * The critical constraint from DESIGN.md section 12. If the background drifted
   * toward the recommended path's hue mid-flow it would give the ending away and
   * spoil the egg at the same time. Energy may change presence, never colour.
   */
  it('drives the wash from a neutral tint, not from an accent', () => {
    const tint = semanticLight.get('--ft-energy-tint');
    expect(tint, '--ft-energy-tint is not declared').toBeDefined();

    const resolved = resolveValue(tint as string, [semanticLight, palette]);
    expect(resolved, 'the tint does not resolve to a literal').toBeDefined();

    // It must point at a neutral ramp. Naming an accent or a path family here is
    // the exact mistake this test exists to prevent.
    expect(tint).toMatch(/--palette-(warm|ink)-/);
    for (const family of [...PATH_FAMILIES, 'sage', 'amber']) {
      expect(tint, `the energy tint must not use the ${family} family`).not.toContain(family);
    }
  });

  it('varies only opacity with energy', () => {
    const wash = rule(onboarding, '.step::before');
    const opacity = wash.get('opacity');

    expect(opacity, '.step::before sets no opacity').toBeDefined();
    expect(opacity).toContain('var(--energy)');

    // Nothing else may respond to energy - a filter or a hue-rotate here would be
    // a colour change wearing a brightness change's clothes.
    for (const [property, value] of wash) {
      if (property === 'opacity') continue;
      expect(value, `${property} must not depend on --energy`).not.toContain('var(--energy)');
    }
  });

  it('keeps the wash inside the column, so it cannot cause a horizontal scroll', () => {
    const wash = rule(onboarding, '.step::before');
    expect(wash.get('inset')).toBe('0');
    expect(wash.get('position')).toBe('absolute');
  });
});

describe('the egg gives nothing away', () => {
  it('never varies by path', () => {
    expect(egg).not.toContain('data-path');
    for (const family of PATH_FAMILIES) {
      expect(egg, `egg.css must not reference the ${family} family`).not.toContain(family);
    }
  });

  it('is rendered outside anything themed, and sized for each breakpoint', () => {
    expect(onboarding).toMatch(/\.step__egg\s*\{/);
    // 72px tall on a phone per DESIGN.md, larger on a tablet.
    expect(onboarding).toMatch(/\.step__egg[^{]*\.egg\s*\{[^}]*height:\s*72px/);
    expect(onboarding).toMatch(/min-width:\s*768px[\s\S]*\.step__egg[^{]*\.egg\s*\{[^}]*height:\s*96px/);
  });

  it('hands the egg to the ceremony while the ceremony is running', () => {
    /*
     * `screens` beats `components`, so an unqualified `.step__egg .egg` also won
     * during the hatch - and drew a 58px egg inside a full-viewport overlay. Both
     * resting sizes must therefore exclude the running ceremony, or the ceremony's
     * own `min(56vmin, 420px)` can never take effect.
     */
    for (const size of ['72px', '96px']) {
      const at = onboarding.indexOf(`height: ${size}`);
      expect(at, `no rule sets the egg to ${size}`).toBeGreaterThan(-1);
      const selector = onboarding.slice(onboarding.lastIndexOf('}', at) + 1, at);
      expect(selector, `the ${size} rule still applies during the ceremony`).toContain(
        ":not([class*='egg-hatch--'])",
      );
    }
  });

  /**
   * Reduced motion removes the transition, not the value. Because the scale and
   * shadow are computed with calc() from --egg-energy rather than animated toward
   * it, someone who has asked for no motion still sees the egg in the right state -
   * it simply arrives there without travelling.
   */
  it('expresses its state as a computed value, not only as an animation', () => {
    const energised = rule(egg, '.egg--energised');

    expect(energised.get('transform')).toContain('var(--egg-energy)');
    expect(energised.get('transform')).toContain('calc(');
    expect(energised.get('filter')).toContain('var(--egg-energy)');
  });
});

describe('selecting an answer cannot move the page', () => {
  /**
   * Growing the border on selection would push every card below it down by half a
   * pixel and shift what is under the user's thumb mid-tap. The extra visual weight
   * comes from an inset shadow instead, which paints inside the existing box.
   */
  it('never changes the border width between states', () => {
    const base = baseRule(onboarding, '.step__option');
    const selected = rule(onboarding, '.step__option--selected');

    expect(base.get('border')).toBeDefined();
    expect(selected.get('border')).toBeUndefined();
    expect(selected.get('border-width')).toBeUndefined();
    expect(selected.get('border-color'), 'colour may change, width may not').toBeDefined();
  });

  it('carries selection on more than colour', () => {
    const selected = rule(onboarding, '.step__option--selected');

    // Background, border colour and an inset ring, plus the tick in the markup.
    expect(selected.get('background')).toBeDefined();
    expect(selected.get('border-color')).toBeDefined();
    expect(selected.get('box-shadow')).toContain('inset');
  });

  it('keeps touch targets at or above the 56px floor', () => {
    const base = baseRule(onboarding, '.step__option');
    expect(base.get('min-height')).toBe('60px');

    // Small Android drops to 56, which is still above the 44px guideline.
    expect(onboarding).toMatch(/max-width:\s*374px[\s\S]*min-height:\s*56px/);
    expect(onboarding).toMatch(/\.step__nav \.btn\s*\{[^}]*min-height:\s*var\(--ft-control-lg\)/);
  });
});

describe('path colour appears only in the reveal', () => {
  it('gives the reveal panel the accent', () => {
    const reveal = rule(onboarding, '.step__reveal');
    expect(reveal.get('border')).toContain('--ft-accent');
    expect(reveal.get('background')).toContain('--ft-accent-soft');
  });

  /**
   * Phase 4 measured only about 1.15:1 of greyscale separation between adjacent
   * path accents. Five tinted tiles would therefore be five identical tiles to
   * anyone not distinguishing the hues, so the alternatives carry no accent at all
   * and are told apart by name and summary.
   */
  it('gives the alternative paths no accent of their own', () => {
    const alternatives = baseRule(onboarding, '.step__path');
    for (const value of alternatives.values()) {
      expect(value).not.toContain('--ft-accent');
    }
  });

  it('never names a path family anywhere in onboarding', () => {
    for (const family of PATH_FAMILIES) {
      expect(onboarding, `onboarding.css must not reference ${family}`).not.toContain(family);
    }
  });
});

describe('Phase 3 layout survives', () => {
  it('frames the column on a tablet without going two-column', () => {
    expect(onboarding).toMatch(/min-width:\s*768px[\s\S]*max-width:\s*480px/);
    expect(onboarding).not.toMatch(/grid-template-columns:\s*1fr\s+1fr/);
  });

  it('sets no gutter or safe-area of its own', () => {
    // Those belong to the app shell from Phase 3; redefining them here is how
    // safe-area handling quietly regresses on a notched phone.
    expect(onboarding).not.toContain('env(safe-area');
    expect(onboarding).not.toContain('--ft-gutter');
  });
});
