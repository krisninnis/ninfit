// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GameHeader } from '../ui/components/GameHeader';
import { OnboardingScreen } from '../ui/screens/OnboardingScreen';
import { resetAppContextForTests } from '../app/bootstrap';
import { createDefaultGameSettings, createInitialGameState } from '../domain/game/defaults';
import { hatchEgg } from '../domain/game/mascot';
import { MAX_CRACK_STAGE } from '../domain/game/egg';
import { mascotStageArt } from '../ui/mascotStageArt';
import type { GameState } from '../domain/game/types';
import type { FinishOnboardingInput } from '../app/game';

/**
 * THE STARTER TORTOISE HATCH, END TO END (#134).
 *
 * Everything else in the egg suites checks a source file or a generated asset. This
 * one runs the actual ceremony in a DOM, with real timers stepped by hand and the
 * real domain mutation wired to the real component, and watches what is on screen at
 * each beat.
 *
 * It exists because the two things most likely to go wrong here cannot be seen in a
 * source assertion:
 *
 * 1. THE SPECIES APPEARING EARLY. Not through a label - that is already impossible -
 *    but through an <img src> mounting a frame before the authoritative hatch. The
 *    only honest check is to look at the whole rendered tree, at every beat before
 *    the break, and find no reference to the family's artwork anywhere in it.
 * 2. THE COMMIT DRIFTING OFF THE BREAK. At 4.2 seconds a mutation that fires at the
 *    END means someone can background the app mid-ceremony, having watched their egg
 *    open, and still own an egg.
 *
 * The host below is Today's recovery route - a save that reached Today still holding
 * a ready egg. Onboarding uses the same hook, the same component and the same gating
 * expression; `hatchTiming` and the source guards at the bottom of this file hold
 * that equivalence, because driving the whole questionnaire to its final press would
 * test the questionnaire rather than the hatch.
 */

const TORTOISE_ART = mascotStageArt('tortoise', 'starter');
const NOW = '2026-09-04T09:00:00.000Z';

/** A save that reached Today still holding an egg, with onboarding behind it. */
function readyEggState(): GameState {
  const base = createInitialGameState({ now: NOW });
  return {
    ...base,
    onboarding: { ...base.onboarding, completed: true },
    mascot: { ...base.mascot, familyId: 'tortoise', eggState: 'ready' },
  };
}

/**
 * The real wiring, not a mock of it.
 *
 * `onHatch` performs the domain mutation and the host re-renders with the result,
 * which is exactly what `TodayScreen` does through `game.hatch`. A test that passed a
 * spy here would prove the spy was called and nothing about whether the person ends
 * up owning a companion.
 */
function TodayRecoveryHost({ onCommit }: { onCommit: (state: GameState) => void }) {
  const [state, setState] = useState<GameState>(readyEggState);

  return (
    <GameHeader
      state={state}
      settings={createDefaultGameSettings()}
      context={state.mascot.eggState === 'hatched' ? 'just_hatched' : 'hatch_ready'}
      freshMomentKey=""
      crackStage={state.mascot.eggState === 'unhatched' ? 0 : MAX_CRACK_STAGE}
      onHatch={() => {
        setState((current) => {
          const next = { ...current, mascot: hatchEgg(current.mascot, NOW) };
          onCommit(next);
          return next;
        });
      }}
      onEvolve={() => {
        throw new Error('the hatch presentation must never trigger an evolution');
      }}
    />
  );
}

const hatchButton = () => {
  const button = Array.from(document.querySelectorAll('button')).find(
    (candidate) => candidate.textContent === 'Hatch egg' || candidate.textContent === 'Hatching…',
  );
  expect(button, 'no hatch control on screen').toBeTruthy();
  return button as HTMLButtonElement;
};

/** Every asset URL currently in the tree, however it got there. */
const assetUrls = () =>
  Array.from(document.querySelectorAll('img, image, source, video')).map(
    (element) => element.getAttribute('src') ?? element.getAttribute('poster') ?? '',
  );

const speciesLeaks = () =>
  [...assetUrls(), document.body.innerHTML].filter((value) =>
    /\/mascots\/|tortoise/i.test(value),
  );

const buttonNamed = (name: string) =>
  Array.from(document.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === name,
  );

const press = (name: string) => {
  const button = buttonNamed(name);
  expect(button, `no "${name}" control on screen`).toBeTruthy();
  (button as HTMLButtonElement).click();
};

