# Supported Device & Accessibility Acceptance Matrix v1

## Status

Acceptance plan for supervised pilot evidence.

No device/browser is considered supported merely because CSS is responsive or an
automated test passes.

Record evidence against this matrix before a pilot/public-support statement.

## Device/browser matrix

| Environment | Launch | Navigation | Theme | Journey | Data backup | PWA/offline | Status |
|---|---|---|---|---|---|---|---|
| Android Chrome browser | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | N/A | NOT RUN |
| Android installed PWA | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| iPhone Safari | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | N/A | NOT RUN |
| iPhone Add to Home Screen | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Tablet ~768px | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | N/A | NOT RUN |
| Desktop modern browser | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | N/A | NOT RUN |

Allowed statuses:

- NOT RUN
- PASS
- PASS WITH ACCEPTED LIMITATION
- FAIL
- BLOCKED
- NOT APPLICABLE

## Core visual widths

At minimum inspect:

- 360
- 390
- 430
- 768
- 1024
- 1440

For each changed UI slice check:

- no horizontal overflow
- primary navigation is usable
- Settings/Data secondary routing works
- cards/forms do not clip
- text remains legible
- tappable controls remain comfortable
- light/dark/system theme is coherent
- background art does not obscure critical text

## Critical flows

### Today

- screen loads
- companion presentation does not overlap title/meta
- reduced motion behaves correctly
- activity controls are reachable
- external activity links are clearly external

### Week

- week cards/sections remain usable at mobile widths
- today state is visible
- collapsing/expanding sections remains understandable

### Journey

- Journey Home loads
- map mounts without colour-validation errors
- launch controls are understandable
- permission-denied states are clear
- active Journey controls are usable
- route privacy remains private by default
- no test fabricates GPS truth in production

### Progress

- measurements/summary remain readable
- units are correct
- charts/sparklines do not overflow

### Profile

- personal/baseline fields remain distinct from Settings
- editable fields remain labelled
- health notes are not reframed as diagnosis

### Settings

- Appearance is discoverable
- System / Light / Dark work
- Data is reachable
- About/build identity is readable where deployed
- app settings are not duplicated confusingly in Profile

### Data

- JSON backup action is prominent
- CSV is clearly not a backup
- restore consequences are explicit
- local-first/device-only wording is visible
- errors are understandable
- no update troubleshooting path instructs casual site-data clearing

## Accessibility matrix

| Check | Mobile | Desktop | Status |
|---|---|---|---|
| Visible keyboard focus | N/A | NOT RUN | NOT RUN |
| Keyboard reachability | N/A | NOT RUN | NOT RUN |
| Screen-reader labels for critical controls | NOT RUN | NOT RUN | NOT RUN |
| Text zoom / reflow | NOT RUN | NOT RUN | NOT RUN |
| Light-theme contrast | NOT RUN | NOT RUN | NOT RUN |
| Dark-theme contrast | NOT RUN | NOT RUN | NOT RUN |
| Reduced motion | NOT RUN | NOT RUN | NOT RUN |
| Touch target comfort | NOT RUN | N/A | NOT RUN |
| Errors not colour-only | NOT RUN | NOT RUN | NOT RUN |

## Keyboard acceptance

Desktop:

- tab order follows visual task order
- no focus trap in forms/cards
- buttons and links are operable
- hidden file input flow has a visible keyboard-operable trigger
- hash navigation does not dump focus somewhere confusing
- modals/confirmations, where present, return focus sensibly

## Screen-reader acceptance

Critical controls should expose an understandable name without needing nearby visual
context.

Check at minimum:

- primary navigation
- theme controls
- Data backup/export/restore actions
- Journey start/pause/resume/finish controls
- profile form fields
- account auth controls if pilot includes NinFit ID

Do not expose raw storage keys, opaque IDs or technical implementation detail as the
primary accessible label.

## Text zoom/reflow

At 200% browser text zoom where supported:

- no essential text is clipped
- actions remain visible
- two-column layouts collapse safely
- navigation remains usable
- no horizontal scrolling is required for ordinary reading

## Reduced motion

Verify OS/browser reduced-motion preference:

- ambient Tortoise idle does not play
- no new automatic decorative animation is introduced
- necessary state transitions remain understandable without motion

Reduced motion must not hide essential controls or truth.

## Contrast

Human-check critical text and action states in both light and dark themes.

Special attention:

- secondary/footnote text
- disabled buttons
- attention/warning cards
- map overlays
- selected theme controls
- navigation selected state

Automated contrast tooling can assist but is not the sole acceptance evidence.

## Touch targets

On phone:

- bottom navigation targets are comfortable
- Settings destination is easy to hit
- destructive/attention actions are not adjacent in a way that invites mis-taps
- restore confirmation is deliberate
- small icon-only controls have accessible labels and sufficient target area

## Error communication

A critical error must not rely only on colour.

Check:

- storage issues
- import failure
- auth failure
- Journey permission/location failure
- offline/update limitation

The user should be told what happened and what they can safely do next.

## Launch-summit H-A to H-K acceptance ledger

