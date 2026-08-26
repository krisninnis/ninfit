import { useEffect, useMemo, useState } from 'react';
import { getAppContext } from '../../app/bootstrap';
import { createJourneyRecoveryController } from '../../app/journeyRecoveryController';
import { journeyActiveSeconds, type Journey } from '../../domain/journey';
import type { ISODateTime } from '../../domain/types';
import {
  formatJourneyDistance,
  formatJourneyDuration,
  journeyDistanceM,
  journeyGpsLabel,
  journeyGpsPresentationState,
} from '../journeyPresentation';

interface ActiveJourneyScreenProps {
  onClose(): void;
}

function nowIso(): ISODateTime {
  return new Date().toISOString();
}

function activityLabel(journey: Journey): string {
  switch (journey.activityType) {
    case 'walk':
      return 'Walk';
    case 'run':
      return 'Run';
    case 'hike':
      return 'Hike';
    case 'cycle':
      return 'Cycle';
    default:
      return 'Journey';
  }
}

export function ActiveJourneyScreen({ onClose }: ActiveJourneyScreenProps) {
  const recovery = useMemo(
    () => createJourneyRecoveryController(getAppContext().adapter),
    [],
  );
  const [journey, setJourney] = useState<Journey | null>(() => recovery.load());
  const [now, setNow] = useState<ISODateTime>(() => nowIso());

  useEffect(() => {
    if (journey === null || journey.status === 'completed') return undefined;
    const timer = window.setInterval(() => setNow(nowIso()), 1000);
    return () => window.clearInterval(timer);
  }, [journey]);

  if (journey === null) {
    return (
      <section className="active-journey active-journey--empty" aria-labelledby="active-journey-title">
        <div className="active-journey__empty-panel">
          <p className="active-journey__eyebrow">Living Journey</p>
          <h1 id="active-journey-title">No active Journey</h1>
          <p>
            There is no unfinished Journey on this device. Starting a Journey from Today is the
            next wiring slice.
          </p>
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Back to Today
          </button>
        </div>
      </section>
    );
  }

  const distanceM = journeyDistanceM(journey);
  const activeSeconds = journeyActiveSeconds(journey, now);
  const gpsState = journeyGpsPresentationState(journey);
  const isPaused = journey.status === 'paused';
  const isCompleted = journey.status === 'completed';

  const pause = () => {
    if (journey.status !== 'recording') return;
    const changedAt = nowIso();
    setJourney(recovery.pause(journey, changedAt));
    setNow(changedAt);
  };

  const resume = () => {
    if (journey.status !== 'paused') return;
    const changedAt = nowIso();
    setJourney(recovery.resume(journey, changedAt));
    setNow(changedAt);
  };

  const finish = () => {
    if (journey.status !== 'recording' && journey.status !== 'paused') return;
    const changedAt = nowIso();
    setJourney(recovery.complete(journey, changedAt));
    setNow(changedAt);
  };

  return (
    <section className="active-journey" aria-labelledby="active-journey-title">
      <header className="active-journey__topbar">
        <button type="button" className="active-journey__leave" onClick={onClose}>
          <span aria-hidden="true">←</span>
          <span>Today</span>
        </button>
        <div className="active-journey__identity">
          <span className="active-journey__eyebrow">Living Journey</span>
          <h1 id="active-journey-title">{activityLabel(journey)}</h1>
        </div>
        <span
          className={`active-journey__status active-journey__status--${gpsState}`}
          role="status"
        >
          <span className="active-journey__status-dot" aria-hidden="true" />
          {journeyGpsLabel(gpsState)}
        </span>
      </header>

      <div className="active-journey__world" aria-label="Journey world surface">
        <div className="active-journey__horizon" aria-hidden="true" />
        <div className="active-journey__distance" aria-live="polite">
          <span className="active-journey__distance-value">{formatJourneyDistance(distanceM)}</span>
          <span className="active-journey__distance-unit">km</span>
        </div>
        <p className="active-journey__world-note">
          {gpsState === 'receiving'
            ? 'Trusted GPS points are stored with this Journey.'
            : 'Live GPS connection arrives in the next wiring slice.'}
        </p>
      </div>

      <div className="active-journey__metrics" aria-label="Live Journey metrics">
        <div className="active-journey__metric">
          <span className="active-journey__metric-label">Active time</span>
          <strong className="active-journey__metric-value">
            {formatJourneyDuration(activeSeconds)}
          </strong>
        </div>
        <div className="active-journey__metric">
          <span className="active-journey__metric-label">State</span>
          <strong className="active-journey__metric-value">
            {isCompleted ? 'Finished' : isPaused ? 'Paused' : 'Recording'}
          </strong>
        </div>
      </div>

      <div className="active-journey__dock" aria-label="Journey controls">
        {isCompleted ? (
          <button type="button" className="btn btn--primary active-journey__dock-action" onClick={onClose}>
            Back to Today
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn btn--secondary active-journey__dock-action"
              onClick={isPaused ? resume : pause}
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              type="button"
              className="btn btn--primary active-journey__dock-action"
              onClick={finish}
            >
              Finish
            </button>
          </>
        )}
      </div>
    </section>
  );
}
