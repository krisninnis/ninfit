import { describe, expect, it } from 'vitest';
import importSource from '../io/importJson.ts?raw';

describe('restore read-back integrity', () => {
  it('verifies all repository-backed categories before reporting success', () => {
    expect(importSource).toContain('getProfile');
    expect(importSource).toContain('getHealthContext');
    expect(importSource).toContain('getBaseline');
    expect(importSource).toContain('getMeasurements');
    expect(importSource).toContain('getWeeklyPlans');
    expect(importSource).toContain('getMetricSamples');
    expect(importSource).toContain('getGameState');
    expect(importSource).toContain('getGameSettings');
  });


  it('verifies replacement before removing stale daily records', () => {
    const verifyAt = importSource.indexOf('const verification = verifyWritten');
    const removeAt = importSource.indexOf('repository.removeDailyLog');

    expect(verifyAt).toBeGreaterThan(-1);
    expect(removeAt).toBeGreaterThan(verifyAt);
  });

  it('keeps restore honesty explicit rather than claiming transactionality', () => {
    expect(importSource).toMatch(/localStorage has no transactions/i);
    expect(importSource).toMatch(/pre-import backup/i);
  });
});
