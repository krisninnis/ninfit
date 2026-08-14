import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FITNESS_PATHS, MASCOT_FAMILIES } from '../domain/game/paths';
import { visibleMascotFamily } from '../domain/game/mascot';
import type { MascotState } from '../domain/game/types';

/**
 * How a path is switched on, and what must not give it away too early.
 *
 * These read source rather than rendering, because the suite runs in node with no
 * DOM. That is a real limitation and worth being honest about: they prove the
 * attribute is written in exactly one place and is absent from the onboarding
 * branch, which is the property that matters, but they cannot prove what the
 * browser paints. The browser check covers that.
 */

const SRC = fileURLToPath(new URL('..', import.meta.url));
const app = readFileSync(join(SRC, 'App.tsx'), 'utf8');

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(full));
    else if (entry.isFile() && /\.tsx?$/.test(entry.name)) found.push(full);
  }
  return found;
}

describe('the path is activated in exactly one place', () => {
  it('sets data-path once, on the app root', () => {
    const occurrences = [...app.matchAll(/data-path=/g)];
    expect(occurrences.length, 'path state must not be duplicated in the DOM').toBe(1);
    expect(app).toMatch(/<div className="app" data-path=\{[^}]+\}>/);
  });

  it('binds it to the stored path, so an absent path omits the attribute', () => {
    // React drops an attribute whose value is undefined, which is what makes the
    // neutral theme the natural resting state rather than a special case.
    expect(app).toContain('data-path={game.state.pathId}');
  });

  it('is the only file that activates a path', () => {
    const offenders = sourceFiles(SRC)
      .filter((path) => !path.endsWith('App.tsx') && !path.includes('test'))
      .filter((path) => readFileSync(path, 'utf8').includes('data-path'));

    expect(offenders, `only App.tsx may set data-path:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });

  it('never hardcodes a path id in a component', () => {
    const ids = FITNESS_PATHS.map((path) => path.id);
    const offenders: string[] = [];

    for (const path of sourceFiles(join(SRC, 'ui'))) {
      const code = readFileSync(path, 'utf8');
      for (const id of ids) {
        // Screens legitimately list every path; a *single* one named in isolation
        // is the smell, since that is how path-specific styling creeps back in.
        if (code.includes(`'${id}'`) && !code.includes('FITNESS_PATHS')) {
          offenders.push(`${id} in ${path.slice(SRC.length)}`);
        }
      }
    }

    expect(offenders, `path ids belong in the domain:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });
});

describe('onboarding stays neutral until a path is chosen', () => {
  /**
   * The chooser must not be tinted in any path's colour. Beyond the Mystery Egg,
   * there is a plainer reason: colouring the screen where the recommendation is
   * made would quietly argue for the recommendation.
   */
  it('renders the onboarding branch without a path', () => {
    const branch = /if \(game\.needsOnboarding[\s\S]*?\n  \}/.exec(app);
    expect(branch, 'could not find the onboarding branch').not.toBeNull();

    // Comments stripped first: the branch carries a comment explaining why there
    // is no data-path here, and a naive substring search would match that and
    // report the opposite of the truth.
    const code = (branch?.[0] as string).replace(/\/\/[^\n]*/g, '');

    expect(code).toContain('<div className="app">');
    expect(code).not.toContain('data-path');
  });
});

describe('the Mystery Egg keeps its secret', () => {
  const egg = (eggState: MascotState['eggState']): MascotState => ({
    eggState,
    familyId: 'bear',
    stage: 'starter',
    evolutionReady: false,
  });

  it('reveals no family before the egg hatches', () => {
    expect(visibleMascotFamily(egg('unhatched'))).toBeUndefined();
    expect(visibleMascotFamily(egg('ready'))).toBeUndefined();
    expect(visibleMascotFamily(egg('hatched'))?.id).toBe('bear');
  });

  /**
   * The accent does not weaken this. A path is only themed once onboarding is
   * complete, and by then the app already names the chosen path in words on the
   * Profile screen - so the colour tells the person nothing they have not already
   * been told, and still nothing about which animal is inside the egg.
   */
  it('never derives the accent from the mascot or the egg', () => {
    const styles = readFileSync(join(SRC, 'styles/tokens/paths.css'), 'utf8').toLowerCase();

    // Whole words only, and the family list comes from the domain rather than
    // being retyped here. A plain substring search flagged "bear" inside
    // "load-bearing", which is the same class of false positive the CSS guard
    // was built to avoid.
    const forbidden = ['mascot', 'egg', ...MASCOT_FAMILIES.map((family) => family.id)];

    for (const word of forbidden) {
      const found = new RegExp(`\\b${word}\\b`).test(styles);
      expect(found, `paths.css must not mention "${word}"`).toBe(false);
    }
  });
});
