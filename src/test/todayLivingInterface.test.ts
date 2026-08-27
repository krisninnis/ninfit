import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');

const today = read('ui', 'screens', 'TodayScreen.tsx');
const todayCss = read('styles', 'screens', 'today.css');
const living = read('ui', 'components', 'LivingScrim.tsx');

describe('Today Living Interface v1', () => {
  it('uses the shared bridge primitive rather than inventing another scrim', () => {
    expect(today).toContain("import { LivingScrim } from '../components/LivingScrim';");
    expect(today).toContain('<LivingScrim variant="bridge" className="today__living-bridge">');
    expect((today.match(/<LivingScrim/g) ?? []).length).toBe(1);
    expect(living).toContain("'hero' | 'bridge'");
  });

  it('keeps programme context and the permanent companion inside the bridge', () => {
    const start = today.indexOf('<LivingScrim');
    const end = today.indexOf('</LivingScrim>');
    const bridge = today.slice(start, end);

    expect(bridge).toContain('today__meta');
    expect(bridge).toContain('<GameHeader');
    expect(bridge).not.toContain('<RewardAcknowledgement');
    expect(bridge).not.toContain('plan--hero');
  });

  it('keeps the actual fitness plan outside and after the living bridge', () => {
    expect(today.indexOf('</LivingScrim>')).toBeLessThan(today.indexOf('plan--hero'));
    expect(today).toContain('card card--action plan plan--hero');
  });

  it('does not add another primary action or permanent guide character', () => {
    const executable = today.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const primaries = executable.match(/className="btn btn--primary[^"]*"/g) ?? [];
    for (const primary of primaries) expect(primary).toContain('plan__cta');
    expect(executable).not.toMatch(/<Opal\b/);
  });

  it('flattens the companion surface only inside the Living bridge', () => {
    expect(todayCss).toContain('.today__living-bridge .game');
    expect(todayCss).toMatch(/\.today__living-bridge \.game\s*\{[\s\S]*?background:\s*transparent/);
    expect(todayCss).toMatch(/\.today__living-bridge \.game\s*\{[\s\S]*?border:\s*0/);
  });

  it('removes the old metadata negative offset inside the bridge', () => {
    expect(todayCss).toMatch(/\.today__living-bridge \.today__meta\s*\{[\s\S]*?margin:\s*0 0/);
  });

  it('adds no new fitness, XP, reward or persistence semantics', () => {
    expect(today).not.toContain('livingScore');
    expect(today).not.toContain('livingXp');
    expect(today).not.toContain('livingReward');
    expect(today).not.toContain('saveLiving');
  });

  it('uses no raw colours in the Today composition rules', () => {
    expect(todayCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(todayCss).not.toMatch(/\brgb\(|\bhsl\(/);
  });
});
