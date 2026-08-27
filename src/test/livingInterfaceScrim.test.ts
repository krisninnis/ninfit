import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const component = read('ui', 'components', 'LivingScrim.tsx');
const css = read('styles', 'components', 'living-interface.css');

describe('Living Interface scrim primitive', () => {
  it('is presentation-only and imports no fitness or game truth', () => {
    const executable = code(component);
    expect(executable).not.toMatch(/domain\//);
    expect(executable).not.toMatch(/useGame|useToday|Journey|Mascot|XP|reward/i);
    expect(executable).toContain('children: ReactNode');
  });

  it('offers a small closed set of reusable presentation variants', () => {
    expect(component).toContain("'hero' | 'bridge'");
    expect(component).toContain('data-living-scrim={variant}');
  });

  it('does not create a second semantic landmark around caller content', () => {
    expect(component).toContain('<div className={classes}');
    expect(component).not.toMatch(/<section|<article|role=/);
  });

  it('adds contrast rather than weakening the PageBackdrop veil', () => {
    expect(css).toContain('var(--ft-surface-raised)');
    expect(css).toContain('backdrop-filter: blur(14px)');
    expect(css).not.toContain('--backdrop-veil-light');
    expect(css).not.toContain('--backdrop-veil-dark');
  });

  it('uses tokens only and invents no raw colour', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\brgb\(|\bhsl\(/);
    expect(css).toContain('var(--ft-accent)');
  });

  it('does not require animation and respects reduced data for decoration', () => {
    expect(css).not.toMatch(/animation:/);
    expect(css).toContain('prefers-reduced-data: reduce');
  });

  it('cannot intercept interaction through its decorative layers', () => {
    expect(css).toContain('pointer-events: none');
  });
});
