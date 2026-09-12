import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearCompletedJourneyDiagnosticLogs,
  preserveCompletedJourneyDiagnosticLog,
  readCompletedJourneyDiagnosticLog,
} from '../app/journeyCompletedDiagnosticLog';

describe('completed Journey diagnostic log handoff', () => {
  beforeEach(() => {
    clearCompletedJourneyDiagnosticLogs();
  });

  it('returns the diagnostic log for the matching Journey only', () => {
    preserveCompletedJourneyDiagnosticLog('journey-a', 'diagnostic-a');

    expect(readCompletedJourneyDiagnosticLog('journey-a')).toBe('diagnostic-a');
    expect(readCompletedJourneyDiagnosticLog('journey-b')).toBeNull();
  });

  it('keeps only the three most recently preserved Journeys', () => {
    preserveCompletedJourneyDiagnosticLog('journey-a', 'a');
    preserveCompletedJourneyDiagnosticLog('journey-b', 'b');
    preserveCompletedJourneyDiagnosticLog('journey-c', 'c');
    preserveCompletedJourneyDiagnosticLog('journey-d', 'd');

    expect(readCompletedJourneyDiagnosticLog('journey-a')).toBeNull();
    expect(readCompletedJourneyDiagnosticLog('journey-b')).toBe('b');
    expect(readCompletedJourneyDiagnosticLog('journey-c')).toBe('c');
    expect(readCompletedJourneyDiagnosticLog('journey-d')).toBe('d');
  });

  it('refreshes an existing Journey without keeping its stale value', () => {
    preserveCompletedJourneyDiagnosticLog('journey-a', 'old');
    preserveCompletedJourneyDiagnosticLog('journey-b', 'b');
    preserveCompletedJourneyDiagnosticLog('journey-c', 'c');
    preserveCompletedJourneyDiagnosticLog('journey-a', 'new');
    preserveCompletedJourneyDiagnosticLog('journey-d', 'd');

    expect(readCompletedJourneyDiagnosticLog('journey-a')).toBe('new');
    expect(readCompletedJourneyDiagnosticLog('journey-b')).toBeNull();
    expect(readCompletedJourneyDiagnosticLog('journey-c')).toBe('c');
    expect(readCompletedJourneyDiagnosticLog('journey-d')).toBe('d');
  });

  it('can clear all current-session diagnostic logs', () => {
    preserveCompletedJourneyDiagnosticLog('journey-a', 'diagnostic-a');
    preserveCompletedJourneyDiagnosticLog('journey-b', 'diagnostic-b');

    clearCompletedJourneyDiagnosticLogs();

    expect(readCompletedJourneyDiagnosticLog('journey-a')).toBeNull();
    expect(readCompletedJourneyDiagnosticLog('journey-b')).toBeNull();
  });
});
