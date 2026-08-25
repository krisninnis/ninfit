import { describe, expect, it } from 'vitest';
import { DEFAULT_JOURNEY_PRIVACY, type Journey } from '../domain/journey';
import {
  applyJourneyRecoveryAction,
  discardJourneyRecovery,
  recoverJourney,
  recoveredJourneyStatus,
} from '../domain/journeyRecovery';

function journey(status: Journey['status']): Journey {
  return {
    id: 'journey-1',
    activityType: 'walk',
    status,
    startedAt: '2026-08-25T10:00:00.000Z',
    pauses: status === 'paused' ? [{ startedAt: '2026-08-25T10:10:00.000Z' }] : [],
    metrics: [],
    sources: [],
    privacy: { ...DEFAULT_JOURNEY_PRIVACY },
    createdAt: '2026-08-25T10:00:00.000Z',
    updatedAt: '2026-08-25T10:10:00.000Z',
  };
}

const savedAt = '2026-08-25T10:11:00.000Z';

describe('Journey recovery decisions', () => {
  it('recovers a recording Journey without silently changing its state', () => {
    const candidate = { journey: journey('recording'), savedAt };
    const result = recoverJourney(candidate);

    expect(result.journey).toBe(candidate.journey);
    expect(result.journey?.status).toBe('recording');
    expect(result.shouldClearSnapshot).toBe(false);
  });

  it('keeps a paused Journey paused after recovery', () => {
    const candidate = { journey: journey('paused'), savedAt };

    expect(recoveredJourneyStatus(candidate)).toBe('paused');
    expect(applyJourneyRecoveryAction(candidate, 'resume').journey?.status).toBe('paused');
  });

  it('discard explicitly clears recovery without completing the Journey', () => {
    expect(discardJourneyRecovery()).toEqual({ journey: null, shouldClearSnapshot: true });
  });

  it('routes the discard action without mutating the candidate', () => {
    const candidate = { journey: journey('recording'), savedAt };
    const before = structuredClone(candidate.journey);

    expect(applyJourneyRecoveryAction(candidate, 'discard')).toEqual({
      journey: null,
      shouldClearSnapshot: true,
    });
    expect(candidate.journey).toEqual(before);
  });

  it.each(['completed', 'imported'] as const)('fails closed for %s Journeys', (status) => {
    const candidate = { journey: journey(status), savedAt };

    expect(() => recoverJourney(candidate)).toThrow(/recording or paused/);
    expect(() => recoveredJourneyStatus(candidate)).toThrow(/recording or paused/);
  });
});
