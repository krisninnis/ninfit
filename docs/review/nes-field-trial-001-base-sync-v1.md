# NES Field Trial 001 — review-base sync evidence

The diagnostic branch was created from review head `82092cc6f23e6ff8e40cead1d58d39519ed1e18d`.

The review branch subsequently advanced to `e0384df53f3b2a9c7f03791f55edbdaf986dde4f` by three commits. Comparison established that those commits changed verification/signing contracts and documentation only; they did not change Journey runtime, Android location capture, durable replay, or auto-pause policy.

This record exists to preserve the provenance decision before runtime diagnostic wiring. It does not assert that the diagnostic branch has been rebased or merged with the newer review head; that must be established from the Git graph itself.
