import { describe, expect, it } from 'vitest';
import hookSource from '../ui/hooks/useHatchCinematic.ts?raw';

describe('hatch cinematic timing', () => {
  it('uses the held beat and commits at the break, before the ceremony ends', () => {
    expect(hookSource).toContain("setPhase('held')");
    expect(hookSource).toContain('const BREAK_MS = 1450');
    expect(hookSource).toContain('const HATCH_MS = 4200');
    expect(hookSource).toMatch(/setTimeout\(\(\) => \{\s*commit\(\);\s*setPhase\('flash'\);/);
    expect(hookSource).toContain("setPhase('emerging')");
    expect(hookSource).toContain("setPhase('settling')");
  });

  it('commits exactly once when a running ceremony unmounts before the break', () => {
    expect(hookSource).toContain('if (committed.current) return;');
    expect(hookSource).toContain('committed.current = true;');
    expect(hookSource).toMatch(/useEffect\(\(\) => \(\) => \{[\s\S]*?if \(running\.current\) commit\(\);/);
  });

  it('keeps reduced-motion ceremony timed and domain-authoritative', () => {
    expect(hookSource).toContain("prefers-reduced-motion: reduce");
    expect(hookSource).toContain("const REDUCED_READY_MS = 700");
    expect(hookSource).toContain("const REDUCED_TOTAL_MS = 2100");
    expect(hookSource).toContain("setPhase('reduced-ready')");
    expect(hookSource).toContain("setPhase('reduced-opening')");
    expect(hookSource).toContain("setPhase('reduced-meet')");
    expect(hookSource).toMatch(/if \(reduceMotion\) \{[\s\S]*?commit\(\);[\s\S]*?return;/);
    const executable = hookSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(executable).not.toMatch(/eggState|familyId|hatchEgg/);
  });
});
