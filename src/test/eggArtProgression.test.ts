import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import eggSource from '../ui/components/EggArt.tsx?raw';

const eggStyles = readFileSync(join('src', 'styles', 'components', 'egg.css'), 'utf8');

describe('egg crack-stage presentation', () => {
  it('renders all six cumulative stages at the production viewBox', () => {
    expect(eggSource).toContain('viewBox="0 0 80 100"');
    for (const stage of [1, 2, 3, 4, 5]) {
      expect(eggSource).toContain(`data-egg-stage="${stage}"`);
    }
    expect((eggSource.match(/className="egg__stage"/g) ?? []).length).toBe(5);
    expect(eggSource).toContain('Math.floor(crackStage)');
  });

  it('uses neutral crack light and cross-fades reverse transitions', () => {
    expect(eggStyles).toContain('transition: opacity 240ms ease-out');
    expect(eggStyles).toContain('rgb(240 217 168 / 0.72)');
    expect(eggStyles).not.toMatch(/\n\s*[^/*\n]*\[data-path\]/i);
    expect(eggStyles).toContain('.egg__crack-light');
  });

  it('keeps the egg decorative and species-secret', () => {
    expect(eggSource).toContain('aria-hidden="true"');
    expect(eggSource).not.toMatch(/\b(pathId|data-path)\s*[:=]/i);
  });
});
