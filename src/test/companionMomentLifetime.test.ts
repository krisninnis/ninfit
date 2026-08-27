import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { MascotContext } from '../domain/game/messages';
import {
  COMPANION_MOMENT_DWELL_MS,
  COMPANION_REACTION_LIFETIME,
  companionReactionLifetime,
  companionReactionPresentationForLifetime,
} from '../ui/companionReactionPresentation';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const header = read('ui', 'components', 'GameHeader.tsx');
const today = read('ui', 'screens', 'TodayScreen.tsx');
const presentation = read('ui', 'companionReactionPresentation.ts');

const CONTEXTS: readonly MascotContext[] = [
  'egg_waiting',
  'hatch_ready',
  'just_hatched',
  'session_complete',
  'partial_complete',
  'rest_day',
  'returning',
  'idle',
  'evolution_ready',
  'trophy',
];

describe('companion moment lifetime policy', () => {
  it('classifies every MascotContext deliberately', () => {
    expect(Object.keys(COMPANION_REACTION_LIFETIME).sort()).toEqual(
      [...CONTEXTS].sort(),
    );
  });

  it('treats completion, partial, trophy and hatch as moments', () => {
    for (const context of [
      'session_complete',
      'partial_complete',
      'trophy',
      'just_hatched',
    ] as const) {
      expect(companionReactionLifetime(context)).toBe('moment');
    }
  });

  it('keeps rest, returning and action-ready states standing', () => {
    for (const context of [
      'rest_day',
      'returning',
      'egg_waiting',
      'idle',
      'hatch_ready',
      'evolution_ready',
    ] as const) {
      expect(companionReactionLifetime(context)).toBe('standing');
    }
  });

  it('shows transient emphasis only while the moment is fresh', () => {
    expect(companionReactionPresentationForLifetime('session_complete', true)).toBe('warm');
    expect(companionReactionPresentationForLifetime('session_complete', false)).toBe('calm');

    expect(companionReactionPresentationForLifetime('partial_complete', true)).toBe('warm');
    expect(companionReactionPresentationForLifetime('partial_complete', false)).toBe('calm');

    expect(companionReactionPresentationForLifetime('trophy', true)).toBe('celebrate');
    expect(companionReactionPresentationForLifetime('trophy', false)).toBe('calm');
  });

  it('does not suppress standing ambient states when no moment is fresh', () => {
    expect(companionReactionPresentationForLifetime('rest_day', false)).toBe('rest');
    expect(companionReactionPresentationForLifetime('returning', false)).toBe('welcome');
    expect(companionReactionPresentationForLifetime('hatch_ready', false)).toBe('action');
    expect(companionReactionPresentationForLifetime('evolution_ready', false)).toBe('action');
  });

  it('uses a bounded dwell rather than a permanent moment', () => {
    expect(COMPANION_MOMENT_DWELL_MS).toBeGreaterThanOrEqual(2000);
    expect(COMPANION_MOMENT_DWELL_MS).toBeLessThanOrEqual(5000);
  });
});

describe('freshness wiring', () => {
  it('derives only an opaque batch identity from newly granted event ids', () => {
    expect(today).toContain(
      "const companionMomentKey = game.granted.map((event) => event.id).join('|');",
    );
    expect(today).toContain('freshMomentKey={companionMomentKey}');
  });

  it('does not pass reward kinds, XP or labels into GameHeader lifetime logic', () => {
    const executable = code(header);
    expect(executable).not.toMatch(/RewardEvent|RewardKind|\.kind\b|\.xp\b|\.label\b/);
    expect(executable).not.toMatch(/trophy_unlocked|session_completed|activity_completed/);
  });

  it('does not replay a moment when the fresh key is empty', () => {
    expect(header).toContain("lifetime === 'moment' ? freshMomentKey : ''");
    expect(header).toContain("if (lifetime !== 'moment' || freshMomentKey === '')");
    expect(header).toContain("setActiveMomentKey('')");
  });

  it('expires emphasis with a timer keyed to fresh identity and lifetime', () => {
    expect(header).toContain(
      "setTimeout(() => setActiveMomentKey(''), COMPANION_MOMENT_DWELL_MS)",
    );
    expect(header).toMatch(/\},\s*\[freshMomentKey, lifetime\]\)/);
    expect(header).toContain('clearTimeout(timer)');
  });

  it('keeps lifetime entirely in presentation with no persistence', () => {
    const executable = code(presentation + '\n' + header);
    expect(executable).not.toMatch(/localStorage|repository|adapter|save|write|schema/i);
    expect(executable).not.toMatch(/grantReward|XP_REWARDS|calculateXp|syncGame/i);
  });

  it('keeps the truthful companion message independent of visual expiry', () => {
    expect(header).toContain(
      'const message = mascotMessage(context, settings.mascotPersonality);',
    );
    expect(header).toContain(
      '{message !== undefined ? <span className="game__message">{message}</span> : null}',
    );
  });
});
