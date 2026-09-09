# Journey native terminal reconciliation gate v1

This slice closes a race at Journey terminal boundaries.

Before manual pause/finish/leave can transition recorder state, the installed native path must be able to stop new provider callbacks and drain the already-durable native suffix through `JourneyMotionSession.processSample`. Only after that reconciliation may the caller perform the terminal Journey transition and permanently stop the session.

Browser/PWA remains safe: with no injected native durable queue, the provider is quiesced and no replay is attempted.

This does not claim native background GPS is complete. Concrete Android/iOS durable storage and physical Samsung lock-screen proof remain required.
