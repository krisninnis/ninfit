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

The native adapter must preserve sequence numbers across process restarts. The replay consumer processes fixes serially and acknowledges only the successfully processed prefix. A failed fix and every later fix remain available for retry.

Replay is deliberately at-least-once: if Journey processing succeeds but transport acknowledgement is interrupted, that fix can arrive again. The trusted GPS runtime already rejects non-forward route samples. Auto-pause/resume motion evidence now also records the last reliable evidence timestamp and ignores equal/older evidence. This is essential because a duplicate movement fix must not count twice toward the two-fix auto-resume threshold.

Legacy/recovered auto-pause state without the new evidence timestamp remains supported; once it consumes its first new reliable fix, forward-time replay protection is established.

## Current implementation boundary

The TypeScript Journey buffer, ordered replay consumer and replay-through-motion-session path are implemented. The remaining production step is a concrete native process-level store behind the Capacitor/background-location layer so fixes remain durable even when the WebView or app process is suspended.

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
