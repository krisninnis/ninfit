import type { Journey } from '../domain/journey';

export type JourneyGpsPresentationState = 'waiting' | 'receiving';
export type JourneyLiveGpsState =
  | 'connecting'
  | 'live'
  | 'searching'
  | 'permission_denied'
  | 'runtime_error'
  | 'paused'
  | 'finished';

export function journeyDistanceM(journey: Pick<Journey, 'metrics'>): number {
  return journey.metrics.find((metric) => metric.kind === 'distance_m')?.value ?? 0;
}

export function formatJourneyDistance(distanceM: number): string {
  const safe = Number.isFinite(distanceM) && distanceM > 0 ? distanceM : 0;
  return (safe / 1000).toFixed(2);
}

export function formatJourneyDuration(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Stored-route evidence only. This does not claim that a foreground watcher is live. */
export function journeyGpsPresentationState(
  journey: Pick<Journey, 'route'>,
): JourneyGpsPresentationState {
  return (journey.route?.acceptedPoints.length ?? 0) > 0 ? 'receiving' : 'waiting';
}

export function journeyGpsLabel(state: JourneyGpsPresentationState): string {
  return state === 'receiving' ? 'GPS points saved' : 'GPS waiting';
}

export function journeyLiveGpsLabel(state: JourneyLiveGpsState): string {
  switch (state) {
    case 'connecting':
      return 'GPS connecting';
    case 'live':
      return 'GPS live';
    case 'searching':
      return 'GPS searching';
    case 'permission_denied':
      return 'Location permission needed';
    case 'runtime_error':
      return 'GPS stopped';
    case 'paused':
      return 'GPS paused';
    case 'finished':
      return 'GPS finished';
  }
}

export function journeyLiveGpsNote(state: JourneyLiveGpsState): string {
  switch (state) {
    case 'connecting':
      return 'Waiting for a trusted GPS point.';
    case 'live':
      return 'Trusted GPS points are updating this Journey.';
    case 'searching':
      return 'GPS is temporarily unavailable. The watcher is still trying.';
    case 'permission_denied':
      return 'Location permission is off. Pause and resume after allowing location to retry.';
    case 'runtime_error':
      return 'GPS recording stopped safely. Pause and resume to retry.';
    case 'paused':
      return 'GPS collection is paused.';
    case 'finished':
      return 'GPS collection has stopped for this Journey.';
  }
}
