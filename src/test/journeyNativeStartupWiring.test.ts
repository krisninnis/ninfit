import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const main = readFileSync(join(SRC, 'main.tsx'), 'utf8');

describe('native Journey startup wiring', () => {
  it('settles native provider and durable queue registration before React can start a Journey', () => {
    const providerAt = main.indexOf('installInjectedNativeJourneyBridge();');
    const queueAt = main.indexOf('installInjectedNativeJourneyDurableQueue();');
    const renderAt = main.indexOf('createRoot(rootElement).render(');

    expect(providerAt).toBeGreaterThan(-1);
    expect(queueAt).toBeGreaterThan(-1);
    expect(renderAt).toBeGreaterThan(-1);
    expect(providerAt).toBeLessThan(renderAt);
    expect(queueAt).toBeLessThan(renderAt);
  });

  it('does not make application startup depend on native transport being present', () => {
    expect(main).toContain('installInjectedNativeJourneyBridge();');
    expect(main).toContain('installInjectedNativeJourneyDurableQueue();');
    expect(main).not.toContain('await installInjectedNativeJourneyBridge');
    expect(main).not.toContain('await installInjectedNativeJourneyDurableQueue');
  });
});
