import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  fitnessCompanionReaction,
  type FitnessCompanionFacts,
} from '../domain/game/fitnessCompanionReaction';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const source = readFileSync(join(SRC, 'domain', 'game', 'fitnessCompanionReaction.ts'), 'utf8');
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const TODAY = '2026-08-20';

function facts(patch: Partial<FitnessCompanionFacts> = {}): FitnessCompanionFacts {
  return {
    completion: 'not_yet',
    grantedKinds: [],
    today: TODAY,
    ...patch,
  };
}

describe('fitness to companion reaction boundary', () => {
  it('reacts only to supplied fitness facts', () => {
    const returning = vi.fn(() => false);

    expect(fitnessCompanionReaction(facts({ completion: 'complete' }), returning))
      .toBe('session_complete');
    expect(fitnessCompanionReaction(facts({ completion: 'rest' }), returning))
      .toBe('rest_day');
    expect(fitnessCompanionReaction(facts({ completion: 'partial' }), returning))
      .toBe('partial_complete');
    expect(fitnessCompanionReaction(
      facts({ grantedKinds: ['trophy_unlocked'] }),
      returning,
    )).toBe('trophy');
  });

  it('uses the supplied history predicate instead of deriving history itself', () => {
    const returning = vi.fn(() => true);
    const candidate = facts({ lastActiveDate: '2026-08-01' });

    expect(fitnessCompanionReaction(candidate, returning)).toBe('returning');
    expect(returning).toHaveBeenCalledWith(TODAY, '2026-08-01');
  });

  it('does not call history logic when today already has something to acknowledge', () => {
    const returning = vi.fn(() => true);

    expect(fitnessCompanionReaction(
      facts({ completion: 'complete', lastActiveDate: '2026-08-01' }),
      returning,
    )).toBe('session_complete');
    expect(returning).not.toHaveBeenCalled();
  });

  it('stays silent for not-yet and unplanned fitness', () => {
    const returning = vi.fn(() => false);

    expect(fitnessCompanionReaction(facts({ completion: 'not_yet' }), returning)).toBe('none');
    expect(fitnessCompanionReaction(facts({ completion: 'unplanned' }), returning)).toBe('none');
  });

  it('cannot read raw logs, symptoms, measurements or activity collections', () => {
    expect(code).not.toMatch(/DailyLog|symptoms|health|measurement|completedActivityIds|activities/i);
    expect(code).not.toMatch(/summariseSessionCompletion|todaySessionCompletion|resolveToday/);
  });

  it('cannot calculate progression, grant rewards or persist anything', () => {
    expect(code).not.toMatch(/XP_REWARDS|calculateXp|grantReward|awardedKeys|evaluateMascot/i);
    expect(code).not.toMatch(/repository|adapter|localStorage|saveGameState|saveDailyLog|write/i);
  });

  it('contains no fitness judgement or medical interpretation', () => {
    expect(code).not.toMatch(/good|bad|healthy|unhealthy|safe|unsafe|pain|injury|medical/i);
  });
});
