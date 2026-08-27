import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TAB,
  JOURNEY_ACTIVE_HASH,
  JOURNEY_HASH,
  PRIMARY_NAV,
  TABS,
  hashForPrimaryNav,
  hashForTab,
  journeyDetailHash,
  isTabId,
  parseRouteFromHash,
  parseTabFromHash,
  tabDefinition,
} from '../ui/tabs';

describe('tabs', () => {
  it('keeps the original five journal tabs in order', () => {
    expect(TABS.map((tab) => tab.id)).toEqual(['today', 'week', 'progress', 'profile', 'data']);
  });

  it('adds Journey as a primary navigation destination without weakening TabId', () => {
    expect(PRIMARY_NAV.map((item) => item.id)).toEqual([
      'today', 'week', 'journey', 'progress', 'profile', 'data',
    ]);
    expect(isTabId('journey')).toBe(false);
  });

  it('defaults to Today', () => {
    expect(DEFAULT_TAB).toBe('today');
  });

  it('every tab has a label and a title', () => {
    for (const tab of TABS) {
      expect(tab.label.length).toBeGreaterThan(0);
      expect(tab.title.length).toBeGreaterThan(0);
    }
  });
});

describe('parseTabFromHash', () => {
  it('parses each journal tab from its canonical hash', () => {
    for (const tab of TABS) {
      expect(parseTabFromHash(hashForTab(tab.id))).toBe(tab.id);
    }
  });

  it.each([
    ['', 'empty hash'],
    ['#', 'bare hash'],
    ['#/', 'hash root'],
    ['#/nonsense', 'unknown route'],
    ['#/today/extra', 'over-deep route'],
  ])('falls back to Today for %s (%s)', (hash) => {
    expect(parseTabFromHash(hash)).toBe('today');
  });
});

describe('Journey routes', () => {
  it('separates Journey Home from the immersive active recorder', () => {
    expect(parseRouteFromHash(JOURNEY_HASH)).toEqual({ kind: 'journey-home' });
    expect(parseRouteFromHash(JOURNEY_ACTIVE_HASH)).toEqual({ kind: 'journey-active' });
  });

  it('builds Journey and journal navigation hashes correctly', () => {
    expect(hashForPrimaryNav('journey')).toBe(JOURNEY_HASH);
    expect(hashForPrimaryNav('week')).toBe('#/week');
  });

  it('keeps ordinary tab routing unchanged', () => {
    expect(parseRouteFromHash('#/week')).toEqual({ kind: 'tab', tab: 'week' });
  });

  it('preserves opaque Journey ids exactly, including case and encoded characters', () => {
    const id = 'Journey-MixedCase/1';
    const hash = journeyDetailHash(id);
    expect(hash).toBe('#/journey/detail/Journey-MixedCase%2F1');
    expect(parseRouteFromHash(hash)).toEqual({ kind: 'journey-detail', journeyId: id });
  });

  it('fails malformed detail ids back to Journey Home', () => {
    expect(parseRouteFromHash('#/journey/detail/%E0%A4%A')).toEqual({ kind: 'journey-home' });
  });
});

describe('hashForTab', () => {
  it('round-trips through parseTabFromHash', () => {
    for (const tab of TABS) {
      expect(parseTabFromHash(hashForTab(tab.id))).toBe(tab.id);
    }
  });

  it('produces a relative hash path', () => {
    expect(hashForTab('week')).toBe('#/week');
  });
});

describe('isTabId', () => {
  it('accepts known ids and rejects others', () => {
    expect(isTabId('today')).toBe(true);
    expect(isTabId('data')).toBe(true);
    expect(isTabId('journey')).toBe(false);
    expect(isTabId('settings')).toBe(false);
    expect(isTabId('')).toBe(false);
  });
});

describe('tabDefinition', () => {
  it('returns the definition for a known tab', () => {
    expect(tabDefinition('progress').label).toBe('Progress');
  });
});
