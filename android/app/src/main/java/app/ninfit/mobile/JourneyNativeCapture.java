package app.ninfit.mobile;

import android.location.Location;

/**
 * Native append-before-delivery boundary for background Journey GPS.
 *
 * A provider callback must enter this class before it is allowed to notify the WebView.
 * The raw fix is committed to the app-private durable store first. If persistence fails,
 * delivery fails closed: JavaScript must not see an observation that could disappear
 * when the WebView/process is suspended immediately afterwards.
 *
 * This class deliberately owns no GPS trust, route, distance, pause, reward or Journey
 * domain state. Those remain authoritative in the existing Journey runtime after replay.
 */
final class JourneyNativeCapture {
    interface Delivery {
        void onDurablyCaptured(long sequence, Location location);
        void onCaptureError(Exception error);
    }

    private final JourneyDurableStore store;
    private String journeyId;

    JourneyNativeCapture(JourneyDurableStore store) {
        if (store == null) throw new IllegalArgumentException("Journey store is required");
        this.store = store;
    }

    synchronized void begin(String nextJourneyId) {
        if (nextJourneyId == null || nextJourneyId.trim().isEmpty() || nextJourneyId.length() > 128) {
            throw new IllegalArgumentException("Invalid Journey id");
        }
        if (journeyId != null && !journeyId.equals(nextJourneyId)) {
            throw new IllegalStateException("A different Journey is already being captured");
        }
        journeyId = nextJourneyId;
    }

    synchronized boolean isActive() {
        return journeyId != null;
    }

    synchronized String activeJourneyId() {
        return journeyId;
    }

    synchronized void capture(Location location, Delivery delivery) {
        if (delivery == null) throw new IllegalArgumentException("Journey delivery is required");
        if (journeyId == null) {
            delivery.onCaptureError(new IllegalStateException("No active Journey capture"));
            return;
        }
        if (location == null) {
            delivery.onCaptureError(new IllegalArgumentException("Location is required"));
            return;
        }

        try {
            long timestampMs = location.getTime();
            long sequence = store.append(
                journeyId,
                location.getLatitude(),
                location.getLongitude(),
                location.getAccuracy(),
                timestampMs
            );
            // This callback is intentionally after store.append() returns. That return
            // means the SQLite transaction committed successfully.
            delivery.onDurablyCaptured(sequence, location);
        } catch (Exception error) {
            delivery.onCaptureError(error);
        }
    }

    synchronized void end(String expectedJourneyId) {
        if (journeyId == null) return;
        if (expectedJourneyId == null || !journeyId.equals(expectedJourneyId)) {
            throw new IllegalStateException("Cannot stop a different Journey capture");
        }
        journeyId = null;
    }
}
