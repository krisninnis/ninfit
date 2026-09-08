import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const main = readFileSync(join(SRC, 'main.tsx'), 'utf8');

describe('native Journey startup wiring', () => {
  it('settles native provider registration before React can start a Journey', () => {
    const installAt = main.indexOf('installInjectedNativeJourneyBridge();');
    const renderAt = main.indexOf('createRoot(rootElement).render(');

    expect(installAt).toBeGreaterThan(-1);
    expect(renderAt).toBeGreaterThan(-1);
    expect(installAt).toBeLessThan(renderAt);
  });

  it('does not make application startup depend on a native bridge being present', () => {
    expect(main).toContain('installInjectedNativeJourneyBridge();');
    expect(main).not.toContain('await installInjectedNativeJourneyBridge');
  });
});
