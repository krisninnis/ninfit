import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { updateGameSettings } from '../app/game';
import { createMemoryStorageAdapter } from '../storage/StorageAdapter';
import { createRepository } from '../storage/repository';
import { applyThemePreference } from '../ui/theme';
import {
  DATA_HASH,
  PRIMARY_NAV,
  hashForPrimaryNav,
  parseRouteFromHash,
} from '../ui/tabs';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');

describe('Settings and primary navigation', () => {
  it('makes Settings primary, keeps Profile, and removes Data from the primary row', () => {
    expect(PRIMARY_NAV.map((item) => item.id)).toEqual([
      'today',
      'week',
      'journey',
      'progress',
      'profile',
      'settings',
    ]);
  });

  it('keeps Data as a secondary route owned by Settings', () => {
    expect(parseRouteFromHash(DATA_HASH)).toEqual({ kind: 'data' });
    expect(hashForPrimaryNav('settings')).toBe('#/settings');

    const app = read('App.tsx');
    const settings = read('ui', 'screens', 'SettingsScreen.tsx');
    const data = read('ui', 'screens', 'DataScreen.tsx');
    expect(settings).toContain('onOpenData');
    expect(settings).toContain('Open data tools');
    expect(app).toContain('onOpenData={() => navigate(DATA_HASH)}');
    expect(app).toContain("onClose={() => navigate(hashForTab('settings'))}");
    expect(data).toContain('Back to Settings');
  });
});

describe('theme preference', () => {
  function root() {
    const attributes = new Map<string, string>();
    return {
      dataset: {} as DOMStringMap,
      attributes,
      setAttribute(name: string, value: string) {
        attributes.set(name, value);
        if (name === 'data-theme') this.dataset.theme = value;
      },
      removeAttribute(name: string) {
        attributes.delete(name);
        if (name === 'data-theme') delete this.dataset.theme;
      },
    };
  }

  it('applies explicit light and dark choices and lets System follow media preference', () => {
    const target = root();
    applyThemePreference('dark', target);
    expect(target.dataset.theme).toBe('dark');
    applyThemePreference('light', target);
    expect(target.dataset.theme).toBe('light');
    applyThemePreference('system', target);
    expect(target.dataset.theme).toBeUndefined();
  });

  it('persists through the existing game-settings repository without touching fitness truth', () => {
    const adapter = createMemoryStorageAdapter();
    const repository = createRepository(adapter);
    repository.initialise();
    const profileBefore = repository.getProfile();
    const plansBefore = repository.getWeeklyPlans();

    updateGameSettings(repository, { theme: 'dark' });

    const reloaded = createRepository(adapter);
    expect(reloaded.getGameSettings()?.theme).toBe('dark');
    expect(reloaded.getProfile()).toEqual(profileBefore);
    expect(reloaded.getWeeklyPlans()).toEqual(plansBefore);
    expect(reloaded.listDailyLogs()).toEqual([]);
  });

  it('offers all three choices without creating another theme engine', () => {
    const settings = read('ui', 'screens', 'SettingsScreen.tsx');
    const app = read('App.tsx');
    const main = read('main.tsx');
    const theme = read('ui', 'theme.ts');
    const semantic = read('styles', 'tokens', 'semantic.css');

    expect(settings).toContain("value: 'system'");
    expect(settings).toContain("value: 'light'");
    expect(settings).toContain("value: 'dark'");
    expect(settings).not.toContain('document.documentElement');
    expect(app).toContain('applyThemePreference');
    expect(main).toContain('applyThemePreference');
    expect(theme.match(/function applyThemePreference/g)).toHaveLength(1);
    expect(semantic).toContain("@media (prefers-color-scheme: dark)");
    expect(semantic).toContain(":root[data-theme='light']");
    expect(semantic).toContain(":root[data-theme='dark']");
  });
});

describe('existing safety preferences remain available', () => {
  it('keeps real app preferences in Settings and profile/baseline preferences in Profile', () => {
    const settings = read('ui', 'screens', 'SettingsScreen.tsx');
    const profile = read('ui', 'screens', 'ProfileScreen.tsx');

    expect(settings).toContain('Mascot personality');
    expect(settings).toContain('Sound');
    expect(settings).toContain('Haptics');
    expect(settings).toContain('Social mode');
    expect(profile).toContain('Show weight in');
    expect(profile).toContain('Show lengths in');
    expect(profile).not.toContain('<SettingsSection');
  });

  it('does not weaken reduced-motion, reduced-data, backup, export, or import paths', () => {
    expect(read('styles', 'motion.css')).toContain('prefers-reduced-motion: reduce');
    expect(read('styles', 'components', 'backdrop.css')).toContain(
      'prefers-reduced-data: reduce',
    );

    const data = read('ui', 'screens', 'DataScreen.tsx');
    expect(data).toContain('Export JSON backup');
    expect(data).toContain('Export daily CSV');
    expect(data).toContain('Choose a backup file');
  });
});
