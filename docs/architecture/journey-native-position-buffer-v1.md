# Journey native position buffer v1

## Purpose

A native Android/iOS location service can outlive the React WebView. A position must not disappear merely because the WebView is suspended, killed, or restarting.

This buffer defines the durable handoff contract between the native location service and NinFit's existing trusted Journey GPS runtime.

## Contract

1. The native service records a monotonically increasing sequence number for each fix within the active Journey.
2. The fix is durably appended before delivery to the WebView/runtime.
3. On foreground/resume, pending fixes are replayed in sequence order.
4. NinFit acknowledges a sequence only after the existing trusted-GPS runtime has processed that fix.
5. A crash before acknowledgement causes at-least-once replay, not silent data loss.
6. Completion/cancel cleanup clears only the matching Journey buffer.
7. A buffer is scoped by Journey id; fixes must never cross Journey boundaries.

## Authority boundary

The buffer is transport durability only. It must not:

- decide whether a GPS fix is trusted;
- add distance;
- create route segments;
- pause or resume a Journey;
- award rewards;
- rewrite Journey history.

Those remain owned by the existing Journey domain/runtime.

## Replay and duplicate safety

The concrete native adapter must preserve sequence numbers across process restarts. The WebView replay consumer must process fixes serially and acknowledge only the successfully processed prefix. The next implementation slice will add the replay consumer and durable native storage adapter; the current TypeScript buffer establishes and tests the contract first.

## Privacy and lifecycle

Only location fixes belonging to the active Journey may be buffered. No background collection is permitted when no Journey is recording/auto-paused. The native service must stop and the buffer must be cleared after completion/cancel once the final accepted fixes are reconciled.

## Acceptance gate

Real Android proof remains required before claiming background GPS complete:

- start a Journey;
- lock the physical phone for more than one minute;
- move while locked;
- unlock and verify ordered route/distance continuity;
- stand still long enough for the 5-second auto-pause candidate to engage;
- move and verify automatic resume;
- verify manual pause never auto-resumes.
