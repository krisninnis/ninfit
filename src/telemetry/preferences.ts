import type { StorageAdapter } from '../storage/StorageAdapter';

const TELEMETRY_ENABLED_KEY = 'ninfit:telemetry:enabled';
const TELEMETRY_LAST_OPEN_KEY = 'ninfit:telemetry:last-open-date';

/**
 * Telemetry consent is intentionally outside Repository/GameSettings.
 *
 * It is a device-local privacy choice, not fitness data and not part of backup/restore.
 * Restoring an old backup must never silently re-enable data collection on a device.
 */
export function telemetryEnabled(store: StorageAdapter): boolean {
  return store.get(TELEMETRY_ENABLED_KEY) === 'true';
}

export function setTelemetryEnabled(store: StorageAdapter, enabled: boolean): boolean {
  try {
    store.set(TELEMETRY_ENABLED_KEY, enabled ? 'true' : 'false');
    if (!enabled) store.remove(TELEMETRY_LAST_OPEN_KEY);
    return true;
  } catch {
    // Fail closed: if the preference cannot be persisted, collection stays disabled.
    try {
      store.remove(TELEMETRY_ENABLED_KEY);
      store.remove(TELEMETRY_LAST_OPEN_KEY);
    } catch {
      // The backing store may be completely unavailable. Disabled is still the runtime default.
    }
    return false;
  }
}

export function telemetryLastOpenDate(store: StorageAdapter): string | undefined {
  return telemetryEnabled(store) ? store.get(TELEMETRY_LAST_OPEN_KEY) ?? undefined : undefined;
}

export function saveTelemetryLastOpenDate(store: StorageAdapter, date: string): void {
  if (!telemetryEnabled(store)) return;
  try {
    store.set(TELEMETRY_LAST_OPEN_KEY, date);
  } catch {
    // Analytics metadata is best-effort and can never interfere with the app.
  }
}
