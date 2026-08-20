import { describe, expect, it } from 'vitest';
import todayContextSource from '../domain/game/todayContext.ts?raw';
import { RETURNING_AFTER_DAYS, mascotMessage } from '../domain/game/messages';
import {
  daysSinceLastActive,
  isReturning,
  todayCompanionContext,
  type TodayCompanionInput,
} from '../domain/game/todayContext';
import type { MascotPersonality } from '../domain/game/types';
import type { SessionCompletionStatus } from '../domain/weeklyPlan';

/**
 * What the companion has noticed, and what it may never say about it.
 *
 * Two kinds of test here. The precedence cases pin the handful of orderings that
 * carry a product decision - chiefly that finishing the session outranks having been
 * away, because leading with the absence would turn a good day into a comment about
 * the gap. The tone cases pin the things that must stay impossible: no guilt, no
 * greeting a new user as though they had lapsed, and no unreachable copy.
 */

const source = todayContextSource;
/** Comments stripped: the docstring explains what must not happen and would match. */
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const TODAY = '2026-08-20';

function input(patch: Partial<TodayCompanionInput> = {}): TodayCompanionInput {
  return {
    eggState: 'hatched',
    evolutionReady: false,
    completion: 'not_yet',
    grantedKinds: [],
    today: TODAY,
    ...patch,
  };
}

describe('the day is read from facts the domain already owns', () => {
  it('acknowledges a finished session', () => {
    expect(todayCompanionContext(input({ completion: 'complete' }))).toBe('session_complete');
  });

  it('acknowledges a planned rest day as an outcome, not an empty day', () => {
    expect(todayCompanionContext(input({ completion: 'rest' }))).toBe('rest_day');
  });

  it('acknowledges partial completion, which is a win', () => {
    expect(todayCompanionContext(input({ completion: 'partial' }))).toBe('partial_complete');
  });

  it('notices a trophy granted by this sync', () => {
    expect(todayCompanionContext(input({ grantedKinds: ['trophy_unlocked'] }))).toBe('trophy');
  });

  it('says nothing special about a day not got to yet', () => {
    // `not_yet` must reach no message of its own: a day still in progress is not an
    // event, and giving it a line would be the companion prompting rather than
    // responding.
    expect(todayCompanionContext(input({ completion: 'not_yet' }))).toBe('idle');
    expect(todayCompanionContext(input({ completion: 'unplanned' }))).toBe('idle');
  });
});

describe('precedence', () => {
  it('puts an action the user can take now above any remark about the day', () => {
    expect(
      todayCompanionContext(input({ eggState: 'ready', completion: 'complete' })),
    ).toBe('hatch_ready');

    expect(
      todayCompanionContext(input({ evolutionReady: true, completion: 'complete' })),
    ).toBe('evolution_ready');
  });

  it('ranks a finished session above a return after time away', () => {
    /**
     * THE ONE ORDERING MOST WORTH PROTECTING.
     *
     * Somebody who has been away a fortnight and has just done the entire session
     * hears about the session. Reversing this would greet a person at their best
     * moment with an observation about how long they had been gone.
     */
    const away = input({
      completion: 'complete',
      lastActiveDate: '2026-08-01',
    });

    expect(isReturning(away.today, away.lastActiveDate)).toBe(true);
    expect(todayCompanionContext(away)).toBe('session_complete');
  });

  it('greets a return only once today has nothing of its own to say', () => {
    expect(
      todayCompanionContext(input({ completion: 'not_yet', lastActiveDate: '2026-08-01' })),
    ).toBe('returning');
  });

  it('prefers the warmer return line to ambient egg colour', () => {
    // "Ready when you are" is more use after time away than "Something inside is
    // moving."
    expect(
      todayCompanionContext(
        input({ eggState: 'unhatched', completion: 'not_yet', lastActiveDate: '2026-08-01' }),
      ),
    ).toBe('returning');
  });

  it('falls back to the egg, then to calm', () => {
    expect(todayCompanionContext(input({ eggState: 'unhatched' }))).toBe('egg_waiting');
    expect(todayCompanionContext(input({ eggState: 'hatched' }))).toBe('idle');
  });
});

