import type { RewardEvent } from '../domain/game/types';

/**
 * Which pending rewards are being said right now, and which are waiting their turn.
 *
 * PURE, AND DELIBERATELY SO. Everything about a reward's lifetime that could be got
 * wrong lives here as a function of its inputs, with no repository, no timer and no
 * React - which is what lets the rule be tested exactly rather than approximated
 * through a renderer the suite does not have. The thin part left over is a
 * `setTimeout` and one call, and source guards hold that.
 *
 * IT DECIDES NOTHING ABOUT REWARDS. It cannot derive, grant, value or invent one. It
 * receives events the domain granted and persisted, and answers a scheduling question
 * about them: which ones are on screen.
 */

/**
 * A BATCH IS A MOMENT, AND A MOMENT DOES NOT GROW WHILE IT IS BEING HAD.
 *
 * Once a batch is on screen it stays exactly as it is until it has been acknowledged.
 * Anything granted in the meantime waits and becomes the next batch.
 *
 * WHY NOT SIMPLY SHOW EVERYTHING PENDING. Because the dwell is computed from the batch
 * size at the moment it appears, so growing the batch mid-dwell would leave the reading
 * time wrong for what is on screen - and because
 * `docs/product/ninfit-reward-presentation-v1.md` section 21 names exactly this as a
 * failure to watch for: "Two consecutive batches with overlapping ids must not merge
 * into one long-lived acknowledgement." Restarting the dwell every time something new
 * arrives is how that merge happens.
 *
 * WHY THE LAST ACKNOWLEDGED KEY IS AN INPUT. Acknowledgement removes entries from
 * storage. If that write ever failed, the same pending list would come straight back,
 * be selected again, be acknowledged again, and spin. Refusing to re-select a batch we
 * have just finished saying turns that into what the architecture asks for - the reward
 * is offered again on the next visit - rather than a loop inside one.
 */
export function nextRewardBatch(
  pending: readonly RewardEvent[],
  displayed: readonly RewardEvent[],
  lastAcknowledgedKey: string,
): RewardEvent[] {
  // Something is already being said. It finishes before anything else starts.
  if (displayed.length > 0) return [...displayed];
  if (pending.length === 0) return [];

  const key = rewardBatchKey(pending);
  if (key !== '' && key === lastAcknowledgedKey) return [];

  return [...pending];
}

/**
 * The identity of one presentation moment.
 *
 * OPAQUE ON PURPOSE. It is built from event ids and nothing else - no kind, no XP, no
 * label, no count - because its only job is to say "this is a different moment from the
 * last one". The companion consumes it to decide whether to look freshly pleased, and
 * the companion must not be able to learn what was earned from it: what happened is
 * `MascotContext`'s business, decided in the domain.
 */
export function rewardBatchKey(batch: readonly RewardEvent[]): string {
  return batch.map((event) => event.id).join('|');
}
