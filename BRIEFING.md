# Long-term product and technical briefing

**Status:** research only. Nothing here is approved, and nothing here is implemented.
**Scope guard:** v0.1 remains exactly as agreed. This document exists to stop us
making a v0.1 decision that quietly closes a door later.

**Headline:** almost nothing in this list is blocked by our current architecture,
because our architecture is mostly a *domain layer* and a *React UI*. What is blocked
is the delivery vehicle: a PWA cannot read HealthKit, cannot read Health Connect, and
cannot reliably control the camera torch on iOS. That is a packaging problem, solvable
later with Capacitor, not a rewrite.

---

## 1. What leading fitness apps do particularly well that is relevant to us

**Oura - the baseline framing.** Oura's most transferable idea is not its readiness
score, it is that every number is shown *relative to your own recent normal* rather
than to a population norm. "Your resting heart rate is 4 bpm above your 14-day
average" is useful and honest. "Your resting heart rate is 72" is neither.

**Garmin and Oura - the honest-uncertainty pattern.** Both suppress or caveat scores
when the underlying data is thin (not enough sleep captured, sensor off-wrist). They
degrade gracefully rather than inventing a number. This matches our
"missing stays missing" rule exactly.

**Apple Fitness - progressive disclosure.** One glanceable summary; detail only if you
tap. Our Today screen already assumes this.

**Strava - the effort/outcome separation.** A slow run is still a logged run. Strava
never retroactively downgrades an activity because it went badly. This is the same
principle you already insisted on for completion versus symptoms.

**Nike Training Club - the session as a unit.** A workout is a titled, timed thing
with instructions, not a free-text blob. That is a small data-model idea with a large
usability payoff, and it is a cheap extension of our existing `PlannedActivity`.

**MyFitnessPal - the thing it gets right despite everything.** Barcode-and-recent-meals
shortcuts. The lesson is not "log food", it is "make the 90% case two taps". Its
failure mode is the opposite: full macro logging is so laborious that people quit,
which is precisely why you excluded calorie counting from v0.1.

**Fitbit/Google Health - passive capture.** The single biggest retention feature in
this whole category is that steps arrive without you doing anything. Manual step entry
is the most likely field for you to abandon first.

## 2. Concepts we should adopt

- Comparison against **your own rolling baseline**, never a population norm.
- **Graceful degradation**: show "not enough data yet" rather than a number built from
  two readings.
- **Passive capture wherever possible**, with manual entry always available as a peer,
  not a fallback.
- **Session-as-an-object** for guided workouts (title, duration, instructions, optional
  link).
- **Two-tap common cases** in nutrition; free text for everything else.
- **Provenance on every value**, so "you walked 6,000 steps" can always answer "says
  who?".
- **Separate the observation from the interpretation.** Store the number; let the
  screen decide what, if anything, to say about it.

## 3. Concepts we should deliberately avoid

- **Readiness/recovery scores as a single number.** Every vendor's is proprietary,
  unvalidated in public, and invites exactly the medical-sounding overreach you ruled
  out. We can show the inputs longitudinally without ever collapsing them into a score.
- **Streaks and rings that break.** Directly conflicts with a back condition where
  skipping a day is often the correct decision.
- **Leaderboards, social feeds, kudos.** No.
- **Red failure states.** Already enforced at the CSS token level - the palette has no
  red in it.
- **Auto-progression of training load from a metric.** This is the single most dangerous
  feature in the category for someone with a prolapsed disc history.
- **Retroactive downgrading** of a completed session because the outcome was poor.
- **Sleep staging.** Consumer sleep-stage data is weakly validated; duration and
  consistency are the parts worth trusting.

---

## 4. Phone step-count feasibility

Three sources, in ascending order of usefulness:

1. **Web accelerometer step counting** (`DeviceMotionEvent` / Generic Sensor API).
   Technically possible, practically useless: it only counts while the page is open and
   awake, iOS requires a user gesture to grant motion access, and background execution
   is not available. Not worth building.
2. **Health Connect on-device step counting** (Android). Health Connect itself records
   steps from the hardware `TYPE_STEP_COUNTER` sensor, batched roughly once a minute,
   and this recording activates as soon as any app has been granted `READ_STEPS`. So on
   Android we do not need to build step counting at all - we need to *read* it.
