import { describe, expect, it, vi } from 'vitest';
import { quiesceAndReconcileNativeJourney } from '../app/journeyNativeTerminalReconciliation';
import type { JourneyMotionSession } from '../app/journeyMotionSession';
import type { NativeJourneyDurablePositionQueue } from '../app/journeyNativeDurableQueue';

function session(calls: string[]): JourneyMotionSession {
  return {
    getJourney: vi.fn(),
    getMotionState: vi.fn(),
    processSample(sample) {
      calls.push(`process:${sample.recordedAt}`);
    },
    stopProvider() {
      calls.push('stop-provider');
    },
    stop: vi.fn(),
  } as JourneyMotionSession;
}

describe('Journey native terminal reconciliation', () => {
  it('stops new provider callbacks before draining the durable suffix', async () => {
    const calls: string[] = [];
    const queue: NativeJourneyDurablePositionQueue = {
      async readPending() {
        calls.push('read');
        return [{
          sequence: 1,
          latitude: 51.5,
          longitude: -3.58,
          accuracyM: 4,
          timestampMs: Date.parse('2026-09-08T10:00:00.000Z'),
        }];
      },
      async acknowledgeThrough(_journeyId, sequence) {
        calls.push(`ack:${sequence}`);
      },
      async clear() {},
    };

    const result = await quiesceAndReconcileNativeJourney({
      journeyId: 'journey-1',
      session: session(calls),
      queue,
    });

    expect(calls).toEqual([
      'stop-provider',
      'read',
      'process:2026-09-08T10:00:00.000Z',
      'ack:1',
    ]);
    expect(result.replay?.processed).toBe(1);
  });

  it('still quiesces the provider when browser/PWA has no native durable queue', async () => {
    const calls: string[] = [];
    const result = await quiesceAndReconcileNativeJourney({
      journeyId: 'journey-1',
      session: session(calls),
      queue: null,
    });

    expect(calls).toEqual(['stop-provider']);
    expect(result.replay).toBeNull();
  });
});
