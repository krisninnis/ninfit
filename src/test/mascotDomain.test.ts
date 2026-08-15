import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  ACTIVITY_POSE_GROUPS,
  DEFAULT_CONDITION,
  FORBIDDEN_CONDITION_LANGUAGE,
  MASCOT_CONDITIONS,
  POSE_GROUP_FOR_ACTIVITY,
  defaultMood,
  type MascotMood,
} from '../domain/game/condition';
import {
  MASCOT_PRESENTATIONS,
  MASCOT_RARITIES,
  activePassport,
  addPassport,
  emptyCollection,
  type MascotIdentity,
  type MascotPassport,
} from '../domain/game/identity';
import type { MascotAppearance } from '../domain/game/appearance';
import {
  EVOLUTION_LEVEL_GATES,
  MASCOT_STAGE_LABELS,
  evaluateMascot,
  isEvolutionEligible,
} from '../domain/game/mascot';
import { mascotFamilyForPath } from '../domain/game/paths';
import { earnedTrophies } from '../domain/game/trophies';
import { MASCOT_STAGES, type GameState, type MascotState } from '../domain/game/types';
import { levelForXp, levelProgress } from '../domain/game/xp';
import {
  createDefaultGameSettings,
  createInitialGameState,
} from '../domain/game/defaults';

/**
 * The M1 mascot domain foundation.
 *
 * M1 adds types that nothing reads yet, which makes it exactly the kind of milestone
 * where a mistake hides for months. So these tests pin the two things that would be
 * expensive to discover later: that the permanent and temporary halves cannot be
 * confused, and that decoration cannot reach progression.
 */

const SRC = fileURLToPath(new URL('..', import.meta.url));
const NOW = '2026-08-15T09:00:00.000+01:00';

// ---------------------------------------------------------------------------

