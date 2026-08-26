import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TAB,
  JOURNEY_HASH,
  TABS,
  hashForTab,
  isTabId,
  parseRouteFromHash,
  parseTabFromHash,
  tabDefinition,
} from '../ui/tabs';

describe('tabs', () => {
  it('defines exactly the five v0.1 screens, in order', () => {
    expect(TABS.map((tab) => tab.id)).toEqual(['today', 'week', 'progress', 'profile', 'data']);
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
  it('parses each tab from its canonical hash', () => {
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

  it('tolerates casing, whitespace, missing hash and trailing slash', () => {
    expect(parseTabFromHash('#/WEEK')).toBe('week');
    expect(parseTabFromHash('  #/progress  ')).toBe('progress');
    expect(parseTabFromHash('profile')).toBe('profile');
    expect(parseTabFromHash('#/data/')).toBe('data');
  });
});

describe('standalone routes', () => {
  it('parses the active Journey without adding it to the tab bar', () => {
    expect(parseRouteFromHash(JOURNEY_HASH)).toEqual({ kind: 'journey' });
    expect(TABS.some((tab) => tab.id === ('journey' as never))).toBe(false);
  });

  it('keeps ordinary tab routing unchanged', () => {
    expect(parseRouteFromHash('#/week')).toEqual({ kind: 'tab', tab: 'week' });
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
    expect(isTabId('settings')).toBe(false);
    expect(isTabId('')).toBe(false);
  });
});

describe('tabDefinition', () => {
  it('returns the definition for a known tab', () => {
    expect(tabDefinition('progress').label).toBe('Progress');
  });
});