/**
 * Answer whatever question is on screen and move on.
 *
 * The flow is adaptive, so the number and identity of the questions depend on the
 * answers - which is exactly why this picks an option and presses Continue rather
 * than following a fixed script. Some questions arrive prefilled from existing data,
 * so an already-selected option is left alone rather than being toggled off.
 */
const answerCurrentQuestion = () => {
  act(() => {
    const options = Array.from(document.querySelectorAll<HTMLButtonElement>('[aria-pressed]'));
    const chosen = options.some((option) => option.getAttribute('aria-pressed') === 'true');
    if (!chosen && options[0] !== undefined) options[0].click();
  });
  act(() => {
    const next = buttonNamed('Continue');
    if (next !== undefined && !next.disabled) next.click();
  });
};

/**
 * Onboarding with its real host wiring.
 *
 * `companionName` and `companionArtSrc` arrive only after the journey is recorded,
 * exactly as `App` supplies them - the screen is never handed a species it could
 * show early.
 */
function OnboardingHost({ onCommit }: { onCommit: (input: FinishOnboardingInput) => void }) {
  const [started, setStarted] = useState(false);

  return (
    <OnboardingScreen
      onStartJourney={(input) => {
        onCommit(input);
        setStarted(true);
      }}
      onFinished={() => {}}
      onDismiss={() => {}}
      companionName={started ? 'Tortoise' : undefined}
      companionArtSrc={started ? TORTOISE_ART?.src : undefined}
    />
  );
}

const setReducedMotion = (matches: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
};