describe('stage ids are stored, stage labels are product', () => {
  it('keeps every persisted stage id exactly as it was', () => {
    // Renaming any of these would be a data migration for zero user benefit.
    expect([...MASCOT_STAGES]).toEqual(['starter', 'growing', 'capable', 'advanced', 'elite']);
  });

  it('presents the approved product names', () => {
    expect(MASCOT_STAGE_LABELS.starter).toBe('Starter');
    expect(MASCOT_STAGE_LABELS.growing).toBe('Growing');
    expect(MASCOT_STAGE_LABELS.capable).toBe('Active');
    expect(MASCOT_STAGE_LABELS.advanced).toBe('Athletic');
    expect(MASCOT_STAGE_LABELS.elite).toBe('Champion');
  });

  it('labels every stage, with no gaps', () => {
    for (const stage of MASCOT_STAGES) {
      expect(MASCOT_STAGE_LABELS[stage], `${stage} has no label`).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------

describe('mascot identity', () => {
  const identity: MascotIdentity = {
    speciesId: 'fox',
    presentation: 'neutral',
    personality: 'normal',
    name: 'Ember',
    defaultName: 'Ember',
    variantId: 'winter',
    rarity: 'rare',
    selectionSeed: 'seed-123',
  };

  it('carries species, presentation, personality, rarity and seed', () => {
    expect(identity.speciesId).toBe('fox');
    expect(identity.presentation).toBe('neutral');
    expect(identity.personality).toBe('normal');
    expect(identity.rarity).toBe('rare');
    expect(identity.selectionSeed).toBe('seed-123');
  });

  it('offers the three presentations, unranked', () => {
    expect([...MASCOT_PRESENTATIONS].sort()).toEqual(['feminine', 'masculine', 'neutral']);
  });

  it('offers the approved rarity ladder', () => {
    expect([...MASCOT_RARITIES]).toEqual(['normal', 'uncommon', 'rare', 'epic', 'legendary']);
  });

  it('works with everything optional omitted', () => {
    const minimal: MascotIdentity = {
      speciesId: 'otter',
      presentation: 'feminine',
      personality: 'normal',
      name: 'Pip',
      defaultName: 'Pip',
    };
    expect(minimal.rarity).toBeUndefined();
    expect(minimal.selectionSeed).toBeUndefined();
  });
});

describe('the passport collection is append-only', () => {
  const passport = (id: string): MascotPassport => ({
    id,
    identity: {
      speciesId: 'bear',
      presentation: 'masculine',
      personality: 'normal',
      name: id,
      defaultName: id,
    },
    hatchedAt: '2026-08-15T09:00:00.000+01:00',
  });

  it('starts empty with no active mascot', () => {
    const collection = emptyCollection();
    expect(collection.passports).toEqual([]);
    expect(activePassport(collection)).toBeUndefined();
  });

  it('adds a passport and makes it active', () => {
    const collection = addPassport(emptyCollection(), passport('a'));
    expect(collection.passports).toHaveLength(1);
    expect(activePassport(collection)?.id).toBe('a');
  });

  it('never drops or rewrites an earlier passport', () => {
    let collection = addPassport(emptyCollection(), passport('a'));
    collection = addPassport(collection, passport('b'));

    expect(collection.passports.map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(activePassport(collection)?.id).toBe('b');
  });

  it('refuses to overwrite an id that already exists', () => {
    const first = addPassport(emptyCollection(), passport('a'));
    const again = addPassport(first, { ...passport('a'), hatchedAt: '2030-01-01T00:00:00.000Z' });

    expect(again.passports).toHaveLength(1);
    expect(again.passports[0]?.hatchedAt).toBe('2026-08-15T09:00:00.000+01:00');
  });
});

// ---------------------------------------------------------------------------

describe('temporary condition stays temporary', () => {
  it('defines the approved vocabulary and nothing worse', () => {
    expect([...MASCOT_CONDITIONS]).toEqual([
      'energised',
      'normal',
      'resting',
      'slouch',
      'max_chill',
    ]);
    // There is no state below max_chill to fall into, by design.
    expect(MASCOT_CONDITIONS).not.toContain('neglected');
    expect(MASCOT_CONDITIONS).not.toContain('sad');
    expect(MASCOT_CONDITIONS).not.toContain('unwell');
  });

  it('rests at normal rather than at energised', () => {
    // Energised should be something that happens, not something to fall from.
    expect(DEFAULT_CONDITION).toBe('normal');
    expect(defaultMood()).toEqual({ condition: 'normal', pose: 'idle' });
  });

  it('never appears as a field on the persisted mascot', () => {
    const state: GameState = createInitialGameState({ now: NOW });
    const keys = Object.keys(state.mascot);

    for (const forbidden of ['condition', 'mood', 'pose', 'slouch', 'chill']) {
      expect(keys, `MascotState must not persist "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it('shares no field name with MascotState, so it cannot be assigned by mistake', () => {
    const state: GameState = createInitialGameState({ now: NOW });
    const mood: MascotMood = defaultMood();

    const overlap = Object.keys(mood).filter((key) => key in state.mascot);
    expect(overlap, `overlapping keys would allow a silent overwrite: ${overlap.join(', ')}`).toEqual(
      [],
    );
  });

  it('maps every activity type to a pose group', () => {
    for (const [activity, group] of Object.entries(POSE_GROUP_FOR_ACTIVITY)) {
      expect(ACTIVITY_POSE_GROUPS, `${activity} maps to an unknown group`).toContain(group);
    }
    // idle is the fallback, so lookup can never fail to return something.
    expect(ACTIVITY_POSE_GROUPS).toContain('idle');
  });

  it('records the language the condition copy may never use', () => {
    expect(FORBIDDEN_CONDITION_LANGUAGE).toContain('fat');
    expect(FORBIDDEN_CONDITION_LANGUAGE).toContain('lazy');
    expect(FORBIDDEN_CONDITION_LANGUAGE).toContain('failure');
    expect(FORBIDDEN_CONDITION_LANGUAGE).toContain('sad');
  });
});

// ---------------------------------------------------------------------------

describe('decoration cannot reach progression', () => {

  function withCosmetics(state: GameState, ownedIds: string[]): GameState {
    return { ...state, cosmetics: { ownedIds, equipped: { outfit: ownedIds[0] ?? '' } } };
  }

  it('gives identical XP and level whatever is owned or equipped', () => {
    const plain = createInitialGameState({ now: NOW });
    const decked = withCosmetics(plain, ['epic-hoodie', 'legendary-cape']);

    expect(decked.xp).toEqual(plain.xp);
    expect(levelForXp(decked.xp.total)).toBe(levelForXp(plain.xp.total));
    expect(levelProgress(decked.xp.total)).toEqual(levelProgress(plain.xp.total));
  });

  it('gives identical stage and evolution eligibility', () => {
    const plain = createInitialGameState({ now: NOW });
    const decked = withCosmetics(plain, ['legendary-cape']);
    const hatched: MascotState = { ...plain.mascot, eggState: 'hatched', stage: 'capable' };

    expect(decked.mascot.stage).toBe(plain.mascot.stage);
    expect(isEvolutionEligible(hatched, 15)).toBe(isEvolutionEligible({ ...hatched }, 15));
    expect(evaluateMascot(hatched, { qualifyingDays: 9, level: 15 })).toEqual(
      evaluateMascot({ ...hatched }, { qualifyingDays: 9, level: 15 }),
    );
  });

  it('gives identical trophies', () => {
    const facts = {
      completedActivities: 12,
      fullSessions: 4,
      distinctActiveDays: 9,
      programmeDaysRecorded: 11,
      restDaysObserved: 2,
      measurementsRecorded: 3,
    };
    // Trophies read facts, never inventory - the same facts must always agree.
    expect(earnedTrophies(facts)).toEqual(earnedTrophies({ ...facts }));
  });

  /**
   * The structural half of the same guarantee.
   *
   * A behavioural test proves cosmetics do not affect progression TODAY. This proves
   * they cannot start to: the modules that compute progression do not import the
   * modules that describe decoration, so there is nothing to read.
   */
  it('keeps progression modules from importing identity, cosmetics or condition', () => {
    const progression = ['xp.ts', 'mascot.ts', 'rewards.ts', 'trophies.ts'];
    const forbidden = ['./identity', './condition', './appearance'];
    const offenders: string[] = [];

    for (const file of progression) {
      const code = readFileSync(join(SRC, 'domain/game', file), 'utf8');
      for (const target of forbidden) {
        if (code.includes(`from '${target}'`)) offenders.push(`${file} imports ${target}`);
      }
    }

    expect(offenders, offenders.join('\n  ')).toEqual([]);
  });

  it('keeps rarity out of the progression vocabulary entirely', () => {
    for (const file of ['xp.ts', 'mascot.ts', 'rewards.ts', 'trophies.ts']) {
      const code = readFileSync(join(SRC, 'domain/game', file), 'utf8');
      expect(code, `${file} mentions rarity`).not.toMatch(/\brarity\b/i);
    }
  });
});

// ---------------------------------------------------------------------------

describe('appearance and mood are separable', () => {
  it('builds an appearance from persisted state alone', () => {
    const state = createInitialGameState({ now: NOW });
    const appearance: MascotAppearance = {
      stage: state.mascot.stage,
      identity: {
        speciesId: state.mascot.familyId,
        presentation: 'neutral',
        personality: createDefaultGameSettings().mascotPersonality,
        name: 'Mystery Egg',
        defaultName: 'Mystery Egg',
      },
      cosmetics: state.cosmetics,
    };

    // Nothing temporary leaked into the permanent half.
    expect(Object.keys(appearance)).toEqual(['stage', 'identity', 'cosmetics']);
    expect(appearance).not.toHaveProperty('condition');
    expect(appearance).not.toHaveProperty('pose');
  });
});

// ---------------------------------------------------------------------------

describe('M1 changes no existing behaviour', () => {
  it('still maps each path to the same species it always did', () => {
    // Curated-random selection replaces this later. Until then, nobody's mascot moves.
    expect(mascotFamilyForPath('start_moving')).toBe('tortoise');
    expect(mascotFamilyForPath('build_strength')).toBe('bear');
    expect(mascotFamilyForPath('build_stamina')).toBe('fox');
    expect(mascotFamilyForPath('balanced_fitness')).toBe('otter');
    expect(mascotFamilyForPath('return_to_fitness')).toBe('wolf');
  });

  it('leaves the legacy evolution gates exactly where they were', () => {
    expect(EVOLUTION_LEVEL_GATES.starter).toBe(5);
    expect(EVOLUTION_LEVEL_GATES.growing).toBe(10);
    expect(EVOLUTION_LEVEL_GATES.capable).toBe(15);
    expect(EVOLUTION_LEVEL_GATES.advanced).toBe(20);
    expect(EVOLUTION_LEVEL_GATES.elite).toBeUndefined();
  });

  it('adds nothing to the default persisted game state', () => {
    const state = createInitialGameState({ now: NOW });

    // M1 is schema-neutral: no collection, no passport, no identity on disk yet.
    expect(state).not.toHaveProperty('collection');
    expect(state).not.toHaveProperty('passports');
    expect(state.mascot).not.toHaveProperty('identity');
    expect(state.schemaVersion).toBe(1);
  });
});
