import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../domain/game/defaults';
import { passportPresentation } from '../ui/passportPresentation';

const NOW = '2026-08-27T10:00:00.000Z';

describe('Passport presentation', () => {
  it('keeps the mascot family secret before hatch', () => {
    const state = createInitialGameState({ now: NOW });
    const passport = passportPresentation({
      ...state,
      pathId: 'build_stamina',
      mascot: {
        ...state.mascot,
        familyId: 'fox',
        eggState: 'ready',
      },
    });

    expect(passport.status).toBe('sealed');
    expect(passport.title).toBe('Mystery Egg');
    expect(passport.familyName).toBeNull();
    expect(passport.familyGlyph).toBeNull();
    expect(passport.stageLabel).toBeNull();
    expect(passport.hatchedAt).toBeNull();
  });

  it('shows only existing trusted mascot facts after hatch', () => {
    const state = createInitialGameState({ now: NOW });
    const passport = passportPresentation({
      ...state,
      pathId: 'build_stamina',
      xp: { total: 120, level: 3 },
      mascot: {
        ...state.mascot,
        familyId: 'fox',
        eggState: 'hatched',
        stage: 'growing',
        hatchedAt: '2026-08-20T09:00:00.000Z',
        lastEvolvedAt: '2026-08-25T09:00:00.000Z',
      },
    });

    expect(passport).toMatchObject({
      status: 'active',
      title: 'Fox',
      familyName: 'Fox',
      familyGlyph: 'F',
      pathName: 'Build Stamina',
      stageLabel: 'Growing',
      level: 3,
      hatchedAt: '2026-08-20T09:00:00.000Z',
      lastEvolvedAt: '2026-08-25T09:00:00.000Z',
    });
  });

  it('does not expose evolution percentages, rarity, prestige or lineage', () => {
    const passport = passportPresentation(createInitialGameState({ now: NOW })) as unknown as Record<string, unknown>;

    for (const forbidden of [
      'evolutionPercent',
      'rarity',
      'prestige',
      'predecessorId',
      'passedOnTo',
      'championAt',
      'relic',
    ]) {
      expect(passport).not.toHaveProperty(forbidden);
    }
  });
});
