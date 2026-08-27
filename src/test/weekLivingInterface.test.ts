import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const screen = readFileSync(join(SRC, 'ui', 'screens', 'WeekScreen.tsx'), 'utf8');
const css = readFileSync(join(SRC, 'styles', 'screens', 'week.css'), 'utf8');

describe('Week Living Interface v1', () => {
  it('uses exactly one shared Living Interface bridge for orientation', () => {
    expect(screen).toContain("import { LivingScrim } from '../components/LivingScrim';");
    expect(screen.match(/<LivingScrim\b/g)).toHaveLength(1);
    expect(screen).toContain('<LivingScrim variant="bridge" className="week__living-journey">');
  });

  it('keeps the programme intro and existing seven-day trail inside the bridge', () => {
    const start = screen.indexOf('<LivingScrim variant="bridge"');
    const end = screen.indexOf('</LivingScrim>', start);
    const bridge = screen.slice(start, end);

    expect(bridge).toContain('className="week__intro"');
    expect(bridge).toContain('<WeekTrail days={days} />');
  });

  it('keeps all seven day cards outside the decorative orientation bridge', () => {
    const end = screen.indexOf('</LivingScrim>');
    const after = screen.slice(end);

    expect(after).toContain('className="week__days"');
    expect(after).toContain('<DayCard key={day.date} day={day} />');
    expect(after).toContain('<Section title="This week so far">');
    expect(after).toContain('<Section title="Steps">');
    expect(after).toContain('<Section title="Back and symptoms">');
  });

  it('keeps the trail decorative, one-node-per-day and tally-free', () => {
    const start = screen.indexOf('function WeekTrail');
    const rest = screen.slice(start + 1);
    const trail = rest.slice(0, rest.indexOf('\nfunction '));

    expect(trail).toContain('className="weektrail" aria-hidden="true"');
    expect(trail).toContain('days.map((day)');
    expect(trail).not.toMatch(/\.length|formatCount|%/);
  });

  it('adds no game reaction, XP, mascot or achievement semantics', () => {
    const executable = screen
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');

    expect(executable).not.toMatch(/domain\/game|useGame|\bXP\b|mascot|achievement|prestige|reward/i);
  });

  it('keeps Week domain truth and hook ownership unchanged', () => {
    expect(screen).toContain("import { trailNodeState } from '../../domain/week';");
    expect(screen).toContain('const { week, beforeProgramme } = useWeek();');
    expect(screen).not.toContain('localStorage');
    expect(screen).not.toContain('Repository');
    expect(screen).not.toContain('buildWeekView(');
  });

  it('keeps rest and future presentation semantics intact', () => {
    expect(screen).toContain("return 'Rest day';");
    expect(screen).toContain("return 'To come';");
    expect(screen).toContain('Recovery is part of the programme.');
    expect(css).toContain('.weekday--rest');
    expect(css).toContain('.weekday--future');
  });

  it('keeps the bridge responsive without adding motion or hiding information', () => {
    expect(css).toContain('.week__living-journey');
    expect(css).toContain('display: grid');
    expect(css).not.toMatch(/animation:/);
    expect(css).not.toContain('display: none');
  });
});