beforeEach(() => {
  vi.useFakeTimers();
  setReducedMotion(false);
  resetAppContextForTests();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the premium egg is what the runtime actually shows', () => {
  it('renders the reviewed production stages, not the code drawing', () => {
    render(<TodayRecoveryHost onCommit={() => {}} />);

    const egg = document.querySelector('.egg');
    expect(egg?.getAttribute('data-egg-art')).toBe('production');

    const stages = Array.from(document.querySelectorAll('.egg__art'));
    expect(stages).toHaveLength(MAX_CRACK_STAGE + 1);
    expect(stages.map((img) => img.getAttribute('src'))).toEqual([
      '/egg/egg-stage-0-v1.svg',
      '/egg/egg-stage-1-v1.svg',
      '/egg/egg-stage-2-v1.svg',
      '/egg/egg-stage-3-v1.svg',
      '/egg/egg-stage-4-v1.svg',
      '/egg/egg-stage-5-v1.svg',
    ]);

    // The code-drawn shell is not on screen; it is the fallback, not the presentation.
    expect(document.querySelector('.egg__shell')).toBeNull();
  });

  it('shows exactly one stage, and it is the one the domain asked for', () => {
    render(<TodayRecoveryHost onCommit={() => {}} />);

    // All six are mounted so the break never waits on a decode; only one is visible.
    const visible = Array.from(document.querySelectorAll<HTMLElement>('.egg__art')).filter(
      (img) => img.style.opacity === '1',
    );
    expect(visible).toHaveLength(1);
    expect(visible[0]?.getAttribute('data-egg-art-stage')).toBe(String(MAX_CRACK_STAGE));
  });

  it('keeps every stage decorative and unannounced', () => {
    render(<TodayRecoveryHost onCommit={() => {}} />);

    for (const img of Array.from(document.querySelectorAll('.egg__art'))) {
      expect(img.getAttribute('alt')).toBe('');
      expect(img.getAttribute('aria-hidden')).toBe('true');
    }
    expect(document.querySelector('.egg')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('the full-motion ceremony, beat by beat', () => {
  it('discloses no species before the authoritative hatch', () => {
    const commits: GameState[] = [];
    render(<TodayRecoveryHost onCommit={(state) => commits.push(state)} />);

    expect(speciesLeaks()).toEqual([]);

    act(() => { hatchButton().click(); });

    /*
     * Absolute checkpoints across the build and the held beat, ending one millisecond
     * before the break. Every one of them looks at the WHOLE rendered tree, not just
     * the elements this test knows about - the leak worth catching is the one nobody
     * predicted the shape of.
     */
    let elapsed = 0;
    for (const checkpoint of [0, 400, 850, 1200, 1449]) {
      act(() => { vi.advanceTimersByTime(checkpoint - elapsed); });
      elapsed = checkpoint;
      expect(speciesLeaks(), `species visible at ${checkpoint}ms`).toEqual([]);
      expect(commits, `committed at ${checkpoint}ms, before the break`).toHaveLength(0);
      expect(document.querySelector('.egg-hatch__companion')).toBeNull();
    }

    // The build and the held beat are both real states on screen, not just timers.
    act(() => { vi.advanceTimersByTime(0); });
    expect(document.querySelector('.egg-hatch--held')).toBeTruthy();
  });

  it('commits the real hatch at the break, exactly once, mid-ceremony', () => {
    const commits: GameState[] = [];
    render(<TodayRecoveryHost onCommit={(state) => commits.push(state)} />);

    act(() => { hatchButton().click(); });
    act(() => { vi.advanceTimersByTime(1449); });
    expect(commits).toHaveLength(0);

    act(() => { vi.advanceTimersByTime(1); });
    expect(commits).toHaveLength(1);
    expect(commits[0]?.mascot.eggState).toBe('hatched');
    expect(commits[0]?.mascot.stage).toBe('starter');

    // And the ceremony is still running over an already-hatched domain: that is what
    // makes backgrounding the app at t=3s safe.
    expect(document.querySelector('.egg-hatch--flash, .egg-hatch--emerging')).toBeTruthy();

    act(() => { vi.advanceTimersByTime(4000); });
    expect(commits, 'the ceremony committed a second time').toHaveLength(1);
  });

  it('reveals the reviewed Starter Tortoise only after the break, then settles', () => {
    render(<TodayRecoveryHost onCommit={() => {}} />);
    act(() => { hatchButton().click(); });

    act(() => { vi.advanceTimersByTime(1449); });
    expect(document.querySelector('.egg-hatch__companion')).toBeNull();

    act(() => { vi.advanceTimersByTime(1); });
    const companion = document.querySelector('.egg-hatch__companion');
    expect(companion?.getAttribute('src')).toBe(TORTOISE_ART?.src);
    expect(companion?.getAttribute('alt')).toBe('');
    expect(companion?.getAttribute('aria-hidden')).toBe('true');

    // emerging -> settling -> landing: the companion stays; the shell is done.
    for (const [elapsed, phase] of [
      [250, 'egg-hatch--emerging'],
      [1450, 'egg-hatch--settling'],
      [700, 'egg-hatch--landing'],
    ] as const) {
      act(() => { vi.advanceTimersByTime(elapsed); });
      expect(document.querySelector(`.${phase}`), `missing ${phase}`).toBeTruthy();
      expect(document.querySelector('.egg-hatch__companion')?.getAttribute('src')).toBe(
        TORTOISE_ART?.src,
      );
    }
  });

  it('hands over to the normal standing companion when the ceremony ends', () => {
    render(<TodayRecoveryHost onCommit={() => {}} />);
    act(() => { hatchButton().click(); });
    act(() => { vi.advanceTimersByTime(4200); });

    // No ceremony layer, no egg, no hatch control - just the reviewed standing art
    // and the companion's name, which is the ordinary post-hatch Today strip.
    expect(document.querySelector('[class*="egg-hatch--"]')).toBeNull();
    expect(document.querySelector('.egg')).toBeNull();
    expect(document.querySelector('.mascot--art')?.getAttribute('src')).toBe(TORTOISE_ART?.src);
    expect(document.body.textContent).toContain('Tortoise');
    expect(
      Array.from(document.querySelectorAll('button')).map((b) => b.textContent),
    ).not.toContain('Hatch egg');
  });

  it('preserves the 4.2 second contract', () => {
    render(<TodayRecoveryHost onCommit={() => {}} />);
    act(() => { hatchButton().click(); });

    act(() => { vi.advanceTimersByTime(4199); });
    expect(document.querySelector('[class*="egg-hatch--"]'), 'ended early').toBeTruthy();

    act(() => { vi.advanceTimersByTime(1); });
    expect(document.querySelector('[class*="egg-hatch--"]')).toBeNull();
  });
});

describe('reduced motion is a ceremony, not a skip', () => {
  it('gives three states, commits at the opening, and never reveals early', () => {
    setReducedMotion(true);
    const commits: GameState[] = [];
    render(<TodayRecoveryHost onCommit={(state) => commits.push(state)} />);

    act(() => { hatchButton().click(); });
    expect(document.querySelector('.egg-hatch--reduced-ready')).toBeTruthy();
    expect(speciesLeaks()).toEqual([]);
    expect(commits).toHaveLength(0);

    act(() => { vi.advanceTimersByTime(699); });
    expect(speciesLeaks(), 'species visible before the opening beat').toEqual([]);
    expect(commits).toHaveLength(0);

    act(() => { vi.advanceTimersByTime(1); });
    expect(commits, 'the reduced path did not commit').toHaveLength(1);
    expect(commits[0]?.mascot.eggState).toBe('hatched');
    expect(document.querySelector('.egg-hatch--reduced-opening')).toBeTruthy();

    act(() => { vi.advanceTimersByTime(700); });
    expect(document.querySelector('.egg-hatch--reduced-meet')).toBeTruthy();
    expect(document.querySelector('.egg-hatch__companion')?.getAttribute('src')).toBe(
      TORTOISE_ART?.src,
    );

    act(() => { vi.advanceTimersByTime(700); });
    expect(document.querySelector('.mascot--art')?.getAttribute('src')).toBe(TORTOISE_ART?.src);
    expect(commits).toHaveLength(1);
  });

  it('still offers a Skip, and Skip keeps the authoritative result', () => {
    setReducedMotion(true);
    const commits: GameState[] = [];
    render(<TodayRecoveryHost onCommit={(state) => commits.push(state)} />);

    act(() => { hatchButton().click(); });
    const skip = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Skip',
    );
    expect(skip, 'reduced motion offers no Skip').toBeTruthy();

    // Skipped BEFORE the opening beat: the person still owns a hatched companion.
    act(() => { (skip as HTMLButtonElement).click(); });
    expect(commits).toHaveLength(1);
    expect(commits[0]?.mascot.eggState).toBe('hatched');

    act(() => { vi.advanceTimersByTime(2000); });
    expect(commits, 'Skip committed twice').toHaveLength(1);
    expect(document.querySelector('.mascot--art')?.getAttribute('src')).toBe(TORTOISE_ART?.src);
  });
});

describe('a failed asset costs polish and nothing else', () => {
  it('falls back to the code drawing without losing the hatch or the companion', () => {
    const commits: GameState[] = [];
    render(<TodayRecoveryHost onCommit={(state) => commits.push(state)} />);

    // One stage 404s on this device.
    const stage = document.querySelector('.egg__art');
    expect(stage).toBeTruthy();
    act(() => { stage?.dispatchEvent(new Event('error', { bubbles: false })); });

    expect(document.querySelector('.egg')?.getAttribute('data-egg-art')).not.toBe('production');
    expect(document.querySelector('.egg__shell'), 'no fallback shell rendered').toBeTruthy();
    expect(document.querySelectorAll('.egg__art')).toHaveLength(0);

    // The hatch is independent of presentation media, so it still runs, still commits
    // at the break, and still ends with the reviewed standing companion.
    act(() => { hatchButton().click(); });
    act(() => { vi.advanceTimersByTime(1450); });
    expect(commits).toHaveLength(1);
    expect(commits[0]?.mascot.eggState).toBe('hatched');

    act(() => { vi.advanceTimersByTime(2750); });
    expect(document.querySelector('.mascot--art')?.getAttribute('src')).toBe(TORTOISE_ART?.src);
    expect(speciesLeaks().length).toBeGreaterThan(0); // post-hatch, which is the point
  });
});

describe('the presentation changes nothing except the egg', () => {
  it('mutates only the mascot - no XP, trophy, reward, streak or Journey', () => {
    const before = readyEggState();
    const commits: GameState[] = [];
    render(<TodayRecoveryHost onCommit={(state) => commits.push(state)} />);

    act(() => { hatchButton().click(); });
    act(() => { vi.advanceTimersByTime(4200); });

    const after = commits[0];
    expect(after).toBeDefined();
    expect(after?.xp).toEqual(before.xp);
    expect(after?.trophies).toEqual(before.trophies);
    expect(after?.awardedKeys).toEqual(before.awardedKeys);
    expect(after?.recentEvents).toEqual(before.recentEvents);
    expect(after?.skills).toEqual(before.skills);
    expect(after?.cosmetics).toEqual(before.cosmetics);
    expect(after?.fitnessStage).toBe(before.fitnessStage);
    // Exactly one field moved, and it is the one the domain owns.
    expect(after?.mascot).toEqual({ ...before.mascot, eggState: 'hatched', hatchedAt: NOW });
  });

  it('starts no Journey and asks for no location', () => {
    const geolocation = vi.fn();
    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: geolocation, watchPosition: geolocation },
    });

    render(<TodayRecoveryHost onCommit={() => {}} />);
    act(() => { hatchButton().click(); });
    act(() => { vi.advanceTimersByTime(4200); });

    expect(geolocation).not.toHaveBeenCalled();
  });
});

/**
 * BOTH HOSTS, ONE BEHAVIOUR.
 *
 * The hatch happens in two places for two reasons: at the end of onboarding, where
 * almost everybody meets their companion, and on Today, which is the recovery route
 * for a save that arrived still holding an egg. The ceremony above was driven through
 * Today because driving onboarding to its final press would be a test of the
 * questionnaire. What is checked here is that onboarding is not a second
 * implementation - it renders the same egg through the same component, and reaches
 * the same hook with the same gating.
 */
describe('onboarding shows the same egg and shares the same authority', () => {
  it('renders the reviewed production stages, with no species anywhere', () => {
    render(
      <OnboardingScreen
        onStartJourney={() => {
          throw new Error('onboarding must not start a journey on render');
        }}
        onFinished={() => {}}
        onDismiss={() => {}}
      />,
    );

    expect(document.querySelector('.egg')?.getAttribute('data-egg-art')).toBe('production');
    expect(document.querySelectorAll('.egg__art')).toHaveLength(MAX_CRACK_STAGE + 1);
    expect(document.querySelector('.egg__shell')).toBeNull();
    expect(speciesLeaks()).toEqual([]);

    // Stage 0 at the start of the questionnaire: the shell is pristine, and the
    // picture is derived from progress rather than stored anywhere.
    const visible = Array.from(document.querySelectorAll<HTMLElement>('.egg__art')).filter(
      (img) => img.style.opacity === '1',
    );
    expect(visible).toHaveLength(1);
    expect(visible[0]?.getAttribute('data-egg-art-stage')).toBe('0');
  });

  it('hands the slot to the standing Tortoise once the ceremony ends', () => {
    /*
     * THE DEFECT THE VISUAL PROOF FOUND.
     *
     * Onboarding kept drawing the egg above the words "Your companion", because the
     * only companion element in that slot was the ceremony's, which is `opacity: 0`
     * outside a running ceremony. Nobody noticed while the egg was a placeholder
     * drawing; with reviewed artwork it reads as the wrong animal entirely.
     *
     * This walks the real questionnaire - the same seven presses a person makes - so
     * the assertion is about what onboarding actually does, not about a prop.
     */
    const commits: FinishOnboardingInput[] = [];
    render(<OnboardingHost onCommit={(input) => commits.push(input)} />);

    act(() => { press('Start'); });
    for (let step = 0; step < 12; step += 1) {
      if (buttonNamed('Start my journey') !== undefined) break;
      answerCurrentQuestion();
    }

    expect(buttonNamed('Start my journey'), 'never reached the final press').toBeTruthy();
    // Right up to the last press: still an egg, still no species anywhere.
    expect(document.querySelector('.egg')?.getAttribute('data-egg-art')).toBe('production');
    expect(speciesLeaks()).toEqual([]);

    act(() => { press('Start my journey'); });
    act(() => { vi.advanceTimersByTime(1449); });
    expect(commits, 'onboarding recorded the journey before the break').toHaveLength(0);
    expect(speciesLeaks()).toEqual([]);

    act(() => { vi.advanceTimersByTime(1); });
    expect(commits).toHaveLength(1);

    // Mid-ceremony the egg is still the thing in the slot, with the companion layer
    // travelling over it.
    expect(document.querySelector('.egg')).toBeTruthy();
    expect(document.querySelector('.egg-hatch__companion')?.getAttribute('src')).toBe(
      TORTOISE_ART?.src,
    );

    act(() => { vi.advanceTimersByTime(2751); });

    // Ceremony over: the egg is gone and the reviewed standing Tortoise has the slot.
    expect(document.querySelector('[class*="egg-hatch--"]')).toBeNull();
    expect(document.querySelector('.egg'), 'the egg outlived the ceremony').toBeNull();
    expect(document.querySelector('.step__companionArt')?.getAttribute('src')).toBe(
      TORTOISE_ART?.src,
    );
    expect(document.body.textContent).toContain('Tortoise');
  });

  it('offers no companion, no hatch and no species before the questionnaire is done', () => {
    render(
      <OnboardingScreen
        onStartJourney={() => {}}
        onFinished={() => {}}
        onDismiss={() => {}}
      />,
    );

    expect(document.querySelector('.egg-hatch__companion')).toBeNull();
    expect(document.querySelector('[class*="egg-hatch--"]')).toBeNull();
    expect(speciesLeaks()).toEqual([]);
  });
});