3. **HealthKit** (iOS). The iPhone's motion coprocessor already counts steps into the
   Health store continuously. Again: read, do not build.

**Conclusion:** we should never write a step counter. We should write a *reader*, and
only inside a native shell. Manual entry remains a first-class input.

## 5. Health Connect feasibility (Android)

**Can we read steps?** Yes. `READ_STEPS` permission, `StepsRecord`. Google's own
guidance is to use `aggregate()` rather than `readRecords()` for cumulative types,
because the aggregation API contains the deduplication logic that stops the same steps
being counted twice when several apps write them. That matters to us directly: if he
has a Fitbit *and* the phone, both write steps.

**Availability.** Health Connect requires Android 9 (API 28) or higher with Play
Services; the SDK targets API 26+. From **Android 14 (API 34) it is part of the Android
framework** and cannot be uninstalled. On-device step recording additionally needs
Android 14 with SDK Extension version 20 or higher.

**History.** By default an app reads only the **30 days before permission was first
granted**. On Android 14+ there is no historical limit on reading *your own* written
data, but the 30-day limit still applies to other apps' data. Removing it requires
`PERMISSION_READ_HEALTH_DATA_HISTORY`. Note the sharp edge: uninstalling the app
revokes everything and restarts the 30-day window from the reinstall date. Our own
JSON export is therefore still the real archive.

**Background.** Possible, with `READ_HEALTH_DATA_IN_BACKGROUND` plus a feature-status
check, typically driven from a periodic `WorkManager` job.

**Third-party flow-through.** Yes - this is the whole point of Health Connect. Fitbit,
Samsung Health, Strava and others write into it, and we read one merged store instead
of integrating with each.

**Attribution and dedup.** Every record carries a `DataOrigin` (package name) and
`metadata.device`. Worth flagging as current news: since the **June 2026 Health Connect
update**, on-device steps are attributed to a device-specific *Synthetic Package Name*
rather than the old `android` package, and the SPN differs per reading app, so it must
be fetched via `getCurrentDeviceDataSource()` and never hardcoded. Any provenance model
we design must treat the source identifier as an opaque string.

**Can our PWA read it directly?** **No.** There is no web API. It is an Android
IPC/AIDL surface reached through the Jetpack SDK.

**Native wrapper required?** **Yes** - but a Capacitor shell is sufficient. We do not
need a rewritten native app.

## 6. HealthKit feasibility (iOS)

**Reading steps.** `HKQuantityTypeIdentifierStepCount`, via `HKStatisticsQuery` or
`HKStatisticsCollectionQuery` for daily buckets. Permissions are per-data-type and
per-direction, declared with usage-description strings, and - importantly - **iOS never
tells you whether read permission was denied**, to avoid leaking health information.
Absence of data and refusal of data are indistinguishable. Our "missing stays missing"
rule handles that correctly by accident, which is reassuring.

**Apple Watch and third-party wearables.** They appear as additional sources within the
same Health store, so the read code is identical. Apple already applies its own
deduplication for step counts across iPhone and Watch.

**Can a PWA access HealthKit?** **No**, categorically, and there is no sign of this
changing. There is no HealthKit JavaScript surface, and Apple's model requires access to
happen on-device inside an entitled native app. You also cannot pull it server-side.

**Native app or wrapper required?** **Yes.** A Capacitor shell with a HealthKit plugin
qualifies; a plain PWA never will.

## 7. Fitbit and wearable integration strategy

**Recommendation: platform aggregation first, vendor APIs effectively never.**

The direct-vendor route is worse than it looks right now:

- **Fitbit.** The legacy Fitbit Web API is being decommissioned, with data sync
  stopping around **30 September 2026** as it transitions to the Google Health API.
  Anything we built against the old API this year would already be dead. This is
  happening within weeks.
- **Garmin.** The Garmin Connect Developer Program is **currently on hold and not
  accepting new developer accounts**, and commercial use carries a licence fee. We
  cannot rely on it even if we wanted to.
- **Samsung.** Requires a Samsung developer account, an Android app, and their
  permission flow - all of which presupposes the native shell anyway.
