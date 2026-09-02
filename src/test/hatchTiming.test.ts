import { describe, expect, it } from 'vitest';
import hookSource from '../ui/hooks/useHatchCinematic.ts?raw';

describe('hatch cinematic timing', () => {
  it('uses the held beat and commits at the break, before the ceremony ends', () => {
    expect(hookSource).toContain("setPhase('held')");
    expect(hookSource).toContain('const BREAK_MS = 1450');
    expect(hookSource).toContain('const HATCH_MS = 4200');
    expect(hookSource).toMatch(/setTimeout\(\(\) => \{\s*onHatch\(\);\s*setPhase\('flash'\);\s*\}, BREAK_MS\)/);
    expect(hookSource).toContain("setPhase('emerging')");
    expect(hookSource).toContain("setPhase('settling')");
  });

  it('keeps reduced-motion hatch immediate and domain-authoritative', () => {
    expect(hookSource).toContain("prefers-reduced-motion: reduce");
    expect(hookSource).toMatch(/if \(reduceMotion\) \{[\s\S]*?onHatch\(\);[\s\S]*?return;/);
    const executable = hookSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(executable).not.toMatch(/eggState|familyId|hatchEgg/);
  });
});
