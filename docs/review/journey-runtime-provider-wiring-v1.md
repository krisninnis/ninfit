# Journey runtime provider wiring gate

Temporary review-build marker only. Do not merge this review branch.

This gate verifies that a live `JourneyMotionSession` without an explicitly injected provider resolves its provider through the runtime registry. A startup-installed Android/iOS native bridge must therefore become the live provider; ordinary browser/PWA execution continues to use the browser fallback.

The test also proves a sample delivered by the installed native bridge reaches the existing trusted Journey motion path and that session stop reaches the native provider session.

No physical locked-screen/background GPS claim is made by this gate.
