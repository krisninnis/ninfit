import { describe, expect, it } from 'vitest';
import todaySource from '../ui/screens/TodayScreen.tsx?raw';
import gameHeaderSource from '../ui/components/GameHeader.tsx?raw';
import checkInSource from '../ui/components/QuickCheckIn.tsx?raw';
import { baseRule, leafRules, propertiesIn, readStyleFiles } from './cssSource';

/**
 * The Phase 6 Today contract.
 *
 * These assert the hierarchy and the behaviour, never the cosmetics. Nothing here
 * counts lines, measures how much of the file is markup, or pins a colour: those
 * tests fail on every honest edit and teach people to re-bless them without reading.
 * What is pinned is the handful of things that, if they broke, would undo the phase -
 * the plan coming first, one primary action, tracking staying closed, and the
 * companion staying small.
 */

const files = readStyleFiles();

function css(name: string): string {
  const found = files.find((entry) => entry.name === name);
  if (found === undefined) throw new Error(`missing stylesheet: ${name}`);
  return found.code;
}

const today = css('screens/today.css');
const game = css('screens/game.css');

/** Where a marker first appears in the rendered order of the screen. */
function at(marker: string): number {
  const index = todaySource.indexOf(marker);
  expect(index, `"${marker}" does not appear in TodayScreen`).toBeGreaterThan(-1);
  return index;
}

describe("today's plan comes before everything it must outrank", () => {
  /**
   * The core of the phase. Before this, Today opened with the game card, so the
   * first and largest thing on screen answered "how am I doing?" while "what am I
   * doing today?" was below it. Order in the source is order in the DOM here, since
   * the screen renders one flat sequence.
   */
  it('renders context, then companion, then the plan', () => {
    expect(at('today__meta')).toBeLessThan(at('<GameHeader'));
    expect(at('<GameHeader')).toBeLessThan(at('plan--hero'));
  });

  it('puts the plan ahead of the check-in and all tracking sections', () => {
    const plan = at('plan--hero');
    expect(plan).toBeLessThan(at('<QuickCheckIn'));
    expect(plan).toBeLessThan(at('<Section'));
  });

  it('puts the quick check-in ahead of the collapsed sections', () => {
    expect(at('<QuickCheckIn')).toBeLessThan(at('<Section'));
  });

  it('keeps the contextual insight after the tracking, not competing with the plan', () => {
    expect(at('<Section')).toBeLessThan(at('today__insight'));
  });
});

