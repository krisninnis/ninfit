import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { getAppContext } from '../../app/bootstrap';
import { RegionErrorBoundary } from '../components/RegionErrorBoundary';
import { startForegroundJourneyGpsSession } from '../../app/foregroundJourneyGpsSession';
const ActiveJourneyMap = lazy(async () => {
  const module = await import('../components/ActiveJourneyMap');
  return { default: module.ActiveJourneyMap };
});
import { journeyUsesPhoneGps } from '../../app/journeyLaunchController';
import type { ActiveJourneyGpsSession } from '../../app/activeJourneyGpsSession';
import { createJourneyRecoveryController } from '../../app/journeyRecoveryController';
import { journeyActiveSeconds, type Journey } from '../../domain/journey';
import type { ISODateTime } from '../../domain/types';
import {
  formatJourneyDistance,
  formatJourneyDuration,
  journeyDistanceM,
  journeyLiveGpsLabel,
  journeyLiveGpsNote,
  type JourneyLiveGpsState,
} from '../journeyPresentation';

interface ActiveJourneyScreenProps {
  onClose(): void;
  onCompleted?(journeyId: string): void;
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
    case 'swim':
      return 'Swim';
    default:
      return 'Journey';
  }
}

function initialGpsState(journey: Journey | null): JourneyLiveGpsState {
  if (journey === null) return 'finished';
  if (!journeyUsesPhoneGps(journey.activityType)) return 'not_applicable';
  if (journey.status === 'paused') return 'paused';
  if (journey.status === 'completed') return 'finished';
  return 'connecting';
}

