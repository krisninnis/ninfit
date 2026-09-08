# Journey native shared completion replay gate

Temporary review-build marker only. Do not merge this review branch.

This gate verifies that Journey completion shares the same serialized durable native replay coordinator already owned by the active screen. If startup or foreground replay is in flight, Finish must join that drain rather than race a second native read/ack sequence. Queue cleanup and completed-history persistence remain ordered after successful replay.

No physical locked-screen/background GPS claim is made by this gate.
