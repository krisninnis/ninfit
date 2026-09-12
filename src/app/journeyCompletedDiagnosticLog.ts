const MAX_COMPLETED_JOURNEY_LOGS = 3;

const completedJourneyLogs = new Map<string, string>();

export function preserveCompletedJourneyDiagnosticLog(
  journeyId: string,
  diagnosticLog: string,
): void {
  try {
    completedJourneyLogs.delete(journeyId);
    completedJourneyLogs.set(journeyId, diagnosticLog);

    while (completedJourneyLogs.size > MAX_COMPLETED_JOURNEY_LOGS) {
      const oldestJourneyId = completedJourneyLogs.keys().next().value;
      if (oldestJourneyId === undefined) break;
      completedJourneyLogs.delete(oldestJourneyId);
    }
  } catch {
    // Diagnostics must never affect Journey runtime or completion.
  }
}

export function readCompletedJourneyDiagnosticLog(
  journeyId: string,
): string | null {
  return completedJourneyLogs.get(journeyId) ?? null;
}

export function clearCompletedJourneyDiagnosticLogs(): void {
  completedJourneyLogs.clear();
}
