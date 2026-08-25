import type { ISODateTime } from './types';
import type { Journey, JourneyPause } from './journey';

function assertTime(value: ISODateTime): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ISODateTime: ${value}`);
  return parsed;
}

function assertNotBefore(value: ISODateTime, boundary: ISODateTime, label: string): void {
  if (assertTime(value) < assertTime(boundary)) {
    throw new Error(`${label} cannot be before ${boundary}`);
  }
}

export function pauseJourney(journey: Journey, pausedAt: ISODateTime): Journey {
  if (journey.status !== 'recording') throw new Error('Only a recording Journey can be paused');
  assertNotBefore(pausedAt, journey.startedAt, 'Pause time');

  return {
    ...journey,
    status: 'paused',
    pauses: [...journey.pauses, { startedAt: pausedAt }],
    updatedAt: pausedAt,
  };
}

export function resumeJourney(journey: Journey, resumedAt: ISODateTime): Journey {
  if (journey.status !== 'paused') throw new Error('Only a paused Journey can be resumed');

  const lastPause = journey.pauses[journey.pauses.length - 1];
  if (!lastPause || lastPause.endedAt) throw new Error('Paused Journey requires one open pause');
  assertNotBefore(resumedAt, lastPause.startedAt, 'Resume time');

  const pauses: JourneyPause[] = journey.pauses.map((pause, index) =>
    index === journey.pauses.length - 1 ? { ...pause, endedAt: resumedAt } : pause,
  );

  return { ...journey, status: 'recording', pauses, updatedAt: resumedAt };
}

export function completeJourney(journey: Journey, completedAt: ISODateTime): Journey {
  if (journey.status !== 'recording' && journey.status !== 'paused') {
    throw new Error('Only an active Journey can be completed');
  }
  assertNotBefore(completedAt, journey.startedAt, 'Completion time');

  let pauses = journey.pauses;
  if (journey.status === 'paused') {
    const lastPause = journey.pauses[journey.pauses.length - 1];
    if (!lastPause || lastPause.endedAt) throw new Error('Paused Journey requires one open pause');
    assertNotBefore(completedAt, lastPause.startedAt, 'Completion time');
    pauses = journey.pauses.map((pause, index) =>
      index === journey.pauses.length - 1 ? { ...pause, endedAt: completedAt } : pause,
    );
  }

  return {
    ...journey,
    status: 'completed',
    endedAt: completedAt,
    pauses,
    updatedAt: completedAt,
  };
}
