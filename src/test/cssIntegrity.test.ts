import { describe, expect, it } from 'vitest';
import {
  blockBodies,
  collectDeclarations,
  collectUsages,
  leafBlockBodies,
  readStyleFiles,
  tokensDeclaredIn,
} from './cssSource';

/**
 * The CSS token integrity guard.
 *
 * This exists because two phases shipped the same class of defect and both were
 * caught by luck rather than by tooling:
 *
 *   Phase 1  a rename produced `--ft-surface-raised-sunken` and
 *            `--ft-border-subtle-strong` - 20 references to variables that were
 *            never declared, so every sunken panel silently lost its background.
 *   Phase 3  a font-size cleanup stripped sizing from `.empty`.
 *
 * A build does not fail on an undefined custom property. A browser just drops the
 * declaration. Nothing else in the toolchain notices, which is precisely why this
 * has to be a test.
 *
 * It reads CSS source rather than build output, is structural rather than a
 * snapshot, and is deterministic.
 */

const files = readStyleFiles();
const declarations = collectDeclarations(files);
const usages = collectUsages(files);

const declaredTokens = new Set(declarations.map((entry) => entry.token));

describe('the guard can see the stylesheet', () => {
  it('reads every CSS file in src/styles', () => {
    expect(files.length).toBeGreaterThan(15);
    expect(files.map((file) => file.name)).toContain('tokens/semantic.css');
    expect(files.map((file) => file.name)).toContain('index.css');
  });

  it('reads real content, not empty strings', () => {
    for (const file of files) {
      expect(file.raw.length, `${file.name} is empty`).toBeGreaterThan(0);
    }
  });

  it('ignores commented-out code', () => {
    // Comments in these files mention token names; they must not count as usage.
    const commented = files.find((file) => file.raw.includes('/*'));
    expect(commented).toBeDefined();
    expect(commented?.code).not.toContain('/*');
  });

  it('finds a plausible number of tokens', () => {
    expect(declaredTokens.size).toBeGreaterThan(40);
    expect(usages.length).toBeGreaterThan(100);
  });
});

describe('every referenced custom property is declared', () => {
  it('has no undefined tokens anywhere', () => {
    const undefinedRefs = usages.filter((entry) => !declaredTokens.has(entry.token));

    const detail = undefinedRefs
      .map((entry) => `${entry.token} (used in ${entry.file})`)
      .join('\n  ');

    expect(undefinedRefs, `Undefined custom properties:\n  ${detail}`).toEqual([]);
  });
});

describe('malformed compound token names', () => {
  /**
   * The signature of the Phase 1 defect: a mechanical rename appends a suffix to a
   * token that already exists, producing a name that looks plausible but was never
   * declared. Reported separately from a plain typo, because the cause and the fix
   * are different.
   */
  function collisionSuspects(): Array<{ token: string; file: string; stem: string }> {
    const suspects: Array<{ token: string; file: string; stem: string }> = [];

    for (const entry of usages) {
      if (declaredTokens.has(entry.token)) continue;
      for (const declared of declaredTokens) {
        if (entry.token.startsWith(`${declared}-`)) {
          suspects.push({ token: entry.token, file: entry.file, stem: declared });
          break;
        }
      }
    }
    return suspects;
  }

  it('finds none', () => {
    const suspects = collisionSuspects();
    const detail = suspects
      .map((s) => `${s.token} in ${s.file} - looks like "${s.stem}" with a suffix appended`)
      .join('\n  ');

    expect(suspects, `Probable rename collisions:\n  ${detail}`).toEqual([]);
  });

  it('would catch the two historical defects', () => {
    // Guard-the-guard: prove the detection works, using the real declared set.
    const fakeUsages = ['--ft-surface-raised-sunken', '--ft-border-subtle-strong'];

    for (const fake of fakeUsages) {
      expect(declaredTokens.has(fake), `${fake} must not be declared`).toBe(false);

      const stem = [...declaredTokens].find((declared) => fake.startsWith(`${declared}-`));
      expect(stem, `${fake} should be recognised as a suffixed collision`).toBeDefined();
    }
  });

  it('does not flag a legitimate token that merely shares a prefix', () => {
    // --ft-text-secondary and --ft-text-sm coexist; both are declared, so neither
    // is a suspect. This asserts the check keys on "undeclared", not on shape.
    expect(declaredTokens.has('--ft-text-secondary')).toBe(true);
    expect(declaredTokens.has('--ft-text-sm')).toBe(true);
  });
});

