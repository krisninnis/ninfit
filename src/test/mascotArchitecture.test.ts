import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  COMPANION_ID,
  COMPANION_ROLES,
  OPAL,
  isCompanionId,
  isPathMascotFamily,
  type CompanionId,
} from '../domain/game/companion';
import { FITNESS_PATHS, MASCOT_FAMILIES, mascotFamilyForPath } from '../domain/game/paths';
import type { MascotFamilyId } from '../domain/game/types';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');

/**
 * Source with comments removed, for every "must NOT contain" assertion.
 *
 * These files explain at length what they deliberately do not do - "not chosen,
 * earned or hatched", "no dialogue, no personality" - so a naive scan finds the
 * forbidden words in the very prose promising their absence.
 */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/**
 * The mascot architecture, as decided.
 *
 *   five path mascots   tortoise, bear, fox, otter, wolf - one per fitness path
 *   Opal                the companion; not a path mascot, not chosen, not earned
 *   owl, red panda      future characters; not in the path system at all
 *
 * The interesting failure this guards against is not someone deleting a family. It
 * is someone adding one - because reference artwork exists for characters that are
 * deliberately not path mascots, and the obvious-looking move when that artwork
 * lands is to wire it into the family union. These tests make that a build failure
 * rather than a product drift.
 */

const CORE_FAMILIES = ['bear', 'fox', 'otter', 'tortoise', 'wolf'] as const;

// ---------------------------------------------------------------------------

