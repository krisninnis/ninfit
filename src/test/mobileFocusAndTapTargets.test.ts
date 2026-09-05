import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const read = (path: string) => readFileSync(join(repoRoot, path), 'utf8');

const field = read('src/styles/components/field.css');
const ninfitId = read('src/styles/screens/ninfit-id.css');
const base = read('src/styles/base.css');
const index = read('src/styles/index.css');

/** The rule body a selector declares, so a declaration can be checked in context. */
function ruleFor(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Missing rule for ${selector}`);
  const end = css.indexOf('}', start);
  return css.slice(start, end);
}

describe('visible keyboard focus', () => {
  it('still declares one global focus ring', () => {
    expect(base).toContain(':focus-visible {');
    expect(base).toContain('outline: 2px solid var(--ft-accent)');
  });

  /**
   * Layer order beats specificity. `components` is declared after `base`, so an
   * unconditional `outline: none` in a component rule silently removes the global
   * focus ring however specific the base selector is. That is what happened to every
   * framed field: Profile's name, birth year, sex, height and programme dates, and
   * the Settings companion-voice select had no visible focus at all.
   */
  it('does not remove the focus ring from framed fields unconditionally', () => {
    expect(index).toContain('@layer tokens, base, layout, components, screens, motion, overrides;');
    expect(ruleFor(field, '.numberfield__input')).not.toContain('outline: none');
  });

  it('moves the ring to the frame rather than deleting it', () => {
    expect(field).toContain('.numberfield:focus-within');
    expect(ruleFor(field, '.numberfield:focus-within')).toContain('box-shadow');
    expect(ruleFor(field, '.numberfield:focus-within')).toContain('border-color: var(--ft-accent)');
  });
});

describe('thumb-sized targets', () => {
  /**
   * Measured on a 390px phone: "Clear" was 47x26 and the NinFit ID "Sign in" was
   * 47x18, both below the 44px target this project verifies against. Neither may
   * grow visually - they are deliberately quiet - so the target is carried by a
   * pseudo-element and the layout around them does not move.
   */
  it('gives the quiet Clear action a 44px target without resizing it', () => {
    expect(ruleFor(field, '.control__clear')).toContain('position: relative');
    const hit = ruleFor(field, '.control__clear::after');
    expect(hit).toContain("content: ''");
    expect(hit).toContain('position: absolute');
    expect(hit).toContain('inset: -9px -6px');
  });

  it('gives the inline NinFit ID sign-in link a 44px target', () => {
    expect(ruleFor(ninfitId, '  .ninfit-id__link')).toContain('position: relative');
    const hit = ruleFor(ninfitId, '  .ninfit-id__link::after');
    expect(hit).toContain("content: ''");
    expect(hit).toContain('position: absolute');
    expect(hit).toContain('inset: -13px -8px');
  });
});
