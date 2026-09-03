import { describe, expect, it } from 'vitest';
import todaySource from '../ui/screens/TodayScreen.tsx?raw';
import gameHeaderSource from '../ui/components/GameHeader.tsx?raw';
import checkInSource from '../ui/components/QuickCheckIn.tsx?raw';
import hatchHookSource from '../ui/hooks/useHatchCinematic.ts?raw';
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

/**
 * The screen with its comments removed.
 *
 * Every assertion below searches for wording that must NOT be on Today, and the
 * comments that explain those rules necessarily quote the wording. Searching the raw
 * source would match the explanation and report the exact opposite of the truth -
 * the same trap the quick check-in test documents.
 */
const todayCode = todaySource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('Today keeps no daily completion score', () => {
  /**
   * A LOCKED PRODUCT RULE, NOT A LAYOUT PREFERENCE.
   *
   * Today used to end with "N of M sections recorded". It scored how much of a form
   * had been filled in, so the only way to raise it was to type more - a person who
   * did their whole session and wrote nothing down scored 1 of 5. Rewarding showing
   * up and scoring the day are different products, and this one rewards showing up.
   *
   * These assertions are about the score coming back in ANOTHER shape, which is the
   * likely way it returns: a ring, a percentage, a "complete your day".
   */
  it('renders no section-completion ratio', () => {
    expect(todayCode).not.toContain('today__footer');
    expect(todayCode).not.toMatch(/sections recorded/);
    expect(todayCode).not.toMatch(/completion\.(filled|total)/);
  });

  it('does not even take the tally from the hook', () => {
    // Reading it is how it grows back. `useToday` still offers it; Today declines.
    const destructure = todayCode.slice(
      todayCode.indexOf('= useToday()') - 200,
      todayCode.indexOf('= useToday()'),
    );
    expect(destructure).not.toMatch(/\bcompletion\b/);
  });

  it('leaves no styling behind for one to be hung on', () => {
    expect(today).not.toContain('.today__footer {');
  });

  it('scores the day in no other shape either', () => {
    expect(todayCode).not.toMatch(/completionRing|dailyScore|percentComplete|__ring\b/i);
    expect(todayCode).not.toMatch(/complete your day|finish your day|\d+% (complete|done)/i);
  });

  /**
   * The one count Today does keep, and why it is not the same thing.
   *
   * `today__insight` counts distinct days with something completed. It measures
   * turning up, it has no denominator, and there is no state in which it reads as a
   * shortfall - a new user gets an invitation rather than a zero.
   */
  it('still counts showing up, which is the number that is allowed', () => {
    expect(todaySource).toContain('today__insight');
    expect(todaySource).toContain('activeDays');
    expect(todaySource).toContain('Your first active day starts whenever you are ready.');
  });
});

