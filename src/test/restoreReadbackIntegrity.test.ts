import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const importSource = readFileSync(
  fileURLToPath(new URL('../io/importJson.ts', import.meta.url)),
  'utf8',
);

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

  it('keeps Journey verification inside the import boundary', () => {
    expect(importSource).toContain('loadJourneyHistory(storage)');
    expect(importSource).toContain('loadActiveJourneySnapshot(storage)');
    expect(importSource).toMatch(/Journey history could not be read back from storage/);
    expect(importSource).toMatch(/unfinished Journey recovery could not be read back from storage/);
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
