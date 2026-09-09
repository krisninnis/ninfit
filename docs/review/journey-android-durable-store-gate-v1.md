# Journey Android durable store gate v1

Review target only. Do not merge independently from the existing stacked Journey native PR chain.

Verify that the new native durable store wire contract:

- preserves a monotonic Journey-scoped sequence across acknowledgements/restarts;
- fails closed on malformed or mismatched envelopes;
- refuses sequence gaps and sequence reuse;
- keeps append-before-delivery and acknowledge-after-processing semantics explicit;
- caps pending positions without silent oldest-item eviction;
- remains transport-only, leaving GPS trust/distance/pause/reward ownership in Journey domain code;
- documents Android foreground-service/store responsibilities without claiming real locked-screen proof;
- keeps browser/PWA behaviour unchanged.
