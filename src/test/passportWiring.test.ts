import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');

const app = read('App.tsx');
const tabs = read('ui', 'tabs.ts');
const passport = read('ui', 'screens', 'PassportScreen.tsx');
const profile = read('ui', 'screens', 'ProfileScreen.tsx');

describe('Passport v1 wiring', () => {
  it('is a dedicated sub-route rather than a new primary navigation tab', () => {
    expect(tabs).toContain("export const PASSPORT_HASH = '#/passport';");
    expect(tabs).toContain("{ readonly kind: 'passport' }");
    const primaryNav = tabs.slice(
      tabs.indexOf('export const PRIMARY_NAV'),
      tabs.indexOf('export const DEFAULT_TAB'),
    );
    expect(primaryNav).not.toMatch(/passport/i);
  });

  it('opens from Profile and returns there', () => {
    expect(profile).toContain('Open Passport');
    expect(profile).toContain('PASSPORT_HASH');
    expect(app).toContain("route.kind === 'passport'");
    expect(app).toContain('navigate(hashForTab(\'profile\'))');
  });

  it('uses the Profile world while remaining a focused sub-route', () => {
    expect(app).toContain("showPassport ? 'profile'");
    expect(app).toContain("const showPrimaryNav = route.kind === 'tab' || showJourneyHome");
  });

  it('uses the shared Living Interface hero primitive', () => {
    expect(passport).toContain("import { LivingScrim } from '../components/LivingScrim';");
    expect(passport).toContain('<LivingScrim variant="hero" className="passport__hero">');
  });

  it('remains read-only and adds no persistence or progression actions', () => {
    for (const source of [passport, read('ui', 'passportPresentation.ts')]) {
      expect(source).not.toContain('localStorage');
      expect(source).not.toContain('repository.');
      expect(source).not.toContain('updateSettings');
      expect(source).not.toContain('choosePath');
      expect(source).not.toContain('game.hatch(');
      expect(source).not.toContain('game.evolve(');
      expect(source).not.toContain('grantReward(');
    }
  });
});
