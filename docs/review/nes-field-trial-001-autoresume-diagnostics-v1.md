# NES Field Trial 001 — Journey auto-resume diagnostics v1

## Claim under investigation

On the Samsung acceptance device, a Journey that entered stationary auto-pause did not automatically return to recording after substantial real-world outdoor movement.

Root cause remains unknown.

## Diagnostic question

At which boundary does expected movement evidence disappear or become insufficient?

1. Android native capture
2. durable queue / acknowledgement
3. JavaScript replay into JourneyMotionSession.processSample
4. auto-pause detector classification

## Safety constraints

- Diagnostic evidence must not change Journey pause/resume behaviour.
- Do not change the 5 s stationary window, 4 m stationary radius, 20 m motion-accuracy ceiling, 6 m resume distance, or two-confirmation requirement during evidence collection.
- Do not change the review signing identity.
- Do not retain latitude, longitude, route geometry, or absolute timestamps in the diagnostic snapshot.
- Do not merge this field-trial branch before its diagnostic-only behaviour is verified.

## Prediction

Boundary instrumentation will distinguish capture failure, durable transport/replay failure, and detector/classification failure without changing the behaviour being investigated.

## Evidence already established

The auto-pause detector continues to evaluate samples while auto-paused and requires two reliable fixes at least 6 m from its stationary anchor to emit auto_resume. The installed Android service provider emits no direct samples; durable replay is the intended route into JourneyMotionSession.processSample.

## Current implementation status

A privacy-safe detector evidence collector and observation-only tests exist on `diagnostic/journey-autoresume-evidence-v1`. Runtime wiring is intentionally separate so each behavioural boundary can be reviewed and verified before the Samsung field trial.
