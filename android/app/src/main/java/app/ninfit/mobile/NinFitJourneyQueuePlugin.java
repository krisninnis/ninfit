package app.ninfit.mobile;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NinFitJourneyQueue")
public class NinFitJourneyQueuePlugin extends Plugin {
    /**
     * The largest sequence JavaScript can hold without losing precision
     * (Number.MAX_SAFE_INTEGER). Anything beyond it could not survive the round trip, so
     * it is refused here rather than silently rounded on the way back.
     */
    private static final long MAX_SEQUENCE = 9007199254740991L;

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

    /**
     * Read the acknowledgement sequence without depending on Capacitor's numeric getters.
     *
     * WHY THIS IS HAND-ROLLED. `PluginCall.getLong(name)` returns the value only when the
     * parsed JSON value is literally a `java.lang.Long`, and performs no widening. The
     * bridge hands plugin arguments to `org.json`, which parses every integral JSON
     * literal inside the int range as a `java.lang.Integer`. So `getLong("sequence")`
     * returned null for sequence 1 - for every sequence a real Journey will ever reach -
     * and this method rejected every acknowledgement, permanently blocking the durable
     * prefix at its first sample while the queue, the session and the provider were all
     * healthy. (`getDouble`/`getFloat` do widen an Integer; `getInt`/`getLong` do not.
     * That asymmetry is pinned by androidJourneyAcknowledgementContract.test.ts.)
     *
     * Accepting every integral numeric shape is the transport being liberal about JSON
     * encoding. It is not laxity about the value: a non-integral, non-finite,
     * out-of-range, missing or non-numeric sequence still fails closed, and the sample
     * stays durable.
     */
    private static long requireSequence(PluginCall call) {
        Object raw = call.getData().opt("sequence");
        long sequence;
        if (raw instanceof Integer || raw instanceof Long || raw instanceof Short || raw instanceof Byte) {
            sequence = ((Number) raw).longValue();
        } else if (raw instanceof Double || raw instanceof Float) {
            double numeric = ((Number) raw).doubleValue();
            if (Double.isNaN(numeric) || Double.isInfinite(numeric)) {
                throw new IllegalArgumentException("Invalid Journey acknowledgement sequence");
            }
            if (numeric != Math.floor(numeric)) {
                throw new IllegalArgumentException("Invalid Journey acknowledgement sequence");
            }
            if (numeric < 1d || numeric > (double) MAX_SEQUENCE) {
                throw new IllegalArgumentException("Invalid Journey acknowledgement sequence");
            }
            sequence = (long) numeric;
        } else {
            throw new IllegalArgumentException("Invalid Journey acknowledgement sequence");
        }

        if (sequence < 1L || sequence > MAX_SEQUENCE) {
            throw new IllegalArgumentException("Invalid Journey acknowledgement sequence");
        }
        return sequence;
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

    /**
     * Acknowledge every durable position up to and including `sequence`.
     *
     * The receipt is deliberately explicit. Resolving with nothing meant JavaScript could
     * not tell a committed acknowledgement from a call that reached a different Journey,
     * acknowledged a different prefix, or resolved without touching the store at all. The
     * echoed journeyId and acknowledgedThrough come from the values this method actually
     * used, and `remaining` is the pending depth measured inside the same transaction
     * that performed the delete - so a receipt cannot describe an uncommitted mutation.
     * `remaining` is a count, never a position.
     */
    @PluginMethod
    public void acknowledgeThrough(PluginCall call) {
        try {
            String journeyId = requireJourneyId(call);
            long sequence = requireSequence(call);
            int remaining = store().acknowledgeThrough(journeyId, sequence);
            JSObject result = new JSObject();
            result.put("journeyId", journeyId);
            result.put("acknowledgedThrough", sequence);
            result.put("remaining", remaining);
            call.resolve(result);
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
