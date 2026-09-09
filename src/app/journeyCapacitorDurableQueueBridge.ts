import { Capacitor, registerPlugin } from '@capacitor/core';
import type { NativeJourneyBufferedPosition } from './journeyNativePositionBuffer';
import type { NativeJourneyDurablePositionQueue } from './journeyNativeDurableQueue';
import { NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY } from './journeyNativeDurableQueueRuntime';

interface NinFitJourneyQueuePlugin {
  readPending(options: { journeyId: string }): Promise<{ positions: unknown }>;
  acknowledgeThrough(options: { journeyId: string; sequence: number }): Promise<void>;
  clear(options: { journeyId: string }): Promise<void>;
}

interface CapacitorRuntimeFacade {
  isNativePlatform(): boolean;
  getPlatform(): string;
}

type QueueHost = {
  [NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY]?: unknown;
};

const runtime: CapacitorRuntimeFacade = {
  isNativePlatform: () => Capacitor.isNativePlatform(),
  getPlatform: () => Capacitor.getPlatform(),
};

const nativePlugin = registerPlugin<NinFitJourneyQueuePlugin>('NinFitJourneyQueue');

function asPositionArray(value: unknown): NativeJourneyBufferedPosition[] {
  if (!Array.isArray(value)) throw new Error('Native Journey queue returned malformed pending positions');
  // The durable replay boundary performs the authoritative per-field validation before
  // any sample can reach Journey motion/distance state. This adapter only preserves the
  // plugin's JSON transport shape.
  return value.map((position) => ({ ...(position as NativeJourneyBufferedPosition) }));
}

export function createCapacitorJourneyDurableQueue(
  plugin: NinFitJourneyQueuePlugin,
): NativeJourneyDurablePositionQueue {
  return {
    async readPending(journeyId) {
      const result = await plugin.readPending({ journeyId });
      return asPositionArray(result.positions);
    },
    async acknowledgeThrough(journeyId, sequence) {
      await plugin.acknowledgeThrough({ journeyId, sequence });
    },
    async clear(journeyId) {
      await plugin.clear({ journeyId });
    },
  };
}

/**
 * Install the concrete Capacitor Android queue before the generic startup bootstrap
 * inspects the global boundary.
 *
 * Web/PWA and future iOS builds stay untouched. Android gets a tiny adapter over the
 * native `NinFitJourneyQueue` plugin; malformed/missing native implementations fail at
 * the existing replay boundary rather than becoming a second Journey state machine.
 */
export function installCapacitorJourneyDurableQueueBridge(options?: {
  host?: QueueHost;
  runtime?: CapacitorRuntimeFacade;
  plugin?: NinFitJourneyQueuePlugin;
}): () => void {
  const host = options?.host ?? (globalThis as QueueHost);
  const activeRuntime = options?.runtime ?? runtime;
  if (!activeRuntime.isNativePlatform() || activeRuntime.getPlatform() !== 'android') {
    return () => undefined;
  }

  const queue = createCapacitorJourneyDurableQueue(options?.plugin ?? nativePlugin);
  const previous = host[NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY];
  host[NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY] = queue;

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    if (host[NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY] === queue) {
      if (previous === undefined) {
        delete host[NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY];
      } else {
        host[NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY] = previous;
      }
    }
  };
}
