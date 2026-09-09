import { useEffect, useMemo, useState } from 'react';
import { getAppContext } from '../../app/bootstrap';
import {
  checkAndroidJourneyPermissionReadiness,
  classifyAndroidJourneyPermissionFailure,
  isInstalledAndroidJourneyRuntime,
  requestAndroidJourneyPermissions,
  type AndroidJourneyPermissionFailureReason,
  type AndroidJourneyPermissionReadiness,
} from '../../app/journeyAndroidPermissionController';
import {
  createJourneyLaunchController,
  journeyUsesPhoneGps,
} from '../../app/journeyLaunchController';
import { visibleMascotFamily } from '../../domain/game/mascot';
import type { JourneyActivityType } from '../../domain/journey';
import type { ISODateTime } from '../../domain/types';
import { JOURNEY_ACTIVE_HASH } from '../tabs';
import {
  activityTypesForFamily,
  journeyActivityFamily,
  journeyActivityLabel,
  type JourneyActivityFamilyId,
} from '../journeyActivityFamilies';
import { mascotActivityArt } from '../mascotActivityArt';

interface JourneyLaunchScreenProps {
  family: JourneyActivityFamilyId;
  onClose(): void;
}

function nowIso(): ISODateTime {
  return new Date().toISOString();
}

function permissionMessage(readiness: AndroidJourneyPermissionReadiness | null): string | null {
  if (readiness === null || readiness.ready) return null;
  if (!readiness.preciseLocation && readiness.notificationRequired && !readiness.notification) {
    return 'Allow precise location and notifications before starting. Precise location records your route; the notification keeps Android showing that NinFit is actively recording.';
  }
  if (!readiness.preciseLocation) {
    return 'Allow precise location before starting so NinFit can record your Journey route.';
  }
  return 'Allow notifications before starting so Android can keep the active Journey recording visible.';
}

/*
 * A readiness check that cannot answer fails closed whatever the cause, but the causes are
 * not the same thing to say. A missing native plugin cannot be fixed by granting anything
 * in Android Settings, and saying so is what turns an unexplainable phone report into a
 * build report.
 */
function permissionFailureMessage(reason: AndroidJourneyPermissionFailureReason): string {
  if (reason === 'bridge_unavailable') {
    return 'This build of NinFit is missing the Android Journey component, so permissions cannot be confirmed. Nothing was started. Changing Android Settings will not help \u2014 this build needs replacing.';
  }
  return 'NinFit could not confirm the Android permissions. Nothing was started. Try again when you are ready.';
}

