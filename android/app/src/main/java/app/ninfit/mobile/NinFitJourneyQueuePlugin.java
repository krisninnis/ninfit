package app.ninfit.mobile;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NinFitJourneyQueue")
public class NinFitJourneyQueuePlugin extends Plugin {
    private JourneyDurableStore store;

    private JourneyDurableStore store() {
        if (store == null) {
            store = new JourneyDurableStore(getContext());
        }
        return store;
    }

    private static String requireJourneyId(PluginCall call) {
        String journeyId = call.getString("journeyId");
        if (journeyId == null || journeyId.trim().isEmpty() || journeyId.length() > 128) {
            throw new IllegalArgumentException("Invalid Journey id");
        }
        return journeyId;
    }

    @PluginMethod
    public void readPending(PluginCall call) {
        try {
            String journeyId = requireJourneyId(call);
            JSObject result = new JSObject();
            result.put("positions", store().readPending(journeyId));
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Failed to read pending Journey positions", error);
        }
    }

    @PluginMethod
    public void acknowledgeThrough(PluginCall call) {
        try {
            String journeyId = requireJourneyId(call);
            Long sequence = call.getLong("sequence");
            if (sequence == null || sequence < 1L) {
                throw new IllegalArgumentException("Invalid Journey acknowledgement sequence");
            }
            store().acknowledgeThrough(journeyId, sequence);
            call.resolve();
        } catch (Exception error) {
            call.reject("Failed to acknowledge Journey positions", error);
        }
    }

    @PluginMethod
    public void clear(PluginCall call) {
        try {
            String journeyId = requireJourneyId(call);
            store().clear(journeyId);
            call.resolve();
        } catch (Exception error) {
            call.reject("Failed to clear Journey positions", error);
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (store != null) {
            store.close();
            store = null;
        }
        super.handleOnDestroy();
    }
}
