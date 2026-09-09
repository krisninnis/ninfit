import type { NativeJourneyBufferedPosition } from '../../app/journeyNativePositionBuffer';
import {
  createAndroidPluginCall,
  ninfitSequenceReader,
  type AndroidSequenceReader,
} from './capacitorAndroidPluginCall';

/**
 * An in-memory stand-in for `JourneyDurableStore`, faithful to the parts the
 * acknowledgement boundary depends on:
 *
 *  - one monotonic `next_sequence` cursor per Journey, which survives an empty queue and
 *    is destroyed only by `clear()`;
 *  - `acknowledgeThrough` deletes the prefix `sequence <= n` and nothing else, is
 *    idempotent, and reports the depth that survived the same transaction;
 *  - `append` refuses a position the Java `requirePosition` would refuse.
 */
export function androidJourneyDurableStoreDouble() {
  const positions = new Map<string, NativeJourneyBufferedPosition[]>();
  const cursors = new Map<string, number>();
  let acknowledgeCommits = 0;

  function rows(journeyId: string): NativeJourneyBufferedPosition[] {
    return positions.get(journeyId) ?? [];
  }

  return {
    append(
      journeyId: string,
      latitude: number,
      longitude: number,
      accuracyM: number,
      timestampMs: number,
    ): number {
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        throw new Error('Invalid latitude');
      }
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        throw new Error('Invalid longitude');
      }
      if (!Number.isFinite(accuracyM) || accuracyM < 0) throw new Error('Invalid accuracy');
      if (!(timestampMs > 0)) throw new Error('Invalid timestamp');

      const sequence = cursors.get(journeyId) ?? 1;
      positions.set(journeyId, [
        ...rows(journeyId),
        { sequence, latitude, longitude, accuracyM, timestampMs },
      ]);
      cursors.set(journeyId, sequence + 1);
      return sequence;
    },

    readPending(journeyId: string): NativeJourneyBufferedPosition[] {
      return rows(journeyId)
        .slice()
        .sort((left, right) => left.sequence - right.sequence)
        .map((row) => ({ ...row }));
    },

    acknowledgeThrough(journeyId: string, sequence: number): number {
      if (sequence < 1) throw new Error('Invalid Journey acknowledgement sequence');
      positions.set(journeyId, rows(journeyId).filter((row) => row.sequence > sequence));
      acknowledgeCommits += 1;
      return rows(journeyId).length;
    },

    clear(journeyId: string): void {
      positions.delete(journeyId);
      cursors.delete(journeyId);
    },

    depth: (journeyId: string) => rows(journeyId).length,
    sequences: (journeyId: string) => rows(journeyId).map((row) => row.sequence),
    nextSequence: (journeyId: string) => cursors.get(journeyId) ?? 1,
    acknowledgeCommits: () => acknowledgeCommits,
  };
}

export type AndroidJourneyDurableStoreDouble = ReturnType<typeof androidJourneyDurableStoreDouble>;

export interface AndroidQueuePluginDoubleOptions {
  readonly store: AndroidJourneyDurableStoreDouble;
  /** Defaults to the plugin's own reader. Pass the Capacitor one to replay the defect. */
  readonly readSequence?: AndroidSequenceReader;
  /** Suppress or corrupt the receipt, to prove JavaScript fails closed on both. */
  readonly receipt?: 'contract' | 'absent' | 'wrong_journey' | 'wrong_sequence' | 'malformed_depth';
}

/**
 * The `NinFitJourneyQueue` plugin as JavaScript sees it: options objects in, resolved
 * payloads out, with every argument crossing the modelled Capacitor/org.json boundary and
 * every resolved payload crossing back through JSON. A `reject` becomes a rejected
 * promise, exactly as the Capacitor JS proxy delivers one.
 */
export function createAndroidJourneyQueuePluginDouble(options: AndroidQueuePluginDoubleOptions) {
  const readSequence = options.readSequence ?? ninfitSequenceReader;
  const receiptMode = options.receipt ?? 'contract';

  function transport(payload: Record<string, unknown>): unknown {
    return JSON.parse(JSON.stringify(payload)) as unknown;
  }

  function requireJourneyId(call: ReturnType<typeof createAndroidPluginCall>): string {
    const journeyId = call.getString('journeyId');
    if (journeyId === null || journeyId.trim() === '' || journeyId.length > 128) {
      throw new Error('Invalid Journey id');
    }
    return journeyId;
  }

  return {
    async readPending(args: { journeyId: string }): Promise<{ positions: unknown }> {
      const call = createAndroidPluginCall(args);
      const journeyId = requireJourneyId(call);
      return transport({ positions: options.store.readPending(journeyId) }) as { positions: unknown };
    },

    async acknowledgeThrough(args: { journeyId: string; sequence: number }): Promise<unknown> {
      const call = createAndroidPluginCall(args);
      const journeyId = requireJourneyId(call);
      const sequence = readSequence(call);
      const remaining = options.store.acknowledgeThrough(journeyId, sequence);
      if (receiptMode === 'absent') return undefined;
      return transport({
        journeyId: receiptMode === 'wrong_journey' ? `${journeyId}-other` : journeyId,
        acknowledgedThrough: receiptMode === 'wrong_sequence' ? sequence + 1 : sequence,
        remaining: receiptMode === 'malformed_depth' ? -1 : remaining,
      });
    },

    async clear(args: { journeyId: string }): Promise<void> {
      const call = createAndroidPluginCall(args);
      options.store.clear(requireJourneyId(call));
    },
  };
}