- **Oura.** A personal access token is straightforward for a single user, but it is one
  more OAuth integration, one more secret to store, and one more API to track.

Every one of those needs a server or a stored secret, which breaks our local-first,
no-account principle. By contrast, Health Connect and HealthKit give us steps, heart
rate, resting heart rate, HRV, sleep, workouts, active minutes and distance through a
**single read interface per platform**, with the vendor integration problem delegated
to Google and Apple.

The only case for a direct vendor API is a device that refuses to write to the platform
store. That is a per-device problem to solve if it ever bites, not an architecture to
design for now.

**Aggregator services** (Terra, Rook, Thryve, Validic) solve the fan-out problem
commercially, but they require sending health data to a third party and paying per user.
For a single-user personal tool that is a poor trade. Revisit only if this becomes a
product with real users.

## 8. Camera pulse-checker feasibility

**Does the science work?** Yes, better than you might expect. Fingertip PPG via a phone
camera has been validated against 12-lead ECG with correlation r=0.997 and RMSE around
**1.03 bpm at rest** - and, notably, fingertip performs clearly better than face-based
PPG. So the concept is sound. Heart *rate* is a genuinely tractable measurement.

**Does the platform work?** This is where it falls down.

- **Torch control is not available on iOS.** Safari does not implement the ImageCapture
  API on iOS or macOS, and torch is a device-gated capability that must be advertised
  by the camera driver and applied via `applyConstraints()`. On Android Chrome this
  works; on iOS Safari it does not. Without the torch, fingertip PPG relies on ambient
  light bleeding through the finger, and the signal quality collapses.
- **iOS PWA camera access is historically fragile.** `getUserMedia` in home-screen
  standalone mode has a long history of WebKit regressions, permissions not persisting
  between launches, and repeated re-prompting. Building a health measurement on that
  foundation is asking for a feature that mysteriously breaks every few iOS releases.
- **Frame rate and timing.** We need a stable 30 fps and, more importantly, accurate
  per-frame timestamps. Browsers throttle background tabs and vary frame delivery, so
  timestamps must come from `requestVideoFrameCallback`, not from assuming a fixed
  interval.

**Verdict: not suitable for our current web/PWA architecture. Defer until a native
shell exists, and even then treat it as experimental.**

Two further points worth making plainly:

1. **Camera PPG cannot give us HRV.** HRV needs beat-to-beat interval accuracy in the
   low-milliseconds range. Camera PPG at 30 fps has a floor of about 33 ms per frame,
   which is the same order of magnitude as the differences we would be trying to
   measure. We should support camera PPG for **heart rate only** and never let it
   populate an HRV field.
2. **The feature may not be worth building at all.** If he ends up with any wearable, it
   will measure resting heart rate more accurately, continuously, and with no effort.
   Camera PPG's real niche is "no wearable, wants an occasional spot reading".

**Signal pipeline, if we ever build it** (recorded here so the research is not lost):
rear camera via `getUserMedia({ video: { facingMode: { exact: 'environment' } } })`;
check `track.getCapabilities().torch` before attempting `applyConstraints({ advanced:
[{ torch: true }] })`; sample the mean **red** channel over a centre region of each
frame - red dominates for transmissive fingertip PPG, whereas green is the right choice
for reflective face PPG; detrend, band-pass roughly 0.7-3.5 Hz (42-210 bpm), then peak
detect with a refractory period; require **at least 20-30 seconds**, discard the first
few seconds while exposure settles; detect finger placement by requiring high mean red
with low green/blue and low spatial variance; score quality from inter-beat-interval
consistency and signal-to-noise, and reject motion artefacts by frame-to-frame intensity
jumps.

## 9. Web/PWA limitations, summarised

| Capability | PWA today | Notes |
|---|---|---|
| Health Connect | **No** | No web surface at all |
| HealthKit | **No** | Native-only by design |
| Background step counting | **No** | No background execution |
| Camera (foreground) | Yes, with caveats | iOS standalone mode historically flaky |
| Torch/flash | Android only | Not exposed on iOS Safari |
| Local storage | Yes | Subject to iOS eviction; export is the real backup |
| Install to home screen | Yes | Already planned |
| Notifications | Android yes; iOS 16.4+ yes | Requires home-screen install on iOS |
| Background sync | Android partial | Not on iOS |

