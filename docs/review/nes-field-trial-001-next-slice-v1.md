# NES Field Trial 001 — next slice

After review-base ancestry is established, wire the existing privacy-safe collector into the auto-paused sample path only. The wiring must observe the detector's already-computed evaluation and must not influence detector input, policy, state transition, recovery, persistence, provider lifecycle, or durable acknowledgement.

Before a Samsung walk, add evidence at the durable replay boundary so a single local snapshot can distinguish: native capture absent; durable samples present but not replayed; replayed samples reaching the motion session; and detector rejection/confirmation.