export function ActiveJourneyScreen({ onClose, onCompleted }: ActiveJourneyScreenProps) {
  const store = useMemo(() => getAppContext().adapter, []);
  const recovery = useMemo(() => createJourneyRecoveryController(store), [store]);
  const [journey, setJourney] = useState<Journey | null>(() => recovery.load());
  const [now, setNow] = useState<ISODateTime>(() => nowIso());
  const [gpsState, setGpsState] = useState<JourneyLiveGpsState>(() => initialGpsState(journey));
  const journeyRef = useRef<Journey | null>(journey);
  const sessionRef = useRef<ActiveJourneyGpsSession | null>(null);

  useEffect(() => {
    journeyRef.current = journey;
  }, [journey]);

  useEffect(() => {
    if (journey?.status !== 'recording') return undefined;
    const timer = window.setInterval(() => setNow(nowIso()), 1000);
    return () => window.clearInterval(timer);
  }, [journey?.status]);

  /*
   * The watcher lifetime follows recorder STATUS, not the changing Journey object.
   * Swim is deliberately excluded because phone GPS is not an honest pool recorder.
   */
  useEffect(() => {
    const current = journeyRef.current;
    if (current === null || current.status !== 'recording') return undefined;
    if (!journeyUsesPhoneGps(current.activityType)) {
      setGpsState('not_applicable');
      return undefined;
    }

    setGpsState('connecting');
    let session: ActiveJourneyGpsSession;
    try {
      session = startForegroundJourneyGpsSession({
        storage: store,
        journey: current,
        onJourneyChanged(next) {
          journeyRef.current = next;
          setJourney(next);
          setGpsState('live');
        },
        onError(error) {
          setGpsState(error.code === error.PERMISSION_DENIED ? 'permission_denied' : 'searching');
        },
        onRuntimeError() {
          setGpsState('runtime_error');
        },
      });
    } catch {
      setGpsState('runtime_error');
      return undefined;
    }
    sessionRef.current = session;

    return () => {
      session.stop();
      if (sessionRef.current === session) sessionRef.current = null;
    };
  }, [journey?.status, journey?.activityType, store]);

  const stopGps = () => {
    sessionRef.current?.stop();
    sessionRef.current = null;
  };

  if (journey === null) {
    return (
      <section className="active-journey active-journey--empty" aria-labelledby="active-journey-title">
        <div className="active-journey__empty-panel">
          <p className="active-journey__eyebrow">Living Journey</p>
          <h1 id="active-journey-title">No active Journey</h1>
          <p>There is no unfinished Journey on this device. Choose an activity from Journey when you are ready.</p>
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Back to Journey
          </button>
        </div>
      </section>
    );
  }

  const distanceM = journeyDistanceM(journey);
  const activeSeconds = journeyActiveSeconds(journey, now);
  const isPaused = journey.status === 'paused';
  const isCompleted = journey.status === 'completed';
  const usesPhoneGps = journeyUsesPhoneGps(journey.activityType);
  const statusClass = gpsState === 'live' ? 'receiving' : 'waiting';

  const pause = () => {
    if (journey.status !== 'recording') return;
    stopGps();
    const changedAt = nowIso();
    const next = recovery.pause(journeyRef.current ?? journey, changedAt);
    journeyRef.current = next;
    setJourney(next);
    setGpsState(journeyUsesPhoneGps(next.activityType) ? 'paused' : 'not_applicable');
    setNow(changedAt);
  };

  const resume = () => {
    if (journey.status !== 'paused') return;
    const changedAt = nowIso();
    const next = recovery.resume(journeyRef.current ?? journey, changedAt);
    journeyRef.current = next;
    setJourney(next);
    setGpsState(journeyUsesPhoneGps(next.activityType) ? 'connecting' : 'not_applicable');
    setNow(changedAt);
  };

  const finish = () => {
    if (journey.status !== 'recording' && journey.status !== 'paused') return;
    stopGps();
    const changedAt = nowIso();
    const next = recovery.complete(journeyRef.current ?? journey, changedAt);
    journeyRef.current = next;
    setJourney(next);
    setGpsState('finished');
    setNow(changedAt);
    onCompleted?.(next.id);
  };

  const leave = () => {
    stopGps();
    onClose();
  };

  return (
    <section className="active-journey" aria-labelledby="active-journey-title">
      <header className="active-journey__topbar">
        <button type="button" className="active-journey__leave" onClick={leave}>
          <span aria-hidden="true">←</span>
          <span>Journey</span>
        </button>
        <div className="active-journey__identity">
          <span className="active-journey__eyebrow">Living Journey</span>
          <h1 id="active-journey-title">{activityLabel(journey)}</h1>
        </div>
        <span
          className={`active-journey__status active-journey__status--${statusClass}`}
          role="status"
        >
          <span className="active-journey__status-dot" aria-hidden="true" />
          {journeyLiveGpsLabel(gpsState)}
        </span>
      </header>

      <div
        className={`active-journey__world active-journey__world--${usesPhoneGps ? 'map' : 'fallback'}`}
        aria-label="Journey world surface"
      >
        {usesPhoneGps ? (
          <RegionErrorBoundary
            fallback={
              <div className="active-journey__map-unavailable" role="status">
                <strong>Map unavailable</strong>
                <span>This Journey is still recording and your distance is still being saved.</span>
              </div>
            }
          >
            <Suspense
              fallback={
                <div
                  className="active-journey__map-loading"
                  role="status"
                  aria-live="polite"
                >
                  Loading map...
                </div>
              }
            >
              <ActiveJourneyMap journey={journey} />
            </Suspense>
          </RegionErrorBoundary>
        ) : (
          <div className="active-journey__horizon" aria-hidden="true" />
        )}
        <div className="active-journey__world-overlay">
          <div className="active-journey__distance" aria-live="polite">
            <span className="active-journey__distance-value">{formatJourneyDistance(distanceM)}</span>
            <span className="active-journey__distance-unit">km</span>
          </div>
          <p className="active-journey__world-note">{journeyLiveGpsNote(gpsState)}</p>
        </div>
      </div>

      <div className="active-journey__metrics" aria-label="Live Journey metrics">
        <div className="active-journey__metric">
          <span className="active-journey__metric-label">Active time</span>
          <strong className="active-journey__metric-value">{formatJourneyDuration(activeSeconds)}</strong>
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
          <button type="button" className="btn btn--primary active-journey__dock-action" onClick={leave}>
            Back to Journey
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