**Everything in v0.1 is comfortably within PWA capability.** Nothing we are building
now is compromised.

## 10. Will Capacitor or native become necessary?

**Yes - necessary, and specifically Capacitor.**

The moment we want steps read automatically, the PWA is disqualified on both platforms.
There is no partial credit and no workaround.

Comparing the options:

| Option | React reused | Domain reused | Health access | Verdict |
|---|---|---|---|---|
| Stay a PWA | 100% | 100% | None | Fine until we want passive data |
| **Capacitor wrapper** | **~100%** | **100%** | **Full, via plugins** | **Recommended** |
| React Native | 0% (UI rewritten) | 100% | Full | Throws away UI work for no gain |
| Separate native apps | 0% | 0% (reimplemented twice) | Full | Two codebases, worst option |

Capacitor keeps the same Vite/React build output, adds an Android and iOS shell around
it, and exposes native APIs through TypeScript plugins. Maintained community plugins
already cover exactly what we need - a unified Health Connect/HealthKit plugin exists
and reads steps, distance, heart rate and weight through one TypeScript interface. The
same shell also solves camera/torch control and notifications.

Crucially, **a Capacitor app can be built from the same repository we are building
now**, and the PWA can continue to exist alongside it. This is additive, not a
migration. The one real cost is that iOS distribution needs an Apple Developer account
(around 79 GBP/99 USD a year) - relevant even for personal use, though a free
seven-day-resigning development install is possible for a single device.

**This is why the domain layer being pure TypeScript with no React or storage imports
matters.** It is already the portable core. We designed for this without needing to.

---

## 11. Proposed data-model changes to make now

The honest position first: **optional fields can always be added later without a
migration**, so very little is genuinely urgent. I am recommending only changes that
either (a) stabilise the *export envelope shape*, or (b) prevent us building the wrong
mental model into code we are about to write.

### 11.1 The active/passive split (the important one)

Do **not** try to make `DailyLog` carry device data. `DailyLog` is a journal: one entry
per local calendar day, written by a person. Device data is timestamped, arrives many
times a day, and is owned by a source. Forcing them together is the mistake that would
be expensive to undo.

Proposed structure:

```ts
// What the user says. One per local day. Implicitly manual by definition.
DailyLog        -> unchanged

// What was observed. Append-only, timestamped, multi-per-day, always attributed.
MetricSample    -> new, reserved now, populated from v0.4 onward
```

```ts
export type SourceType =
  | 'manual'          // typed by the user
  | 'phone_sensor'    // device motion / pedometer
  | 'health_connect'  // Android platform store
  | 'healthkit'       // Apple platform store
  | 'wearable'        // direct vendor API, if ever
  | 'camera_ppg'      // experimental measurement
  | 'imported'        // from a file
  | 'derived';        // computed by us from other values

export interface DataSource {
  sourceType: SourceType;
  /** Opaque. Package name, bundle id or synthetic package name. Never parsed. */
  sourceApp?: string;
  sourceDevice?: string;        // "Pixel 8", "Apple Watch Series 9"
  /** Vendor's own record id, so a re-sync updates rather than duplicates. */
  externalId?: string;
  measuredAt?: ISODateTime;     // when the world was observed
  importedAt?: ISODateTime;     // when it entered our store
}

export type MetricKind =
  | 'steps' | 'heart_rate' | 'resting_heart_rate' | 'hrv'
  | 'sleep_duration' | 'active_minutes' | 'distance_metres'
  | 'weight_kg' | 'waist_cm';

export interface MetricSample {
  id: UUID;
  kind: MetricKind;
  value: number;
  unit: string;                 // explicit; never inferred from `kind`
  /** Local day it belongs to, for joining against DailyLog. */
  date: ISODate;
  startAt?: ISODateTime;        // sub-daily samples
  endAt?: ISODateTime;
  source: DataSource;
  /** 0-1. Only meaningful for experimental sources. */
  confidence?: number;
}
```

**Recommended concrete change to Step 2:** add these types to `types.ts` and add
`metricSamples: MetricSample[]` to `AppData`, seeded as `[]`. No logic, no collection,
no UI. The benefit is that **every v0.1 export already has the final envelope shape**,
so a future AI pipeline or import never has to special-case a missing array. Cost is
roughly 40 lines of type declarations and one empty array.

