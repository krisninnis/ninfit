import { Capacitor, registerPlugin } from '@capacitor/core';
import type { NativeJourneyBufferedPosition } from './journeyNativePositionBuffer';
import type { NativeJourneyDurablePositionQueue } from './journeyNativeDurableQueue';
import { NINFIT_NATIVE_JOURNEY_DURABLE_QUEUE_KEY } from './journeyNativeDurableQueueRuntime';

/**
 * The Android `NinFitJourneyQueue` plugin surface, named exactly as the Java
 * `@PluginMethod`s and argument keys are named.
 *
 * `acknowledgeThrough` resolves a receipt rather than nothing. See
 * `assertNativeJourneyAcknowledgementReceipt` for why.
 */
interface NinFitJourneyQueuePlugin {
  readPending(options: { journeyId: string }): Promise<{ positions: unknown }>;
  acknowledgeThrough(options: { journeyId: string; sequence: number }): Promise<unknown>;
  clear(options: { journeyId: string }): Promise<void>;
}

export interface NativeJourneyAcknowledgementReceipt {
  readonly journeyId: string;
  readonly acknowledgedThrough: number;
  readonly remaining: number;
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

/**
 * Accept a native acknowledgement only when the receipt proves what was acknowledged.
 *
 * A resolved call is not by itself evidence. Before this check, the durable prefix
 * advanced on the mere fact that the bridge came back, so a plugin that acknowledged a
 * different Journey, a different prefix, or nothing at all was indistinguishable from
 * one that committed the delete - and the sample would have been dropped from the queue
 * on that assumption. The receipt is compared against the exact call that was made:
 * anything else throws, replay stops with `acknowledgement_error`, and every sample
 * stays durable.
 *
 * `remaining` is the pending depth the native store measured inside the acknowledging
 * transaction. It is a count of rows, never a position, and it is what lets a device run
 * show the queue draining.
 */
export function assertNativeJourneyAcknowledgementReceipt(
  value: unknown,
  journeyId: string,
  sequence: number,
): NativeJourneyAcknowledgementReceipt {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Native Journey queue returned a malformed acknowledgement receipt');
  }
  const receipt = value as Partial<NativeJourneyAcknowledgementReceipt>;
  if (receipt.journeyId !== journeyId) {
    throw new Error('Native Journey queue acknowledged a different Journey');
  }
  if (receipt.acknowledgedThrough !== sequence) {
    throw new Error('Native Journey queue acknowledged a different sequence');
  }
  if (
    typeof receipt.remaining !== 'number'
    || !Number.isSafeInteger(receipt.remaining)
    || receipt.remaining < 0
  ) {
    throw new Error('Native Journey queue returned a malformed pending depth');
  }
  return { journeyId, acknowledgedThrough: sequence, remaining: receipt.remaining };
}

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
      const receipt = await plugin.acknowledgeThrough({ journeyId, sequence });
      assertNativeJourneyAcknowledgementReceipt(receipt, journeyId, sequence);
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
