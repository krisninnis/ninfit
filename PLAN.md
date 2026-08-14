# Fitness Tracker — v0.1 Plan

**Status:** proposed, not yet built. Awaiting sign-off.
**Philosophy:** Start small. Track honestly. Progress only when the data supports it.
**v0.1 scope:** track data only. No recommendations, no interpretation, no medical logic.

---

## 0. Current state

- Project folder `C:\Users\thoma\fitness-tracker` is **empty**. Greenfield, no existing repo.
- Toolchain available: Node 22.22.3, npm 10.9.8, git 2.34.1, npm registry reachable.
- Decisions already taken: deploy to a private Vercel URL (installable to home screen), code lives in the connected folder, stack is Vite + React + TypeScript.

---

## 1. Recommended stack

| Concern | Choice | Why |
|---|---|---|
| Build | **Vite** | Fast, zero-config TS, trivial static deploy. |
| UI | **React 19 + TypeScript** | Typed domain models; scales to the later adaptive product. |
| Styling | **Plain CSS with custom properties** | 5 screens. No Tailwind build step, no theme dependency. |
| Routing | **Hash-based tab state (~15 lines)** | 5 fixed tabs. `react-router` is not worth it. |
| Dates | **Own `dates.ts` (~25 lines)** | Only need local-date keys and day arithmetic. Avoids `date-fns`. |
| Charts | **Hand-rolled inline SVG sparklines** | Progress screen needs 8 tiny trend lines. `recharts` would be the heaviest dependency in the app. |
| Persistence | **`localStorage` behind a `StorageAdapter` interface** | Tiny data volume (~0.5 KB/day → ~1.8 MB over 10 years). Swappable for IndexedDB or Supabase without touching domain code. |
| Tests | **Vitest** (node environment) | All the logic worth testing is pure. No DOM-testing dependency needed. |
| Offline | **Hand-written `manifest.webmanifest` + ~30-line service worker** | Transparent, no `vite-plugin-pwa`. |

**Total runtime dependencies: `react`, `react-dom`. That is the entire list.**
Dev dependencies: `vite`, `typescript`, `@vitejs/plugin-react`, `vitest`.

**Nothing leaves the device.** Vercel serves static files only. There is no backend, no account, no analytics, no network call after load.

---

## 2. File architecture

```
fitness-tracker/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── PLAN.md
├── public/
│   ├── manifest.webmanifest
│   ├── sw.js
│   └── icons/ (192, 512)
└── src/
    ├── main.tsx
    ├── App.tsx                    # tab shell only
    ├── styles.css
    │
    ├── domain/                    # pure TypeScript. No React. No storage. Fully testable.
    │   ├── types.ts               # every entity below
    │   ├── ids.ts                 # crypto.randomUUID wrappers
    │   ├── dates.ts               # local ISO date keys, day arithmetic
    │   ├── units.ts               # kg↔stone/lb, cm↔in — canonical storage is metric
    │   ├── defaults.ts            # your baseline seed + Week 1 programme
    │   ├── dailyLog.ts            # create empty log, apply partial updates
    │   ├── weeklyPlan.ts          # plan→day resolution, completion counts
    │   ├── progress.ts            # aggregates for the Progress screen
    │   └── schema.ts              # SCHEMA_VERSION, validation, migrations
    │
    ├── storage/
    │   ├── StorageAdapter.ts      # interface: get/set/remove/keys
    │   ├── localStorageAdapter.ts
    │   └── repository.ts          # the only thing UI calls to read/write
    │
    ├── io/
    │   ├── exportJson.ts          # full export envelope
    │   ├── exportCsv.ts           # one row per day, flattened
    │   └── importJson.ts          # validate → backup → replace
    │
    ├── ui/
    │   ├── components/            # Section, Stepper, Slider, Toggle, Counter,
    │   │                          # ProgressRing, Sparkline, TabBar, NoteField
    │   ├── screens/               # Today, Week, Progress, Profile, Data
    │   └── hooks/                 # useRepository, useDailyLog (debounced autosave)
    │
    └── test/
        ├── dates.test.ts
        ├── persistence.test.ts
        ├── dailyLog.test.ts
        ├── weeklyPlan.test.ts
        └── exportImport.test.ts
```

**Hard rule:** `domain/` and `storage/` never import from `ui/`. That boundary is what makes the Supabase migration and any future AI/coaching layer straightforward.

---

## 3. Screen structure

Five tabs in a bottom bar (thumb-reachable, 56px targets).

