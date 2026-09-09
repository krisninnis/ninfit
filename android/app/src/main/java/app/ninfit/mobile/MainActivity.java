package app.ninfit.mobile;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

/**
 * Registration order is load-bearing, not style.
 *
 * Capacitor 8's {@link BridgeActivity#onCreate(Bundle)} finishes by calling load(), which
 * does bridgeBuilder.addPlugins(initialPlugins).create(); the Bridge constructor then runs
 * registerAllPlugins() immediately. registerPlugin() only appends to that builder, so any
 * call made after super.onCreate(...) mutates a list the Bridge has already consumed and
 * the plugin is never registered. Every JS call to it then rejects with
 * "unable to find plugin : <id>" from Bridge.callPluginMethod - which the Journey
 * permission surface can only report as "NinFit could not confirm the Android permissions".
 *
 * Both registrations must stay above super.onCreate(...).
 * Pinned by src/test/androidNativePluginRegistrationContract.test.ts.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NinFitJourneyQueuePlugin.class);
        registerPlugin(NinFitJourneyLocationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
