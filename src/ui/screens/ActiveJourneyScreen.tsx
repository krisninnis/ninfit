import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { getAppContext } from '../../app/bootstrap';
import {
  startJourneyMotionSession,
  type JourneyMotionSession,
  type JourneyMotionState,
} from '../../app/journeyMotionSession';
const ActiveJourneyMap = lazy(async () => {
  const module = await import('../components/ActiveJourneyMap');
  return { default: module.ActiveJourneyMap };
});
import { journeyUsesPhoneGps } from '../../app/journeyLaunchController';
import { keepJourneyScreenAwake } from '../../app/journeyScreenWakeLock';
import { createJourneyRecoveryController } from '../../app/journeyRecoveryController';
import { journeyActiveSeconds, type Journey } from '../../domain/journey';
import type { ISODateTime } from '../../domain/types';
import {
  clearJourneyPauseOrigin,
  loadJourneyPauseOrigin,
  saveJourneyPauseOrigin,
} from '../../storage/journeyPauseProvenance';
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
  const [controlsLocked, setControlsLocked] = useState(false);
  const [autoPaused, setAutoPaused] = useState(() =>
    journey !== null
    && journey.status === 'paused'
    && loadJourneyPauseOrigin(store, journey.id) === 'auto_stationary');
  const journeyRef = useRef<Journey | null>(journey);
  const sessionRef = useRef<JourneyMotionSession | null>(null);

  useEffect(() => {
    journeyRef.current = journey;
  }, [journey]);

  useEffect(() => {
    if (journey?.status !== 'recording') return undefined;
    const timer = window.setInterval(() => setNow(nowIso()), 1000);
    return () => window.clearInterval(timer);
  }, [journey?.status]);

  /*
   * The location provider follows recorder truth. A normal manual pause stops location
   * observation; an explicitly auto-stationary pause keeps it alive so trusted
   * movement can resume the Journey without user intervention. Missing/malformed pause
   * provenance fails closed as manual and therefore can never auto-resume.
   */
  useEffect(() => {
    const current = journeyRef.current;
    if (current === null) return undefined;
    if (!journeyUsesPhoneGps(current.activityType)) {
      setGpsState('not_applicable');
      return undefined;
    }

    const pauseOrigin = current.status === 'paused'
      ? loadJourneyPauseOrigin(store, current.id)
      : 'manual';
    const mayObserve = current.status === 'recording'
      || (current.status === 'paused' && pauseOrigin === 'auto_stationary');
    if (!mayObserve) return undefined;

    setAutoPaused(current.status === 'paused' && pauseOrigin === 'auto_stationary');
    setGpsState(current.status === 'paused' ? 'paused' : 'connecting');

    let session: JourneyMotionSession;
    try {
      session = startJourneyMotionSession({
        storage: store,
        journey: current,
        onJourneyChanged(next) {
          journeyRef.current = next;
          setJourney(next);
          setGpsState(next.status === 'paused' ? 'paused' : 'live');
        },
        onMotionStateChanged(state: JourneyMotionState) {
          const paused = state === 'auto_paused';
          setAutoPaused(paused);
          setGpsState(paused ? 'paused' : 'live');
        },
        onProviderError(error) {
          setGpsState(error.kind === 'permission_denied' ? 'permission_denied' : 'searching');
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

  /*
   * Normal recording owns the original status-bound wake-lock lifetime. Keeping this
   * effect status-only makes the cleanup rule explicit: a manual pause or completion
   * always releases this lock.
   */
  useEffect(() => {
    if (journey?.status !== 'recording') return undefined;
    const wakeLock = keepJourneyScreenAwake();
    return () => wakeLock.release();
  }, [journey?.status]);

  /*
   * Auto-pause is different from a manual pause: tracking is still active and the
   * provider is waiting for trusted movement evidence. It therefore owns a separate,
   * mutually-exclusive wake-lock request while auto-paused. This never overlaps the
   * recording effect because auto-paused Journeys have recorder status `paused`.
   */
  useEffect(() => {
    if (!autoPaused) return undefined;
    const wakeLock = keepJourneyScreenAwake();
    return () => wakeLock.release();
  }, [autoPaused]);

  /*
   * A control lock may remain through an automatic pause because tracking is still
   * active. Manual pause/completion discards it so stale locked controls cannot leak
   * into an inactive state.
   */
  useEffect(() => {
    if (journey?.status !== 'recording' && !autoPaused && controlsLocked) {
      setControlsLocked(false);
    }
  }, [journey?.status, autoPaused, controlsLocked]);

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
  const isRecording = journey.status === 'recording';
  const isTracking = isRecording || autoPaused;
  const usesPhoneGps = journeyUsesPhoneGps(journey.activityType);
  const statusClass = gpsState === 'live' ? 'receiving' : 'waiting';

  const pause = () => {
    if (controlsLocked || journey.status !== 'recording') return;
    stopGps();
    const changedAt = nowIso();
    const next = recovery.pause(journeyRef.current ?? journey, changedAt);
    saveJourneyPauseOrigin(store, next.id, 'manual');
    journeyRef.current = next;
    setJourney(next);
    setAutoPaused(false);
    setGpsState(journeyUsesPhoneGps(next.activityType) ? 'paused' : 'not_applicable');
    setNow(changedAt);
  };

  const resume = () => {
    if (controlsLocked || journey.status !== 'paused') return;
    stopGps();
    const changedAt = nowIso();
    const next = recovery.resume(journeyRef.current ?? journey, changedAt);
    clearJourneyPauseOrigin(store, next.id);
    journeyRef.current = next;
    setJourney(next);
    setAutoPaused(false);
    setGpsState(journeyUsesPhoneGps(next.activityType) ? 'connecting' : 'not_applicable');
    setNow(changedAt);
  };

  const finish = () => {
    if (controlsLocked) return;
    if (journey.status !== 'recording' && journey.status !== 'paused') return;
    stopGps();
    const changedAt = nowIso();
    const next = recovery.complete(journeyRef.current ?? journey, changedAt);
    clearJourneyPauseOrigin(store, next.id);
    journeyRef.current = next;
    setJourney(next);
    setAutoPaused(false);
    setGpsState('finished');
    setNow(changedAt);
    onCompleted?.(next.id);
  };

  const leave = () => {
    if (controlsLocked) return;
    stopGps();
    onClose();
  };

  return (
    <section
      className={`active-journey${controlsLocked ? ' active-journey--controls-locked' : ''}`}
      aria-labelledby="active-journey-title"
    >
      <header className="active-journey__topbar">
        <button
          type="button"
          className="active-journey__leave"
          onClick={leave}
          disabled={controlsLocked}
        >
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
        ) : (
          <div className="active-journey__horizon" aria-hidden="true" />
        )}
        <div className="active-journey__world-overlay">
          <div className="active-journey__distance" aria-live="polite">
            <span className="active-journey__distance-value">{formatJourneyDistance(distanceM)}</span>
            <span className="active-journey__distance-unit">km</span>
          </div>
          <p className="active-journey__world-note">
            {autoPaused ? 'Stationary for 5 seconds. Active time is paused until movement returns.' : journeyLiveGpsNote(gpsState)}
          </p>
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
            {isCompleted
              ? 'Finished'
              : autoPaused
                ? 'Auto-paused · stationary'
                : isPaused
                  ? 'Paused'
                  : controlsLocked
                    ? 'Recording · controls locked'
                    : 'Recording'}
          </strong>
        </div>
      </div>

      {isTracking ? (
        <div className="active-journey__recording-lock">
          <button
            type="button"
            className={`btn btn--block${controlsLocked ? ' btn--primary' : ''}`}
            onClick={() => setControlsLocked((value) => !value)}
            aria-pressed={controlsLocked}
          >
            {controlsLocked ? 'Unlock Journey controls' : 'Lock Journey controls'}
          </button>
          <p className="active-journey__recording-lock-note">
            {controlsLocked
              ? 'Accidental taps are blocked. Tracking and the screen-awake request continue.'
              : 'Locks NinFit controls while tracking. True locked-phone background GPS needs the native app.'}
          </p>
        </div>
      ) : null}

      <div className="active-journey__dock" aria-label="Journey controls">
        {isCompleted ? (
          <button type="button" className="btn btn--primary active-journey__dock-action" onClick={leave}>
            Back to Journey
          </button>
        ) : controlsLocked ? (
          <div className="active-journey__locked-dock" role="status" aria-live="polite">
            Journey controls locked · tracking continues
          </div>
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
