import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  COMPANION_REACTION_PRESENTATION,
  companionReactionPresentation,
} from '../ui/companionReactionPresentation';
import type { MascotContext } from '../domain/game/messages';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const component = read('ui', 'components', 'GameHeader.tsx');
const css = read('styles', 'screens', 'game.css');
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

describe('companion reaction presentation', () => {
  it('maps every MascotContext to a deliberate visual treatment', () => {
    expect(Object.keys(COMPANION_REACTION_PRESENTATION).sort()).toEqual(
      [...CONTEXTS].sort(),
    );
  });

  it('gives completed and partial fitness the same warm, non-scoring treatment', () => {
    expect(companionReactionPresentation('session_complete')).toBe('warm');
    expect(companionReactionPresentation('partial_complete')).toBe('warm');
  });

  it('gives planned rest a calm resting treatment', () => {
    expect(companionReactionPresentation('rest_day')).toBe('rest');
  });

  it('gives returning its own welcoming treatment', () => {
    expect(companionReactionPresentation('returning')).toBe('welcome');
  });

  it('keeps trophy celebration bounded and idle calm', () => {
    expect(companionReactionPresentation('trophy')).toBe('celebrate');
    expect(companionReactionPresentation('idle')).toBe('calm');
    expect(companionReactionPresentation('egg_waiting')).toBe('calm');
  });
});

describe('GameHeader reaction wiring', () => {
  it('renders the already-decided context as presentation state', () => {
    expect(component).toContain(
      "import { companionReactionPresentation } from '../companionReactionPresentation';",
    );
    expect(component).toContain('const reactionPresentation = companionReactionPresentation(context);');
    expect(component).toContain('data-companion-reaction={reactionPresentation}');
  });

  it('does not re-derive fitness truth or import the fitness reaction selector', () => {
    const executable = code(component);
    expect(executable).not.toMatch(
      /fitnessCompanionReaction|DailyLog|summariseSessionCompletion|completedActivityIds|symptoms|measurement/i,
    );
  });

  it('keeps the existing accessible companion landmark unchanged', () => {
    expect(component).toContain('aria-label="Your companion"');
    expect(component).not.toContain('aria-live');
    expect(component).not.toContain('role="alert"');
  });
});

describe('reaction styling stays decorative and calm', () => {
  it('has explicit static treatments for the five fitness reaction presentations', () => {
    for (const state of ['warm', 'rest', 'welcome', 'celebrate'] as const) {
      expect(css).toContain(`.game[data-companion-reaction='${state}']`);
    }
  });

  it('uses design tokens without raw colour or motion dependency', () => {
    const reactionCss = css.slice(
      css.indexOf("Contextual reaction treatment"),
      css.indexOf('.game__art {'),
    );
    expect(reactionCss).toContain('var(--ft-accent)');
    expect(reactionCss).toContain('var(--ft-surface-raised)');
    expect(reactionCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgb\(|\bhsl\(|\boklch\(/);
    expect(reactionCss).not.toMatch(/animation\s*:|@keyframes/);
    expect(reactionCss).not.toMatch(/transition\s*:/);
  });

  it('encodes no score, streak, percentage or fitness judgement in presentation', () => {
    const executable = code(presentation);
    expect(executable).not.toMatch(/score|streak|percent|percentage|good|bad|healthy|unhealthy|pain|medical/i);
    expect(executable).not.toMatch(/repository|localStorage|XP_REWARDS|grantReward|save/i);
  });
});