describe('fallback syntax does not create false positives', () => {
  it('only treats the first var() argument as a reference', () => {
    const withFallback = 'a { color: var(--ft-accent, #fff); width: var(--ft-space-4, 16px); }';
    const parsed = collectUsages([{ name: 'x.css', raw: withFallback, code: withFallback }]);

    expect(parsed.map((entry) => entry.token)).toEqual(['--ft-accent', '--ft-space-4']);
  });

  it('still sees a token used as a fallback for another', () => {
    const nested = 'a { color: var(--ft-accent, var(--ft-text-primary)); }';
    const parsed = collectUsages([{ name: 'x.css', raw: nested, code: nested }]);

    expect(parsed.map((entry) => entry.token)).toEqual(['--ft-accent', '--ft-text-primary']);
  });

  it('does not mistake a declaration for a usage or vice versa', () => {
    const both = ':root { --ft-a: 1px; } .x { margin: var(--ft-a); }';
    const file = [{ name: 'x.css', raw: both, code: both }];

    expect(collectDeclarations(file).map((entry) => entry.token)).toEqual(['--ft-a']);
    expect(collectUsages(file).map((entry) => entry.token)).toEqual(['--ft-a']);
  });
});

describe('duplicate declarations', () => {
  /**
   * Redeclaring a token in a DIFFERENT block is the whole point of theming - the
   * dark block and each path block legitimately restate the same names. Only a
   * repeat inside one block is a mistake, so that is all this checks. Anything
   * broader would fire constantly and get switched off, which is worse than no
   * check at all.
   */
  it('declares each token at most once per block', () => {
    const offenders: string[] = [];

    for (const file of files) {
      for (const body of leafBlockBodies(file.code)) {
        const seen = new Map<string, number>();
        for (const match of body.matchAll(/(^|[;{}\s])(--[\w-]+)\s*:/g)) {
          const token = match[2];
          if (token === undefined) continue;
          seen.set(token, (seen.get(token) ?? 0) + 1);
        }
        for (const [token, count] of seen) {
          if (count > 1) offenders.push(`${token} declared ${count}x in one block in ${file.name}`);
        }
      }
    }

    expect(offenders, offenders.join('\n  ')).toEqual([]);
  });
});

/**
 * Tokens whose value is identical in every mode, so restating them in the dark block
 * would be noise. Kept as an explicit, short list rather than a pattern, so adding to
 * it is a deliberate act.
 */
const MODE_INVARIANT = new Set(['--ft-shadow-none']);

describe('the themeable contract is complete in every mode', () => {
  const semantic = files.find((file) => file.name === 'tokens/semantic.css');

  it('has a semantic token file', () => {
    expect(semantic).toBeDefined();
  });

  /**
   * The light `:root` block is the reference set. Every dark variant must restate
   * all of it, or a token silently keeps its light value on a dark surface - the
   * kind of bug that only shows up as unreadable text at night.
   */
  it('restates every light semantic token in each dark block', () => {
    if (semantic === undefined) throw new Error('missing semantic.css');

    const rootBodies = blockBodies(semantic.code, /:root\s*\{/);
    const lightBody = rootBodies[0];
    expect(lightBody).toBeDefined();

    const light = tokensDeclaredIn(lightBody as string);
    // color-scheme is a property, not a token; the set is all custom properties.
    expect(light.size).toBeGreaterThan(15);

    const darkBodies = blockBodies(semantic.code, /:root(?::not\(\[data-theme='light'\]\))?\[?[^{]*dark[^{]*\{/);
    expect(darkBodies.length, 'expected at least one dark block').toBeGreaterThan(0);

    for (const [index, body] of darkBodies.entries()) {
      const dark = tokensDeclaredIn(body);
      // A dark block that only sets color-scheme is a helper, not a theme block.
      if (dark.size < 5) continue;

      const missing = [...light]
        .filter((token) => !MODE_INVARIANT.has(token))
        .filter((token) => !dark.has(token));
      expect(missing, `dark block ${index} omits: ${missing.join(', ')}`).toEqual([]);
    }
  });
});

describe('palette discipline', () => {
  it('keeps raw colour out of component and screen files', () => {
    const offenders = files
      .filter((file) => !file.name.startsWith('tokens/'))
      .flatMap((file) =>
        [...file.code.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(
          (match) => `${match[0]} in ${file.name}`,
        ),
      );

    expect(offenders, `Hardcoded colours outside tokens/:\n  ${offenders.join('\n  ')}`).toEqual(
      [],
    );
  });

  it('introduces no red', () => {
    // The palette deliberately has no red and no error colour. Incompleteness must
    // never read as failure.
    const all = files.map((file) => file.code).join('\n');

    for (const match of all.matchAll(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/g)) {
      const chroma = Number(match[2]);
      const hue = Number(match[3]);
      // Red sits around 20-40 degrees in OKLCH. Low-chroma neutrals are exempt.
      const isRed = chroma > 0.04 && (hue < 40 || hue > 350);
      expect(isRed, `red-family colour found: oklch(${match[1]} ${match[2]} ${match[3]})`).toBe(
        false,
      );
    }
  });
});
