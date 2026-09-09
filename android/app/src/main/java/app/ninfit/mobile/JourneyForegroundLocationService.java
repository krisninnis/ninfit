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

import java.util.Locale;

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
    static final String ACTION_STATUS = "app.ninfit.mobile.journey.STATUS";
    static final String ACTION_STATUS_CLEAR = "app.ninfit.mobile.journey.STATUS_CLEAR";
    static final String EXTRA_JOURNEY_ID = "journeyId";
    static final String EXTRA_ACTIVITY_LABEL = "activityLabel";
    static final String EXTRA_STATE = "state";
    static final String EXTRA_STATE_LABEL = "stateLabel";
    static final String EXTRA_ACTIVE_SECONDS = "activeSeconds";
    static final String EXTRA_DISTANCE_M = "distanceM";

    private static final String CHANNEL_ID = "ninfit_journey_recording";
    private static final int NOTIFICATION_ID = 4101;
    private static final long MIN_TIME_MS = 1_000L;
    private static final float MIN_DISTANCE_M = 0f;

    private LocationManager locationManager;
    private JourneyDurableStore store;
    private JourneyNativeCapture capture;
    private String activeJourneyId;
    private String activityLabel = "Journey";
    private String stateLabel = "Recording";
    private long activeSeconds = 0L;
    private double distanceM = 0d;

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

        try {
            String action = intent.getAction();
            if (ACTION_STOP.equals(action)) {
                stopCapture(intent.getStringExtra(EXTRA_JOURNEY_ID));
                return START_NOT_STICKY;
            }
            if (ACTION_STATUS.equals(action)) {
                updateStatus(intent);
                return activeJourneyId == null ? START_NOT_STICKY : START_REDELIVER_INTENT;
            }
            if (ACTION_STATUS_CLEAR.equals(action)) {
                clearStatus(intent.getStringExtra(EXTRA_JOURNEY_ID));
                return activeJourneyId == null ? START_NOT_STICKY : START_REDELIVER_INTENT;
            }
            if (!ACTION_START.equals(action)) return START_NOT_STICKY;

            startCapture(intent.getStringExtra(EXTRA_JOURNEY_ID));
            return START_REDELIVER_INTENT;
        } catch (Exception error) {
            if (activeJourneyId == null) stopSelf();
            return activeJourneyId == null ? START_NOT_STICKY : START_REDELIVER_INTENT;
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

        /*
         * All or nothing. activeJourneyId used to be committed BEFORE startForeground()
         * and requestLocationUpdates(), so a refusal from either - a foreground-service
         * start restriction, a missing provider - left onStartCommand's catch looking at
         * a non-null activeJourneyId, declining to stopSelf, and keeping a service alive
         * that had no notification, no location updates and no way to ever produce a fix.
         * From JavaScript that is indistinguishable from a healthy recorder that simply
         * has not seen a satellite yet, which is exactly the state a Journey must never
         * be able to sit in silently. The id is committed only once recording is really
         * running, and a failure unwinds instead of half-starting.
         */
        capture.begin(journeyId);
        boolean foregrounded = false;
        try {
            resetStatusSummary();
            activeJourneyId = journeyId;
            startForeground(NOTIFICATION_ID, buildNotification());
            foregrounded = true;

            // GPS is the authoritative high-accuracy source for an outdoor Journey. Network
            // fixes are deliberately not mixed in here; provider fallback remains a later,
            // explicit acceptance decision rather than silently weakening route quality.
            locationManager.requestLocationUpdates(
                LocationManager.GPS_PROVIDER,
                MIN_TIME_MS,
                MIN_DISTANCE_M,
                this
            );
        } catch (RuntimeException error) {
            activeJourneyId = null;
            resetStatusSummary();
            try {
                locationManager.removeUpdates(this);
            } catch (RuntimeException ignored) {
                // Nothing was registered; unwinding must not mask the original failure.
            }
            capture.end(journeyId);
            if (foregrounded) stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            throw error;
        }
    }

    private boolean matchesActiveJourney(String journeyId) {
        return activeJourneyId != null && activeJourneyId.equals(journeyId);
    }

    private void updateStatus(Intent intent) {
        if (!matchesActiveJourney(intent.getStringExtra(EXTRA_JOURNEY_ID))) return;

        String nextActivity = intent.getStringExtra(EXTRA_ACTIVITY_LABEL);
        String nextState = intent.getStringExtra(EXTRA_STATE);
        String nextStateLabel = intent.getStringExtra(EXTRA_STATE_LABEL);
        long nextActiveSeconds = intent.getLongExtra(EXTRA_ACTIVE_SECONDS, -1L);
        double nextDistanceM = intent.getDoubleExtra(EXTRA_DISTANCE_M, -1d);

        if (nextActivity == null || nextActivity.trim().isEmpty() || nextActivity.length() > 32) return;
        if (nextStateLabel == null || nextStateLabel.trim().isEmpty() || nextStateLabel.length() > 64) return;
        if (
            !"recording".equals(nextState)
            && !"auto_paused".equals(nextState)
            && !"manual_paused".equals(nextState)
        ) return;
        if (nextActiveSeconds < 0L || nextActiveSeconds > 31_536_000L) return;
        if (!Double.isFinite(nextDistanceM) || nextDistanceM < 0d || nextDistanceM > 100_000_000d) return;

        activityLabel = nextActivity;
        stateLabel = nextStateLabel;
        activeSeconds = nextActiveSeconds;
        distanceM = nextDistanceM;
        publishNotification();
    }

    private void clearStatus(String journeyId) {
        if (!matchesActiveJourney(journeyId)) return;
        resetStatusSummary();
        publishNotification();
    }

    private void resetStatusSummary() {
        activityLabel = "Journey";
        stateLabel = "Recording";
        activeSeconds = 0L;
        distanceM = 0d;
    }

    private void publishNotification() {
        if (activeJourneyId == null) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.notify(NOTIFICATION_ID, buildNotification());
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
        resetStatusSummary();
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

    private static String formatDuration(long seconds) {
        long hours = seconds / 3_600L;
        long minutes = (seconds % 3_600L) / 60L;
        long remainingSeconds = seconds % 60L;
        return hours > 0L
            ? String.format(Locale.UK, "%d:%02d:%02d", hours, minutes, remainingSeconds)
            : String.format(Locale.UK, "%02d:%02d", minutes, remainingSeconds);
    }

    private static String formatDistance(double metres) {
        if (metres < 1_000d) return String.format(Locale.UK, "%.0f m", metres);
        return String.format(Locale.UK, "%.2f km", metres / 1_000d);
    }

    private Notification buildNotification() {
        Intent openApp = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent contentIntent = openApp == null ? null : PendingIntent.getActivity(
            this,
            0,
            openApp,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String summary = "NF · " + activityLabel + " · " + stateLabel;
        String metrics = formatDuration(activeSeconds) + " · " + formatDistance(distanceM);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_ninfit_journey)
            .setContentTitle("NinFit Journey")
            .setContentText(summary)
            .setSubText(metrics)
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
        resetStatusSummary();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