**1. Today** — the only screen that matters day to day.
- Header: date, and a soft completion ring (e.g. "4 of 5 sections"). Never red, never a streak, never a scold.
- Planned session card: "10-minute beginner yoga + 5-minute easy walk · target effort 2–4/10".
- Five stacked sections, all optional, all autosaving on change: Exercise · Back & symptoms · Nutrition · Hydration · Recovery.
- No Save button. No required fields. No validation errors.

**2. Week** — the current **rolling** programme week (days 1–7 from your start date, then 8–14, and so on — not Monday–Sunday). 7 rows: day, planned vs done, minutes, steps, back pain before→after, hydration count, food target met. Symptom-change days carry a neutral marker, which never alters the completion state of that day's session.

**3. Progress** — weight, waist, resting HR, HRV, steps, weekly exercise minutes, average effort, average back pain. Each as a number plus a small sparkline. One quiet standing line: *these are your own recorded numbers over time, not health assessments.*

**4. Profile / Baseline** — edit measurements and health context. Health context is explicitly labelled as your own notes, not diagnosis.

**5. Data** — Export JSON · Export CSV · Import JSON. At the top, prominently: **last backed up — date, time, and days ago** (or "not yet backed up"), read from `meta.lastExportedAt` and written on every successful export. Plus a plain statement of where data is stored and why exporting occasionally is worth it.

---

## 4. Data schema

Canonical units are **metric** (kg, cm); imperial is a display conversion only.
Day keys are **local** `YYYY-MM-DD`. Timestamps are full ISO 8601.
Every entity carries a stable `id` from `crypto.randomUUID()`.

```ts
const SCHEMA_VERSION = 1;

type ISODate = string;      // "2026-08-13"  (local calendar day)
type ISODateTime = string;  // "2026-08-13T20:04:00.000+01:00"
type UUID = string;
type Scale10 = number;      // 0–10 integer
type Trend = 'better' | 'same' | 'worse';

interface UserProfile {
  id: UUID;
  displayName?: string;
  birthYear: number;                 // 1984 → age 42
  sex: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  heightCm: number;                  // 180.3
  programmeStartDate: ISODate;       // anchors Week 1 Day 1
  preferredUnits: { weight: 'kg' | 'stone_lb'; length: 'cm' | 'in' };
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// User-entered context. Not a diagnosis, not medical advice, never interpreted by the app.
interface HealthContext {
  id: UUID;
  notes: HealthNote[];
  updatedAt: ISODateTime;
}
interface HealthNote {
  id: UUID;
  label: string;                     // "lower-back prolapsed disc"
  detail?: string;
  noticedOn?: ISODate;               // only when the date is actually known
  noticedNote?: string;              // vague timing as free text: "approximately two years ago"
  source: 'self_reported';           // fixed in v0.1
}
// The prediabetes note carries noticedNote rather than a fabricated noticedOn date.

interface BaselineMeasurement {
  id: UUID;
  recordedOn: ISODate;
  weightKg?: number;                 // 69.9
  waistCm?: number;                  // 76.2  (30 in)
  restingHeartRateBpm?: number;      // 72
  hrvMs?: number;                    // 37
  averageDailySteps?: number;        // 3000
  backPain?: Scale10;                // 4
  exerciseCapacityMinutes?: number;  // 15
  structuredExerciseBefore?: 'none' | 'some' | 'regular';
  plannedDaysPerWeek?: number;       // 6
  notes?: string;
}

// Ongoing measurements use the same shape, keyed by date — Progress reads baseline + these as one series.
interface Measurement {
  id: UUID;
  recordedOn: ISODate;
  weightKg?: number;
  waistCm?: number;
  restingHeartRateBpm?: number;
  hrvMs?: number;
  notes?: string;
}

interface WeeklyPlan {
  id: UUID;
  programmeVersion: string;          // "week-1-v1" — stable, historically identifiable
  weekNumber: number;                // 1
  startDate: ISODate;                // programmeStartDate + (weekNumber-1)*7
  label?: string;                    // "Week 1 — starting gently"
  targetEffortMin: number;           // 2
  targetEffortMax: number;           // 4
  sessions: PlannedSession[];
  createdAt: ISODateTime;
}
// Programme weeks are ROLLING 7-day periods anchored to profile.programmeStartDate.
// Week N covers days (N-1)*7+1 .. N*7 from the start date. Not Monday–Sunday calendar weeks.
// Every DailyLog stores the weeklyPlanId it was logged against, so revising a plan
// (week-1-v1 → week-1-v2) never rewrites history.
interface PlannedSession {
  id: UUID;
  dayIndex: number;                  // 1–7
  activities: PlannedActivity[];     // empty array = rest day
  note?: string;
}
interface PlannedActivity {
  id: UUID;
  type: 'yoga' | 'walk' | 'rest' | 'other';
  label: string;                     // "beginner yoga"
  durationMinutes: number;           // 10
  intensity: 'very_light' | 'light';
}

// One document per calendar day. All sub-logs optional; all fields optional.
interface DailyLog {
  id: UUID;
  date: ISODate;                     // unique business key
  weeklyPlanId?: UUID;
  plannedSessionId?: UUID;
  exercise?: ExerciseLog;
  symptoms?: SymptomLog;
  nutrition?: NutritionLog;
  hydration?: HydrationLog;
  recovery?: RecoveryLog;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

interface ExerciseLog {
  id: UUID;
  completed?: boolean;               // "I did the session". Nothing more.
  actualActivity?: string;
  durationMinutes?: number;
  effort?: Scale10;                  // 1–10
  steps?: number;
  notes?: string;
}
// COMPLETION IS INDEPENDENT OF OUTCOME. `completed: true` alongside worse back, leg or
// toe symptoms is a valid, unremarkable state. Nothing in the app may downgrade, un-tick,
// warn about or visually penalise a completed session because of what SymptomLog says.
// Completed means done, not "good".

interface SymptomLog {
  id: UUID;
  backPainBefore?: Scale10;
  backPainAfter?: Scale10;
  legPain?: boolean;
  toeSensation?: Trend;
  notes?: string;
  // Derived, not stored: toeSensation === 'worse' || legPain === true
  // → the day is visually flagged in Today and Week. The app records it. It does not interpret it.
}

interface NutritionLog {
  id: UUID;
  morningFruit?: boolean;
  proteinMainMeal?: boolean;
  goustoMeal?: boolean;
  fruitVegServings?: number;
  snackNote?: string;                // free text only — no calorie counting in v0.1
}

interface HydrationLog {
  id: UUID;
  glasses?: number;                  // uncapped; guide band is 6–8, described as a rough guide
  extraFluidNote?: string;
}

interface RecoveryLog {
  id: UUID;
  sleepHours?: number;
  energy?: Scale10;                  // 1–10
  restingHeartRateBpm?: number;
  hrvMs?: number;
  notes?: string;
}
```

