import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { getAppContext } from '../../app/bootstrap';
import {
  startJourneyMotionSession,
  type JourneyFlightRecorderSession,
  type JourneyMotionState,
} from '../../app/journeyMotionSession';
import {
  createJourneyFlightRecorder,
} from '../../app/journeyFlightRecorder';
import { formatJourneyDiagnosticLog } from '../../app/journeyDiagnosticLog';
import { preserveCompletedJourneyDiagnosticLog } from '../../app/journeyCompletedDiagnosticLog';
import { subscribeInjectedJourneyAppLifecycle } from '../../app/journeyNativeAppLifecycle';
import { resolveInjectedNativeJourneyDurableQueue } from '../../app/journeyNativeDurableQueueBootstrap';
import type { NativeJourneyDurableReplayStopReason } from '../../app/journeyNativeDurableQueue';
import {
  readJourneyNativeDiagnostics,
  recordJourneyNativeDiagnostic,
  recordJourneyNativeReplayDiagnostic,
} from '../../app/journeyNativeDiagnostics';
import {
  createNativeJourneyDurableReplayCoordinator,
  type NativeJourneyDurableReplayCoordinator,
} from '../../app/journeyNativeDurableReplayCoordinator';
import {
  advanceJourneyCollectionHealth,
  classifyJourneyDrainOutcome,
  initialJourneyCollectionHealth,
  journeyCollectionHoldsActiveTime,
  journeyDrainRejectedOutcome,
  journeyDurableDrainDelayMs,
  type JourneyCollectionHealthState,
  type JourneyDrainOutcome,
} from '../../app/journeyCollectionHealth';
import { completeJourneyAfterNativeReconciliation } from '../../app/journeyNativeSafeCompletion';
import { pauseJourneyAfterNativeReconciliation } from '../../app/journeyNativeSafePause';
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
  journeyFinishFailureNote,
  journeyLiveGpsLabel,
  journeyLiveGpsNote,
  journeyCollectionBlockedNote,
  journeyRecorderStopNote,
  type JourneyFinishFailure,
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

/**
 * Every way native recording can stop, from the application layer's own vocabulary plus
 * the one case the boundary itself cannot report - a queue that could not be reached at
 * all. Passing this to `journeyRecorderStopNote` is what enforces the link between the
 * two unions: add a stop reason to the durable replay boundary without giving it a
 * sentence and this file stops compiling, rather than a user meeting a blank note.
 */
