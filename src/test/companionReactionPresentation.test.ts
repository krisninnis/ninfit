import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  REACTION_TO_CONTEXT,
  companionReactionMessage,
  hasReactionCopy,
} from '../domain/game/companionReactionPresentation';
import type { FitnessCompanionReaction } from '../domain/game/fitnessCompanionReaction';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const source = readFileSync(
  join(SRC, 'domain', 'game', 'companionReactionPresentation.ts'),
  'utf8',
);
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const REACTIONS: readonly FitnessCompanionReaction[] = [
  'trophy',
  'session_complete',
  'rest_day',
  'partial_complete',
  'returning',
  'none',
];

describe('fitness to companion reaction presentation', () => {
  it('presents copy for every reaction the boundary can return, except none', () => {
    for (const reaction of [
      'trophy',
      'session_complete',
      'rest_day',
      'partial_complete',
      'returning',
    ] as const) {
      expect(hasReactionCopy(reaction), reaction).toBe(true);
    }

    // `none` is the boundary saying nothing worth saying; presentation stays quiet.
    expect(hasReactionCopy('none')).toBe(false);

    // Cover the closed union so a newly added reaction is forced to pick a side.
    expect(REACTIONS).toEqual(['trophy', 'session_complete', 'rest_day', 'partial_complete', 'returning', 'none']);
  });

  it('maps every presentable reaction to exactly the reviewed message context', () => {
    expect(REACTION_TO_CONTEXT.trophy).toBe('trophy');
    expect(REACTION_TO_CONTEXT.session_complete).toBe('session_complete');
    expect(REACTION_TO_CONTEXT.rest_day).toBe('rest_day');
    expect(REACTION_TO_CONTEXT.partial_complete).toBe('partial_complete');
    expect(REACTION_TO_CONTEXT.returning).toBe('returning');
    expect(REACTION_TO_CONTEXT.none).toBeUndefined();
  });

  it('returns the reviewed copy for each reaction', () => {
    // Baseline personalities, so wording is easy to assert against messages.ts.
    expect(companionReactionMessage('session_complete', 'normal')).toBe(
      'All of it. Nice one.',
    );
    expect(companionReactionMessage('partial_complete', 'normal')).toBe(
      'That counts.',
    );
    expect(companionReactionMessage('rest_day', 'chatty')).toMatch(/Rest day/);
    expect(companionReactionMessage('returning', 'normal')).toBe(
      'Ready when you are.',
    );
    expect(companionReactionMessage('trophy', 'chatty')).toMatch(/trophy/i);
  });

  it('stays silent for the none reaction, whatever the personality', () => {
    for (const personality of ['quiet', 'normal', 'chatty'] as const) {
      expect(companionReactionMessage('none', personality)).toBeUndefined();
    }
  });

  it('lets a quiet personality stay silent where it has no line to give', () => {
    // The quiet table deliberately leaves some contexts with no line at all.
    expect(
      companionReactionMessage('session_complete', 'quiet'),
    ).toBeUndefined();
    expect(companionReactionMessage('partial_complete', 'quiet')).toBeUndefined();
  });

  it('delegates every line to messages.ts rather than restating it', () => {
    // The tone rule and the reviewed copy live in one place; this module points at
    // them. Any line restated here would be a second, competing source of copy.
    expect(source).toMatch(/from '\.\/messages'/);
    expect(source).toMatch(/mascotMessage/);
    expect(code).not.toMatch(/All of it|That counts|Ready when you are|Rest day/);
  });

  it('selects nothing and reads no fitness truth of its own', () => {
    expect(code).not.toMatch(/DailyLog|symptoms|health|measurement|completedActivityIds|activities/i);
    expect(code).not.toMatch(
      /summariseSessionCompletion|todaySessionCompletion|resolveToday|fitnessCompanionReaction\(/,
    );
  });

  it('grants, persists or computes nothing', () => {
    expect(code).not.toMatch(/XP_REWARDS|calculateXp|grantReward|awardedKeys|evaluateMascot/i);
    expect(code).not.toMatch(/repository|adapter|localStorage|saveGameState|saveDailyLog|write/i);
  });

  it('contains no fitness judgement or medical interpretation', () => {
    expect(code).not.toMatch(/good|bad|healthy|unhealthy|safe|unsafe|pain|injury|medical/i);
  });
});
