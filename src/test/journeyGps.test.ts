import { describe, expect, it } from 'vitest';
import {
  acceptJourneyGpsSample,
  type JourneyGpsSample,
} from '../domain/journeyGps';

function sample(overrides: Partial<JourneyGpsSample> = {}): JourneyGpsSample {
  return {
    latitude: 51.5074,
    longitude: -0.1278,
    accuracyM: 8,
    recordedAt: '2026-08-25T12:00:00.000Z',
    ...overrides,
  };
}

describe('Journey GPS acceptance', () => {
  it('accepts a plausible first sample', () => {
    expect(acceptJourneyGpsSample(sample(), null)).toEqual({
      accepted: true,
      sample: sample(),
    });
  });

  it.each([
    { latitude: 91 },
    { latitude: -91 },
    { longitude: 181 },
    { longitude: -181 },
    { latitude: Number.NaN },
  ])('rejects invalid coordinates %#', (overrides) => {
    expect(acceptJourneyGpsSample(sample(overrides), null)).toEqual({
      accepted: false,
      reason: 'invalid_coordinates',
    });
  });

  it('rejects invalid or negative accuracy', () => {
    expect(acceptJourneyGpsSample(sample({ accuracyM: -1 }), null)).toEqual({
      accepted: false,
      reason: 'invalid_accuracy',
    });
  });

  it('rejects samples outside the configured accuracy ceiling', () => {
    expect(acceptJourneyGpsSample(sample({ accuracyM: 51 }), null)).toEqual({
      accepted: false,
      reason: 'accuracy_too_low',
    });
  });

  it('allows the accuracy ceiling to be configured explicitly', () => {
    expect(
      acceptJourneyGpsSample(sample({ accuracyM: 30 }), null, { maxAccuracyM: 25 }),
    ).toEqual({ accepted: false, reason: 'accuracy_too_low' });
  });

  it('rejects an invalid timestamp', () => {
    expect(acceptJourneyGpsSample(sample({ recordedAt: 'not-a-date' }), null)).toEqual({
      accepted: false,
      reason: 'invalid_timestamp',
    });
  });

  it('rejects duplicate timestamps against the previous accepted sample', () => {
    const previous = sample();
    expect(acceptJourneyGpsSample(sample(), previous)).toEqual({
      accepted: false,
      reason: 'duplicate_timestamp',
    });
  });

  it('rejects out-of-order samples', () => {
    const previous = sample({ recordedAt: '2026-08-25T12:00:10.000Z' });
    expect(acceptJourneyGpsSample(sample(), previous)).toEqual({
      accepted: false,
      reason: 'out_of_order_timestamp',
    });
  });

  it('accepts a later accurate sample', () => {
    const previous = sample();
    const next = sample({
      latitude: 51.5075,
      longitude: -0.1277,
      recordedAt: '2026-08-25T12:00:05.000Z',
    });

    expect(acceptJourneyGpsSample(next, previous)).toEqual({ accepted: true, sample: next });
  });
});
