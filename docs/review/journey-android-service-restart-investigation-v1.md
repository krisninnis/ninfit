# Journey Android service restart investigation v1

Status: investigation scaffold only.

Real-device Samsung acceptance on 2026-09-10 showed that an active Journey could remain logically `Recording` in the WebView while the NinFit foreground-service notification disappeared and GPS returned to `connecting` after a screen-off interval. This document records the defect boundary; it is not acceptance evidence.

The implementation at the stable review APK head uses `START_REDELIVER_INTENT` for the start command and also returns it for status updates. Because status updates are sent repeatedly, the last redeliverable intent can be `ACTION_STATUS`. If Android recreates the service after process/service loss, the new instance has no in-memory `activeJourneyId`; redelivery of a status intent is therefore ignored and the service returns non-sticky without re-establishing foreground location capture.

Required fix properties:

- explicit Start/Stop remains the only authority for beginning/ending a Journey;
- restart state is persisted only after foreground location capture starts successfully;
- explicit Stop clears restart authority before the service is torn down;
- Android service recreation can restore the same Journey and foreground notification without the WebView;
- status-summary persistence contains no coordinates;
- stale status for another Journey cannot start or mutate capture;
- no background-location permission is added;
- route/distance/trust/auto-pause remain JavaScript domain responsibilities;
- physical Samsung screen-off GPS and notification acceptance remains required after CI.
