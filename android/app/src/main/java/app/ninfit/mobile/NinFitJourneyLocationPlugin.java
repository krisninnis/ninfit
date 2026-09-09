package app.ninfit.mobile;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;

import androidx.core.content.ContextCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Narrow JS control surface for the Android-owned Journey recording service.
 *
 * JavaScript may start/stop one named Journey, but cannot append arbitrary fixes to the
 * durable queue. Native provider observations remain the only source allowed to call
 * JourneyDurableStore.append().
 */
@CapacitorPlugin(name = "NinFitJourneyLocation")
public class NinFitJourneyLocationPlugin extends Plugin {
    private static String requireJourneyId(PluginCall call) {
        String journeyId = call.getString("journeyId");
        if (journeyId == null || journeyId.trim().isEmpty() || journeyId.length() > 128) {
            throw new IllegalArgumentException("Invalid Journey id");
        }
        return journeyId;
    }

    private boolean hasLocationPermission() {
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED
            || ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_COARSE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
    }

    @PluginMethod
    public void start(PluginCall call) {
        try {
            String journeyId = requireJourneyId(call);
            if (!hasLocationPermission()) {
                call.reject("Location permission is required before Journey recording starts");
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
}
