package app.ninfit.mobile;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Narrow JS control surface for the Android-owned Journey recording service.
 *
 * JavaScript may start/stop one named Journey and publish privacy-safe notification
 * summary state, but cannot append arbitrary fixes to the durable queue. Native provider
 * observations remain the only source allowed to call JourneyDurableStore.append().
 *
 * Permission prompts are also deliberately separated from start(). Starting a Journey
 * only checks readiness and fails closed. The user-facing React surface must explain why
 * NinFit needs precise location / notification visibility and then explicitly call
 * requestRequiredPermissions() from a user gesture.
 */
@CapacitorPlugin(
    name = "NinFitJourneyLocation",
    permissions = {
        @Permission(
            alias = "location",
            strings = {
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.ACCESS_FINE_LOCATION
            }
        ),
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class NinFitJourneyLocationPlugin extends Plugin {
    private static String requireJourneyId(PluginCall call) {
        String journeyId = call.getString("journeyId");
        if (journeyId == null || journeyId.trim().isEmpty() || journeyId.length() > 128) {
            throw new IllegalArgumentException("Invalid Journey id");
        }
        return journeyId;
    }

    private static String requireSummaryText(PluginCall call, String key, int maxLength) {
        String value = call.getString(key);
        if (value == null || value.trim().isEmpty() || value.length() > maxLength) {
            throw new IllegalArgumentException("Invalid Journey status " + key);
        }
        return value;
    }

    private static long requireActiveSeconds(PluginCall call) {
        Double value = call.getDouble("activeSeconds");
        if (value == null || !Double.isFinite(value) || value < 0d || value > 31_536_000d) {
            throw new IllegalArgumentException("Invalid Journey active seconds");
        }
        return (long) Math.floor(value);
    }

    private static double requireDistanceM(PluginCall call) {
        Double value = call.getDouble("distanceM");
        if (value == null || !Double.isFinite(value) || value < 0d || value > 100_000_000d) {
            throw new IllegalArgumentException("Invalid Journey distance");
        }
        return value;
    }

    private boolean hasPreciseLocationPermission() {
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED;
    }

    private boolean notificationPermissionRequired() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU;
    }

    private boolean hasNotificationPermission() {
        return !notificationPermissionRequired()
            || ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
    }

    private JSObject readinessPayload() {
        JSObject result = new JSObject();
        result.put("preciseLocation", hasPreciseLocationPermission());
        result.put("notificationRequired", notificationPermissionRequired());
        result.put("notification", hasNotificationPermission());
        result.put("ready", hasPreciseLocationPermission() && hasNotificationPermission());
        return result;
    }

    @PluginMethod
    public void checkPermissionReadiness(PluginCall call) {
        call.resolve(readinessPayload());
    }

    @PluginMethod
    public void requestRequiredPermissions(PluginCall call) {
        if (!hasPreciseLocationPermission()) {
            requestPermissionForAlias("location", call, "locationPermissionCallback");
            return;
        }
        requestNotificationIfNeeded(call);
    }

    @PermissionCallback
    private void locationPermissionCallback(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED || !hasPreciseLocationPermission()) {
            call.resolve(readinessPayload());
            return;
        }
        requestNotificationIfNeeded(call);
    }

    private void requestNotificationIfNeeded(PluginCall call) {
        if (!notificationPermissionRequired() || hasNotificationPermission()) {
            call.resolve(readinessPayload());
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        call.resolve(readinessPayload());
    }

    @PluginMethod
    public void start(PluginCall call) {
        try {
            String journeyId = requireJourneyId(call);
            if (!hasPreciseLocationPermission()) {
                call.reject("Precise location permission is required before Journey recording starts");
                return;
            }
            if (!hasNotificationPermission()) {
                call.reject("Notification permission is required so active Journey recording stays visible");
                return;
            }

            Intent intent = new Intent(getContext(), JourneyForegroundLocationService.class);
            intent.setAction(JourneyForegroundLocationService.ACTION_START);
            intent.putExtra(JourneyForegroundLocationService.EXTRA_JOURNEY_ID, journeyId);
            ContextCompat.startForegroundService(getContext(), intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Failed to start native Journey recording", error);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            String journeyId = requireJourneyId(call);
            Intent intent = new Intent(getContext(), JourneyForegroundLocationService.class);
            intent.setAction(JourneyForegroundLocationService.ACTION_STOP);
            intent.putExtra(JourneyForegroundLocationService.EXTRA_JOURNEY_ID, journeyId);
            getContext().startService(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Failed to stop native Journey recording", error);
        }
    }

    @PluginMethod
    public void updateStatus(PluginCall call) {
        try {
            String journeyId = requireJourneyId(call);
            String activityLabel = requireSummaryText(call, "activityLabel", 32);
            String state = requireSummaryText(call, "state", 32);
            String stateLabel = requireSummaryText(call, "stateLabel", 64);
            if (!state.equals("recording") && !state.equals("auto_paused") && !state.equals("manual_paused")) {
                throw new IllegalArgumentException("Invalid Journey notification state");
            }

            Intent intent = new Intent(getContext(), JourneyForegroundLocationService.class);
            intent.setAction(JourneyForegroundLocationService.ACTION_STATUS);
            intent.putExtra(JourneyForegroundLocationService.EXTRA_JOURNEY_ID, journeyId);
            intent.putExtra(JourneyForegroundLocationService.EXTRA_ACTIVITY_LABEL, activityLabel);
            intent.putExtra(JourneyForegroundLocationService.EXTRA_STATE, state);
            intent.putExtra(JourneyForegroundLocationService.EXTRA_STATE_LABEL, stateLabel);
            intent.putExtra(JourneyForegroundLocationService.EXTRA_ACTIVE_SECONDS, requireActiveSeconds(call));
            intent.putExtra(JourneyForegroundLocationService.EXTRA_DISTANCE_M, requireDistanceM(call));
            getContext().startService(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Failed to update native Journey status", error);
        }
    }

    @PluginMethod
    public void clearStatus(PluginCall call) {
        try {
            String journeyId = requireJourneyId(call);
            Intent intent = new Intent(getContext(), JourneyForegroundLocationService.class);
            intent.setAction(JourneyForegroundLocationService.ACTION_STATUS_CLEAR);
            intent.putExtra(JourneyForegroundLocationService.EXTRA_JOURNEY_ID, journeyId);
            getContext().startService(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Failed to clear native Journey status", error);
        }
    }
}
