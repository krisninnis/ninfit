# Journey Capgo background adapter v1

## Status

This document defines the first concrete native-plugin adapter shape for NinFit Journey background location. It does **not** claim the Capacitor package or Android project has been installed yet.

## Selected first candidate

`@capgo/background-geolocation` v8 is the first implementation candidate for the Capacitor 8 shell. The adapter remains behind NinFit's vendor-independent `NativeJourneyLocationBridge`, so changing plugin later does not alter Journey domain logic.

## Start contract

NinFit configures the plugin with:

- a visible Android background notification title/message;
- `requestPermissions: false` because permission UX is owned by NinFit/native onboarding rather than silently requested by the Journey runtime;
- `stale: false`;
- `distanceFilter: 0` so stationary updates are not suppressed;
- `minIntervalMs: 1000` to support evidence gathering for the five-second stationary auto-pause threshold;
- **no URL**, preserving the local-first contract and preventing native location upload.

## Async lifecycle containment

The Capgo `start()` API resolves asynchronously, while NinFit's location bridge returns a synchronous session handle. The adapter therefore returns immediately, tracks startup internally, and remembers an early `stop()` request. If the Journey is stopped before plugin startup resolves, the plugin is stopped immediately after startup completes rather than leaving an orphan foreground service.

Late callbacks after stop are ignored.

## Timestamp rule

A plugin position without its native timestamp is rejected. NinFit does not substitute `Date.now()` because doing so would invent timing for a fix captured while the WebView was suspended and could corrupt route timing or auto-pause evidence.

## Error mapping

Native plugin errors are normalised into NinFit's existing provider vocabulary:

- authorization/permission -> `permission_denied`;
- timeout -> `timeout`;
- unavailable/location failures -> `position_unavailable`;
- anything else -> `provider_error`.

## Remaining native work

Before this can be called production background GPS:

1. Add Capacitor 8 dependencies and Android platform project.
2. Add `@capgo/background-geolocation` v8 dependency and native sync.
3. Bind the real plugin instance to `createCapgoNativeJourneyLocationBridge` during native startup.
4. Add Android notification/runtime permission setup and required Capacitor legacy-bridge setting if still required by the installed plugin version.
5. Add native durable buffering integration so process/WebView suspension cannot lose fixes.
6. Prove screen-lock continuity on the Samsung device.

No browser/PWA background claim changes as part of this adapter.
