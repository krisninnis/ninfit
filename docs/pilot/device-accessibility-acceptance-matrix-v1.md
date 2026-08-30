# Supported Device & Accessibility Acceptance Matrix v1

## Status

Acceptance plan for supervised pilot evidence.

No device/browser is considered supported merely because CSS is responsive or an
automated test passes.

## Principle

NinFit should claim only the environments that have actually been exercised.

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
