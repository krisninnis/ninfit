import { useMemo, useState } from 'react';
import { getAppContext } from '../../app/bootstrap';
import {
  checkAndroidJourneyPermissionReadiness,
  isInstalledAndroidJourneyRuntime,
  requestAndroidJourneyPermissions,
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

export function JourneyLaunchScreen({ family, onClose }: JourneyLaunchScreenProps) {
  const storage = useMemo(() => getAppContext().adapter, []);
  const repository = useMemo(() => getAppContext().repository, []);
  const launch = useMemo(() => createJourneyLaunchController(storage), [storage]);
  const installedAndroid = useMemo(() => isInstalledAndroidJourneyRuntime(), []);

  const [selected, setSelected] = useState<JourneyActivityType | undefined>(undefined);
  const [permissionReadiness, setPermissionReadiness] = useState<AndroidJourneyPermissionReadiness | null>(null);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [permissionFailure, setPermissionFailure] = useState(false);

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

  const start = async () => {
    if (chosen === undefined) return;

    if (installedAndroid && journeyUsesPhoneGps(chosen)) {
      setPermissionFailure(false);
      try {
        const readiness = await checkAndroidJourneyPermissionReadiness();
        setPermissionReadiness(readiness);
        if (readiness !== null && !readiness.ready) return;
      } catch {
        setPermissionFailure(true);
        return;
      }
    }

    launch.start(chosen, nowIso());
    window.location.hash = JOURNEY_ACTIVE_HASH;
  };

  const allowJourneyPermissions = async () => {
    if (!needsAndroidPermission || permissionBusy) return;
    setPermissionBusy(true);
    setPermissionFailure(false);
    try {
      const readiness = await requestAndroidJourneyPermissions();
      setPermissionReadiness(readiness);
    } catch {
      setPermissionFailure(true);
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
                onChange={() => {
                  setSelected(activityType);
                  setPermissionReadiness(null);
                  setPermissionFailure(false);
                }}
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

      {permissionFailure ? (
        <p className="journey-launch__note" role="alert">
          NinFit could not confirm the Android permissions. Nothing was started. Try again when you are ready.
        </p>
      ) : null}

      <button
        type="button"
        className="btn btn--primary btn--block journey-launch__start"
        onClick={() => void start()}
        disabled={chosen === undefined || permissionBusy}
      >
        {chosen === undefined
          ? `Choose ${choices.map(journeyActivityLabel).join(' or ').toLowerCase()}`
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