### Storage keys

```
ft:v1:profile          → UserProfile
ft:v1:health           → HealthContext
ft:v1:baseline         → BaselineMeasurement
ft:v1:measurements     → Measurement[]
ft:v1:plans            → WeeklyPlan[]
ft:v1:log:2026-08-13   → DailyLog        (one key per day)
ft:v1:meta             → { schemaVersion, createdAt, lastExportedAt }
```

One key per day means a day's write never rewrites the whole dataset, and each day maps 1:1 to a future `daily_logs` row.

### Export envelope

```json
{
  "app": "fitness-tracker",
  "appVersion": "0.1.0",
  "schemaVersion": 1,
  "exportedAt": "2026-08-13T20:04:00.000+01:00",
  "data": {
    "profile": {}, "healthContext": {}, "baseline": {},
    "measurements": [], "weeklyPlans": [], "dailyLogs": []
  }
}
```

CSV export: one row per day, flat columns (`date, planned, completed, activity, minutes, effort, steps, back_before, back_after, leg_pain, toe_sensation, fruit_am, protein_meal, gousto, fruit_veg, glasses, sleep_hours, energy, rhr, hrv, notes`). Spreadsheet-friendly and directly usable as future AI input.

Import: validate `schemaVersion` → auto-download a backup of current data → replace. Merge-by-date is a later refinement.

---

## 5. Implementation sequence

Each step ends with something that runs.

1. **Scaffold** — Vite + React + TS, `tsconfig`, `vitest`, mobile viewport, base CSS tokens, empty tab shell. *Verify: dev server loads at 390px.*
2. **Domain layer** — `types.ts`, `dates.ts`, `units.ts`, `ids.ts`, `defaults.ts` (your baseline + Week 1 seeded). *Tests: date keys, unit conversion.*
3. **Storage layer** — adapter, repository, seed-on-first-run, `schemaVersion` in meta. *Tests: round-trip persistence, seeding is idempotent.*
4. **Today screen** — planned card + five sections, debounced autosave, completion ring. The under-a-minute path. *Tests: partial daily-log updates never clobber other fields.*
5. **Week screen** — 7-day table, completion counts, symptom flag carry-through. *Tests: weekly-plan completion calculation.*
6. **Progress + Profile** — aggregates and sparklines; baseline editing. *Tests: aggregates ignore missing values rather than treating them as zero.*
7. **Data screen** — JSON export, CSV export, JSON import with pre-import backup. *Tests: export→import round-trip is lossless.*
8. **PWA + deploy** — manifest, service worker, icons, `navigator.storage.persist()`, deploy to Vercel, install to home screen.
9. **Verify in a real browser at 390px** — walk the full 10-item definition of done, then hand you the URL.

