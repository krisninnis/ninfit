import { describe, expect, it, vi } from 'vitest';
import {
  createCapacitorJourneyDurableQueue,
  installCapacitorJourneyDurableQueueBridge,
} from '../app/journeyCapacitorDurableQueueBridge';
import { NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY } from '../app/journeyNativeDurableQueueRuntime';

function plugin() {
  return {
    readPending: vi.fn(async () => ({
      positions: [{
        sequence: 1,
        latitude: 51.5,
        longitude: -3.58,
        accuracyM: 5,
        timestampMs: Date.parse('2026-09-08T18:00:00.000Z'),
      }],
    })),
    acknowledgeThrough: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
  };
}

describe('Capacitor Journey durable queue bridge', () => {
  it('adapts the concrete native plugin to the vendor-independent queue contract', async () => {
    const native = plugin();
    const queue = createCapacitorJourneyDurableQueue(native);

    const pending = await queue.readPending('journey-1');
    expect(pending).toHaveLength(1);
    expect(native.readPending).toHaveBeenCalledWith({ journeyId: 'journey-1' });

    await queue.acknowledgeThrough('journey-1', 1);
    expect(native.acknowledgeThrough).toHaveBeenCalledWith({ journeyId: 'journey-1', sequence: 1 });

    await queue.clear('journey-1');
    expect(native.clear).toHaveBeenCalledWith({ journeyId: 'journey-1' });
  });

  it('fails closed when the native plugin returns a non-array pending payload', async () => {
    const queue = createCapacitorJourneyDurableQueue({
      ...plugin(),
      readPending: vi.fn(async () => ({ positions: { malformed: true } })),
    });

    await expect(queue.readPending('journey-1')).rejects.toThrow(
      'Native Journey queue returned malformed pending positions',
    );
  });

  it('installs only inside the Android Capacitor shell and restores a previous global on dispose', () => {
    const previous = { existing: true };
    const host: Record<string, unknown> = {
      [NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY]: previous,
    };
    const dispose = installCapacitorJourneyDurableQueueBridge({
      host,
      runtime: {
        isNativePlatform: () => true,
        getPlatform: () => 'android',
      },
      plugin: plugin(),
    });

    expect(host[NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY]).not.toBe(previous);
    dispose();
    expect(host[NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY]).toBe(previous);
  });

  it('leaves browser/PWA and unimplemented iOS transport untouched', () => {
    for (const runtime of [
      { isNativePlatform: () => false, getPlatform: () => 'web' },
      { isNativePlatform: () => true, getPlatform: () => 'ios' },
    ]) {
      const host: Record<string, unknown> = {};
      installCapacitorJourneyDurableQueueBridge({ host, runtime, plugin: plugin() });
      expect(host[NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY]).toBeUndefined();
    }
  });
});
