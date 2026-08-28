import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAppContext } from '../../app/bootstrap';
import { acknowledgeRewardDeliveries, pendingRewardDeliveries } from '../../app/game';
import type { GameState, RewardEvent } from '../../domain/game/types';
import { nextRewardBatch, rewardBatchKey } from '../rewardDeliveryPresentation';

/**
 * The one presentation moment, shared by everything that reacts to it.
 *
 * WHY THIS EXISTS RATHER THAN TWO SEPARATE READS.
 *
 * Today has two things that respond to a reward arriving: the acknowledgement, which
 * says what was earned, and the companion, which looks briefly pleased about it. Before
 * durable delivery they both read the transient `granted` array, so they agreed by
 * accident. Reading the queue twice would end that: the acknowledgement would hold the
 * batch it is showing while the companion followed whatever happened to be pending, and
 * the two would drift apart the first time a reward arrived mid-dwell.
 *
 * So the batch is chosen once, here, and both consume the same answer. There is one
 * moment, and everything that reacts to it is reacting to the same thing.
 *
 * WHAT IT DOES NOT DO. It never derives, grants, values or invents a reward, and it
 * never adds anything to the queue. It reads what the domain granted and persisted,
 * decides which of it is on screen, and removes exactly what has been said.
 */

export interface RewardDelivery {
  /** The batch currently being said, in domain order. Empty when nothing is. */
  batch: RewardEvent[];
  /** Opaque identity of this moment. Ids only - no kind, no XP, no label. */
  batchKey: string;
  /** Called with the ids actually presented, once their full dwell has elapsed. */
  acknowledge: (ids: readonly string[]) => void;
}

/**
 * `syncedState` is the game state the caller's `useGame` has just synced. It is a
 * dependency rather than a data source: when the game layer re-syncs it hands back a
 * new object, and that is the signal to re-read the queue from storage. Reading storage
 * on every render instead would parse the whole game record on every keystroke.
 */
export function useRewardDelivery(syncedState: GameState): RewardDelivery {
  const repository = useMemo(() => getAppContext().repository, []);
  const [revision, setRevision] = useState(0);

  /*
   * The last batch whose dwell completed.
   *
   * Acknowledgement removes entries from storage. If that write ever failed, the same
   * pending list would return, be selected again, be acknowledged again, and spin.
   * Remembering what we have just finished saying turns that into the behaviour the
   * architecture asks for - offered again on the next visit - instead of a loop inside
   * this one.
   */
  const acknowledgedKey = useRef('');

  const pending = useMemo(
    () => pendingRewardDeliveries(repository),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [repository, revision, syncedState],
  );

  const [displayed, setDisplayed] = useState<RewardEvent[]>([]);

  useEffect(() => {
    setDisplayed((current) => nextRewardBatch(pending, current, acknowledgedKey.current));
  }, [pending]);

  /*
   * Ids, in the order the batch was selected in, so the key matches the one
   * `nextRewardBatch` computes from the pending list. Nothing else crosses this
   * boundary: not a kind, not an XP figure, not a label.
   */
  const acknowledge = useCallback(
    (ids: readonly string[]) => {
      acknowledgedKey.current = ids.join('|');
      acknowledgeRewardDeliveries(repository, ids);
      setDisplayed([]);
      setRevision((value) => value + 1);
    },
    [repository],
  );

  return { batch: displayed, batchKey: rewardBatchKey(displayed), acknowledge };
}
