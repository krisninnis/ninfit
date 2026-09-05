import { getAppContext } from '../app/bootstrap';
import { todayISO } from '../domain/dates';
import { captureAppOpenAfterGap } from './client';
import { createPostHogTransport } from './posthogTransport';
import { configureTelemetryTransport, telemetry } from './runtime';

let started = false;

/**
 * Telemetry bootstrap is safe to call unconditionally.
 *
 * With no public project token it installs only the no-op runtime. With a token it
 * configures a transport, but the client and transport still refuse to send until the
 * device-local Settings opt-in is true.
 */
export function startTelemetry(): void {
  if (started) return;
  started = true;

  const context = getAppContext();
  const projectToken = import.meta.env.VITE_POSTHOG_KEY?.trim();
  if (projectToken === undefined || projectToken.length === 0) {
    configureTelemetryTransport(undefined);
    return;
  }

  const transport = createPostHogTransport({
    projectToken,
    store: context.adapter,
  });
  configureTelemetryTransport(transport);
  captureAppOpenAfterGap(context.adapter, transport, todayISO());

  window.addEventListener('error', (event) => {
    telemetry().captureCrash(event.error);
  });
  window.addEventListener('unhandledrejection', (event) => {
    telemetry().captureCrash(event.reason);
  });
}