### 11.2 Reconciliation rule, stated now

When the same day has both a manual entry and a device sample:

- **Never overwrite what the user typed.** The manual value is a fact about what they
  said, and it stays.
- **Display precedence** for device-observable metrics: device sample > manual entry,
  with the source shown next to the number.
- **Aggregates should state which they used.**

This also means the current `summariseProgress` precedence (measurement > recovery log >
baseline) is a **provisional rule for an all-manual world** and should be redefined in
terms of provenance later. Worth a comment in the code now so nobody mistakes it for a
considered position on device data.

### 11.3 `Measurement` needs a clarifying comment, not a change

`Measurement` is date-keyed with no time and no source. That is correct for "I got the
tape measure out on Sunday" and wrong for device data. Document it as manual-only so
nobody later dumps wearable heart rate into it.

### 11.4 Reserved shapes, defined but NOT added yet

```ts
// v0.3+, only if a native shell exists.
export interface PulseMeasurement {
  id: UUID;
  measuredAt: ISODateTime;
  date: ISODate;
  bpm: number;
  durationSeconds: number;
  /** 0-1 from IBI consistency and SNR. */
  signalQuality: number;
  confidence: 'low' | 'medium' | 'high';
  source: DataSource;           // sourceType: 'camera_ppg'
  platform?: string;            // browser/OS, for debugging accuracy
  torchUsed?: boolean;
  /** The user explicitly kept it. Nothing is saved silently. */
  acceptedByUser: boolean;
  /** Only true readings may become canonical. */
  promotedToMetricSample: boolean;
}
```

**Rule:** a `PulseMeasurement` never becomes a canonical heart-rate value unless
`signalQuality` clears a defined threshold **and** `acceptedByUser === true`. Poor
readings are shown, explained, and offered a retry - never silently stored as truth.
And it may never populate an HRV field.

Guided workouts and nutrition both extend by **optional fields only**, so they need no
action now:

```ts
// PlannedActivity, later: instructions?, videoUrl?, equipment?, targetReps?
// NutritionLog, later:  proteinGrams?, fibreGrams?, meals?: MealEntry[],
//                       calorieTrackingEnabled? (opt-in, off by default)
```

### 11.5 One timezone rule to write down now

Health Connect and HealthKit both aggregate over *instants*. Our day keys are *local
calendar days*. Any future provider must convert "local day X" into an instant range
using the local offset for that day, not UTC midnight. Our `dates.ts` already anchors
correctly, so this is a note for the adapter, not a defect.

### 11.6 The port, defined in the domain; adapters outside it

```ts
export interface ActivityDataProvider {
  readonly sourceType: SourceType;
  isAvailable(): Promise<boolean>;
  requestPermissions(kinds: MetricKind[]): Promise<PermissionResult>;
  readDailyTotals(kind: MetricKind, from: ISODate, to: ISODate): Promise<MetricSample[]>;
}
```

`ManualActivityProvider`, `HealthConnectProvider`, `HealthKitProvider`. The **interface**
belongs in the domain; the **implementations** must live outside it, in a `providers/`
directory, because they touch platform APIs. The domain must stay free of anything that
cannot run in a plain Node test.

---

## 12. Proposed roadmap

I would not accept the tentative numbering. Camera PPG at v0.3 is the highest technical
risk and the lowest certain value in the whole list, and it is blocked on native work
that is scheduled after it. Sequenced by (value / effort), risk, and unblocking:

