# NinFit Journey Native Background Location v1

**Status:** implementation boundary added; native plugin/runtime not yet wired.
**Scope:** Android/iOS locked-screen/background Journey recording without weakening local-first GPS truth.
**Parent work:** PR #238 (`feat/journey-native-background-autopause-v1`).

## Product contract

A Journey may keep recording after the phone locks or the user changes apps only when the installed native app is using an OS-backed background location provider. The browser/PWA must continue to advertise `supportsBackground: false` and must never imply locked-screen continuity it cannot guarantee.

Manual Pause remains authoritative. Automatic stationary pause may resume only from trusted movement evidence. Native providers emit observations; they never mutate Journey state, distance, route, pause provenance, rewards or history.

## Architecture

```text
Android/iOS location service
  -> NativeJourneyLocationBridge
  -> JourneyLocationProvider
  -> JourneyMotionSession
  -> existing GPS quality/runtime gates
  -> recovery + local persistence
  -> route / distance / auto-pause
```

`src/app/journeyNativeLocationProvider.ts` is deliberately dependency-free. A concrete Capacitor plugin adapter can be changed later without changing Journey domain truth.

## Native technology decision

For NinFit's installed-app path, use Capacitor as the shell because the product is already a Vite/React application and the provider boundary is now platform-neutral.

For real background geolocation, prefer a maintained native SDK/plugin that provides Android foreground-service support, iOS background location modes, durable/offline delivery and current permission flows. The current leading production candidate is Transistorsoft Background Geolocation for Capacitor. Its current documentation supports Capacitor 5+ and its SDK is purpose-built for background tracking. Release builds require a commercial license; debug builds can be evaluated without one. This is a product-cost decision before production, not a reason to weaken the architecture.

Open/community alternatives may be evaluated, but NinFit must not adopt a plugin merely because it is free. Required acceptance criteria are below.

## Required provider acceptance criteria

1. Android 14+ foreground location service with a visible ongoing notification while recording.
2. Correct foreground/background/precise permission flows; denial must fail closed.
3. iOS `location` background mode with clear Always/While Using behaviour and no false promise when only foreground permission exists.
4. Positions continue through screen lock and ordinary app switching on real devices.
5. No cloud upload is required for the local-first Journey path.
6. Offline operation; native buffering must not lose the route when JavaScript is temporarily suspended.
7. Idempotent stop and safe restart after process/lifecycle interruption.
8. The bridge can emit timestamp, latitude, longitude and accuracy without inventing fields.
9. Battery behaviour is measured on a real 30–60 minute walk before beta.
10. Native callbacks still pass through NinFit's existing accepted-point, impossible-speed, route-segmentation and auto-pause gates.

## Locked controls

The in-app control lock and OS screen lock are separate concepts.

- Tapping **Lock Journey controls** protects Pause/Finish/navigation from accidental touches.
- When the native app goes into the background or the OS locks, the Journey remains logically protected while recording.
- Returning to the app restores the live screen from durable Journey truth, not from stale component state.
- A manual pause before backgrounding stays paused and must never auto-resume.

## Auto-pause interaction

The native service stays alive through `auto_stationary` so movement can be detected. During automatic pause, active time and route/distance recording remain stopped. Repeated trusted movement evidence resumes the Journey; the movement-confirming sample still passes the ordinary GPS acceptance gates.

A manual pause stops the active provider lifecycle and requires explicit user Resume.

## Privacy

Background location is sensitive. NinFit must request it only in the context of a user-started Journey and explain why it is needed. Precise route data remains local unless a later explicit sharing/cloud-sync feature says otherwise. Native plugin HTTP upload/sync features must remain disabled for the local-first recorder unless separately designed and consented.

## Implementation sequence

1. Dependency-free native bridge contract and tests. **Done in this branch.**
2. Add Capacitor shell/dependencies and Android project in a dedicated integration slice.
3. Implement Android bridge first and prove locked-screen recording on the existing Samsung test device.
4. Add lifecycle/recovery tests around app background/foreground transitions.
5. Measure battery and location continuity outdoors.
6. Implement iOS provider and repeat the same gates on real hardware.
7. Only after device proof, expose background-recording capability copy in the installed app.

## Merge rule

This slice may merge only as architecture/provider preparation. It must not be described as true background GPS. That claim requires a real native adapter plus real-device locked-screen evidence.
