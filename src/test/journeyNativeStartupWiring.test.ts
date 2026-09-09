import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const main = readFileSync(join(SRC, 'main.tsx'), 'utf8');

describe('native Journey startup wiring', () => {
  it('settles concrete Capacitor queue, lock-screen status, native provider and durable queue before React', () => {
    const capacitorQueueAt = main.indexOf('installCapacitorJourneyDurableQueueBridge();');
    const lockScreenAt = main.indexOf('installCapacitorJourneyLockScreenBridge();');
    const providerAt = main.indexOf('installInjectedNativeJourneyBridge();');
    const queueAt = main.indexOf('installInjectedNativeJourneyDurableQueue();');
    const statusRuntimeAt = main.indexOf('startNativeJourneyLockScreenStatusRuntime(getAppContext().adapter);');
    const renderAt = main.indexOf('createRoot(rootElement).render(');

    expect(capacitorQueueAt).toBeGreaterThan(-1);
    expect(lockScreenAt).toBeGreaterThan(-1);
    expect(providerAt).toBeGreaterThan(-1);
    expect(queueAt).toBeGreaterThan(-1);
    expect(statusRuntimeAt).toBeGreaterThan(-1);
    expect(renderAt).toBeGreaterThan(-1);
    expect(capacitorQueueAt).toBeLessThan(queueAt);
    expect(lockScreenAt).toBeLessThan(statusRuntimeAt);
    expect(providerAt).toBeLessThan(renderAt);
    expect(queueAt).toBeLessThan(renderAt);
    expect(statusRuntimeAt).toBeLessThan(renderAt);
  });

  it('does not make application startup depend on native transport being present', () => {
    expect(main).toContain('installCapacitorJourneyDurableQueueBridge();');
    expect(main).toContain('installCapacitorJourneyLockScreenBridge();');
    expect(main).toContain('installInjectedNativeJourneyBridge();');
    expect(main).toContain('installInjectedNativeJourneyDurableQueue();');
    expect(main).toContain('startNativeJourneyLockScreenStatusRuntime(getAppContext().adapter);');
    expect(main).not.toContain('await installCapacitorJourneyDurableQueueBridge');
    expect(main).not.toContain('await installCapacitorJourneyLockScreenBridge');
    expect(main).not.toContain('await installInjectedNativeJourneyBridge');
    expect(main).not.toContain('await installInjectedNativeJourneyDurableQueue');
    expect(main).not.toContain('await startNativeJourneyLockScreenStatusRuntime');
  });
});
