import type { Journey } from '../domain/journey';

export type JourneyGpsPresentationState = 'waiting' | 'receiving';

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

export function journeyGpsPresentationState(
  journey: Pick<Journey, 'route'>,
): JourneyGpsPresentationState {
  return (journey.route?.acceptedPoints.length ?? 0) > 0 ? 'receiving' : 'waiting';
}

export function journeyGpsLabel(state: JourneyGpsPresentationState): string {
  return state === 'receiving' ? 'GPS points saved' : 'GPS waiting';
}
