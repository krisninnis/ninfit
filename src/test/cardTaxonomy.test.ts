import { describe, expect, it } from 'vitest';
import todaySource from '../ui/screens/TodayScreen.tsx?raw';
import weekSource from '../ui/screens/WeekScreen.tsx?raw';
import progressSource from '../ui/screens/ProgressScreen.tsx?raw';
import profileSource from '../ui/screens/ProfileScreen.tsx?raw';
import dataSource from '../ui/screens/DataScreen.tsx?raw';
import gameHeaderSource from '../ui/components/GameHeader.tsx?raw';
import iconSource from '../ui/components/Icon.tsx?raw';

/**
 * Structural invariants for the card taxonomy.
 *
 * These are not visual tests - nothing here checks how anything looks. They protect
 * the handful of decisions that would be quietly expensive to lose: that attention
 * never relies on colour alone, that the Data screen stays un-gamified, and that
 * today's plan keeps the strongest role on its screen.
 */

const SCREENS: ReadonlyArray<[string, string]> = [
  ['Today', todaySource],
  ['Week', weekSource],
  ['Progress', progressSource],
  ['Profile', profileSource],
  ['Data', dataSource],
];

describe('attention states never rely on colour alone', () => {
  it('pairs every attention card with an icon', () => {
    for (const [name, source] of SCREENS) {
      const cards = source.match(/className="card card--attention"/g) ?? [];
      if (cards.length === 0) continue;

      // Each attention card is immediately followed by the icon.
      const withIcon = source.match(/card--attention"[^>]*>\s*\n\s*<AttentionIcon \/>/g) ?? [];
      expect(withIcon.length, `${name} attention cards missing an icon`).toBe(cards.length);
    }
  });

  it('gives every attention chip an icon as well as its wording', () => {
    for (const [name, source] of SCREENS) {
      for (const chip of source.match(/className="attention-chip">[\s\S]{0,120}?<\/span>/g) ?? []) {
        expect(chip, `${name} chip without an icon`).toMatch(/<AttentionIcon \/>/);
        // And words, not just a symbol.
        expect(chip.replace(/<[^>]*>/g, '').trim().length).toBeGreaterThan(2);
      }
    }
  });

  it('gives the inline attention note an icon', () => {
    for (const [, source] of SCREENS) {
      for (const note of source.match(/className="attention-note[^"]*">[\s\S]{0,160}?<\/p>/g) ?? []) {
        expect(note).toMatch(/<AttentionIcon \/>/);
      }
    }
  });

  it('draws the icon as a shape, so it survives greyscale', () => {
    expect(iconSource).toMatch(/<svg/);
    expect(iconSource).toMatch(/stroke="currentColor"/);
    expect(iconSource).toMatch(/aria-hidden="true"/);
  });

  it('keeps skill focus visually distinct from attention', () => {
    // Focus is accent emphasis; attention means a recorded symptom change. If focus
    // ever became an attention chip the two meanings would collide.
    expect(profileSource).toMatch(/className="stat__flag"/);
    expect(profileSource).not.toMatch(/attention-chip">\s*<AttentionIcon \/>focus/);
  });
});

describe('card roles', () => {
  it('makes today’s plan the action card', () => {
    // Matched on the role rather than the exact class string: Phase 6 added
    // `plan--hero`, and pinning the literal list would fail on any future modifier
    // while proving nothing extra. The role is what the taxonomy is about.
    expect(todaySource).toMatch(/className="card card--action plan\b/);
    expect(todaySource).toMatch(/className="card card--action plan[^"]*plan--rest"/);
  });

  it('keeps tracking sections on the quiet default', () => {
    // The collapsible tracking sections use <Section>, which is a plain .card.
    expect(todaySource).not.toMatch(/<Section[^>]*className="card--action/);
    expect(todaySource).not.toMatch(/<Section[^>]*className="card--reward/);
  });

  /**
   * CHANGED IN PHASE 6, DELIBERATELY.
   *
   * The companion header used to wear `card--reward` permanently. That made the
   * reward surface mean "the game lives here" rather than "something was earned",
   * and it was the tallest thing on Today - the exact hierarchy Phase 6 set out to
   * fix. It is now a plain strip.
   *
   * The reward role is not retired: it stays reserved in the taxonomy for actual
   * reward moments, which Phase 8 builds. What this test now protects is that it is
   * not spent on furniture.
   */
  it('keeps the reward role off the permanent companion strip', () => {
    expect(gameHeaderSource).not.toMatch(/card--reward/);
    expect(gameHeaderSource).toMatch(/className="game"/);
  });

  it('keeps reward styling off the Data screen', () => {
    expect(dataSource).not.toMatch(/card--reward/);
    expect(dataSource).not.toMatch(/reward-glow/);
    // Restoring a backup must not feel celebratory.
    expect(dataSource).toMatch(/card--attention/);
  });

  it('uses the information role for the storage explanation', () => {
    expect(dataSource).toMatch(/className="card card--info"/);
  });
});

describe('one stat vocabulary', () => {
  it('has retired the old statrow classes', () => {
    for (const [name, source] of SCREENS) {
      expect(source, `${name} still uses statrow`).not.toMatch(/statrow/);
    }
  });

  it('uses the shared stat parts', () => {
    expect(weekSource).toMatch(/className="stat stat--row"/);
    expect(progressSource).toMatch(/className="stat stat--tile"/);
    for (const [, source] of SCREENS) {
      if (/className="stat /.test(source)) {
        expect(source).toMatch(/stat__(label|value)/);
      }
    }
  });
});

describe('buttons use the shared primitives', () => {
  it('has no bare legacy button classes left', () => {
    for (const [name, source] of [...SCREENS, ['GameHeader', gameHeaderSource] as [string, string]]) {
      expect(source, `${name} uses a legacy button class`).not.toMatch(
        /className="primary"|className="confirm__ok"|className="confirm__cancel"|className="onboard__skip"/,
      );
    }
  });

  it('confirms a replacement with attention, never with red', () => {
    expect(dataSource).toMatch(/btn btn--attention/);
    for (const [name, source] of SCREENS) {
      expect(source, `${name} mentions red`).not.toMatch(/\bred\b|danger|destructive/i);
    }
  });
});