describe('exactly five core path mascot families', () => {
  it('declares five, and only five', () => {
    expect(MASCOT_FAMILIES).toHaveLength(5);
    expect(MASCOT_FAMILIES.map((family) => family.id).sort()).toEqual([...CORE_FAMILIES]);
  });

  it('gives every family a distinct id', () => {
    const ids = MASCOT_FAMILIES.map((family) => family.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps the union closed at the type level', () => {
    // If a sixth member is ever added to MascotFamilyId, this stops compiling
    // because the union no longer narrows to the five listed here.
    const exhaustive: Record<MascotFamilyId, true> = {
      tortoise: true,
      bear: true,
      fox: true,
      otter: true,
      wolf: true,
    };
    expect(Object.keys(exhaustive).sort()).toEqual([...CORE_FAMILIES]);
  });
});

// ---------------------------------------------------------------------------

describe('every path maps to exactly one core family', () => {
  const expected = {
    start_moving: 'tortoise',
    build_strength: 'bear',
    build_stamina: 'fox',
    balanced_fitness: 'otter',
    return_to_fitness: 'wolf',
  } as const;

  for (const [path, family] of Object.entries(expected)) {
    it(`maps ${path} to ${family}`, () => {
      expect(mascotFamilyForPath(path as keyof typeof expected)).toBe(family);
    });
  }

  it('covers every path that exists, not just the five listed above', () => {
    expect(FITNESS_PATHS.map((path) => path.id).sort()).toEqual(
      Object.keys(expected).sort(),
    );
  });

  it('uses each family exactly once', () => {
    const used = FITNESS_PATHS.map((path) => mascotFamilyForPath(path.id));
    expect(used.sort()).toEqual([...CORE_FAMILIES]);
  });
});

// ---------------------------------------------------------------------------

describe('Opal is the companion, not a path mascot', () => {
  it('is not one of the core families', () => {
    expect(MASCOT_FAMILIES.map((family) => family.id)).not.toContain('opal');
    expect(isPathMascotFamily('opal', MASCOT_FAMILIES.map((f) => f.id))).toBe(false);
  });

  it('is not reachable from any fitness path', () => {
    for (const path of FITNESS_PATHS) {
      expect(mascotFamilyForPath(path.id)).not.toBe('opal');
    }
  });

  it('cannot be assigned where a path mascot family is expected', () => {
    // @ts-expect-error Opal is the companion, never a fitness-path mascot family.
    const notAFamily: MascotFamilyId = 'opal';
    expect(notAFamily).toBe('opal');
  });

  it('cannot be assigned where the companion is expected, in reverse', () => {
    // @ts-expect-error A path mascot family is never the companion.
    const notTheCompanion: CompanionId = 'tortoise';
    expect(notTheCompanion).toBe('tortoise');
  });

  it('exists as its own concept, with a name and stated roles', () => {
    expect(OPAL.id).toBe(COMPANION_ID);
    expect(OPAL.name).toBe('Opal');
    expect(OPAL.roles).toEqual(COMPANION_ROLES);
    expect(OPAL.roles.length).toBeGreaterThan(0);
  });

  it('is the only companion, and is not chosen or earned', () => {
    expect(isCompanionId('opal')).toBe(true);
    expect(isCompanionId('tortoise')).toBe(false);
    expect(isCompanionId(undefined)).toBe(false);

    // No selection, no hatching, no ownership: nothing in the module takes a user,
    // a path or any state to decide who the companion is.
    const companion = code(read('domain', 'game', 'companion.ts'));
    expect(companion).not.toMatch(/hatch|evolve|earn|unlock|select|choose/i);
  });

  it('carries no behaviour, persistence or schema in this slice', () => {
    const companion = code(read('domain', 'game', 'companion.ts'));
    expect(companion).not.toMatch(/localStorage|schemaVersion|StorageAdapter/);
    expect(companion).not.toMatch(/dialogue|personality|animation|sprite/i);
  });
});

// ---------------------------------------------------------------------------

describe('Owl and Red Panda stay out of the path system', () => {
  for (const character of ['owl', 'red_panda', 'red-panda', 'redPanda']) {
    it(`does not admit ${character} as a family`, () => {
      expect(MASCOT_FAMILIES.map((family) => family.id)).not.toContain(character);
      expect(isPathMascotFamily(character, MASCOT_FAMILIES.map((f) => f.id))).toBe(false);
    });
  }

  it('cannot be assigned where a path mascot family is expected', () => {
    // @ts-expect-error Owl is a future character, not a current path mascot family.
    const owl: MascotFamilyId = 'owl';
    // @ts-expect-error Red Panda is a future character, not a current path family.
    const redPanda: MascotFamilyId = 'red_panda';
    expect([owl, redPanda]).toEqual(['owl', 'red_panda']);
  });

  it('appears nowhere in the domain layer', () => {
    // Reference artwork exists for both. That must not leak into the model.
    for (const file of ['types.ts', 'paths.ts', 'mascot.ts', 'companion.ts']) {
      const source = code(read('domain', 'game', file));
      expect(source, `${file} admits owl`).not.toMatch(/'owl'|"owl"/);
      expect(source, `${file} admits red panda`).not.toMatch(/red[_-]?panda/i);
    }
  });
});

// ---------------------------------------------------------------------------

describe('the letter glyphs are a fallback, not the model', () => {
  it('still exists, because no mascot artwork does yet', () => {
    // Removing it now would leave the header with nothing to draw.
    for (const family of MASCOT_FAMILIES) {
      expect(family.glyph).toHaveLength(1);
    }
  });

  it('is documented as temporary rather than quietly tolerated', () => {
    expect(read('domain', 'game', 'paths.ts')).toContain('TEMPORARY');
    expect(read('ui', 'components', 'GameHeader.tsx')).toContain(
      'TEMPORARY PRESENTATION FALLBACK',
    );
  });

  it('defines nothing: no progression or reward reads it', () => {
    for (const file of ['mascot.ts', 'rewards.ts', 'xp.ts', 'egg.ts', 'trophies.ts']) {
      expect(
        code(read('domain', 'game', file)),
        `${file} reads glyph`,
      ).not.toContain('glyph');
    }
  });

  it('is hidden from assistive technology, since a letter is not a mascot', () => {
    const header = read('ui', 'components', 'GameHeader.tsx');
    const art = header.slice(header.indexOf('game__art'), header.indexOf('game__body'));
    expect(art).toContain('aria-hidden="true"');
  });
});
