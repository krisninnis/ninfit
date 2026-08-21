import { describe, expect, it } from 'vitest';
import componentSource from '../ui/components/RewardAcknowledgement.tsx?raw';
import { readStyleFiles } from './cssSource';
import gameHeaderSource from '../ui/components/GameHeader.tsx?raw';
import todayScreenSource from '../ui/screens/TodayScreen.tsx?raw';
import {
  REWARD_DWELL_BASE_MS,
  REWARD_DWELL_MAX_MS,
  REWARD_DWELL_PER_EXTRA_MS,
  acknowledgementTier,
  orderedForAcknowledgement,
  rewardDwellMs,
  rewardTier,
} from '../ui/components/RewardAcknowledgement';
import type { RewardEvent, RewardKind } from '../domain/game/types';

/**
 * Phase 8.1 — the reward acknowledgement contract.
 *
 * The spec these protect is `docs/product/ninfit-reward-presentation-v1.md`. They
 * guard behaviour, not layout: the component may be restyled freely, but it may not
 * start dropping events, inventing wording, or spending the reward surface on an
 * ordinary walk.
 */

/**
 * Comments stripped first. This component's docstring explains at length which words
 * and patterns it forbids, so it necessarily contains them - and a scan of the raw
 * source would match the explanation and report the opposite of the truth.
 */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const componentCode = code(componentSource);

/**
 * CSS read from source through the established helper, which strips comments for us.
 * A `?raw` import of a stylesheet resolves to an empty string under this setup, which
 * would make every negative assertion below pass without reading anything.
 */
const styles = readStyleFiles();
const stylesheet = (name: string): string => {
  const found = styles.find((entry) => entry.name === name);
  if (found === undefined) throw new Error(`missing stylesheet: ${name}`);
  return found.code;
};

const rewardCss = stylesheet('components/reward.css');
const gameCss = stylesheet('screens/game.css');
const motionCss = stylesheet('motion.css');

const ALL_KINDS: RewardKind[] = [
  'activity_completed',
  'session_completed',
  'first_programme_day',
  'rest_day_observed',
  'first_measurement',
  'consistency_milestone',
  'trophy_unlocked',
];

function event(kind: RewardKind, id: string, label = `${id} label`, xp = 10): RewardEvent {
  return { id, key: `k:${id}`, kind, xp, skillXp: {}, label, awardedAt: '2026-08-21T09:00:00.000+01:00' };
}

// ---------------------------------------------------------------------------