---

## 6. Risks and decisions

**Risks**

1. **iOS clears browser storage.** Safari can evict script-writable storage after ~7 days of non-use. Daily use plus home-screen install makes this unlikely, but it is the single biggest data-loss risk. Mitigations: call `navigator.storage.persist()` on first run, and a quiet "last exported N days ago" line on the Data screen. Export is your backup — that is why it is a v0.1 requirement, not a nice-to-have.
2. **Timezone off-by-one.** `toISOString()` on a local date silently shifts the day in BST. All day keys go through one tested local-date helper; `toISOString()` is banned outside timestamps.
3. **"No guilt UI" is easy to break by accident.** Standard form validation produces red errors; a completion ring implies a target. Constraint: no required fields, no error states, no red for incompleteness, no streaks. Reserve amber/neutral tones for symptom flags only.
4. **Schema lock-in.** `schemaVersion: 1` and a migration hook ship in v0.1 even though there is nothing to migrate yet — retrofitting versioning onto exported files later is painful.
5. **Health data on a public URL.** The Vercel URL serves only the app shell; your data never leaves your phone. But anyone with the URL can open a blank copy of the app — worth knowing, though there is nothing of yours to see.
6. **Scope creep.** Nothing outside the 10 definition-of-done items gets built. Coaching, adaptivity, wearables and AI stay out until the tracker is working end to end.

**Decisions taken (tell me if any are wrong)**

- **Programme start date = today, Thursday 13 August 2026.** Day 1 is today; Day 7 rest falls on Wednesday 19 August. Editable in Profile.
- **Programme weeks are rolling 7-day periods**, anchored to the start date. No Monday–Sunday calendar weeks anywhere in the app.
- **`WeeklyPlan.programmeVersion`** (`"week-1-v1"`) makes every plan revision historically identifiable; daily logs reference the plan they were logged against.
- **Completion is independent of symptom outcome.** A session stays completed regardless of how the body responded.
- **`meta.lastExportedAt` is surfaced on the Data screen** as "last backed up N days ago".
- **Weight displayed in stone + lb, waist in inches, height in cm** — stored metric throughout.
- **Steps entered manually.** No wearable or Health/Google Fit integration in v0.1.
- **Effort recorded 1–10** with the Week 1 target band (2–4) shown as context, not as a rule.
- **Hydration guide 6–8 glasses**, worded as a rough guide, uncapped, with no penalty above or below.
- **Symptom changes are flagged, never interpreted.** A "worse" toe reading or leg pain marks the day prominently in Today and Week. The app offers no assessment and no instruction.
- **Import replaces rather than merges**, with an automatic backup download first.

**Explicitly out of v0.1:** accounts, auth, backend, cloud sync, notifications, streaks, calorie counting, AI coaching, wearables, social, payments, ChatGPT conversation reading.

---

## 7. Cross-platform intent (documented, not implemented)

Confirmed direction. Nothing below is built, and none of it changes v0.1.

**Platform sequence**

1. **Current PWA / manual tracker** — where we are. Manual entry stays a first-class input forever, not a fallback.
2. **Capacitor wrapper** — same Vite/React build, same domain layer, an Android and iOS shell added around it. Additive: the PWA continues to exist alongside it. This is the step that unlocks everything below, because no web API can reach either platform health store.
3. **Android Health Connect provider first** — the user's current phone is Android, the OS already counts steps, and Health Connect is part of the framework from Android 14.
4. **iOS HealthKit provider second** — same read interface, different adapter.

**Constraints this places on the domain**

- The domain must contain **no Android-only assumptions**. `SourceType` carries both `health_connect` and `healthkit` from the outset, and source identifiers are opaque strings on both platforms.
- Provider **interfaces** may eventually live in the domain; provider **implementations** must not — they touch platform APIs and would break the rule that the domain runs in a plain Node test.
- `DailyLog` (what the person said) and `MetricSample` (what was observed) stay separate. Merging them is the one change that would be expensive to undo.
- Local calendar-day boundaries for platform reads must be derived from that day's local offset, never from UTC midnight.

See `BRIEFING.md` for the research these decisions rest on.
