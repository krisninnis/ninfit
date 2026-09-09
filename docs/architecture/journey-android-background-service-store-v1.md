# Journey Android background service/store v1

Status: architecture contract implemented in shared TypeScript; concrete Android service/store still pending.

## Goal

Keep an active NinFit Journey recoverable while the Android WebView is backgrounded or suspended, without letting the native layer become a second source of truth for distance, route trust, pause state or rewards.

## Ownership

The Android foreground location service owns only:

- obtaining raw location fixes from the selected native provider;
- assigning a monotonic Journey-scoped sequence number;
- durably committing each fix before attempting delivery to JavaScript;
- retaining unacknowledged fixes across WebView suspension and process restart;
- exposing ordered pending fixes to the injected `NativeJourneyDurablePositionQueue` bridge;
- deleting an acknowledged prefix only after JavaScript confirms processing;
- maintaining the ongoing Android notification required by the foreground location service.

The existing NinFit Journey domain remains authoritative for GPS acceptance, route segmentation, distance, auto-pause/resume, manual pause authority, completion, rewards and local Journey persistence.

## Durable wire envelope

Shared code now defines a versioned `NativeJourneyDurableStoreEnvelopeV1` with:

- `version: 1`
- `journeyId`
- `nextSequence`
- ordered `positions[]`

`nextSequence` survives even when the pending array is empty. A service restart therefore cannot reuse a sequence number that was already issued for the same Journey.

The parser fails closed on wrong Journey identity, unsupported schema version, malformed coordinates/accuracy/timestamps, sequence gaps, unsafe sequence values, oversized queues, or a `nextSequence` that would reuse an issued id.

## Write ordering

For each accepted OS/provider callback:

1. validate the basic native transport shape;
2. allocate `sequence = nextSequence`;
3. atomically persist the updated envelope locally;
4. only after the durable write succeeds, emit the fix to the JavaScript bridge if the WebView is available;
5. if JavaScript is unavailable, do nothing further: the durable suffix remains pending for foreground/startup reconciliation.

A failed durable write must not emit the fix as if it were safely retained.

## Replay and acknowledgement

JavaScript reads the pending suffix through `NativeJourneyDurablePositionQueue.readPending(journeyId)` and sends each fix through `JourneyMotionSession.processSample`.

Only after that processing returns successfully may native storage advance `acknowledgeThrough(journeyId, sequence)`.

This is intentionally at-least-once delivery. A crash after Journey processing but before acknowledgement may replay the same fix; the Journey GPS/motion runtime is already hardened against equal/older samples. Losing a suffix is worse than offering a duplicate.

## Atomicity requirement

The concrete Android store must make each append and acknowledgement transaction atomic. Suitable implementation directions include Room/SQLite or another crash-safe local database. Plain in-memory state is not acceptable for locked-screen acceptance.

No cloud transport is required or permitted by this contract.

## Capacity/failure policy

The shared contract caps one Journey queue at 10,000 pending positions. Native code must not silently drop the oldest fixes to make room. Capacity exhaustion is a provider/runtime failure that should leave the Journey recoverable and surface an error when JavaScript becomes available.

## Android foreground service contract

The concrete Android implementation must:

- start location tracking while the app is in an allowed foreground state;
- run as a location foreground service while background recording is active;
- show the NinFit ongoing notification;
- persist raw fixes before bridge delivery;
- continue collecting while the WebView is suspended, subject to OS permissions/policy;
- stop promptly when the Journey provider is quiesced or permanently stopped;
- never expose Pause/Finish actions on the lock screen in v1;
- keep exact route coordinates out of notification content.

## Locked-screen auto-pause caveat

Durable position buffering guarantees route recovery, but by itself it does not prove real-time auto-pause while JavaScript is suspended. The Samsung acceptance gate must verify whether the chosen Capacitor/background-location stack keeps Journey motion processing timely enough while locked. If it does not, native timestamped motion/pause evidence will need its own narrow durable contract rather than pretending replay later paused the clock in real time.

## Acceptance before claiming background GPS complete

Android background recording remains unproven until a real Samsung test shows:

- foreground service notification present;
- controls protected after screen lock/background;
- GPS fixes continue while locked;
- app can resume and reconcile without route loss or double-counting;
- manual Pause never auto-resumes;
- auto-pause/resume behaves correctly across the locked interval;
- Finish retains the final native suffix;
- restart/recovery does not silently discard pending fixes;
- acceptable accuracy and battery behaviour.