| Phase | Content | Why here |
|---|---|---|
| **v0.1** | Current manual tracker, end to end | Unchanged |
| **v0.2** | Progress visuals, editable programmes, week 2+, guided-workout links | Pure web. No platform risk. Highest value per unit of effort, and it is what makes daily use stick |
| **v0.3** | Data hardening: provenance in anger, richer nutrition/hydration, CSV/JSON round-trip proven over months of real data | Cheap, and it is the foundation everything later reads from |
| **v0.4** | **Capacitor shell** + automatic steps on whichever platform he actually uses | The single biggest reduction in daily friction. Unblocks everything below |
| **v0.5** | The second platform's health integration | Only if he changes phone or wants both |
| **v0.6** | Passive resting HR, HRV and sleep from the platform store; recovery *dashboard* showing inputs against personal baseline - still no score | Free once v0.4 exists: same read interface, more data types |
| **v0.7** | Camera pulse measurement, experimental, native-only, quality-gated | Now cheap, because the native shell already exists. May be dropped entirely if a wearable is in play |
| **Later** | Cautious adaptive suggestions, and only if the medical boundary in section 14 is properly thought through | Highest risk item in the product. Deserves its own decision, not a version number |

**One input changes this ordering, and I do not have it: which phone do you actually
carry?** If it is Android, v0.4 is Health Connect and is comparatively easy - the OS is
already counting your steps and Health Connect is built into Android 14+. If it is an
iPhone, v0.4 means an Apple Developer account and a heavier build. Worth answering
before we commit to the sequence.

## 13. Security and privacy implications

- **Today we hold health data with no account, no server and no transmission.** That is
  a genuinely strong position and we should protect it. Every phase above should be
  judged partly on whether it forces us to give it up.
- **Platform health stores keep that property**: reads happen on-device, and nothing
  needs to leave the phone. **Direct vendor APIs do not** - they need OAuth, a stored
  refresh token and usually a server. That is another argument for section 7.
- **Once we ship a native app, the store listings acquire obligations**: Google Play
  requires a declared, reviewed Health Connect data-use policy, and Apple requires
  usage-description strings plus a privacy policy for HealthKit. Neither permits using
  health data for advertising. This is real paperwork, not a formality, and it is a cost
  of v0.4 that should be priced in.
- **Health data must never be sent to a third-party AI service without an explicit,
  specific, revocable decision.** Your existing instinct - that the app's structured
  export is the canonical source and AI consumes it deliberately rather than
  continuously - is the right architecture, and it is worth writing into the product
  principles rather than leaving as an assumption.
- **Export files are unencrypted plain-text health data.** They will end up in cloud
  backups. That is an acceptable trade for portability, but the Data screen should say
  so plainly rather than let it be a surprise.
- **Camera PPG frames must never leave the device**, must never be recorded, and only
  the derived number should be stored.

## 14. The medical/wellness boundary

This is the largest long-term risk in the whole plan - larger than any API - and it is
worth being blunt about it. I am not a lawyer and this is not legal advice, but the
shape of the problem is clear.

**Personal use is the easy case.** A tool you build for yourself, distributed to nobody,
carries essentially no regulatory exposure. Everything below concerns what happens if
this ever reaches other people.

**In the UK and EU, what makes software a medical device is its *intended purpose*, not
its technology.** General-wellness software that helps you record and view your own
activity sits outside that definition. Software intended for *diagnosis, prevention,
monitoring, prediction, prognosis or treatment* of a disease or injury sits inside it,
with UKCA/CE marking obligations attached.

Mapping our roadmap onto that line:

- **Recording symptoms, pain scores, steps, sleep: clearly outside.** This is a diary.
- **Showing your own trends: outside**, provided we describe rather than assess.
- **A "recovery score": edging toward the line**, especially if named in a way that
  implies clinical meaning. Another reason not to build one.
- **Adaptive coaching that changes your exercise prescription in response to back pain,
  leg pain or neurological symptoms: this is the one that could cross it.** Software
  that takes symptom input relating to a known disc prolapse and outputs a modified
  therapeutic exercise recommendation starts to look like intended-purpose monitoring
  and treatment of a condition.

**Practical guidance for the later phases:**

- Keep symptom data **descriptive and adjacent**, never an input to an automated
  training-load decision.
- If adaptive suggestions ever ship, they should adjust based on **effort, completion
  and consistency** - not on neurological symptoms.
- Never generate text that reads as assessment ("your disc is irritated"), instruction
  ("stop exercising"), or reassurance ("this is nothing to worry about").
- **Escalating numbness, weakness or new bladder/bowel symptoms is the one genuine
  red-flag pattern in this clinical picture** (cauda equina). You were right to keep
  emergency logic out of v0.1. The correct long-term design is *not* to detect and
  advise, but to make sure the record is clear and prominent enough that the person and
  their clinician can see it. Surfacing is safe. Interpreting is not.
