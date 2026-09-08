# NinFit Journey Native Shell Bootstrap v1

**Status:** implemented bootstrap contract; no concrete Android/iOS bridge implementation yet.

## Purpose

NinFit's web bundle must make exactly one decision before the first Journey can start: use the foreground-only browser location provider, or use a native Android/iOS provider supplied by the installed shell.

The decision is made at application startup by `installInjectedNativeJourneyBridge()`.

## Injection contract

The installed shell may expose a single global before the Vite bundle executes:

`globalThis.__NINFIT_NATIVE_JOURNEY_BRIDGE__`

The object must satisfy the existing `NativeJourneyLocationBridge` contract:

- `platform`: `android` or `ios`
- `supportsLockedScreen`: boolean capability claim from the concrete native implementation
- `start(...)`: begin location observation and return a session with `stop()`

Malformed or partial objects are ignored. Browser/PWA fallback remains authoritative.

## Ordering

The bridge must exist before `src/main.tsx` executes. `main.tsx` installs it before React renders, so a Journey cannot race ahead and start on the browser provider first.

## Safety boundary

The injected bridge may only emit native positions and provider errors. It cannot directly change Journey status, route, distance, auto-pause state, rewards, storage, privacy, or UI.

Every position still passes through:

native bridge → native provider adapter → Journey location provider → Journey motion session → trusted GPS runtime → recovery/storage

## Locked-screen claim

`supportsLockedScreen: true` is a capability claim only. It does not prove background tracking works on a real device. NinFit must not surface or document locked-screen recording as complete until Android/iOS acceptance proves it with a real Journey and route continuity across screen lock/app backgrounding.

## Next implementation slice

The concrete Android shell will:

1. initialise the selected background-location SDK/plugin;
2. create the bridge object before web bootstrap;
3. request only the permissions required for an active Journey;
4. run Android location as a foreground service while recording/backgrounded;
5. emit positions through the bridge rather than mutating web state;
6. stop the native service when the Journey is completed/discarded;
7. preserve durable native observations across WebView suspension so the web layer can reconcile on return.