type ActiveJourneyStopReason = NativeJourneyDurableReplayStopReason | 'queue_unavailable';

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
  const flightRecorder = useMemo(() => createJourneyFlightRecorder(), []);
  const [journey, setJourney] = useState<Journey | null>(() => recovery.load());
  const [now, setNow] = useState<ISODateTime>(() => nowIso());
  const [gpsState, setGpsState] = useState<JourneyLiveGpsState>(() => initialGpsState(journey));
  const [controlsLocked, setControlsLocked] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [pauseFailure, setPauseFailure] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishFailure, setFinishFailure] = useState<JourneyFinishFailure | null>(null);
  /*
   * What the native transport last said, and whether the recorder is still collecting.
   * `recorderStopped` is the honest-state flag: it is set only when a refused Pause or
   * Finish could not get the provider going again, and it is what stops NinFit
   * presenting an ever-growing active time over a recorder that is not running.
   */
  const [stopReason, setStopReason] = useState<ActiveJourneyStopReason | null>(null);
  const [recorderStopped, setRecorderStopped] = useState(false);
  /*
   * Whether the durable prefix is still advancing. `recorderStopped` answers "is the
   * recorder running"; this answers "is what it records actually reaching Journey state".
   * A physical Samsung proved those are not the same question.
   */
  const [collection, setCollection] = useState<JourneyCollectionHealthState>(
    initialJourneyCollectionHealth,
  );
  const [autoPaused, setAutoPaused] = useState(() =>
    journey !== null
    && journey.status === 'paused'
    && loadJourneyPauseOrigin(store, journey.id) === 'auto_stationary');
  const journeyRef = useRef<Journey | null>(journey);
  const sessionRef = useRef<JourneyFlightRecorderSession | null>(null);
  const durableReplayRef = useRef<NativeJourneyDurableReplayCoordinator | null>(null);
  const collectionRef = useRef<JourneyCollectionHealthState>(initialJourneyCollectionHealth());
  /** Set while a durable poll loop is live, so a person can retry without waiting out a backoff. */
  const drainNowRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    journeyRef.current = journey;
  }, [journey]);

  /** Fold one drain outcome into collection health. Touches refs and state setters only. */
  const applyDrainOutcome = (outcome: JourneyDrainOutcome): JourneyCollectionHealthState => {
    const next = advanceJourneyCollectionHealth(collectionRef.current, outcome, Date.now());
    collectionRef.current = next;
    setCollection(next);
    return next;
  };

  const resetCollectionHealth = () => {
    collectionRef.current = initialJourneyCollectionHealth();
    setCollection(collectionRef.current);
  };

  /*
   * ACTIVE TIME CONTRACT.
   *
   * Active time is derived from the Journey's own start/pause record, so it is never
   * invented and never destroyed. What this clock decides is whether NinFit keeps
   * *claiming* that time is still accruing. It stops claiming in two cases, and they are
   * different failures:
   *
   *   - the native recorder is known to have stopped and could not be restarted; or
   *   - the recorder is running, but its observations have not reached Journey state
   *     across a sustained run of failures, so the durable prefix is blocked.
   *
   * The second is the one a Samsung found the hard way: a live provider and a live
   * session are not evidence of a trustworthy recording if nothing can be filed. Neither
   * case touches the Journey record - Finish still writes its real active time.
   */
  const collectionHoldsClock = journeyCollectionHoldsActiveTime(collection);
  const activeTimeHeld = recorderStopped || collectionHoldsClock;
  const hasNativeJourneyDiagnostics = resolveInjectedNativeJourneyDurableQueue() !== null;

  useEffect(() => {
    if (journey?.status !== 'recording' || activeTimeHeld) return undefined;
    const timer = window.setInterval(() => setNow(nowIso()), 1000);
    return () => window.clearInterval(timer);
  }, [journey?.status, activeTimeHeld]);

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

    let session: JourneyFlightRecorderSession;
    try {
      session = startJourneyMotionSession({
        storage: store,
        journey: current,
        flightRecorder,
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
      recordJourneyNativeDiagnostic({ event: 'session_start_failed', journeyStatus: current.status });
      setGpsState('runtime_error');
      return undefined;
    }
    sessionRef.current = session;
    setRecorderStopped(false);
    collectionRef.current = initialJourneyCollectionHealth();
    setCollection(collectionRef.current);
    recordJourneyNativeDiagnostic({
      event: 'session_started',
      journeyStatus: current.status,
      queuePresent: resolveInjectedNativeJourneyDurableQueue() !== null,
    });

    const durableQueue = resolveInjectedNativeJourneyDurableQueue();
    const durableReplay = durableQueue === null
      ? null
      : createNativeJourneyDurableReplayCoordinator({
          journeyId: current.id,
          queue: durableQueue,
          session,
        });
    durableReplayRef.current = durableReplay;

    let drainTimer: number | null = null;
    let disposed = false;

    /*
     * Schedule the next drain only once the previous one has settled. A fixed interval
     * could stack drains on a slow bridge; this cannot, and it is also where the retry
     * cadence lives. A blocked prefix backs off instead of failing once a second for the
     * length of the Journey - a storm that buries the very diagnostics needed to read it.
     * Backoff never applies to a foreground/resume, a Pause, a Finish, or the person's
     * own retry: those all drain immediately.
     */
    const scheduleNextDrain = (state: JourneyCollectionHealthState) => {
      if (disposed || durableReplay === null) return;
      drainTimer = window.setTimeout(reconcileDurableQueue, journeyDurableDrainDelayMs(state));
    };

    function reconcileDurableQueue(): void {
      if (durableReplay === null || disposed) return;
      drainTimer = null;
      void durableReplay.reconcile().then((result) => {
        if (sessionRef.current !== session) return;
        const health = applyDrainOutcome(classifyJourneyDrainOutcome(result));
        recordJourneyNativeReplayDiagnostic('poll_drain', result, {
          journeyStatus: journeyRef.current?.status,
          sessionStopped: session.isStopped(),
          providerStopped: session.isProviderStopped(),
          collectionHealth: health.health,
        });
        scheduleNextDrain(health);
        if (result.stopReason !== null) {
          /*
           * `session_stopped` means this drain outlived its session, not that anything
           * is wrong: the suffix is still durable and the live session will read it.
           * Reporting it as stopped GPS is a lie the person cannot act on.
           */
          if (result.stopReason === 'session_stopped') return;
          setStopReason(result.stopReason);
          setGpsState('runtime_error');
          return;
        }
        /*
         * A drain that succeeded is the evidence that the recorder is reachable again.
         * Without this, one transient read failure pinned "GPS stopped" on the screen
         * for the rest of the Journey however well everything afterwards worked.
         */
        setStopReason(null);
        setGpsState((currentState) => (
          currentState === 'runtime_error'
            ? (journeyRef.current?.status === 'paused' ? 'paused' : 'live')
            : currentState
        ));
      }).catch(() => {
        if (sessionRef.current !== session) return;
        const health = applyDrainOutcome(journeyDrainRejectedOutcome());
        recordJourneyNativeDiagnostic({
          event: 'runtime_error',
          failure: 'poll_drain_rejected',
          collectionHealth: health.health,
        });
        scheduleNextDrain(health);
        setStopReason('queue_unavailable');
        setGpsState('runtime_error');
      });
    }

    // Installed Android records into SQLite independently of the WebView. While the UI
    // is awake, drain that durable queue so the visible route/distance follows the native
    // recorder without starting a second browser geolocation watch. Browsers/PWAs have no
    // injected queue and therefore create no polling loop at all.
    drainNowRef.current = durableReplay === null
      ? null
      : () => {
        if (drainTimer !== null) {
          window.clearTimeout(drainTimer);
          drainTimer = null;
        }
        reconcileDurableQueue();
      };

    reconcileDurableQueue();

    return () => {
      disposed = true;
      if (drainTimer !== null) window.clearTimeout(drainTimer);
      drainNowRef.current = null;
      session.stop();
      if (sessionRef.current === session) sessionRef.current = null;
      if (durableReplayRef.current === durableReplay) durableReplayRef.current = null;
    };
  }, [journey?.activityType, store]);

  useEffect(() => {
    if (journey?.status !== 'recording') return undefined;
    const wakeLock = keepJourneyScreenAwake();
    return () => wakeLock.release();
  }, [journey?.status]);

  useEffect(() => {
    if (!autoPaused) return undefined;
    const wakeLock = keepJourneyScreenAwake();
    return () => wakeLock.release();
  }, [autoPaused]);

  useEffect(() => {
    const isTracking = journey?.status === 'recording' || autoPaused;
    if (!isTracking) return undefined;
    return subscribeInjectedJourneyAppLifecycle((state) => {
      if (state === 'backgrounded') {
        setControlsLocked(true);
        return;
      }
      const durableReplay = durableReplayRef.current;
      if (durableReplay === null) return;
      void durableReplay.reconcile().then((result) => {
        if (durableReplayRef.current !== durableReplay) return;
        const health = applyDrainOutcome(classifyJourneyDrainOutcome(result));
        recordJourneyNativeReplayDiagnostic('foreground_drain', result, {
          journeyStatus: journeyRef.current?.status,
          collectionHealth: health.health,
        });
        if (result.stopReason === null) {
          setStopReason(null);
          return;
        }
        if (result.stopReason === 'session_stopped') return;
        setStopReason(result.stopReason);
        setGpsState('runtime_error');
      }).catch(() => {
        if (durableReplayRef.current !== durableReplay) return;
        const health = applyDrainOutcome(journeyDrainRejectedOutcome());
        recordJourneyNativeDiagnostic({
          event: 'runtime_error',
          failure: 'foreground_drain_rejected',
          collectionHealth: health.health,
        });
        setStopReason('queue_unavailable');
        setGpsState('runtime_error');
      });
    });
  }, [journey?.status, autoPaused]);

  useEffect(() => {
    if (journey?.status !== 'recording' && !autoPaused && controlsLocked) {
      setControlsLocked(false);
    }
  }, [journey?.status, autoPaused, controlsLocked]);

  const stopGps = () => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    durableReplayRef.current = null;
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

  const settlePause = (next: Journey) => {
    journeyRef.current = next;
    setJourney(next);
    setAutoPaused(false);
    setPauseFailure(false);
    setStopReason(null);
    setRecorderStopped(false);
    setGpsState(journeyUsesPhoneGps(next.activityType) ? 'paused' : 'not_applicable');
    setNow(next.pauses.at(-1)?.startedAt ?? nowIso());
  };

  const pause = () => {
    if (controlsLocked || pausing || finishing || journey.status !== 'recording') return;

    const session = sessionRef.current;
    const durableQueue = session === null ? null : resolveInjectedNativeJourneyDurableQueue();
    if (session === null || durableQueue === null) {
      stopGps();
      const changedAt = nowIso();
      const next = recovery.pause(journeyRef.current ?? journey, changedAt);
      saveJourneyPauseOrigin(store, next.id, 'manual');
      settlePause(next);
      return;
    }

    setPausing(true);
    setPauseFailure(false);
    void pauseJourneyAfterNativeReconciliation({
      storage: store,
      session,
      queue: durableQueue,
      replayCoordinator: durableReplayRef.current,
      now: nowIso,
    }).then((result) => {
      setPausing(false);
      if (!result.paused) {
        recordJourneyNativeDiagnostic({
          event: 'pause_drain',
          journeyStatus: journeyRef.current?.status,
          failure: result.reason,
          stopReason: result.replay?.stopReason ?? null,
          stoppedAtSequence: result.replay?.stoppedAtSequence ?? null,
          lastAcknowledgedSequence: result.replay?.lastAcknowledgedSequence ?? null,
          processed: result.replay?.processed,
          providerStopped: !result.recording,
        });
        setPauseFailure(true);
        setStopReason(result.replay?.stopReason ?? 'queue_unavailable');
        /*
         * A refusal that could not get the recorder going again means this Journey is
         * no longer collecting anything. Say so, and stop the clock: the alternative is
         * a Recording state and a rising active time over a dead recorder, which is
         * exactly the trap a physical Samsung run fell into.
         */
        setRecorderStopped(!result.recording);
        setGpsState(result.recording ? 'runtime_error' : 'recorder_stopped');
        return;
      }
      sessionRef.current = null;
      durableReplayRef.current = null;
      settlePause(result.journey);
    }).catch(() => {
      setPausing(false);
      setPauseFailure(true);
      setStopReason('queue_unavailable');
      setGpsState('runtime_error');
    });
  };

  const resume = () => {
    if (controlsLocked || pausing || finishing || journey.status !== 'paused') return;
    stopGps();
    const changedAt = nowIso();
    const next = recovery.resume(journeyRef.current ?? journey, changedAt);
    clearJourneyPauseOrigin(store, next.id);
    journeyRef.current = next;
    setJourney(next);
    setAutoPaused(false);
    setPauseFailure(false);
    setStopReason(null);
    setRecorderStopped(false);
    resetCollectionHealth();
    setGpsState(journeyUsesPhoneGps(next.activityType) ? 'connecting' : 'not_applicable');
    setNow(changedAt);
  };

  const settleCompletion = (next: Journey) => {
    clearJourneyPauseOrigin(store, next.id);
    journeyRef.current = next;
    setJourney(next);
    setAutoPaused(false);
    setPauseFailure(false);
    setFinishFailure(null);
    setStopReason(null);
    setRecorderStopped(false);
    resetCollectionHealth();
    setGpsState('finished');
    setNow(next.endedAt ?? nowIso());
    try {
      preserveCompletedJourneyDiagnosticLog(
        next.id,
        formatJourneyDiagnosticLog(
          readJourneyNativeDiagnostics(),
          flightRecorder.snapshot(),
        ),
      );
    } catch {
      // Diagnostics must never affect Journey runtime or completion.
    }

    onCompleted?.(next.id);
  };

  const finish = () => {
    if (controlsLocked || pausing || finishing) return;
    if (journey.status !== 'recording' && journey.status !== 'paused') return;

    const session = sessionRef.current;
    const durableQueue = session === null ? null : resolveInjectedNativeJourneyDurableQueue();
    if (session === null || durableQueue === null) {
      stopGps();
      settleCompletion(recovery.complete(journeyRef.current ?? journey, nowIso()));
      return;
    }

    setFinishing(true);
    setFinishFailure(null);
    void completeJourneyAfterNativeReconciliation({
      storage: store,
      session,
      queue: durableQueue,
      replayCoordinator: durableReplayRef.current,
      now: nowIso,
    }).then((result) => {
      setFinishing(false);
      if (!result.completed) {
        recordJourneyNativeDiagnostic({
          event: 'finish_drain',
          journeyStatus: journeyRef.current?.status,
          failure: result.reason,
          stopReason: result.replay?.stopReason ?? null,
          stoppedAtSequence: result.replay?.stoppedAtSequence ?? null,
          lastAcknowledgedSequence: result.replay?.lastAcknowledgedSequence ?? null,
          processed: result.replay?.processed,
          providerStopped: !result.recording,
        });
        setFinishFailure(result.reason);
        setStopReason(result.replay?.stopReason ?? 'queue_unavailable');
        setRecorderStopped(!result.recording);
        setGpsState(result.recording ? 'runtime_error' : 'recorder_stopped');
        return;
      }
      sessionRef.current = null;
      durableReplayRef.current = null;
      settleCompletion(result.journey);
    }).catch(() => {
      setFinishing(false);
      setFinishFailure('completion_failed');
      setStopReason('queue_unavailable');
      setGpsState('runtime_error');
    });
  };

  const copyDiagnosticLog = async () => {
    try {
      const diagnosticLog = formatJourneyDiagnosticLog(
        readJourneyNativeDiagnostics(),
        flightRecorder.snapshot(),
      );

      await navigator.clipboard.writeText(diagnosticLog);
    } catch {
      // Diagnostic export failure must never affect Journey runtime.
    }
  };

  const leave = () => {
    if (controlsLocked || pausing || finishing) return;
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
          disabled={controlsLocked || pausing || finishing}
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
          <span className="active-journey__metric-label">
            {activeTimeHeld ? 'Active time · held' : 'Active time'}
          </span>
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
                  : recorderStopped
                    ? 'Recording stopped · not collecting'
                    : collectionHoldsClock
                      ? 'Recording · not filing GPS'
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
              ? 'Accidental taps are blocked. Tracking continues; unlock NinFit controls when you are ready.'
              : 'Locks NinFit controls while tracking. The installed app will also protect them when your phone backgrounds.'}
          </p>
        </div>
      ) : null}

      {pauseFailure ? (
        <p className="active-journey__finish-error" role="alert">
          NinFit could not safely pause yet because recent background GPS has not finished reconciling. Your Journey remains recoverable; try Pause again.
        </p>
      ) : null}

      {finishFailure === null ? null : (
        <p className="active-journey__finish-error" role="alert">
          {journeyFinishFailureNote(finishFailure)}
        </p>
      )}

      {stopReason === null ? null : (
        <p
          className="active-journey__note"
          role="status"
          aria-live="polite"
          data-recorder-stop={stopReason}
        >
          {journeyRecorderStopNote(stopReason)}
        </p>
      )}

      {/*
        * Shown only once the durable prefix has been blocked long enough to stop the
        * clock, so it never fires on a single bad drain. The retry exists because the
        * drain loop backs off at this point: the person should never have to wait out a
        * backoff they cannot see.
        */}
      {collectionHoldsClock ? (
        <div className="active-journey__note" role="status" aria-live="polite" data-collection-health="blocked">
          <p>{journeyCollectionBlockedNote()}</p>
          {drainNowRef.current === null ? null : (
            <button type="button" className="btn" onClick={() => drainNowRef.current?.()}>
              Try background GPS again
            </button>
          )}
        </div>
      ) : null}

      {hasNativeJourneyDiagnostics ? (
        <details className="active-journey__diagnostics">
          <summary>Technical details (for support)</summary>
          <pre>{formatJourneyDiagnosticLog(
            readJourneyNativeDiagnostics(),
            flightRecorder.snapshot(),
          )}</pre>
          <button type="button" className="btn" onClick={() => void copyDiagnosticLog()}>
            Copy diagnostic log
          </button>
        </details>
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
              disabled={pausing || finishing}
            >
              {pausing ? 'Pausing...' : isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              type="button"
              className="btn btn--primary active-journey__dock-action"
              onClick={finish}
              disabled={pausing || finishing}
            >
              {finishing ? 'Finishing...' : 'Finish'}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

