# Journey native durable live wiring gate v2

Temporary review-build marker only. Do not merge this review branch.

This rerun follows the source-contract refresh after #258 exposed only an outdated assertion shape. Product behavior remains: native backgrounding locks Journey controls, foregrounding never unlocks them, and foregrounding reconciles any durable native GPS fixes collected while the WebView was suspended.
