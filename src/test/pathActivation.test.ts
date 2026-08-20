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

/**
 * Phase 4 allowed `data-path` in exactly one place, App.tsx. Phase 5 needs a second:
 * the onboarding recommendation panel, which is where the chosen path is finally
 * named and may finally be coloured.
 *
 * "Exactly once" is therefore replaced rather than relaxed. Counting occurrences was
 * only ever a proxy for the properties that actually matter, and those are now
 * asserted directly:
 *
 *   - only these two files may activate a path at all
 *   - every value comes from a FitnessPathId, never a hardcoded string
 *   - nothing before the recommendation stage carries one
 *
 * That is a stronger guarantee than the count it replaces, and it survives a third
 * legitimate activation point appearing later.
 */
const ACTIVATION_FILES = ['App.tsx', 'ui/screens/OnboardingScreen.tsx'];

describe('the path is activated only where it is meant to be', () => {
  it('sets data-path once on the app root, bound to the stored path', () => {
    const occurrences = [...app.matchAll(/data-path=/g)];
    expect(occurrences.length, 'App.tsx must not duplicate path state').toBe(1);
    expect(app).toMatch(/<div className="app" data-path=\{[^}]+\}>/);

    // React drops an attribute whose value is undefined, which is what makes the
    // neutral theme the natural resting state rather than a special case.
    expect(app).toContain('data-path={game.state.pathId}');
  });

  it('activates a path in no files beyond the two sanctioned ones', () => {
    const offenders = sourceFiles(SRC)
      .filter((path) => !path.includes('test'))
      .filter((path) => readFileSync(path, 'utf8').includes('data-path='))
      .filter((path) => {
        const normalised = path.replaceAll('\\', '/');
        return !ACTIVATION_FILES.some((allowed) => normalised.endsWith(allowed));
      });

    expect(
      offenders,
      `only ${ACTIVATION_FILES.join(' and ')} may set data-path:\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });

  /**
   * The rule that makes the whole theme engine safe: a path is always read from
   * state, never typed in. A literal would be a path hardcoded into a component,
   * which is exactly how per-path styling creeps back into screens.
   */
  it('never assigns a hardcoded path id to the attribute', () => {
    const ids = FITNESS_PATHS.map((path) => path.id);

    for (const file of ACTIVATION_FILES) {
      const code = readFileSync(join(SRC, file), 'utf8');
      for (const match of code.matchAll(/data-path=\{?([^}\s>]*)\}?/g)) {
        const value = match[1] ?? '';
        expect(
          ids.some((id) => value.includes(`'${id}'`) || value.includes(`"${id}"`)),
          `${file} hardcodes a path id: data-path={${value}}`,
        ).toBe(false);
      }
    }
  });

  it('only ever activates from a value the domain produced', () => {
    const onboarding = readFileSync(join(SRC, 'ui/screens/OnboardingScreen.tsx'), 'utf8');
    // The activated path is the FINAL chosen one, which is either the domain's
    // recommendation or a FitnessPathId the user picked from the domain's own list.
    // Either way it is never a string assembled in the view.
    expect(onboarding).toContain('data-path={finalPathId}');
    expect(onboarding).toMatch(/const finalPathId = chosenPathId \?\? recommendation\?\.pathId/);
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

describe('nothing before the recommendation carries a path', () => {
  const onboarding = readFileSync(join(SRC, 'ui/screens/OnboardingScreen.tsx'), 'utf8');

  /**
   * The single most important property in Phase 5. The path may be revealed on the
   * recommendation stage and nowhere earlier, so the attribute must live inside the
   * block that only renders on that stage.
   */
  it('scopes data-path to the recommendation stage only', () => {
    const occurrences = [...onboarding.matchAll(/data-path=/g)];
    expect(occurrences.length, 'onboarding should activate a path exactly once').toBe(1);

    const index = onboarding.indexOf('data-path=');
    const guard = onboarding.lastIndexOf("stage.kind === 'recommendation'", index);
    const opensBefore = guard !== -1 && guard < index;

    expect(opensBefore, 'data-path is not inside a recommendation-stage guard').toBe(true);
  });

  it('puts the egg and the wash outside the themed panel', () => {
    // The egg and the background must never sit inside [data-path], or they would
    // inherit the accent and start hinting at the path before it is named.
    const eggIndex = onboarding.indexOf('<EggArt');
    const pathIndex = onboarding.indexOf('data-path=');

    expect(eggIndex).toBeGreaterThan(-1);
    expect(eggIndex, 'the egg must render before the themed panel').toBeLessThan(pathIndex);
  });

  it('drives the energy arc from progress, not from the path', () => {
    expect(onboarding).toContain("style={{ '--energy': energy }");
    expect(onboarding).toMatch(/const energy = progress\.fraction/);
  });

  /**
   * The chooser must not be tinted in any path's colour. Beyond the Mystery Egg,
   * there is a plainer reason: colouring the screen where the recommendation is
   * made would quietly argue for the recommendation.
   */
  it('renders the onboarding branch without a path', () => {
    const branch = /if \(\(game\.needsOnboarding[\s\S]*?\n  \}/.exec(app);
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