describe('every newly granted reward is represented', () => {
  it('keeps all four events of a four-event batch', () => {
    const batch = [
      event('activity_completed', 'a'),
      event('session_completed', 'b'),
      event('consistency_milestone', 'c'),
      event('trophy_unlocked', 'd'),
    ];

    const ordered = orderedForAcknowledgement(batch);
    expect(ordered).toHaveLength(4);
    expect(ordered.map((entry) => entry.id).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('loses nothing at any batch size', () => {
    for (let size = 1; size <= 8; size += 1) {
      const batch = Array.from({ length: size }, (_, index) =>
        event(ALL_KINDS[index % ALL_KINDS.length] as RewardKind, `e${index}`),
      );
      expect(orderedForAcknowledgement(batch)).toHaveLength(size);
    }
  });

  it('renders the whole ordered list rather than one chosen event', () => {
    /*
     * Pinned to the exact chain, because a looser check does not hold. An earlier
     * version of this test asserted only that the component contained `ordered.map(`
     * - and it passed when `ordered` was rewritten to a single-element array. The
     * three links have to be named: the whole delta becomes the batch, the batch is
     * ordered by the tested helper, and every entry of that result is rendered.
     */
    expect(componentCode).toMatch(/setBatch\(granted\)/);
    expect(componentCode).toMatch(/const ordered = orderedForAcknowledgement\(batch\);/);
    expect(componentCode).toMatch(/ordered\.map\(\(event\) =>/);

    // The presentation this replaced took the last event and showed only that.
    expect(componentCode).not.toMatch(/\.length\s*-\s*1\s*\]/);
    expect(componentCode).not.toMatch(/slice\(\s*-?\d|\.at\(\s*-?\d/);
  });

  it('offers no truncation or overflow escape hatch', () => {
    expect(componentCode).not.toMatch(/more\b|and others|\+\{[^}]*length[^}]*\}\s*more/i);
    expect(rewardCss).not.toMatch(/overflow:\s*(auto|scroll)/);
  });
});

// ---------------------------------------------------------------------------

describe('the domain owns the wording', () => {
  it('prints RewardEvent.label verbatim', () => {
    expect(componentCode).toMatch(/\{event\.label\}/);
  });

  it('composes no reward phrasing of its own', () => {
    // No template literal builds a sentence around a label or an XP value.
    expect(componentCode).not.toMatch(/`[^`]*\$\{[^}]*\.label[^}]*\}[^`]*`/);
    expect(componentCode).not.toMatch(/label\s*\+|\+\s*event\.label/);
  });

  it('adds no praise the domain did not author', () => {
    expect(componentCode).not.toMatch(
      /well done|great work|nice work|amazing|awesome|congratulations|keep it up|smashed/i,
    );
    expect(componentCode).not.toMatch(/!<\/|!\s*\{|!`/);
  });
});

// ---------------------------------------------------------------------------

describe('the tier mapping is exhaustive and lives in the UI', () => {
  it('gives every RewardKind a tier', () => {
    for (const kind of ALL_KINDS) {
      expect(['standard', 'reward'], `no tier for ${kind}`).toContain(rewardTier(kind));
    }
  });

  it('maps routine work to standard', () => {
    expect(rewardTier('activity_completed')).toBe('standard');
    expect(rewardTier('session_completed')).toBe('standard');
    expect(rewardTier('rest_day_observed')).toBe('standard');
    expect(rewardTier('first_measurement')).toBe('standard');
  });

  it('maps meaningful moments to reward', () => {
    expect(rewardTier('first_programme_day')).toBe('reward');
    expect(rewardTier('consistency_milestone')).toBe('reward');
    expect(rewardTier('trophy_unlocked')).toBe('reward');
  });

  it('is a Record over RewardKind, so an eighth kind cannot fall through', () => {
    expect(componentCode).toMatch(/Readonly<Record<RewardKind,\s*RewardTier>>/);
    expect(componentCode).not.toMatch(/default:\s*'standard'|\?\?\s*'standard'/);
  });

  it('keeps presentation tiers out of the reward domain', () => {
    // The domain must not learn that motion exists.
    expect(componentCode).not.toMatch(/from '\.\.\/\.\.\/domain\/game\/(rewards|xp|trophies)'/);
    expect(componentCode).toMatch(/import type \{[^}]*\} from '\.\.\/\.\.\/domain\/game\/types'/);
  });
});

// ---------------------------------------------------------------------------

describe('the reward surface is spent only on meaningful moments', () => {
  it('leaves a routine batch on the quiet surface', () => {
    const routine = [event('activity_completed', 'a'), event('session_completed', 'b')];
    expect(acknowledgementTier(routine)).toBe('standard');
  });

  it('lifts a batch that contains anything meaningful', () => {
    expect(acknowledgementTier([event('trophy_unlocked', 't')])).toBe('reward');
    expect(
      acknowledgementTier([event('activity_completed', 'a'), event('consistency_milestone', 'c')]),
    ).toBe('reward');
    expect(acknowledgementTier([event('first_programme_day', 'f')])).toBe('reward');
  });

  it('applies card--reward only on the reward tier', () => {
    expect(componentCode).toMatch(/isReward \? 'card card--reward' : 'reward__surface'/);
  });

  it('uses no cinematic treatment anywhere', () => {
    expect(componentCode).not.toMatch(/cinematic/i);
    expect(rewardCss).not.toMatch(/--ft-motion-cinematic/);
  });

  it('composes only motion tokens that already existed', () => {
    expect(rewardCss).toMatch(/--ft-motion-standard/);
    expect(rewardCss).toMatch(/--ft-motion-reward/);
    expect(rewardCss).toMatch(/--ft-ease-standard/);
    expect(rewardCss).toMatch(/--ft-ease-reward/);
    // No hand-rolled duration or easing beside the scale.
    expect(rewardCss).not.toMatch(/animation-duration:\s*\d|transition-duration:\s*\d/);
    expect(rewardCss).not.toMatch(/\b\d+ms\b|\b\d+(\.\d+)?s\b/);
  });
});

// ---------------------------------------------------------------------------

describe('ordering puts the meaningful first without reshuffling the rest', () => {
  it('places reward-tier events ahead of routine ones', () => {
    const ordered = orderedForAcknowledgement([
      event('activity_completed', 'walk'),
      event('trophy_unlocked', 'trophy'),
      event('session_completed', 'session'),
      event('consistency_milestone', 'run'),
    ]);

    expect(ordered.map((entry) => entry.id)).toEqual(['trophy', 'run', 'walk', 'session']);
  });

  it('preserves the domain order inside each tier', () => {
    const ordered = orderedForAcknowledgement([
      event('session_completed', 'first'),
      event('activity_completed', 'second'),
      event('rest_day_observed', 'third'),
    ]);

    expect(ordered.map((entry) => entry.id)).toEqual(['first', 'second', 'third']);
  });

  it('re-sorts by nothing else', () => {
    const ordered = orderedForAcknowledgement([
      event('activity_completed', 'small', 'small', 5),
      event('activity_completed', 'large', 'large', 500),
    ]);

    // Not by XP, not alphabetically: the domain's sequence stands.
    expect(ordered.map((entry) => entry.id)).toEqual(['small', 'large']);
  });
});

// ---------------------------------------------------------------------------

describe('dwell is reading time, bounded', () => {
  it('starts at the inherited base', () => {
    expect(REWARD_DWELL_BASE_MS).toBe(2200);
    expect(rewardDwellMs(1)).toBe(2200);
  });

  it('adds reading time per extra line', () => {
    expect(REWARD_DWELL_PER_EXTRA_MS).toBe(600);
    expect(rewardDwellMs(2)).toBe(2800);
    expect(rewardDwellMs(3)).toBe(3400);
    expect(rewardDwellMs(4)).toBe(4000);
  });

  it('caps so nothing loiters', () => {
    expect(REWARD_DWELL_MAX_MS).toBe(4400);
    expect(rewardDwellMs(5)).toBe(4400);
    expect(rewardDwellMs(9)).toBe(4400);
    expect(rewardDwellMs(50)).toBe(4400);
  });

  it('shows nothing for an empty batch', () => {
    expect(rewardDwellMs(0)).toBe(0);
    expect(rewardDwellMs(-1)).toBe(0);
    expect(componentCode).toMatch(/batch\.length === 0.*return null|return null/);
  });

  it('restarts on a new batch and not on a re-render', () => {
    expect(componentCode).toMatch(/const batchKey = granted\.map\(/);
    expect(componentCode).toMatch(/\},\s*\[batchKey\]\)/);
  });
});

// ---------------------------------------------------------------------------

describe('it survives reduced motion, silence and greyscale', () => {
  it('leaves the whole app covered by the global reduced-motion rule', () => {
    expect(motionCss).toMatch(/prefers-reduced-motion: reduce/);
    expect(motionCss).toMatch(/animation-duration: 0\.01ms !important/);
    expect(motionCss).toMatch(/transition-duration: 0\.01ms !important/);
  });

  it('ties the dwell timer to nothing that reduced motion removes', () => {
    expect(componentCode).toMatch(/setTimeout\(/);
    expect(componentCode).not.toMatch(/transitionend|animationend|onAnimationEnd|onTransitionEnd/);
    expect(componentCode).not.toMatch(/matchMedia|prefers-reduced-motion/);
  });

  it('animates arrival only, and never repeats', () => {
    expect(rewardCss).not.toMatch(/infinite|alternate/);
    expect(rewardCss).not.toMatch(/animation-iteration-count/);
  });

  it('depends on no sound or haptic channel', () => {
    expect(componentCode).not.toMatch(/soundEnabled|hapticsEnabled|vibrate|new Audio|AudioContext/);
    expect(rewardCss).not.toMatch(/sound|haptic/i);
  });

  it('announces politely and takes nothing', () => {
    expect(componentCode).toMatch(/role="status"/);
    expect(componentCode).not.toMatch(/role="alert"|aria-modal|autoFocus|\.focus\(\)|tabIndex/);
  });

  it('carries meaning in text rather than colour', () => {
    // Every line prints its own label and value; no state is signalled by hue alone.
    expect(componentCode).toMatch(/reward__label/);
    expect(componentCode).toMatch(/reward__xp/);
    expect(rewardCss).not.toMatch(/\bred\b|danger|destructive/i);
  });
});

// ---------------------------------------------------------------------------

describe('tone and dependencies', () => {
  it('uses none of the forbidden vocabulary', () => {
    expect(componentCode).not.toMatch(/\bstreak\b|\bperfect\b|\bfailed\b|\bbroken\b|\bscore\b/i);
    expect(rewardCss).not.toMatch(/\bstreak\b|\bperfect\b|\bfailed\b|\bbroken\b|\bscore\b/i);
  });

  it('introduces no urgency or obligation', () => {
    expect(componentCode).not.toMatch(/don'?t lose|hurry|expires|last chance|act now/i);
  });

  it('depends on no mascot artwork', () => {
    expect(componentCode).not.toMatch(/EggArt|Opal|GameHeader|glyph|mascot/i);
  });

  it('is not a dialog', () => {
    expect(rewardCss).not.toMatch(/position:\s*(fixed|absolute)/);
    expect(rewardCss).not.toMatch(/z-index/);
  });
});

// ---------------------------------------------------------------------------

describe('the old last-event-only float is gone', () => {
  it('has left no markup behind', () => {
    expect(code(gameHeaderSource)).not.toMatch(/xpfloat/);
    expect(code(gameHeaderSource)).not.toMatch(/granted/);
  });

  it('has left no dead CSS behind', () => {
    expect(gameCss).not.toMatch(/xpfloat|xp-float/);
  });

  it('leaves the rest of the companion strip intact', () => {
    expect(gameHeaderSource).toMatch(/xpbar/);
    expect(gameHeaderSource).toMatch(/game__level/);
    expect(gameHeaderSource).toMatch(/game__stage/);
    expect(gameHeaderSource).toMatch(/mascotMessage\(context,/);
  });
});

// ---------------------------------------------------------------------------

describe('placement on Today', () => {
  it('sits below the companion strip and above the plan', () => {
    const today = code(todayScreenSource);
    const companion = today.indexOf('<GameHeader');
    const acknowledgement = today.indexOf('<RewardAcknowledgement');
    const plan = today.indexOf('week__days') > -1 ? today.indexOf('week__days') : today.indexOf('card--action');

    expect(companion).toBeGreaterThan(-1);
    expect(acknowledgement).toBeGreaterThan(companion);
    expect(plan).toBeGreaterThan(acknowledgement);
  });

  it('is handed the domain delta unchanged', () => {
    expect(code(todayScreenSource)).toMatch(/<RewardAcknowledgement granted=\{game\.granted\} \/>/);
  });
});
