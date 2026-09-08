import type { JourneyMotionSession } from './journeyMotionSession';
import type { NativeJourneyAppLifecycleState } from './journeyNativeAppLifecycle';
import { createNativeJourneyDurableReplayCoordinator } from './journeyNativeDurableReplayCoordinator';
import type { NativeJourneyDurablePositionQueue, NativeJourneyDurableReplayResult } from './journeyNativeDurableQueue';

export interface NativeJourneyForegroundReconciliation {
  reconcileNow(): Promise<NativeJourneyDurableReplayResult>;
  onLifecycleState(state: NativeJourneyAppLifecycleState): void;
}

/**
 * Drain the native durable suffix when the JS runtime is available again.
 *
 * The coordinator deduplicates overlapping startup/foreground drains. Backgrounding
 * itself never triggers replay because the WebView may be in the process of suspension;
 * native transport should keep buffering there instead.
 */
export function createNativeJourneyForegroundReconciliation(options: {
  journeyId: string;
  queue: NativeJourneyDurablePositionQueue;
  session: JourneyMotionSession;
  onResult?(result: NativeJourneyDurableReplayResult): void;
}): NativeJourneyForegroundReconciliation {
  const coordinator = createNativeJourneyDurableReplayCoordinator({
    journeyId: options.journeyId,
    queue: options.queue,
    session: options.session,
  });

  const reconcileNow = async () => {
    const result = await coordinator.reconcile();
    options.onResult?.(result);
    return result;
  };

  return {
    reconcileNow,
    onLifecycleState(state) {
      if (state !== 'foregrounded') return;
      void reconcileNow();
    },
  };
}
