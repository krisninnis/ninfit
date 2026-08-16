import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  COMPANION_PRESENTATION,
} from '../domain/game/companionPresentation';
import {
  COMPANION_ID,
  OPAL,
  type CompanionId,
} from '../domain/game/companion';
import type { MascotFamilyId } from '../domain/game/types';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');

/** Source with comments stripped, for every "must NOT contain" assertion. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const component = read('ui', 'components', 'Opal.tsx');
const opalCss = read('styles', 'components', 'opal.css');
const indexCss = read('styles', 'index.css');

describe('Opal companion presentation', () => {
  it('uses the canonical companion identity', () => {
    expect(COMPANION_PRESENTATION.id).toBe(COMPANION_ID);
    expect(COMPANION_PRESENTATION.id).toBe(OPAL.id);
    expect(COMPANION_PRESENTATION.name).toBe('Opal');
  });

  it('has presentation copy without owning behaviour', () => {
    expect(COMPANION_PRESENTATION.description).toBe(
      'Your friendly NinFit companion.',
    );
    expect(COMPANION_PRESENTATION.ariaLabel).toBe(
      'Opal, your NinFit companion',
    );
  });

  it('remains a separate type from path mascot families', () => {
    const companion: CompanionId = COMPANION_PRESENTATION.id;
    expect(companion).toBe('opal');

    // @ts-expect-error Opal must never become a path mascot family.
    const family: MascotFamilyId = COMPANION_PRESENTATION.id;
    expect(family).toBe('opal');
  });

  it('does not introduce progression or persistence', () => {
    const presentation = COMPANION_PRESENTATION as Record<string, unknown>;

    expect(presentation).not.toHaveProperty('level');
    expect(presentation).not.toHaveProperty('stage');
    expect(presentation).not.toHaveProperty('xp');
    expect(presentation).not.toHaveProperty('unlocked');
    expect(presentation).not.toHaveProperty('owned');
    expect(presentation).not.toHaveProperty('state');
  });
});

describe('Opal component boundary', () => {
  it('has a dedicated component and stylesheet', async () => {
    const component = await import('../ui/components/Opal');
    expect(component.Opal).toBeTypeOf('function');
  });

  it('is wired into the stylesheet, not merely present on disk', () => {
    // An unimported stylesheet is the failure that looks like it works: the file
    // exists, the class names match, and none of it reaches the browser.
    expect(indexCss).toContain("@import './components/opal.css'");
  });

  it('takes every word of its copy from the presentation module', () => {
    expect(component).toContain("from '../../domain/game/companionPresentation'");
    expect(component).toContain('{COMPANION_PRESENTATION.name}');
    expect(component).toContain('{COMPANION_PRESENTATION.description}');
    expect(component).toContain('aria-label={COMPANION_PRESENTATION.ariaLabel}');

    // Nothing hard-coded alongside it, or the module stops being the source.
    expect(code(component)).not.toContain(COMPANION_PRESENTATION.name + '<');
    expect(code(component)).not.toContain(COMPANION_PRESENTATION.description);
  });
});

describe('Opal stays neutral, whatever path the user chose', () => {
  /**
   * A path may change exactly five tokens (tokens/paths.css). If Opal reads any of
   * them, the one companion everybody shares silently becomes a path indicator.
   * `.opal__mark` was `color: var(--ft-accent)` before this slice, so this is a
   * regression that has already happened once.
   */
  const PATH_TOKENS = [
    '--ft-accent',
    '--ft-accent-strong',
    '--ft-accent-soft',
    '--ft-accent-ring',
    '--ft-text-on-accent',
  ];

  it('reads none of the path-driven accent tokens', () => {
    for (const token of PATH_TOKENS) {
      expect(code(opalCss), `opal.css reads ${token}`).not.toContain(`var(${token})`);
    }
  });

  it('introduces no path-specific selector', () => {
    expect(code(opalCss)).not.toContain('data-path');
    for (const family of ['tortoise', 'bear', 'fox', 'otter', 'wolf']) {
      expect(code(opalCss), `opal.css mentions ${family}`).not.toContain(family);
    }
  });

  it('hard-codes no colour of its own', () => {
    expect(code(opalCss)).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgb\(|\bhsl\(|\boklch\(/);
  });
});

describe('the artwork slot is ready and honest', () => {
  it('has a semantic container the real artwork can drop into', () => {
    expect(component).toContain('opal__portrait');
    expect(opalCss).toContain('.opal__portrait');
    // Sized and masked, so a future asset needs no pre-cropping and no re-layout.
    expect(opalCss).toContain('.opal__portrait > img');
    expect(opalCss).toContain('.opal__portrait > svg');
  });

  it('depends on no image file, because none exists yet', () => {
    expect(code(opalCss)).not.toContain('url(');
    expect(component).not.toMatch(/^import .*\.(png|jpe?g|webp|avif|svg)/m);
    expect(component).not.toContain('<img');
    // The asset folder is still a scaffold; nothing may pretend otherwise.
    const assets = readdirSync(join(SRC, 'assets', 'mascots', 'opal'), {
      withFileTypes: true,
    }).filter((entry) => entry.isFile() && entry.name !== '.gitkeep');
    expect(assets).toEqual([]);
  });

  it('marks the letter as a temporary fallback rather than as artwork', () => {
    expect(component).toContain('TEMPORARY PRESENTATION FALLBACK');
    expect(opalCss).toContain('TEMPORARY PRESENTATION FALLBACK');
    expect(opalCss).toContain('NOT OPAL ARTWORK');
  });

  it('keeps the decorative portrait out of the accessibility tree', () => {
    // The section is already named; a letter would only duplicate it.
    //
    // Sliced from the comment-stripped source: the doc comment above also mentions
    // `opal__portrait`, so slicing the raw file starts inside prose and drags the
    // section's own aria-label into the range.
    const markup = code(component);
    const portrait = markup.slice(
      markup.indexOf('opal__portrait'),
      markup.indexOf('opal__body'),
    );
    expect(portrait).toContain('aria-hidden="true"');
    expect(portrait).not.toContain('alt=');
    expect(portrait).not.toContain('aria-label');
  });
});

describe('Opal uses the shared design system', () => {
  it('takes its type from the shared roles rather than restating them', () => {
    expect(component).toContain('t-body-strong');
    expect(component).toContain('t-small');
    // Only colour is decided locally; size and weight come from the roles.
    expect(opalCss).not.toMatch(/\.opal__name\s*\{[^}]*font-size/);
    expect(opalCss).not.toMatch(/\.opal__description\s*\{[^}]*font-size/);
  });

  it('sizes the portrait from an existing scale, not a magic number', () => {
    expect(opalCss).toContain('--opal-portrait-size: var(--ft-control-md)');
    expect(opalCss).not.toMatch(/\.opal__portrait\s*\{[^}]*\b\d{2,}px/);
  });

  it('adds no game logic, persistence or routing', () => {
    // Word boundaries, not substrings: a bare `xp` search matches `export`, which is
    // in every module in the repository.
    for (const forbidden of [
      'useState',
      'useEffect',
      'localStorage',
      'xp',
      'level',
      'reward',
      'cosmetic',
      'pathId',
    ]) {
      expect(code(component), `Opal.tsx contains ${forbidden}`).not.toMatch(
        new RegExp(`\\b${forbidden}\\b`, 'i'),
      );
    }
    expect(code(component)).not.toContain('location.hash');
  });
});