export function JourneyLaunchScreen({ family, onClose }: JourneyLaunchScreenProps) {
  const storage = useMemo(() => getAppContext().adapter, []);
  const repository = useMemo(() => getAppContext().repository, []);
  const launch = useMemo(() => createJourneyLaunchController(storage), [storage]);
  const installedAndroid = useMemo(() => isInstalledAndroidJourneyRuntime(), []);

  const [selected, setSelected] = useState<JourneyActivityType | undefined>(undefined);
  const [permissionReadiness, setPermissionReadiness] = useState<AndroidJourneyPermissionReadiness | null>(null);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [permissionFailure, setPermissionFailure] = useState<AndroidJourneyPermissionFailureReason | null>(null);

  const definition = journeyActivityFamily(family);
  const choices = activityTypesForFamily(family);
  const sole = choices.length === 1 ? choices[0] : undefined;
  const usesLocation = choices.some(journeyUsesPhoneGps);
  const gameState = repository.getGameState();
  const mascot = gameState === undefined ? undefined : visibleMascotFamily(gameState.mascot);
  const art = mascot === undefined ? undefined : mascotActivityArt(mascot.id, family);
  const chosen = sole ?? selected;
  const chosenUsesLocation = chosen !== undefined && journeyUsesPhoneGps(chosen);
  const needsAndroidPermission = installedAndroid && chosenUsesLocation;
  const permissionBlocked = needsAndroidPermission && permissionReadiness?.ready === false;

  useEffect(() => {
    let cancelled = false;
    setPermissionFailure(null);

    if (!needsAndroidPermission) {
      setPermissionReadiness(null);
      return () => { cancelled = true; };
    }

    const read = () => {
      void checkAndroidJourneyPermissionReadiness()
        .then((readiness) => {
          if (cancelled) return;
          setPermissionReadiness(readiness);
          setPermissionFailure(null);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setPermissionReadiness(null);
          setPermissionFailure(classifyAndroidJourneyPermissionFailure(error));
        });
    };

    read();

    /*
     * Granting location happens in Android Settings, with NinFit in the background, and
     * nothing tells the WebView about it. Re-reading on the way back makes the screen
     * correct the moment the person returns instead of on a second tap of Start. It only
     * ever reads: permission prompting stays tied to the explicit Allow button.
     */
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') read();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [needsAndroidPermission, chosen]);

  const refreshPermissionReadiness = () => {
    setPermissionFailure(null);
    void checkAndroidJourneyPermissionReadiness()
      .then((readiness) => {
        setPermissionReadiness(readiness);
        setPermissionFailure(null);
      })
      .catch((error: unknown) => setPermissionFailure(classifyAndroidJourneyPermissionFailure(error)));
  };

  const start = () => {
    if (chosen === undefined) return;
    if (needsAndroidPermission && permissionReadiness?.ready !== true) {
      refreshPermissionReadiness();
      return;
    }
    launch.start(chosen, nowIso());
    window.location.hash = JOURNEY_ACTIVE_HASH;
  };

  const allowJourneyPermissions = async () => {
    if (!needsAndroidPermission || permissionBusy) return;
    setPermissionBusy(true);
    setPermissionFailure(null);
    try {
      const readiness = await requestAndroidJourneyPermissions();
      setPermissionReadiness(readiness);
    } catch (error: unknown) {
      setPermissionFailure(classifyAndroidJourneyPermissionFailure(error));
    } finally {
      setPermissionBusy(false);
    }
  };

  return (
    <section className="journey-launch" aria-labelledby="journey-launch-title">
      <button type="button" className="journey-launch__back" onClick={onClose}>
        <span aria-hidden="true">←</span>
        <span>Journey</span>
      </button>

      <header className="journey-launch__header">
        <p className="journey-launch__eyebrow">Living Journey</p>
        <h1 id="journey-launch-title">{definition?.label ?? 'Journey'}</h1>
      </header>

      <div className="journey-launch__companion">
        <div
          className="journey-launch__portrait"
          data-art={art !== undefined ? 'true' : 'false'}
          aria-hidden="true"
        >
          {art !== undefined ? <img src={art.src} alt="" /> : (
            <span className="journey-launch__portrait-mark">{mascot?.glyph ?? '·'}</span>
          )}
        </div>
        {mascot !== undefined ? (
          <p className="journey-launch__companion-name">{mascot.name} is ready.</p>
        ) : null}
      </div>

      {sole === undefined ? (
        <fieldset className="journey-launch__choice">
          <legend className="journey-launch__choice-legend">Choose your activity</legend>
          {choices.map((activityType) => (
            <label
              key={activityType}
              className="journey-launch__option"
              data-selected={selected === activityType ? 'true' : 'false'}
            >
              <input
                type="radio"
                name="journey-activity"
                value={activityType}
                checked={selected === activityType}
                onChange={() => setSelected(activityType)}
              />
              <span>{journeyActivityLabel(activityType)}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {permissionBlocked ? (
        <div className="journey-launch__permission" role="status" aria-live="polite">
          <p><strong>Allow Journey tracking</strong></p>
          <p>{permissionMessage(permissionReadiness)}</p>
          <p>NinFit asks only when you choose this button. Your route stays private on this device by default.</p>
          <button
            type="button"
            className="btn btn--secondary btn--block"
            onClick={allowJourneyPermissions}
            disabled={permissionBusy}
          >
            {permissionBusy ? 'Waiting for Android…' : 'Allow location & notification'}
          </button>
        </div>
      ) : null}

      {permissionFailure !== null ? (
        <p className="journey-launch__note" role="alert" data-permission-failure={permissionFailure}>
          {permissionFailureMessage(permissionFailure)}
        </p>
      ) : null}

      <button
        type="button"
        className="btn btn--primary btn--block journey-launch__start"
        onClick={start}
        disabled={chosen === undefined}
        aria-busy={permissionBusy ? 'true' : undefined}
      >
        {chosen === undefined
          ? `Choose ${choices.map(journeyActivityLabel).join(' or ').toLowerCase()}`
          : permissionBusy
            ? 'Waiting for Android…'
            : `Start ${journeyActivityLabel(chosen)}`}
      </button>

      <p className="journey-launch__note">
        {usesLocation
          ? installedAndroid
            ? 'During a recorded Journey, the installed app uses location so tracking can continue when the screen is off.'
            : 'Location is used only while a Journey is recording.'
          : 'NinFit does not use location for this activity.'}
      </p>
      <p className="journey-launch__note">Journeys stay private on this device by default.</p>
    </section>
  );
}
