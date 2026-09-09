# Journey native lock-screen status v1

## Goal

When an active Journey is running and the user wakes their phone, NinFit should present a calm native system status surface before the user opens the app. The visual direction is the **NF mark** with a compact Journey summary.

This does **not** replace Android/iOS authentication or imitate the system lock screen. It uses the platform's supported ongoing-notification / lock-screen presentation mechanisms.

## Summary model

The native surface may receive only:

- NF brand mark and `NinFit Journey` title;
- activity label such as Walk, Run or Cycle;
- Recording / Auto-paused / Paused state;
- active seconds;
- distance in metres.

The contract explicitly excludes exact coordinates, route geometry and route maps. A person glancing at the phone should not learn where the Journey started, where the user currently is, or the exact path they took.

## Controls

No Pause or Finish action is exposed from the locked system surface in v1. Those remain inside the unlocked NinFit UI, where the existing control lock and durable reconciliation rules apply. Tapping the native surface may open NinFit after normal device authentication.

## Android direction

Use the foreground location service's ongoing notification as the primary surface, with the NF notification icon and Journey summary. The real Android adapter must respect Android notification/channel requirements and must not claim a custom full lock-screen replacement.

## iOS direction

Use the equivalent supported native surface (Live Activity / lock-screen activity presentation where appropriate). The same privacy-safe summary contract applies.

## Current implementation boundary

Implemented now:

- privacy-safe `JourneyNativeLockScreenStatus` model;
- NF branding choice;
- no-route/no-coordinate contract;
- no terminal lock-screen controls;
- dependency-free injected `NativeJourneyLockScreenBridge` with web/PWA null fallback and contained native failures.

Not implemented yet:

- concrete Android notification adapter;
- concrete iOS Live Activity adapter;
- platform artwork/icon packaging;
- real-device visual proof.
