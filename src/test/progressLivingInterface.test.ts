import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const screen = readFileSync(join(SRC, 'ui', 'screens', 'ProgressScreen.tsx'), 'utf8');
const css = readFileSync(join(SRC, 'styles', 'screens', 'progress.css'), 'utf8');

describe('Progress Living Interface v1', () => {
  it('uses exactly one shared Living Interface hero for the recorded chapter', () => {
    expect(screen).toContain("import { LivingScrim } from '../components/LivingScrim';");
    expect(screen.match(/<LivingScrim\b/g)).toHaveLength(1);
    expect(screen).toContain('<LivingScrim variant="hero" className="progress__living-summary">');
    expect(screen).toContain('Recorded chapter');
  });

  it('keeps the time range and Activity overview together inside the living summary', () => {
    const start = screen.indexOf('<LivingScrim variant="hero"');
    const end = screen.indexOf('</LivingScrim>', start);
    const summary = screen.slice(start, end);

    expect(summary).toContain('aria-label="Time range"');
    expect(summary).toContain('progress__group');
    expect(summary).toContain('Activity');
    expect(summary).toContain('overviewStats(summary)');
    expect(summary).toContain('summary.daysLogged');
  });

  it('keeps body, recovery and symptom truth outside the decorative hero', () => {
    const end = screen.indexOf('</LivingScrim>');
    const after = screen.slice(end);

    expect(after).toContain('<Section title="Body">');
    expect(after).toContain('<Section title="Heart and recovery">');
    expect(after).toContain('<Section title="Back and symptoms">');
    expect(after).toContain('A personal record, not a medical assessment.');
  });

  it('does not add game reaction, XP, mascot or achievement semantics', () => {
    const executable = screen
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');

    expect(executable).not.toMatch(/useGame|\bXP\b|mascot|achievement|prestige|reward/i);
  });

  it('keeps the existing Progress source and hook as the only data inputs', () => {
    expect(screen).toContain('const { range, setRange, summary, data, hasStorageIssues } = useProgress();');
    expect(screen).not.toContain('localStorage');
    expect(screen).not.toContain('Repository');
    expect(screen).not.toContain('summariseProgress(');
  });

  it('keeps the range control visually subordinate to the record', () => {
    expect(css).toContain('.progress__chapter-head');
    expect(css).toContain('.progress__chapter-kicker');
    expect(css).toContain('max-width: 320px');
    expect(css).not.toMatch(/animation:/);
  });

  it('remains responsive without hiding information on small screens', () => {
    expect(css).toContain('@media (max-width: 430px)');
    expect(css).toContain('flex-direction: column');
    expect(css).not.toContain('display: none');
  });
});
