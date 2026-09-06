import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { getAppContext } from '../../app/bootstrap';
import { startForegroundJourneyGpsSession } from '../../app/foregroundJourneyGpsSession';
const ActiveJourneyMap = lazy(async () => {
  const module = await import('../components/ActiveJourneyMap');
  return { default: module.ActiveJourneyMap };
});
import { journeyUsesPhoneGps } from '../../app/journeyLaunchController';
import { keepJourneyScreenAwake } from '../../app/journeyScreenWakeLock';
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
  const [controlsLocked, setControlsLocked] = useState(false);
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

  /*
   * THE SCREEN STAYS AWAKE WHILE - AND ONLY WHILE - SOMETHING IS BEING RECORDED.
   *
   * A locked screen suspends the page, and a suspended page collects no GPS. The
   * Journey survives that intact, but the walk between the last fix and the next one
   * was never observed, so the route is left honestly broken across it. Holding a
   * wake lock is how that hole is avoided rather than explained.
   *
   * It follows recorder STATUS, exactly as the watcher above does. Paused means the
   * person has deliberately stopped, and a phone that will not sleep while nothing is
   * being recorded is a battery complaint, not a feature. Finishing runs the same
   * cleanup, so nothing is still holding the screen on after Finish.
   *
   * Failure here is not a failure. Every branch that cannot get a lock - an
   * unsupported browser, a refusal, a hidden page - returns a handle that holds
   * nothing, and recording is identical either way. There is deliberately no state,
   * no message and no retry button.
   */
  useEffect(() => {
    if (journey?.status !== 'recording') return undefined;
    const wakeLock = keepJourneyScreenAwake();
    return () => wakeLock.release();
  }, [journey?.status]);

  /*
   * A lock belongs only to an actively recording Journey. If recorder state changes
   * for any other reason, discard the presentation lock rather than carrying stale
   * locked controls into a paused/completed screen.
   */
  useEffect(() => {
    if (journey?.status !== 'recording' && controlsLocked) setControlsLocked(false);
  }, [journey?.status, controlsLocked]);

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
  const usesPhoneGps = journeyUsesPhoneGps(journey.activityType);
  const statusClass = gpsState === 'live' ? 'receiving' : 'waiting';

  const pause = () => {
    if (controlsLocked || journey.status !== 'recording') return;
    stopGps();
    const changedAt = nowIso();
    const next = recovery.pause(journeyRef.current ?? journey, changedAt);
    journeyRef.current = next;
    setJourney(next);
    setGpsState(journeyUsesPhoneGps(next.activityType) ? 'paused' : 'not_applicable');
    setNow(changedAt);
  };

  const resume = () => {
    if (controlsLocked || journey.status !== 'paused') return;
    const changedAt = nowIso();
    const next = recovery.resume(journeyRef.current ?? journey, changedAt);
    journeyRef.current = next;
    setJourney(next);
    setGpsState(journeyUsesPhoneGps(next.activityType) ? 'connecting' : 'not_applicable');
    setNow(changedAt);
  };

  const finish = () => {
    if (controlsLocked) return;
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
            {isCompleted
              ? 'Finished'
              : isPaused
                ? 'Paused'
                : controlsLocked
                  ? 'Recording · controls locked'
                  : 'Recording'}
          </strong>
        </div>
      </div>

      {isRecording ? (
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
              ? 'Accidental taps are blocked. Recording and the screen-awake request continue.'
              : 'Locks NinFit controls while recording. True locked-phone background GPS needs the native app.'}
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
            Journey controls locked · recording continues
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