- A standing, quiet "this is a personal record, not a medical assessment" line costs
  nothing and is worth having.

## 15. Changes required to the current Step 2 design

**Nothing is broken.** The domain layer as built is compatible with everything above,
and two decisions already made turn out to be load-bearing:

- The **pure-TypeScript, React-free, storage-free domain** is exactly the core that
  survives a Capacitor move.
- **"Missing stays missing"** happens to be the correct behaviour for HealthKit's
  refusal-is-indistinguishable-from-absence design.

Recommended small, additive changes before Step 3:

1. **Add** `SourceType`, `DataSource`, `MetricKind` and `MetricSample` to `types.ts`.
   Types only - no functions, no tests beyond shape.
2. **Add** `metricSamples: MetricSample[]` to `AppData`, seeded `[]`, so the export
   envelope is final from the first export. `validateExportEnvelope` should accept a
   missing array and default it, so older files still import.
3. **Comment** `Measurement` as user-taken only.
4. **Comment** the `summariseProgress` precedence rule as provisional pending
   provenance.
5. **Comment** `ExerciseLog.steps` as the manual entry, which a device sample may later
   supersede for display without overwriting.

Explicitly **not** recommended now: per-field provenance wrappers, `PulseMeasurement`,
guided-workout fields, nutrition macros, the `ActivityDataProvider` interface, or any
provider implementation. All are additive later and none of them changes anything we are
about to write.

Estimated impact: about 40 lines of new type declarations, one array, four comments, and
two or three small tests asserting the empty array survives an export/import round trip.
No change to `dates.ts`, `units.ts`, `dailyLog.ts`, `weeklyPlan.ts` or `progress.ts`
logic.

---

## Verdict

**CONTINUE STEP 2 WITH SMALL SCHEMA CHANGES**

The changes are additive types and comments. No architectural change is required now,
and none of the research above invalidates a single decision already made. If you would
rather keep Step 2 pristine, "CONTINUE STEP 2 UNCHANGED" is also defensible - every one
of these five items can be added later without a migration. The only thing you would
give up is a stable export envelope from the very first export.

---

## Sources

- [Health Connect: read raw data](https://developer.android.com/health-and-fitness/health-connect/read-data)
- [Health Connect: get started](https://developer.android.com/health-and-fitness/health-connect/get-started)
- [Health Connect: check availability](https://developer.android.com/health-and-fitness/health-connect/availability)
- [Health Connect: platform architecture](https://developer.android.com/health-and-fitness/health-connect/architecture)
- [Google Fit to Health Connect migration guide](https://developer.android.com/health-and-fitness/health-connect/migration/fit)
- [Fitbit to Google Health API developer transition](https://help.validic.com/space/VCS/5513478151/Fitbit+to+Google+Health+API+Developer+Transition+Guide)
- [Fitbit API deprecation analysis](https://www.thryve.health/blog/fitbit-api-deprecation)
- [Garmin Connect Developer Program: Health API](https://developer.garmin.com/gc-developer-program/health-api/)
- [Garmin Health SDKs](https://developer.garmin.com/health-sdk/)
- [What you can and cannot do with Apple HealthKit data](https://www.themomentum.ai/blog/what-you-can-and-cant-do-with-apple-healthkit-data)
- [MDN: MediaStreamTrack.getCapabilities()](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getCapabilities)
- [ImageCapture API browser support](https://www.testmuai.com/learning-hub/image-capture-api-browser-support/)
- [Camera access issues in iOS PWA/home-screen apps](https://kb.strich.io/article/29-camera-access-issues-in-ios-pwa)
- [WebKit bug 185448: getUserMedia in standalone mode](https://bugs.webkit.org/show_bug.cgi?id=185448)
- [Resting and postexercise heart rate detection from fingertip and facial PPG using a smartphone camera: a validation study (JMIR mHealth)](https://mhealth.jmir.org/2017/3/e33/)
- [@capgo/capacitor-health plugin](https://www.npmjs.com/package/@capgo/capacitor-health)
- [mley/capacitor-health (Apple Health + Health Connect)](https://github.com/mley/capacitor-health)