describe('returning is a greeting, never a streak', () => {
  it('treats someone who has never been active as new, not lapsed', () => {
    // The distinction this whole `undefined` case exists for. A first-time user has
    // not been away from anything, and must never be welcomed back.
    expect(daysSinceLastActive(TODAY, undefined)).toBeUndefined();
    expect(isReturning(TODAY, undefined)).toBe(false);
    expect(todayCompanionContext(input({ lastActiveDate: undefined }))).toBe('idle');
  });

  it('does not trigger a day early', () => {
    const dayBefore = '2026-08-17'; // three days before TODAY
    expect(daysSinceLastActive(TODAY, dayBefore)).toBe(RETURNING_AFTER_DAYS - 1);
    expect(isReturning(TODAY, dayBefore)).toBe(false);
  });

  it('triggers exactly on the threshold', () => {
    const onThreshold = '2026-08-16'; // four days before TODAY
    expect(daysSinceLastActive(TODAY, onThreshold)).toBe(RETURNING_AFTER_DAYS);
    expect(isReturning(TODAY, onThreshold)).toBe(true);
  });

  it('survives a clock or a backup that reports the future', () => {
    // A wrong device clock should make the companion say nothing unusual, not throw
    // on the first render of Today.
    expect(daysSinceLastActive(TODAY, '2026-09-01')).toBe(0);
    expect(isReturning(TODAY, '2026-09-01')).toBe(false);
  });

  it('never worsens with time, because there is nothing to lose', () => {
    // Every longer absence lands on the same single line. There is no second, worse
    // state further along.
    for (const date of ['2026-08-16', '2026-07-01', '2025-01-01']) {
      expect(todayCompanionContext(input({ lastActiveDate: date }))).toBe('returning');
    }
  });
});

describe('the module derives nothing it does not own', () => {
  it('re-implements no completion logic', () => {
    // Completion has exactly one source of truth. If this file ever started counting
    // activities there would be two answers to the same question.
    expect(code).not.toMatch(/completedActivityIds|summariseSessionCompletion|activities/);
  });

  it('persists nothing and grants nothing', () => {
    expect(code).not.toMatch(/repository|adapter|localStorage|awardedKeys|save|write/i);
  });

  it('reads the threshold from the message table rather than restating it', () => {
    expect(source).toContain('RETURNING_AFTER_DAYS');
    expect(code).not.toMatch(/>=\s*4\b/);
  });
});

describe('every context it can choose has copy behind it', () => {
  const PERSONALITIES: readonly MascotPersonality[] = ['quiet', 'normal', 'chatty'];

  const REACHABLE: ReadonlyArray<TodayCompanionInput> = [
    input({ eggState: 'ready' }),
    input({ evolutionReady: true }),
    input({ grantedKinds: ['trophy_unlocked'] }),
    input({ completion: 'complete' }),
    input({ completion: 'rest' }),
    input({ completion: 'partial' }),
    input({ lastActiveDate: '2026-01-01' }),
    input({ eggState: 'unhatched' }),
    input(),
  ];

  it('resolves each one through the message table without error', () => {
    for (const candidate of REACHABLE) {
      const context = todayCompanionContext(candidate);
      for (const personality of PERSONALITIES) {
        // `undefined` is a legitimate answer - it is how the quiet personality stays
        // quiet - so this asserts the lookup succeeds, not that it speaks.
        expect(() => mascotMessage(context, personality)).not.toThrow();
      }
    }
  });

  it('reaches the four contexts Today could not reach before', () => {
    const reached = new Set(REACHABLE.map((candidate) => todayCompanionContext(candidate)));

    for (const context of ['session_complete', 'rest_day', 'partial_complete', 'returning']) {
      expect(reached, `${context} is still unreachable from Today`).toContain(context);
    }
  });

  it('never reaches wording that blames the user', () => {
    const reached = REACHABLE.map((candidate) => todayCompanionContext(candidate));

    for (const context of reached) {
      for (const personality of PERSONALITIES) {
        const message = mascotMessage(context, personality);
        if (message === undefined) continue;
        expect(message, `${context}/${personality}`).not.toMatch(
          /missed|failed|behind|only|streak|lost|should have|broke/i,
        );
      }
    }
  });
});

describe('completion statuses are covered exhaustively', () => {
  it('answers for every status the session summary can produce', () => {
    const statuses: readonly SessionCompletionStatus[] = [
      'rest',
      'complete',
      'partial',
      'not_yet',
      'unplanned',
    ];

    for (const completion of statuses) {
      expect(typeof todayCompanionContext(input({ completion }))).toBe('string');
    }
  });
});
