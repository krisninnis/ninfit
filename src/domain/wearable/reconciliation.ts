import type { Journey, JourneyActivityType } from '../journey';
import type { WearableProviderId } from './provider';

/**
 * One real walk becomes one NinFit Journey, however many devices watched it.
 *
 * THE FAILURE THIS PREVENTS. Somebody walks around the block with NinFit recording
 * the route and a watch recording their heart rate. Two honest records of one
 * afternoon arrive. Counted naively, that is twice the distance in their daily total,
 * two entries in their history, two efforts on a personal ranking, and a walk they
 * did once that made their week look like a walk they did twice. Nothing about that
 * is recoverable by apologising later - the numbers are already wrong and the person
 * already believes them.
 *
 * SO THE ORDER IS FIXED: identify, then count. Reconciliation happens before totals,
 * before rankings, before eligibility and before anything a reward could read.
 *
 * PRESERVE, BUT DO NOT DOUBLE-COUNT. Uncertainty never resolves by deleting one of
 * two records. A pair that might be the same walk is kept, both of them, and held
 * OUT of aggregates until somebody says which it is. A silently merged pair and a
 * silently deleted record are the same mistake wearing different clothes.
 *
 * THIS MODULE DECIDES; IT DOES NOT WRITE. It is a pure function over an incoming
 * summary and the Journeys it could belong to. Persisting a verdict, asking the
 * person to resolve a maybe, and the storage shape for all of that are the next
 * slice, specified in `docs/architecture/ninfit-wearable-integration-v1.md`.
 */

export interface ExternalActivitySummary {
  providerId: WearableProviderId;
  /** The provider's own identifier for this record. The strongest lineage there is. */
  externalId: string;
  activityType: JourneyActivityType;
  startedAt: string;
  endedAt: string;
  distanceM?: number;
  steps?: number;
  averageHeartRateBpm?: number;
  /** True when the provider supplied route geometry, not just a summary. */
  hasRoute?: boolean;
}

export type JourneyReconciliation =
  /** This exact provider record is already attached to a Journey. Do nothing. */
  | { kind: 'already_imported'; journeyId: string }
  /** Same physical activity, beyond reasonable doubt. Attach the observations. */
  | { kind: 'same_activity'; journeyId: string; confidence: number }
  /** Might be the same. Keep both, and keep both out of totals until resolved. */
  | { kind: 'possible_duplicate'; journeyId: string; confidence: number }
  /** Nothing it could plausibly be. A new Journey. */
  | { kind: 'separate_activity' };

export interface JourneyReconciliationPolicy {
  /** At or above this, NinFit attaches without asking. */
  sameActivityConfidence: number;
  /** At or above this but below the above, NinFit keeps both and asks later. */
  possibleDuplicateConfidence: number;
}

export const DEFAULT_JOURNEY_RECONCILIATION_POLICY: JourneyReconciliationPolicy = {
  sameActivityConfidence: 0.8,
  possibleDuplicateConfidence: 0.45,
};

