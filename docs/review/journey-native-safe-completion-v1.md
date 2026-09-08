# Journey native safe completion gate

Temporary review-build marker only. Do not merge this review branch.

This gate verifies the completion boundary needed before native background GPS can safely ship: quiesce new provider callbacks, replay the durable native suffix through the existing trusted Journey motion path, clear the matching native queue only after successful replay, and persist completion only after that reconciliation. Replay failure must leave the active Journey recoverable rather than silently dropping native fixes.

No physical locked-screen/background GPS claim is made by this gate.
