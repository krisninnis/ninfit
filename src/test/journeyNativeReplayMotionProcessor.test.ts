import { describe, expect, it, vi } from 'vitest';
import { createJourneyNativeReplayMotionProcessor } from '../app/journeyNativeReplayMotionProcessor';

const position = {
  latitude: 51.5,
  longitude: -3.58,
  accuracyM: 6,
  timestampMs: Date.parse('2026-09-08T08:00:00.000Z'),
};

describe('Journey native replay motion processor', () => {
  it('feeds replayed fixes into the Journey motion sample path without changing semantics', () => {
    const processSample = vi.fn();
    const processor = createJourneyNativeReplayMotionProcessor({ processSample });

    processor.process(position);

    expect(processSample).toHaveBeenCalledWith({
      latitude: 51.5,
      longitude: -3.58,
      accuracyM: 6,
      recordedAt: '2026-09-08T08:00:00.000Z',
    });
  });

  it('propagates runtime failures so replay does not acknowledge the failed fix', () => {
    const failure = new Error('runtime persistence failed');
    const processor = createJourneyNativeReplayMotionProcessor({
      processSample() {
        throw failure;
      },
    });

    expect(() => processor.process(position)).toThrow(failure);
  });

  it('fails closed before the Journey runtime sees malformed native positions', () => {
    const processSample = vi.fn();
    const processor = createJourneyNativeReplayMotionProcessor({ processSample });

    expect(() => processor.process({ ...position, latitude: 100 })).toThrow(/invalid native Journey position/i);
    expect(processSample).not.toHaveBeenCalled();
  });
});
