import { getAppContext } from '../app/bootstrap';
import { createTelemetryClient } from './client';
import type { TelemetryTransport } from './types';

const NOOP_TRANSPORT: TelemetryTransport = {
  capture() {},
  captureCrash() {},
};

let transport: TelemetryTransport = NOOP_TRANSPORT;

/** Provider wiring is one narrow seam; product code never imports a vendor SDK. */
export function configureTelemetryTransport(next: TelemetryTransport | undefined): void {
  transport = next ?? NOOP_TRANSPORT;
}

export function telemetry() {
  return createTelemetryClient(getAppContext().adapter, transport);
}
