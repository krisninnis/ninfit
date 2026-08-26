import { useMemo } from 'react';
import { getAppContext } from '../../app/bootstrap';
import { createJourneyLaunchController } from '../../app/journeyLaunchController';
import type { ISODateTime } from '../../domain/types';

interface JourneyLauncherProps {
  onOpen(): void;
}

function nowIso(): ISODateTime {
  return new Date().toISOString();
}

/**
 * Small floating entry point from Today. It creates no duplicate Journey: if recovery
 * already holds an unfinished recording, the launch controller returns that evidence
 * and this button simply reopens it.
 */
export function JourneyLauncher({ onOpen }: JourneyLauncherProps) {
  const launch = useMemo(
    () => createJourneyLaunchController(getAppContext().adapter),
    [],
  );
  const active = launch.loadActive();

  return (
    <button
      type="button"
      className="journey-launcher"
      onClick={() => {
        launch.start('walk', nowIso());
        onOpen();
      }}
      aria-label={active ? 'Continue active Journey' : 'Start a walking Journey'}
    >
      <span className="journey-launcher__mark" aria-hidden="true">●</span>
      <span>{active ? 'Continue Journey' : 'Start walk'}</span>
    </button>
  );
}
