import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const screen = readFileSync(join(SRC, 'ui', 'screens', 'ProfileScreen.tsx'), 'utf8');
const css = readFileSync(join(SRC, 'styles', 'screens', 'profile.css'), 'utf8');

describe('Profile Living Interface v1', () => {
  it('uses exactly one shared Living Interface hero for NinFit identity', () => {
    expect(screen).toContain('import { LivingScrim } from "../components/LivingScrim";');
    expect(screen.match(/<LivingScrim\b/g)).toHaveLength(1);
    expect(screen).toContain('<LivingScrim variant="hero" className="profile__living-identity">');
    expect(screen).toContain('Your NinFit journey');
    expect(screen).toContain('Path and companion');
  });

  it('shows only existing game identity facts and Passport access in the hero', () => {
    const start = screen.indexOf('<LivingScrim variant="hero"');
    const end = screen.indexOf('</LivingScrim>', start);
    const hero = screen.slice(start, end);

    expect(hero).toContain('Path');
    expect(hero).toContain('Starting stage');
    expect(hero).toContain('state.xp.level');
    expect(hero).toContain('state.xp.total');
    expect(hero).toContain('Open Passport');
    expect(hero).toContain('PASSPORT_HASH');
  });

  it('keeps mutable path controls outside the Living hero', () => {
    const end = screen.indexOf('</LivingScrim>');
    const after = screen.slice(end);

    expect(after).toContain('<Section title="Path settings" defaultOpen={false}>');
    expect(after).toContain('label="Switch path"');
    expect(after).toContain('game.choosePath(pathId)');
    expect(after).toContain('state.skills.map((skill)');
  });

  it('does not pull personal profile, measurement or health-note data into the game hero', () => {
    const start = screen.indexOf('<LivingScrim variant="hero"');
    const end = screen.indexOf('</LivingScrim>', start);
    const hero = screen.slice(start, end);

    expect(hero).not.toMatch(/displayName|birthYear|heightCm|weightKg|waistCm|restingHeartRateBpm|hrvMs/);
    expect(hero).not.toMatch(/healthContext|measurements|Your Notes|medical/i);
  });

  it('keeps trophies, settings and account outside the identity hero', () => {
    const start = screen.indexOf('<LivingScrim variant="hero"');
    const end = screen.indexOf('</LivingScrim>', start);
    const hero = screen.slice(start, end);

    expect(hero).not.toContain('Trophies');
    expect(hero).not.toContain('<SettingsSection');
    expect(hero).not.toContain('<AccountSection />');

    expect(screen).toContain('<Section title="Trophies" defaultOpen={false}>');
    expect(screen).toContain('<SettingsSection');
    expect(screen).toContain('<AccountSection />');
  });

  it('adds no new game calculation or persistence ownership', () => {
    expect(screen).toContain('const game = useGame();');
    expect(screen).toContain('const path = state.pathId === undefined ? undefined : findPath(state.pathId);');
    expect(screen).not.toContain('localStorage');
    expect(screen).not.toContain('grantReward(');
    expect(screen).not.toContain('calculateXp(');
  });

  it('uses presentation tokens and stays responsive without motion', () => {
    expect(css).toContain('.profile__living-identity');
    expect(css).toContain('.profile__identity-head');
    expect(css).toContain('@media (max-width: 430px)');
    expect(css).not.toMatch(/animation:/);
    expect(css).not.toContain('display: none');
  });
});
