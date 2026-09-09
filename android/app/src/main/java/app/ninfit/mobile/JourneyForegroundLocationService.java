package app.ninfit.mobile;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;

/**
 * Android-owned foreground Journey location service.
 *
 * This service is intentionally independent of the React/WebView lifecycle. Every raw
 * fix enters {@link JourneyNativeCapture}, which commits it to app-private SQLite before
 * any later delivery/replay path can observe it. The service owns no Journey trust,
 * distance, route, reward or auto-pause business logic.
 */
public final class JourneyForegroundLocationService extends Service implements LocationListener {
    static final String ACTION_START = "app.ninfit.mobile.journey.START";
    static final String ACTION_STOP = "app.ninfit.mobile.journey.STOP";
    static final String EXTRA_JOURNEY_ID = "journeyId";

    private static final String CHANNEL_ID = "ninfit_journey_recording";
    private static final int NOTIFICATION_ID = 4101;
    private static final long MIN_TIME_MS = 1_000L;
    private static final float MIN_DISTANCE_M = 0f;

    private LocationManager locationManager;
    private JourneyDurableStore store;
    private JourneyNativeCapture capture;
    private String activeJourneyId;

    @Override
    public void onCreate() {
        super.onCreate();
        store = new JourneyDurableStore(this);
        capture = new JourneyNativeCapture(store);
        locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
        ensureNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || intent.getAction() == null) return START_NOT_STICKY;

        if (ACTION_STOP.equals(intent.getAction())) {
            stopCapture(intent.getStringExtra(EXTRA_JOURNEY_ID));
            return START_NOT_STICKY;
        }

        if (!ACTION_START.equals(intent.getAction())) return START_NOT_STICKY;

        String journeyId = intent.getStringExtra(EXTRA_JOURNEY_ID);
        try {
            startCapture(journeyId);
            return START_REDELIVER_INTENT;
        } catch (Exception error) {
            stopSelf();
            return START_NOT_STICKY;
        }
    }

    private void startCapture(String journeyId) {
        if (journeyId == null || journeyId.trim().isEmpty() || journeyId.length() > 128) {
            throw new IllegalArgumentException("Invalid Journey id");
        }
        if (
            ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED
            && ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
                != PackageManager.PERMISSION_GRANTED
        ) {
            throw new SecurityException("Location permission is required before Journey recording starts");
        }

        if (activeJourneyId != null && !activeJourneyId.equals(journeyId)) {
            throw new IllegalStateException("A different Journey is already recording");
        }

        capture.begin(journeyId);
        activeJourneyId = journeyId;
        startForeground(NOTIFICATION_ID, buildNotification());

        // GPS is the authoritative high-accuracy source for an outdoor Journey. Network
        // fixes are deliberately not mixed in here; provider fallback remains a later,
        // explicit acceptance decision rather than silently weakening route quality.
        locationManager.requestLocationUpdates(
            LocationManager.GPS_PROVIDER,
            MIN_TIME_MS,
            MIN_DISTANCE_M,
            this
        );
    }

    @Override
    public void onLocationChanged(Location location) {
        if (activeJourneyId == null) return;
        capture.capture(location, new JourneyNativeCapture.Delivery() {
            @Override
            public void onDurablyCaptured(long sequence, Location captured) {
                // SQLite is now authoritative transport evidence. The WebView consumes
                // this fix through the existing ordered native replay queue. We do not
                // send a second direct callback here, which avoids duplicate processing.
            }

            @Override
            public void onCaptureError(Exception error) {
                // Fail closed. A fix that could not be durably persisted is not emitted.
                // Keep the service alive so a transient storage/provider failure does not
                // silently turn a whole Journey into a foreground-only session.
            }
        });
    }

    @Override
    public void onProviderDisabled(String provider) {
        // No domain mutation here. The WebView/provider readiness layer surfaces the
        // missing GPS state when it next reconciles; durable transport remains separate.
    }

    @Override
    public void onProviderEnabled(String provider) {}

    @Override
    @SuppressWarnings("deprecation")
    public void onStatusChanged(String provider, int status, Bundle extras) {}

    private void stopCapture(String expectedJourneyId) {
        if (activeJourneyId == null) {
            stopSelf();
            return;
        }
        if (expectedJourneyId == null || !activeJourneyId.equals(expectedJourneyId)) {
            throw new IllegalStateException("Cannot stop a different Journey service");
        }

        locationManager.removeUpdates(this);
        capture.end(expectedJourneyId);
        activeJourneyId = null;
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    private void ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "NinFit Journey recording",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Shows when NinFit is recording a Journey in the background.");
        manager.createNotificationChannel(channel);
    }

    private Notification buildNotification() {
        Intent openApp = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent contentIntent = openApp == null ? null : PendingIntent.getActivity(
            this,
            0,
            openApp,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle("NinFit Journey")
            .setContentText("NF · Recording your Journey")
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setContentIntent(contentIntent)
            .build();
    }

    @Override
    public void onDestroy() {
        if (locationManager != null) locationManager.removeUpdates(this);
        if (store != null) store.close();
        activeJourneyId = null;
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