function ms(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

interface Interval { start: number; end: number }

function interval(startedAt: string, endedAt: string | undefined): Interval | null {
  const start = ms(startedAt);
  const end = endedAt === undefined ? null : ms(endedAt);
  if (start === null || end === null || end < start) return null;
  return { start, end };
}

/** Overlapping seconds as a share of the SHORTER record, so a long one cannot swallow a short one. */
function overlapRatio(a: Interval, b: Interval): number {
  const overlap = Math.min(a.end, b.end) - Math.max(a.start, b.start);
  if (overlap <= 0) return 0;
  const shorter = Math.min(a.end - a.start, b.end - b.start);
  if (shorter <= 0) return 0;
  return Math.min(1, overlap / shorter);
}

/**
 * Agreement between two measurements of what should be the same quantity.
 *
 * The difference is taken against the SMALLER value, not the larger one. Against the
 * larger, a record claiming nearly twice the distance still scores about a half - and
 * a half of a heavily weighted signal is enough to drag an obvious mismatch over an
 * attach threshold. Against the smaller, "70% more than the other one" scores 0.3,
 * which is what a disagreement that size deserves.
 */
function similarity(a: number, b: number): number {
  const smaller = Math.min(a, b);
  if (smaller <= 0) return a === b ? 1 : 0;
  return Math.max(0, 1 - Math.abs(a - b) / smaller);
}

/**
 * Whether a Journey already carries this exact provider record.
 *
 * Lineage beats every heuristic below it. A record NinFit has already seen is not a
 * new activity no matter how its timestamps look on a second sync, and this is what
 * makes re-syncing the same week idempotent.
 */
function carriesExternalRecord(journey: Journey, external: ExternalActivitySummary): boolean {
  return journey.sources.some(
    (source) => source.externalRecordId === external.externalId,
  );
}

function journeyDistanceM(journey: Journey): number | null {
  const value = journey.metrics.find((metric) => metric.kind === 'distance_m')?.value;
  return value === undefined || !Number.isFinite(value) ? null : value;
}

/**
 * How strongly the evidence says one incoming record and one Journey are the same
 * outing.
 *
 * TIME OVERLAP IS NECESSARY AND NEVER SUFFICIENT. Two people in a household, or one
 * person switching activities, produce overlapping records that are not the same
 * thing. So overlap opens the question and duration, distance and activity type
 * answer it - and a mismatched activity type ends it outright, because a cycle is not
 * a walk however neatly the clocks agree.
 */
export function journeyMatchConfidence(
  journey: Journey,
  external: ExternalActivitySummary,
): number {
  if (journey.activityType !== external.activityType) return 0;

  const journeyInterval = interval(journey.startedAt, journey.endedAt);
  const externalInterval = interval(external.startedAt, external.endedAt);
  if (journeyInterval === null || externalInterval === null) return 0;

  const overlap = overlapRatio(journeyInterval, externalInterval);
  if (overlap === 0) return 0;

  const durationSimilarity = similarity(
    journeyInterval.end - journeyInterval.start,
    externalInterval.end - externalInterval.start,
  );

  const recordedDistance = journeyDistanceM(journey);
  /*
   * A summary with no distance is not evidence AGAINST a match - plenty of honest
   * wearable records carry only a duration. It simply contributes nothing, and the
   * remaining signals have to carry the verdict on their own, which is why the
   * weights below still leave such a pair short of the attach threshold.
   */
  const distanceComparable =
    recordedDistance !== null && external.distanceM !== undefined && external.distanceM > 0;
  const distanceSimilarity = distanceComparable
    ? similarity(recordedDistance, external.distanceM as number)
    : 0;

  /*
   * Distance carries the most weight of the three, and overlap the least of the ones
   * that can confirm a match. Time is what makes two records worth comparing; agreeing
   * about how far somebody went is what makes them the same walk.
   *
   * With no distance to compare, the remaining signals total 0.65 - deliberately
   * below the attach threshold. A summary-only record can therefore never be attached
   * silently on timing alone; the strongest it can be is a maybe somebody resolves.
   */
  const weighted = distanceComparable
    ? overlap * 0.40 + durationSimilarity * 0.25 + distanceSimilarity * 0.35
    : overlap * 0.40 + durationSimilarity * 0.25;

  return Math.min(1, Math.max(0, weighted));
}

export function reconcileExternalActivity(
  external: ExternalActivitySummary,
  candidates: readonly Journey[],
  policy: JourneyReconciliationPolicy = DEFAULT_JOURNEY_RECONCILIATION_POLICY,
): JourneyReconciliation {
  const alreadyImported = candidates.find((journey) => carriesExternalRecord(journey, external));
  if (alreadyImported !== undefined) {
    return { kind: 'already_imported', journeyId: alreadyImported.id };
  }

  let best: { journey: Journey; confidence: number } | null = null;
  for (const journey of candidates) {
    const confidence = journeyMatchConfidence(journey, external);
    if (confidence <= 0) continue;
    /*
     * Ties break on Journey id rather than on iteration order, so the same inputs
     * always produce the same verdict whatever order history happened to be read in.
     */
    if (
      best === null
      || confidence > best.confidence
      || (confidence === best.confidence && journey.id < best.journey.id)
    ) {
      best = { journey, confidence };
    }
  }

  if (best === null) return { kind: 'separate_activity' };
  if (best.confidence >= policy.sameActivityConfidence) {
    return { kind: 'same_activity', journeyId: best.journey.id, confidence: best.confidence };
  }
  if (best.confidence >= policy.possibleDuplicateConfidence) {
    return { kind: 'possible_duplicate', journeyId: best.journey.id, confidence: best.confidence };
  }
  return { kind: 'separate_activity' };
}

/**
 * Which metric an external record may contribute to a Journey NinFit recorded itself.
 *
 * THE ROUTE AND ITS DISTANCE ARE NOT NEGOTIABLE. A Journey whose distance was derived
 * from a NinFit-recorded route keeps that distance. A watch reporting 1.49 km against
 * NinFit's 1.52 km has not discovered an error; it has measured the same walk a
 * different way, and swapping one for the other would quietly rewrite a route's own
 * arithmetic with a number that has no route behind it.
 *
 * What a watch does bring is everything the phone in a pocket could not see - heart
 * rate, steps, energy - and those are enrichment, not correction.
 */
export type ExternalMetricDecision =
  | { accepted: true }
  | { accepted: false; reason: 'ninfit_route_is_authoritative' | 'not_a_supported_metric' };

const ENRICHMENT_METRICS = new Set(['heart_rate_bpm', 'steps', 'elevation_gain_m']);

export function externalMetricDecision(
  journey: Pick<Journey, 'metrics' | 'sources'>,
  metricKind: string,
): ExternalMetricDecision {
  if (metricKind === 'distance_m') {
    const distance = journey.metrics.find((metric) => metric.kind === 'distance_m');
    const source = distance === undefined
      ? undefined
      : journey.sources.find((candidate) => candidate.id === distance.sourceId);
    if (source?.kind === 'ninfit_phone_gps') {
      return { accepted: false, reason: 'ninfit_route_is_authoritative' };
    }
    return { accepted: true };
  }

  if (ENRICHMENT_METRICS.has(metricKind)) return { accepted: true };
  return { accepted: false, reason: 'not_a_supported_metric' };
}

/**
 * Whether a reconciliation verdict may contribute to a total, a ranking or a reward.
 *
 * `possible_duplicate` fails closed. An unresolved maybe counted into a weekly total
 * is a number nobody can later untangle, and the cost of leaving it out for a day is
 * one slightly low total the person can see and explain.
 */
export function reconciliationMayCountTowardTotals(
  reconciliation: JourneyReconciliation,
): boolean {
  return reconciliation.kind === 'separate_activity';
}
