# Journey location provider boundary v1

## Purpose

Journey recording must keep one trusted domain/runtime pipeline while allowing different platforms to supply location evidence.

The provider boundary exists below Journey GPS quality gating and persistence. Providers emit samples and normalised errors only; they do not mutate Journey state, distance, route continuity, recovery state, rewards, or privacy.

## Current browser provider

The browser implementation wraps `navigator.geolocation.watchPosition` through the existing geolocation adapter.

It declares `supportsBackground: false` deliberately. A browser wake lock can help keep the screen awake while the page is visible, but it is not a guarantee that GPS collection continues after Android/iOS locks or suspends the browser tab.

Therefore NinFit must not claim locked-screen or true background GPS support while browser geolocation is the active provider.

## Future native providers

The same `JourneyLocationProvider` contract is intended for:

- Android native/background location
- iOS native/background location

A native provider may declare background capability only when its platform implementation, permissions and lifecycle genuinely support it.

Native providers should deliver `JourneyGpsSample` values into the existing Journey runtime. They must not bypass:

- GPS accuracy/timestamp acceptance
- impossible-speed filtering
- observation-continuity segmentation
- authoritative distance accumulation
- active Journey recovery persistence
- manual pause intent
- disclosure/privacy rules

## Lifecycle

A provider exposes `start(callbacks)` and returns a session with idempotent `stop()` semantics.

Provider startup failure is reported as a normalised provider error. The application decides how that affects UI and recording state. The provider itself never completes, pauses or mutates a Journey.

## Errors

The boundary currently normalises these categories:

- permission denied
- position unavailable
- timeout
- provider error

Platform-specific native errors should be translated into these categories where possible while preserving the original cause for diagnostics.

## Auto-pause relationship

Auto-pause consumes trusted motion evidence above the provider boundary.

Manual Pause remains authoritative. A Journey manually paused by the user must never auto-resume merely because a location provider reports movement.

Automatic stationary pause/resume provenance must remain recoverable across reload if it is wired into persistent recorder state.

## Privacy

Location evidence remains local-first. Provider choice must not imply cloud upload.

The owner may view their own private saved route. Disclosure/share behaviour remains a separate privacy decision.

## Battery and permissions

High-accuracy and background location can increase battery usage. Native Android/iOS work must include explicit permission UX and platform-appropriate background indicators before background capability is considered production-ready.

## Remaining work

1. Route live Journey recording through the provider interface instead of directly through browser geolocation.
2. Integrate trusted stationary auto-pause/resume with explicit manual-vs-automatic provenance.
3. Prove recovery/reload semantics for auto-paused Journeys.
4. Add Android native provider implementation and real locked-screen outdoor verification.
5. Add iOS native provider implementation and equivalent lifecycle/permission verification.
