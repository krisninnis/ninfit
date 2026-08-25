import type { Journey, JourneyStatus } from './journey';

export type JourneyRecoveryAction = 'resume' | 'discard';

export interface JourneyRecoveryCandidate {
  journey: Journey;
  savedAt: string;
}

export interface JourneyRecoveryResult {
  journey: Journey | null;
  shouldClearSnapshot: boolean;
}

function assertRecoverable(journey: Journey): void {
  if (journey.status !== 'recording' && journey.status !== 'paused') {
    throw new Error('Journey recovery requires a recording or paused Journey');
  }
}

/**
 * Recovery never silently changes recording state. A Journey that was paused remains
 * paused; one that was recording remains recording until the recorder explicitly acts.
 */
export function recoverJourney(candidate: JourneyRecoveryCandidate): JourneyRecoveryResult {
  assertRecoverable(candidate.journey);
  return {
    journey: candidate.journey,
    shouldClearSnapshot: false,
  };
}

/** Discarding recovery evidence is explicit and never completes or rewards a Journey. */
export function discardJourneyRecovery(): JourneyRecoveryResult {
  return {
    journey: null,
    shouldClearSnapshot: true,
  };
}

export function applyJourneyRecoveryAction(
  candidate: JourneyRecoveryCandidate,
  action: JourneyRecoveryAction,
): JourneyRecoveryResult {
  return action === 'resume' ? recoverJourney(candidate) : discardJourneyRecovery();
}

export function recoveredJourneyStatus(candidate: JourneyRecoveryCandidate): JourneyStatus {
  assertRecoverable(candidate.journey);
  return candidate.journey.status;
}