describe('the path mascot is the permanent companion on Today', () => {
  /**
   * LOCKED. The path mascot strip is attached to the user's own fitness journey and
   * is the single permanent character on this screen.
   *
   * Opal is the NinFit guide, not a second resident. This does not forbid a future
   * contextual Opal - Opal speaking when there is a reason to is the agreed
   * direction - it forbids Opal being rendered unconditionally beside the path
   * mascot, which is how a guide turns into furniture and pushes the session down.
   */
  it('renders the path mascot strip unconditionally', () => {
    expect(todayCode).toContain('<GameHeader');
    expect((todayCode.match(/<GameHeader/g) ?? []).length).toBe(1);
  });

  it('gives Opal no permanent card of its own here', () => {
    expect(todayCode, 'Opal must not be a second permanent character on Today').not.toMatch(
      /<Opal\b/,
    );
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

describe('the quick check-in stays secondary to the real fitness action', () => {
  it('uses a quiet card rather than an action or reward surface', () => {
    expect(checkInSource).toContain('className="card checkin"');
    expect(checkInSource).not.toContain('card--action');
    expect(checkInSource).not.toContain('card--reward');
  });

  it('keeps non-action Today states informational rather than primary', () => {
    expect(todaySource).toContain('className="card card--info plan"');
    expect((todaySource.match(/className="card card--info plan"/g) ?? []).length).toBe(2);
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

  /**
   * THE CINEMATIC MOVED, AND THAT IS THE POINT.
   *
   * Hatching now happens in onboarding for almost everybody; Today is the recovery
   * route for a save that arrived here still holding an egg. Both share one hook, so
   * the guarantees are asserted once, where they live, rather than twice in two
   * copies that could drift.
   */
  it('keeps the real hatch action behind a short presentation-only reveal', () => {
    expect(gameHeaderSource).toContain('useHatchCinematic');
    expect(hatchHookSource).toContain("setPhase('cracking')");
    expect(hatchHookSource).toContain("setPhase('flash')");
    expect(hatchHookSource).toContain('onHatchRef.current();');
  });

  it('prevents repeated hatch requests while the reveal is running', () => {
    expect(hatchHookSource).toContain("if (!canHatch || phase !== 'idle') return;");
    expect(gameHeaderSource).toContain('disabled: hatch.isRunning');
  });

  it('gives reduced-motion users the timed still-state ceremony', () => {
    expect(hatchHookSource).toContain('prefers-reduced-motion: reduce');
    expect(hatchHookSource).toMatch(/if \(reduceMotion\) \{[\s\S]*?commit\(\);[\s\S]*?return;/);
  });

  it('asks the domain whether the egg may open, and never decides for itself', () => {
    expect(gameHeaderSource).toContain("canHatch: state.mascot.eggState === 'ready'");
    const code = hatchHookSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(code).not.toMatch(/eggState|hatchEgg|familyId/);
  });

  it('still names the level and exposes XP to assistive technology', () => {
    expect(gameHeaderSource).toContain('Level {progress.level}');
    expect(gameHeaderSource).toMatch(/aria-label=\{[\s\S]*XP/);
  });

  /**
   * The companion should feel alive without the screen deciding what is true.
   *
   * The header used to hold its own `contextFor(state)`, which could see the egg and
   * nothing else - so the message never changed when the user finished a session,
   * rested, earned a trophy or came back after a fortnight. That was a presentation
   * component deriving product truth, which the architecture rule puts in the domain.
   */
  it('is told what the companion has noticed rather than working it out', () => {
    expect(gameHeaderSource).not.toMatch(/function contextFor/);
    expect(gameHeaderSource).toContain('context: MascotContext');
    expect(gameHeaderSource).toContain('mascotMessage(context,');
  });

  it('reads the mascot state for artwork only, never to choose the message', () => {
    // The one remaining `state.mascot` reads decide what to draw and which action to
    // offer. None of them may decide what is said.
    // Re-anchored when the XP float retired and took `const latest` with it. The
    // slice is the same single declaration it always was: `const action` is now what
    // follows the message, so the scope of this assertion is unchanged.
    const messageLine = gameHeaderSource.slice(
      gameHeaderSource.indexOf('const message ='),
      gameHeaderSource.indexOf('const action ='),
    );
    expect(messageLine).not.toContain('state.mascot');
  });

  it('sources the context from the domain, on the screen that owns the day', () => {
    expect(todaySource).toContain("from '../../domain/game/todayContext'");
    expect(todaySource).toContain('todayCompanionContext({');
    expect(todaySource).toContain('context={companionContext}');
  });


  /**
   * The Mystery Egg on Today is now a RECOVERY state, not the normal one: first-run
   * hatching happens in onboarding, so an ordinary user arrives here with a starter
   * mascot. Crucially, Today no longer reads reward keys to draw the shell - cracking
   * belongs to onboarding, and activity buys growth instead.
   */
  it('no longer derives the shell from activity or reward keys', () => {
    const code = todaySource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(code).not.toContain('eggProgress');
    expect(code).not.toMatch(/awardedKeys/);
    expect(code).toContain('MAX_CRACK_STAGE');
  });

  it('passes the crack stage through the companion strip to EggArt', () => {
    expect(gameHeaderSource).toContain('crackStage: number');
    expect(gameHeaderSource).toContain('crackStage={crackStage}');
  });

  it('feeds it the session completion already computed for the plan card', () => {
    // Not a second reading of the day. The plan card and the companion must agree,
    // which they can only do by sharing one answer.
    expect(todaySource).toContain('completion: sessionCompletion.status');
  });
});

describe('the phase changed no semantics it was not meant to', () => {
  it('keeps attention separate from the plan facts', () => {
    const fact = baseRule(today, '.plan__fact');
    for (const value of fact.values()) {
      expect(value, 'session facts must never borrow the attention amber').not.toContain(
        '--ft-attention',