describe('the plan card offers exactly one primary action', () => {
  /**
   * More than one `btn--primary` in the plan area would mean two things claiming to
   * be the next step, which is the specific failure this phase exists to fix.
   */
  it('routes every primary button through the single CTA slot', () => {
    // Counting `btn--primary` alone would miscount: the planned branch holds a
    // ternary whose two arms are a link and a button, and only one of them ever
    // renders. What actually matters is that no primary button exists outside the
    // one CTA slot, so a second call to action cannot appear beside the first.
    const primaries = [...todaySource.matchAll(/className="btn btn--primary[^"]*"/g)];
    expect(primaries.length).toBeGreaterThan(0);

    for (const match of primaries) {
      expect(match[0], `a primary button sits outside the CTA slot: ${match[0]}`).toContain(
        'plan__cta',
      );
    }
  });

  it('guards the session CTA with a single condition, so only one arm can render', () => {
    const planned = todaySource.slice(at("view.status === 'planned'"));
    const body = planned.slice(0, planned.indexOf('</section>'));

    expect((body.match(/nextUp !== undefined \?/g) ?? []).length).toBe(1);
  });

  it('points the action at the next unfinished activity, not the whole session', () => {
    // A session-level "mark complete" was proposed and rejected once already: it
    // destroys the information that only part of the session happened.
    expect(todaySource).toContain('toggleActivityCompletion(log, nextUp.activity.id, true)');
    expect(todaySource).not.toMatch(/markSessionComplete|completeSession/);
  });

  it('states duration and intensity as facts rather than prose', () => {
    expect(todaySource).toContain('plan__fact');
    expect(todaySource).toContain('plannedMinutes');
  });

  it('gives the rest day a real action of its own', () => {
    const rest = todaySource.slice(at("view.status === 'rest'"));
    expect(rest).toContain('I rested today');
    expect(rest.slice(0, rest.indexOf('</section>'))).toContain('btn--primary');
  });
});

describe('tracking discloses progressively', () => {
  it('opens no tracking section by default', () => {
    const sections = todaySource.match(/<Section\b/g) ?? [];
    const closed = todaySource.match(/defaultOpen=\{false\}/g) ?? [];

    expect(sections.length).toBeGreaterThan(3);
    expect(closed.length, 'every Section must be closed by default').toBe(sections.length);
  });

  it('gives every collapsed section a summary, so closed still answers the question', () => {
    const sections = todaySource.match(/<Section\b/g) ?? [];
    const summaries = todaySource.match(/summary=\{/g) ?? [];
    expect(summaries.length).toBe(sections.length);
  });

  it('keeps units on the summaries rather than bare numbers', () => {
    // "4" told the user nothing; "4 glasses" does.
    expect(todaySource).toMatch(/\$\{hydration\.glasses\} glasses/);
    expect(todaySource).toMatch(/\$\{recovery\.sleepHours\} hours/);
  });
});

describe('the quick check-in is genuinely quick', () => {
  it('records water in a single tap, in both directions', () => {
    expect(checkInSource).toContain('One glass more');
    expect(checkInSource).toContain('One glass fewer');
  });

  it('labels every control for assistive technology', () => {
    const labels = checkInSource.match(/aria-label=|htmlFor=/g) ?? [];
    expect(labels.length).toBeGreaterThanOrEqual(4);
    expect(checkInSource).toContain('aria-labelledby');
  });

  it('says "Not recorded" rather than implying a miss', () => {
    // Comments stripped first. The component's own docstring explains that it must
    // never say "missed", and a naive search would match that explanation and
    // report the opposite of the truth.
    const code = checkInSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

    expect(code).toContain('Not recorded');
    expect(code).not.toMatch(/missed|failed|behind|should have/i);
  });

  it('keeps every control at or above the 44px touch floor', () => {
    for (const selector of ['.checkin__row', '.checkin__input', '.checkin__step']) {
      const rule = baseRule(today, selector);
      const height = rule.get('min-height') ?? rule.get('height');
      expect(height, `${selector} declares no height`).toBeDefined();
      expect(Number.parseInt(height as string, 10)).toBeGreaterThanOrEqual(44);
    }
  });
});

describe('the companion stays a strip', () => {
  it('no longer wears the reward surface', () => {
    // A reward surface should mark a reward, not the permanent furniture.
    expect(gameHeaderSource).not.toContain('card--reward');
    expect(gameHeaderSource).not.toContain('btn--block');
  });

  it('sizes the egg well below its onboarding size', () => {
    const art = baseRule(game, '.game__art .egg');
    const height = Number.parseInt(art.get('height') as string, 10);

    expect(height).toBeGreaterThan(0);
    expect(height, 'the companion must not dominate Today').toBeLessThanOrEqual(48);
  });

  it('keeps the hatch and evolve moments reachable, just not dominant', () => {
    expect(gameHeaderSource).toContain('Hatch egg');
    expect(gameHeaderSource).toContain('See what changed');
    expect(gameHeaderSource).toContain('btn--secondary');
  });

  it('still names the level and exposes XP to assistive technology', () => {
    expect(gameHeaderSource).toContain('Level {progress.level}');
    expect(gameHeaderSource).toMatch(/aria-label=\{[\s\S]*XP/);
  });
});

describe('the phase changed no semantics it was not meant to', () => {
  it('keeps attention separate from the plan facts', () => {
    const fact = baseRule(today, '.plan__fact');
    for (const value of fact.values()) {
      expect(value, 'session facts must never borrow the attention amber').not.toContain(
        '--ft-attention',
      );
    }
  });

  it('introduces no red anywhere in the touched stylesheets', () => {
    for (const [name, source] of [
      ['today.css', today],
      ['game.css', game],
    ] as const) {
      for (const match of source.matchAll(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/g)) {
        const chroma = Number(match[2]);
        const hue = Number(match[3]);
        expect(chroma > 0.04 && (hue < 40 || hue > 350), `red found in ${name}`).toBe(false);
      }
    }
  });

  it('adds no hardcoded colour outside the token layer', () => {
    for (const source of [today, game]) {
      expect(source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    }
  });

  it('states partial completion without framing it as a shortfall', () => {
    expect(todaySource).toContain('of ${completion.plannedCount} done');
    expect(todaySource).not.toMatch(/only \$\{|incomplete|you missed/i);
  });

  it('leaves every new rule inside the declared layers', () => {
    // A rule outside @layer would outrank the whole cascade by accident.
    for (const rule of leafRules(today)) {
      expect(propertiesIn(rule.body).size).toBeGreaterThanOrEqual(0);
    }
    expect(today.trimStart().startsWith('@layer') || today.includes('@layer screens')).toBe(true);
  });
});