This table is the authoritative recording surface for the human gate defined in
`docs/LAUNCH_SUMMIT_2026-09-05.md` section 9.2. Automated tests, desktop responsive
emulation and screenshots from a different build do not satisfy these rows.

Every row must be exercised on one real iPhone and one real Android phone. Record the
exact build fingerprint used. Where the summit requires both themes, locked-screen
behaviour, airplane mode, or a deliberate media failure, perform that condition rather
than substituting a nearby test.

| Gate | Required behaviour | iPhone | Android | Build fingerprint(s) | Evidence / notes |
|---|---|---|---|---|---|
| H-A | Full hatch ceremony: one companion at all times; no ghost, watermark or cut-off gesture; check both themes | NOT RUN | NOT RUN | — | — |
| H-B | Reduced-motion hatch: three still states, Skip works, companion arrives | NOT RUN | NOT RUN | — | — |
| H-C | Force companion motion asset failure: standing fallback remains reachable and user is never trapped | NOT RUN | NOT RUN | — | — |
| H-D | Real 30-minute outdoor walk with screen locked: route drawn, distance sane, no unexplained gaps | NOT RUN | NOT RUN | — | — |
| H-E | Record battery drain across the same 30-minute walk | NOT RUN | NOT RUN | — | — |
| H-F | Cold launch in airplane mode: installed app boots and existing local data is visible | NOT RUN | NOT RUN | — | — |
| H-G | JSON backup → clear site data → restore: history returns and is verified by read-back | NOT RUN | NOT RUN | — | — |
| H-H | Adventure Map route line is visibly drawn on the real device GPU | NOT RUN | NOT RUN | — | — |
| H-I | VoiceOver / TalkBack: Today, Week, Journey start/stop, Settings → Data | NOT RUN | NOT RUN | — | — |
| H-J | Install to home screen, launch from icon, then update to a newer build without losing local data | NOT RUN | NOT RUN | — | — |
| H-K | Simulate a three-week absence by controlled clock/date change: no punishment, decay, catch-up debt or shaming copy anywhere | NOT RUN | NOT RUN | — | — |

### Gate evidence rules

For each H-gate record:

- device make/model
- OS version
- browser/WebKit/Chrome version where visible
- installed PWA / Add to Home Screen state
- NinFit version, channel and build fingerprint from Settings → About
- exact test condition used
- PASS / PASS WITH ACCEPTED LIMITATION / FAIL / BLOCKED
- screenshot, screen recording, battery screenshot or written observation as appropriate
- reviewer name and date

A gate is complete only when both required device cells have an accepted result. A
failure stays a failure until a later build is rerun; do not overwrite the old evidence
without recording the superseding build.

### H-D / H-E shared walk record

Use one record per device so distance and battery evidence are tied to the same real
session:

```
30-MINUTE WALK
date:
device:
OS/version:
NinFit build fingerprint:
start battery %:
end battery %:
battery delta percentage points:
start time:
finish time:
recorded duration:
recorded distance:
screen locked interval(s):
route visually continuous: yes/no
unexplained GPS gaps: yes/no
Adventure Map line visible: yes/no
evidence:
reviewer:
notes:
```

Do not manufacture a percentage-per-hour extrapolation as the primary result. Publish
the observed 30-minute battery delta first; any extrapolation must be clearly labelled
as an estimate.

### H-G destructive-test safety

H-G intentionally clears site data. Before performing it, create the JSON backup and
verify the file exists outside the app/device storage being cleared. Do not use a
valuable sole copy of real fitness history for this drill.

The pass condition is not merely that import reports success. Re-open representative
history after restore and verify the restored data by read-back.

### H-K clock-test safety

Use a controlled test profile/device state. Record the original device date/time and
restore automatic date/time immediately after the check. The pass condition is absence
of punishment or lost earned progress; it is not permission to mutate historical
fitness truth to make the UI look favourable.

## Pilot evidence record

For every real-device run, record:

```
DEVICE ACCEPTANCE
date:
device:
OS/version:
browser/version:
installed PWA: yes/no
build/channel:
build fingerprint:
flows checked:
accessibility checks:
failures:
accepted limitations:
screenshots/evidence:
reviewer:
```

## Support claim rule

Do not publish "supports Android and iPhone" as a blanket claim until both browser and
installed-PWA paths intended for support have recorded accepted evidence.

A successful 390px desktop-browser emulation is not the same thing as a real Android
or iPhone acceptance run.

## Non-goals

This matrix does not cover:

- Health Connect
- HealthKit
- native Capacitor packaging
- App Store / Play Store distribution
- wearable integrations
- cloud sync
- public social/location sharing


## Current mobile evidence note — 2026-09-01

Human screenshots from the canonical production site on Android Chrome confirm that the current deployed mobile baseline can launch and render the six primary destinations (Today / Week / Journey / Progress / Profile / Settings), that Settings exposes System / Light / Dark appearance controls, and that Data remains reachable inside Settings.

This evidence is **not** sufficient to mark the Android matrix row complete: Journey recording/GPS, an actual backup/restore drill, installed-PWA update/offline behaviour, reduced motion, keyboard/accessibility, and the remaining target widths still require their own recorded checks.
