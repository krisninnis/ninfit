# Journey native durable live wiring gate v3

Temporary review-build marker only. Do not merge this review branch.

This rerun follows correction of a test-only TypeScript narrowing issue in the replay coordinator test. Product behavior is unchanged: live Journey sessions select the runtime native provider, native durable fixes reconcile on start and foreground, native backgrounding protects controls, and browser/PWA remains the safe fallback.
