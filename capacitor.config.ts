import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The installed NinFit shell.
 *
 * NinFit is a local-first web application first, and the shell exists for exactly one
 * reason the browser cannot serve: a Journey must keep recording while the phone is
 * locked. Everything here is chosen to keep the installed app the same app - same Vite
 * bundle, same hash routes, same local storage - rather than a second product.
 *
 * `appId` is permanent. The Play listing and the background-location licence are both
 * bound to it; see `docs/architecture/journey-native-provider-selection-v1.md`.
 */
const config: CapacitorConfig = {
  appId: 'app.ninfit.mobile',
  appName: 'NinFit',
  webDir: 'dist',
  android: {
    /*
     * The web layer must never silently ignore a bad certificate. NinFit talks to the
     * NinFit ID endpoint and to a map tile host; a shell that tolerated a broken chain
     * would be weaker than the browser the same code runs in.
     */
    allowMixedContent: false,
  },
  server: {
    /*
     * `https` rather than the legacy `http` scheme so the WebView origin is a secure
     * context. Geolocation, the Screen Wake Lock API and service workers all refuse to
     * run outside one, and all three are load-bearing for Journey recording.
     */
    androidScheme: 'https',
  },
};

export default config;
