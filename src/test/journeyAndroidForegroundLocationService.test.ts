import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
const service = readFileSync(
  'android/app/src/main/java/app/ninfit/mobile/JourneyForegroundLocationService.java',
  'utf8',
);
const capture = readFileSync(
  'android/app/src/main/java/app/ninfit/mobile/JourneyNativeCapture.java',
  'utf8',
);
const activity = readFileSync(
  'android/app/src/main/java/app/ninfit/mobile/MainActivity.java',
  'utf8',
);
const plugin = readFileSync(
  'android/app/src/main/java/app/ninfit/mobile/NinFitJourneyLocationPlugin.java',
  'utf8',
);
const icon = readFileSync('android/app/src/main/res/drawable/ic_ninfit_journey.xml', 'utf8');

describe('Android native Journey foreground location service', () => {
  it('declares a non-exported foreground location service and required permissions', () => {
    expect(manifest).toContain('android:name=".JourneyForegroundLocationService"');
    expect(manifest).toContain('android:exported="false"');
    expect(manifest).toContain('android:foregroundServiceType="location"');
    expect(manifest).toContain('android.permission.ACCESS_FINE_LOCATION');
    expect(manifest).toContain('android.permission.FOREGROUND_SERVICE_LOCATION');
    expect(manifest).toContain('android.permission.POST_NOTIFICATIONS');
    expect(manifest).not.toContain('android.permission.ACCESS_BACKGROUND_LOCATION');
  });

  it('persists every native GPS fix before any later delivery path', () => {
    const appendIndex = capture.indexOf('long sequence = store.append(');
    const deliveryIndex = capture.indexOf('delivery.onDurablyCaptured(sequence, location);');

    expect(appendIndex).toBeGreaterThan(-1);
    expect(deliveryIndex).toBeGreaterThan(appendIndex);
    expect(service).toContain('capture.capture(location');
    expect(service).toContain('The WebView consumes');
    expect(service).not.toContain('notifyListeners(');
  });

  it('keeps JS unable to append arbitrary native positions', () => {
    expect(activity).toContain('registerPlugin(NinFitJourneyQueuePlugin.class)');
    expect(activity).toContain('registerPlugin(NinFitJourneyLocationPlugin.class)');
    expect(service).toContain('LocationManager.GPS_PROVIDER');
    expect(service).toContain('START_REDELIVER_INTENT');
  });

  it('updates only the matching active Journey notification with privacy-safe summary data', () => {
    expect(service).toContain('ACTION_STATUS');
    expect(service).toContain('matchesActiveJourney');
    expect(service).toContain('EXTRA_ACTIVITY_LABEL');
    expect(service).toContain('EXTRA_STATE_LABEL');
    expect(service).toContain('EXTRA_ACTIVE_SECONDS');
    expect(service).toContain('EXTRA_DISTANCE_M');
    expect(service).toContain('R.drawable.ic_ninfit_journey');
    expect(service).toContain('.setOngoing(true)');
    expect(service).not.toContain('EXTRA_LATITUDE');
    expect(service).not.toContain('EXTRA_LONGITUDE');
    expect(service).not.toContain('ACTION_PAUSE');
    expect(service).not.toContain('ACTION_FINISH');
    expect(plugin).toContain('public void updateStatus(PluginCall call)');
    expect(plugin).not.toContain('latitude');
    expect(plugin).not.toContain('longitude');
    expect(icon).toContain('<vector');
  });
});
