# NinFit Company Launch Summit — 2026-09-05

A whole-company audit, market review and single agreed roadmap, produced against
verified repository truth and live external research on 5 September 2026.

**Status:** canonical strategic record. It supersedes earlier launch planning where
they disagree. It does **not** supersede `docs/DECISIONS.md` (durable product
decisions) or `docs/CURRENT_STATE.md` (live repository checkpoint).

**Authority:** live Git, tests and repository contents outrank this file. Where an
external fact is cited, the source and the date it was read are given, because
competitor products change.

## Evidence classes used throughout

| Tag | Meaning |
|---|---|
| `[REPO]` | Verified repository fact — proved from source at the SHA below |
| `[EXT]` | Verified external fact — primary or reputable source, dated |
| `[SENT]` | User sentiment — repeated pattern in reviews/forums, reported not measured |
| `[INF]` | Team inference — reasoning from evidence, not itself evidence |
| `[HYP]` | Hypothesis — to be tested, not believed |
| `[DEC]` | Decision taken at this summit |

Nothing below is presented as evidence unless it carries `[REPO]` or `[EXT]`.

---

# 1. Executive verdict

**What NinFit is now.** `[REPO]` A genuinely well-engineered, local-first,
calm-by-default *gentle-movement journal* with an unusually strong data-integrity
and privacy spine, a real GPS Journey recorder, and a companion layer that is
architecturally correct but visually unfinished. 22,061 lines of application code
against 25,771 lines of test code — a test-to-source ratio above 1:1, 2,035 tests,
all green. The product's engineering discipline is far ahead of its art pipeline and
far ahead of its fitness breadth.

**What it should become.** The app for the ~25% of adults who are inactive and the
~11% who are *fairly* active — people who have been beaten by Strava, Fitbit and the
gym and who need a companion that never punishes them for stopping. Not a competitor
to Strava. The thing people use *before* Strava, and the thing they come back to
after they quit it.

**Why it deserves to exist.** `[EXT]` Every major platform moved the wrong way in
the last eighteen months for this user. Garmin paywalled previously-free features and
took a public backlash (Connect+ , 2025). Strava consolidated the serious-runner
market by buying Runna (17 April 2025) and now sells a £119.99/year bundle. Google
replaced the Fitbit app with Google Health on 19 May 2026, removing Badges,
community and Sleep Profile, and raised the annual subscription — with Play Store
review-bombing in response. `[INF]` The industry is optimising for committed
athletes and for recurring revenue at exactly the moment the beginner and the
returner have been left with nothing that is calm, private, cheap and kind. That gap
is real, it is large, and it is the one NinFit was accidentally already built for.

**The verdict.** NinFit is **not** ready for a public launch and is **close** to
being ready for a private beta. Two launch-blocking defects are on `main` today, both
in the single most emotionally important moment in the product, and both invisible to
a green CI run. Fix those, close the offline gap, and NinFit can be in real hands
within weeks.

---

# 2. Verified current state

## 2.1 Repository truth

| | |
|---|---|
| Remote | `https://github.com/krisninnis/ninfit.git` |
| `main` SHA | **`95c9ccabb454f723e527bc08b371e25c56f3bda1`** |
| Head commit | `Merge pull request #197 from krisninnis/feat/tortoise-hatch-wave-shake-v1` |
| Merged | 2026-09-04 19:29:22 +0100 |
| Total commits on `main` | 437 |
| Open PRs | **1** — #194 |
| Closed PRs | 150 |
| Open issues | **46** (#101–#144, #146, #147). Zero closed issues. |
| Remote branches | 154 |

`[REPO]` **The only open PR is #194 — "feat: add deterministic Day 1 first-win
selector"** (branch `feat/day1-first-win-selector-v1`, head `9cda3fd`). It adds
`src/domain/day1FirstWin.ts` (157 lines) and its test (140 lines); +297 lines, no
deletions, no UI. Verified two ways: GitHub's own open-PR listing shows `1 Open / 150
Closed`, and `git ls-remote origin 'refs/pull/*/merge'` returns exactly one
computed merge ref (`194 → de49a0b`).

`[REPO]` **`docs/CURRENT_STATE.md` is stale.** It records `main` as
`6cfa56309f59139a3fc9979cb66ed8f127dc83e7` (#192) and "Open PRs: none". Four merges
have landed since: #193, #195, #196, #197. This summit refreshes it.

## 2.2 The Tortoise hatch lane — repository truth vs. the human report

The CEO's brief said an open prototype lane on the Tortoise hatch animation had a
human-observed overlap defect, and that it must not be merged merely because CI
passes.

`[REPO]` **It was already merged.** PR #197
(`feat/tortoise-hatch-wave-shake-v1`) is the head of `main`. There is no open
Tortoise PR. The defect is not waiting in a branch — it is shipping in `main`.

That changes the response from "do not merge" to "revert or fix, now". The
department that owns this is Art/Animation with Engineering; the gate that failed is
in section 9.

### Defect H1 — two Tortoises are rendered at once (root cause proved)

`[REPO]` `src/ui/components/HatchCompanionMedia.tsx` mounts the standing `<img>`
**and** the motion `<video>` simultaneously during `emerging`, `settling` and
`landing`. The still is not hidden; it is given a modifier class:

```tsx
const fullMotionReveal = phase === 'emerging' || phase === 'settling' || phase === 'landing';
const showMotion = fullMotionReveal && motionSrc !== undefined && !motionFailed;
// standing <img> keeps rendering, gaining only `egg-hatch__companion--under-wave`
```

`[REPO]` `src/styles/components/egg.css` then holds that still fully opaque beneath
the video:

```css
.egg-hatch--emerging .egg-hatch__companion--under-wave, /* + settling, landing */
{ z-index: 1; opacity: 1; animation: none; transform: translate(-50%, -50%); }
.egg-hatch--emerging .egg-hatch__wave { opacity: 1; }   /* z-index: 2 */
```

`[REPO]` Both WebM masters carry a real alpha channel — the WebM `AlphaMode`
element (`0x53C0`) is present in both files and `ffprobe` reports
`TAG:alpha_mode=1`. The video is therefore **transparent**, so whatever sits beneath
it shows through.

`[REPO]` And what sits beneath it is the wrong drawing. Character bounding boxes
on the shared 608×608 canvas:

| Asset | Character bbox | Size |
|---|---|---|
| `tortoise-starter-idle-v1.png` — **the still used under the wave** | (148, 72, 456, 550) | 308×478 |
| `tortoise-starter-idle-v1.webm` frame 0 | (148, 72, 456, 550) | 308×478 |
| `tortoise-starter-wave-rest-v1.png` — **present in the repo, referenced nowhere** | (144, 60, 464, 552) | 320×492 |
| `tortoise-starter-wave-v1.webm` frame 0 | (144, 60, 464, 552) | 320×492 |

The still under the wave is frame 0 of the **idle** master. The video is the **wave**
master. They differ by 12px in width, 14px in height and are offset up and left — so
the standing Tortoise's silhouette protrudes around the animated one for the whole
2.5 s of the reveal, and once the arms rise the mismatch becomes two visibly
different bodies.

This violates the rule the codebase states in its own source, in
`src/ui/mascotStageArt.ts`:

> "For a stage that also has motion this MUST be a frame taken from that motion
> asset, so the two share framing, scale and character exactly and the swap between
> them is invisible."

`[REPO]` **The correct asset already exists.**
`public/mascots/tortoise/tortoise-starter-wave-rest-v1.png` is byte-for-byte the
wave master's frame 0 by bounding box, and no file under `src/` references it.

Visual proof, regenerable from the repository:
`docs/brand/reference/mascots/tortoise/hatch-wave-overlap-proof-2026-09-05.png`.

Reproduction (any machine with `ffmpeg` and Python/Pillow):

```bash
ffmpeg -c:v libvpx-vp9 -i public/mascots/tortoise/tortoise-starter-wave-v1.webm \
  -vf "select=eq(n\,0)" -vframes 1 -pix_fmt rgba /tmp/wave_f0.png
python3 -c "from PIL import Image; \
  print(Image.open('public/mascots/tortoise/tortoise-starter-idle-v1.png').convert('RGBA').split()[3].getbbox()); \
  print(Image.open('/tmp/wave_f0.png').split()[3].getbbox())"
```

### Defect H2 — a third-party generator watermark is in the hatch

`[REPO]` The wave master contains a **visible "Pika" watermark**, baked into the
frames and preserved by the alpha matte. It is legible from roughly t≈1.6s to t≈3.4s,
beside the Tortoise's raised hand. The hatch plays the video from t=0 to t≈2.5 s, so
**the watermark is on screen during the reveal**. Today's tap-to-wave plays the full
5.03 s, so it is on screen there too.

The repository already knew. `src/styles/components/egg.css` says so in a comment:

> "The current wave contains a Pika watermark and is intentionally temporary; CSS
> never crops, masks or obscures it."

And `docs/specs/active/tortoise-production-scaffold-v1.md` line 25 says:

> "The existing Pika-watermarked Starter wave is TEMPORARY proof artwork. Do not
> treat it as the clean production master."

`[INF]` A slice was merged that did exactly the thing an active spec in the same
repository forbids. This is a process failure, not only an art failure.

### Defect H3 — green-screen matte spill on the wave master

`[REPO]` Measured across the semi-transparent alpha edge, the wave master carries
11,272 edge pixels with a mean green excess of **+53.8** (max +116) over the larger
of the red and blue channels — a visible green halo on the whole silhouette. The
idle master measures **0** on the same test: it has a clean hard-edged matte. The
wave asset was keyed from an un-keyed green background and the key was never
finished.

### Defect H4 — the wave never completes

`[REPO]` The wave master is 151 frames at 30 fps = **5.03 s**. The hatch mounts it
at `BREAK_MS + 250 = 1,700 ms` and unmounts it at `HATCH_MS = 4,200 ms` — 2.5 s.
Users see roughly half a wave, cut mid-gesture.

### Verdict on the lane

`[DEC]` **D-01. Revert the wave from the hatch presentation on `main` immediately;
do not fix it forward under time pressure.** The reduced-motion and no-motion paths
are already correct and already shipping. Reverting restores a correct, calm reveal
in one small diff. Re-land the wave only after the T1B clean-wave master exists and a
human has accepted it on a real device.

`[DEC]` **D-02. Today's tap-to-wave is reverted with it**, for the same watermark
and spill reasons. It is the same asset.

## 2.3 Verified technical health at `95c9cca`

All measured in a clean cloud clone of `origin/main` on 2026-09-05.

| Check | Result |
|---|---|
| `npm test` | **107 files / 2,035 tests — all pass**, 26.5 s |
| `npm run typecheck` (`tsc --noEmit`) | **pass** |
| `npm run build` | **pass**, 1.13 s, 188 modules |
| `npm audit` | **0 vulnerabilities** (info/low/moderate/high/critical all 0) |
| `git diff --check HEAD^ HEAD` | clean |
| Application source | 22,061 lines |
| Test source | 25,771 lines |

Bundle, production build:

| Chunk | Raw | Gzip |
|---|---|---|
| `index.js` | 404.91 kB | **119.44 kB** |
| `index.css` | 106.69 kB | 16.56 kB |
| `JourneyRouteMap.js` (MapLibre) | 945.42 kB | **247.34 kB** |
| `JourneyRouteMap.css` | 82.86 kB | 10.71 kB |
| `auth.js` (Supabase) | 204.24 kB | 52.36 kB |
| `dist/` total | **13 MB** | — |
| `public/backgrounds/` | 7.6 MB | — |
| `public/mascots/` | 2.3 MB | — |
| `public/intro/ninfit-intro-v1.mp4` | 735 kB | — |

`[REPO]` First meaningful paint costs ~136 kB gzip. The map is correctly code-split
and lazy. The 13 MB `dist` is dominated by 17 regions × 2 background variants.

## 2.4 What is actually built, proved from source

| Surface | State `[REPO]` |
|---|---|
| Navigation | Six primary destinations: Today, Week, Journey, Progress, Profile, Settings (`src/ui/tabs.ts`). Hash routing. |
| Onboarding | Adaptive questionnaire, 4 required core questions + adaptive follow-ups; recommends a path, never decides; explicitly does not read or classify health notes (`src/domain/game/onboarding.ts`). |
| Egg / hatch | Six deterministic crack stages driven by questionnaire progress; production SVG stages in `public/egg/`; authoritative mutation at 1,450 ms; exactly-once commit that survives unmount; 4.2 s full ceremony, 2.1 s reduced-motion ceremony with Skip; species art requested only after the hatch. |
| Companion | Five closed path families (Tortoise, Bear, Fox, Otter, Wolf). **Only Tortoise `starter` has artwork.** Every other family and stage returns `undefined` and falls back to a single letter glyph (`src/ui/mascotStageArt.ts`). |
| Today | Companion presence, Day 1 first-step guidance, planned session, quick check-in. |
| Week | Rolling 7-day programme from the programme start date; neutral trail; no score, fraction, percentage or streak (`docs/DECISIONS.md`, `src/domain/week.ts`). |
| Journey / GPS | Real recorder with accuracy gating (`maxAccuracyM: 50`), duplicate/out-of-order/invalid rejection, pause support, trusted-segment routing, live map, completion and postcard screens, three activity doors (Walk/Run, Cycle, Swim) that never merge walk and run. |
| Route privacy | Four visibility levels; 200 m default endpoint mask; masking splits the route rather than joining across a hidden zone; the projection never mutates authoritative points or distance (`src/domain/journeyRoutePrivacy.ts`). |
| Adventure Map | A read-only projection of completed/imported Journeys. Writes nothing. |
| Progress | Neutral presentation of user-entered measurements. No score, target, grade or population comparison. |
| Backup / restore | JSON restorable, CSV explicitly non-restorable; fail-closed on incomplete backups; semantic read-back verification after restore; corrupt values quarantined, never deleted. |
| NinFit ID | Optional Supabase email/password. Sign up, sign in, sign out, session, resend confirmation. **No password reset exists** — `grep -rn "resetPassword\|forgot" src/` returns nothing. |
| Rewards | XP to level 20, skills, tiered trophies (`PLATINUM_AVAILABLE = false`), durable `pendingRewardDeliveries`. |
| PWA | Manifest, icons, service worker. **Precache is `/`, manifest and two icons only** — no JS or CSS. |
| Accessibility | One global `@layer motion` rule neutralises every animation and transition under `prefers-reduced-motion`; 71 aria attributes across the UI; decorative art is `aria-hidden` throughout. |
| Analytics / crash reporting / notifications / error boundary | **None of the four exist.** No Sentry, no telemetry, no `Notification` API use, no `componentDidCatch`. |

## 2.5 The finding that reframes the product

`[REPO]` NinFit has **two disconnected fitness vocabularies**:

```ts
// src/domain/types.ts — the programme and daily log
export type ActivityType = 'yoga' | 'walk' | 'rest' | 'other';
export type ActivityIntensity = 'very_light' | 'light';

// src/domain/journey.ts — the GPS recorder
export type JourneyActivityType = 'walk' | 'run' | 'hike' | 'cycle' | 'swim' | 'other';
```

The programme can express **yoga, walking and rest, at very light or light
intensity**. That is the whole vocabulary. There is no run, no gym session, no sets,
no reps, no load, no strength movement of any kind in the planned-activity model.

Meanwhile `src/domain/game/paths.ts` offers five paths, three of which the programme
cannot express: `build_strength` (Bear), `build_stamina` (Fox), `balanced_fitness`
(Otter).

`[INF]` **NinFit's positioning currently writes cheques its domain model cannot
cash.** A user who picks "Build strength", hatches a Bear, and then finds their
programme can only plan yoga and walks has been misled — by a product whose first
principle is truthfulness. This is not a gap to fill before launch. It is the single
strongest piece of evidence about **who NinFit is actually for**, and section 4 acts
on it.

---

# 3. Competitive landscape

All prices read on 2026-09-05 unless stated. Prices change; re-date before reuse.

## 3.1 Categorisation

| Category | Products |
|---|---|
| **Direct fitness competitors** | Strava, Nike Run Club, adidas Running, Runna, Google Health (ex-Fitbit), Samsung Health |
| **Adjacent fitness products** | Hevy, Strong, Fitbod, Apple Fitness+, MyFitnessPal, Cronometer |
| **Wearable / recovery platforms** | WHOOP, Oura, Ultrahuman, Garmin Connect(+) |
| **Gamified wellness** | Zombies Run!, Walkr, Wokamon, Pokémon GO, Pikmin Bloom |
| **Behavioural / companion** | Finch, Gentler Streak |
| **Platform ecosystems** | Apple Health / HealthKit, Google Health Connect, Samsung Health SDK |

**Category we were missing, and should not have been.** `[INF]` NinFit's real
competitive set is *not* the first row. It is **Finch, Gentler Streak and Zombies
Run!** — the products that already sell "movement without judgement" and "a creature
that cares". Those three are the benchmark for what NinFit must beat, and Strava is
the thing NinFit must not become.

## 3.2 Matrix

| Product | Core proposition | Target | Price (2026-09-05) | Gamification | Streaks | Rating / ratings |
|---|---|---|---|---|---|---|
| **Strava** | Social record of every activity | Committed endurance athletes | UK £8.99/mo, £54.99/yr; Family £99.99/yr; **Strava+Runna £119.99/yr** `[EXT]` | Segments, leaderboards, KOM/QOM, challenges | Weekly-goal pressure, comparison | — |
| **Runna** (Strava-owned) | Personalised race training plans | Runners with a goal race | **£15.99/mo, £99.99/yr** `[EXT]` | Plan adherence | Plan-day pressure | 4.8 / 25,000 `[EXT]` |
| **Google Health** (ex-Fitbit) | Whole-health hub for Fitbit/Pixel | Mainstream trackers | Premium; annual price raised 19 May 2026 `[EXT]` | **Badges removed 19 May 2026** `[EXT]` | Step/goal streaks | Review-bombed post-migration `[SENT]` |
| **Garmin Connect / Connect+** | Deep training analytics | Serious multisport | Core free; **Connect+ ~$6.99/mo, $69.99/yr** `[EXT]` | Badges, challenges | Training-load pressure | Public backlash at launch `[SENT]` |
| **WHOOP** | Strain / recovery coaching | Optimisers | **$199 / $239 / $359 per year**, hardware included `[EXT]` | Streaks, strain targets | Yes | — |
| **Apple Fitness+** | Guided workout video library | Apple owners | **UK £9.99/mo, £79.99/yr** `[EXT]` | Rings, awards | Ring streaks | — |
| **Hevy** | Free strength logging + social | Lifters | Free tier prominent; Pro paid | PRs, social feed | Weekly targets | **4.9 / 590,000+**, 16M+ athletes `[EXT]` |
| **Gentler Streak** | "Move consistently, not constantly" | Burnt-out / over-trainers | **UK £8.99/mo, £40.99/yr, £59.99 lifetime** `[EXT]` | Activity Path, "go gentler" states | **Rest days keep the streak** | 4.6 / 726 (UK) `[EXT]` |
| **Finch** | "Take care of your pet by taking care of yourself" | Self-care, mental health | **Finch Plus £4.99–£69.99 tiers; Guardian £7.99** `[EXT]` | Pet growth, journeys | Gentle, forgiving | **4.9 / 76,000** `[EXT]` |
| **Zombies, Run!** | "Run in the real world. Become a hero in another." | Story-motivated runners | **£6.99/mo, £49.99/yr** `[EXT]` | Narrative seasons, base building | Mission-based | 4.8 / 4,700 `[EXT]` |

## 3.3 What competitors consistently do well

1. `[EXT]` **Wearable and platform integration is table stakes.** Every serious
   competitor reads HealthKit or Health Connect. A fitness app that cannot see the
   steps the phone already counted feels broken.
2. `[EXT]` **Free tiers that are genuinely usable.** Hevy reached 16M+ athletes and
   a 4.9/590k rating with a free tier people do not resent.
3. `[SENT]` **Emotional attachment beats feature depth for retention.** Finch's
   4.9/76,000 is not earned by analytics. It is earned by a bird that notices.
4. `[EXT]` **Narrative and identity work.** Zombies, Run! has sustained a paid
   subscription for over a decade on story alone.
5. `[EXT]` **Rest reframed as progress.** Gentler Streak's entire wedge is that a
   rest day *keeps* the streak, and it won an Apple Editors' Choice for it.

## 3.4 What competitors consistently do badly

1. `[EXT]` **Removing what people loved.** Google removed Badges, Sleep Profile and
   community from the Fitbit app on 19 May 2026 and raised the price in the same
   move `[SENT]` prompting Play Store review-bombing and a published apology
   roadmap.
2. `[EXT]` **Paywalling what used to be free.** Garmin moved Training Readiness and
   VO2 max history into Connect+ after a decade of marketing itself as
   subscription-free `[SENT]` and took sustained community anger for it.
3. `[EXT]` **Subscription stacking.** A UK user wanting social + plans + recovery
   can now pay Strava £54.99 + Runna £99.99 (or £119.99 bundled) + WHOOP ~$199 +
   Fitness+ £79.99. `[INF]` That is well over £300/year across four apps for one
   person's fitness.
4. `[INF]` **Comparison as the default frame.** Strava's core loop is other people's
   times on your route. For a deconditioned beginner that is not motivation; it is
   evidence they do not belong.
5. `[SENT]` **Streaks that punish.** The recurring, well-documented complaint across
   habit and fitness apps is that a broken streak causes abandonment rather than
   re-engagement — the "all-or-nothing" collapse.

## 3.5 Where the market leaves people underserved

| Underserved | Evidence |
|---|---|
| **Inactive adults** | `[EXT]` 24.7% of English adults are inactive (Active Lives, Nov 2024–Nov 2025). Nothing in the top row of the matrix is designed for them. |
| **Fairly active adults** | `[EXT]` A further 10.7% do 30–149 min/week — moving, but below guidelines, and invisible to every "athlete" product. |
| **People with a long-term condition or disability** | `[EXT]` 49.1% active vs 69.8% for others — the widest gap in the survey, and the group most harmed by intensity-first design. |
| **Lower-income adults** | `[EXT]` 53.8% vs 73.2% activity. `[INF]` Also the group least able to absorb a £55–£120/year subscription. |
| **Returners after a long break** | `[INF]` Every product in the matrix greets a three-week absence with a broken streak, a lost fitness score, or a decayed readiness baseline. |
| **Privacy-sensitive users** | `[INF]` Every mainstream competitor is cloud-first by construction. NinFit is the only one in this matrix whose fitness truth never leaves the device by default. |

## 3.6 Where experienced athletes are already extremely well served

`[EXT]` Strava (150M+ registered athletes, April 2025) plus Runna plus Garmin plus
WHOOP cover training plans, segments, load management, recovery and community
comprehensively. `[DEC]` **D-03. NinFit will not compete for the experienced
endurance athlete.** Any roadmap item justified by "athletes expect it" is rejected
by default.

---

# 4. The market gap

## 4.1 Candidate positions considered

Six candidates were generated before any was preferred, and scored 1–5 across
thirteen criteria (need, saturation, differentiation, feasibility, cost, time to
market, retention, monetisation, safety, privacy, fit with current NinFit,
defensibility, marketing clarity). Total out of 65.

| # | Candidate position | Score | Why it scored that way |
|---|---|---|---|
| **A** | **The kind companion for people starting or restarting movement** | **57** | Highest need, lowest saturation, near-perfect fit with what is *already built* — walking, yoga, rest, no-punishment architecture, local-first. Weakest on monetisation. |
| B | Privacy-first fitness tracker ("the fitness app that never uploads you") | 44 | Genuine and defensible `[REPO]`, but privacy is a *reason to trust*, not a reason to open an app daily. Small addressable market on its own. |
| C | Gamified adventure fitness (Pokémon-GO-for-fitness) | 39 | Fun, but saturated, art-cost-heavy, and directly opposed by NinFit's own no-fake-progress rules. Would take 12+ months of art the company does not have. |
| D | Calm alternative to Strava for casual runners/cyclists | 41 | Journey/GPS is strong `[REPO]`, but this fights Strava on Strava's ground with 0.0001% of its network. |
| E | Sleep & recovery companion | 33 | Requires wearables NinFit has not integrated, and puts health inference at the centre — the highest-risk area for a solo founder. |
| F | Family / intergenerational movement | 36 | Interesting, but needs accounts, sharing and moderation — everything NinFit deliberately has not built. |

## 4.2 The debate, recorded

**Growth argued for D** — "casual Strava" is the easiest thing to explain and the
easiest market to find. **Product and Fitness rejected it**: `[REPO]` the programme
cannot plan a run, and a casual-runner product that cannot plan a run is a lie.
Growth's objection is recorded and not dismissed: A is harder to *find* than D.
Section 11 answers it.

**Commercial argued that A monetises worst** — inactive adults are the least willing
to pay, and `[EXT]` the demographics least active are also the lowest-income.
**Accepted as a real constraint**, and it is why section 12 rejects a subscription at
launch rather than pretending A is a good subscription market on day one.

**Engineering argued that C is the only option that uses the game layer already
built.** **Rejected on cost**: `[REPO]` one of five families has art; four families
× five stages = nineteen unbuilt character sets, plus habitats, plus items. That is
not a solo-founder scope.

**Safety objected to E outright** and was upheld: recovery scoring implies health
inference, and `[EXT]` since 26 March 2026 Apple requires a regulated-medical-device
declaration for Health & Fitness apps in the UK, EEA and US. A one-person company
should not go near that boundary as its *wedge*.

## 4.3 The decisions

`[DEC]` **D-04. Primary launch wedge — "The first four weeks."**

> NinFit is for people who have stopped moving and want to start again, and it is
> built so that stopping again is not a failure. It plans in walks, gentle sessions
> and rest — because that is what starting actually looks like — and it never shows
> you a broken streak, a red day or somebody else's time.

This wedge is chosen because it is the only candidate where `[REPO]` the existing
domain model, the existing product principles and the existing test suite are already
correct for it. Everything else requires building against the grain.

`[DEC]` **D-05. Secondary differentiator — a companion that is bound to a real,
private journey.** The hatched species is permanent, tied to the path the user chose,
and its history is the user's own recorded Journeys. `[EXT]` Finch proves the
attachment mechanic works at 4.9/76,000; NinFit's version is attached to *actual
movement*, which Finch's is not.

`[DEC]` **D-06. Long-term moat — local-first fitness truth with portable,
verifiable data.** `[REPO]` Fail-closed backups, semantic restore verification,
quarantine-never-delete, versioned schema, JSON that restores and CSV that honestly
says it does not. `[INF]` As Google, Garmin and Strava move features behind
paywalls and remove data people relied on, "your history is a file you own and can
restore" becomes a durable reason to choose NinFit that a large incumbent structurally
cannot copy without abandoning its own business model.

`[DEC]` **D-07. Rename what the paths promise.** The five paths stay, but
`build_strength`, `build_stamina` and `balanced_fitness` may not be offered until the
programme can express them. Launch offers **Start moving** and **Return to fitness**
(Tortoise and Wolf) and says plainly that more paths are coming. `[REPO]` Only
Tortoise has art regardless, so this costs nothing at launch and removes a
truthfulness violation.

---

# 5. Target customer

## 5.1 ICP

**Primary — "Sam, 41, starting again."** Was active once. Has a desk job, kids or
shift work, a body that has changed, and about 20 spare minutes. `[EXT]` One of the
24.7% inactive or 10.7% fairly-active adults. Has a phone and probably no wearable.

**Secondary — "Nadia, 34, moving with a condition."** Manages fatigue, pain or a
long-term condition. `[EXT]` In the 49.1%-active group. Needs a product that treats
a light day as a real day and never implies she under-performed.

**Explicitly not the launch ICP:** runners chasing a PB, lifters, quantified-self
optimisers, anyone who already owns and loves a Garmin.

## 5.2 The journey into NinFit

| | |
|---|---|
| **Situation before** | Two or three false starts this year. A gym membership they stopped using. An app that showed a broken streak in week two. |
| **Problem** | "I want to be someone who moves again, and every attempt so far has made me feel worse." |
| **Already tried** | Couch-to-5K, Strava, a Fitbit, a gym. `[SENT]` Each abandoned at the first missed week. |
| **Why those failed** | They measured against a plan or against other people, and missing was visible, red and permanent. |
| **Trigger** | A birthday, a photo, a health scare, a friend, or simply a Sunday night. |
| **What NinFit promises** | A gentle first four weeks, a companion that is glad to see you, and a record that is yours. |
| **What NinFit explicitly does NOT promise** | Weight loss. A training plan for a race. Strength programming. Sleep or recovery scoring. Medical advice of any kind. Cloud backup or sync — `[REPO]` NinFit ID does not back up fitness data today. |

## 5.3 Success ladder

| Moment | Success looks like |
|---|---|
| First session | Onboarding completed, egg hatched, companion met, and the user knows exactly what to do next. |
| Day 1 | One real activity recorded — a walk counts. |
| Day 7 | Three or more days with something logged, **including at least one rest day logged as a rest day**. |
| Day 30 | Still opening the app, and can point at their Week and say "that's more than I was doing." |
| Six months | The companion, the Journey history and the sense that this is the one app that never made them feel bad. |

## 5.4 Positioning statement

> **NinFit is a gentle fitness app for people starting again. It plans in walks and
> rest days, not workouts you'll dread. Your companion is always pleased to see you —
> even if it's been three weeks. And everything you record stays on your phone.**

`[DEC]` **D-08.** No startup jargon in any user-facing copy. Not "journey" as a verb,
not "wellness", not "your fitness era". The sentence above is the test: if a normal
person would not say it out loud, it does not ship.

---

# 6. Launch product (v1)

## 6.1 Scope decisions

`[DEC]` **D-09.** Launch scope for every named surface:

| Surface | Decision | Note |
|---|---|---|
| Today | **P0** | Already built `[REPO]` |
| Week | **P0** | Already built |
| Progress | **P0** | Already built |
| Profile | **P0** | Already built |
| Onboarding | **P0** | Already built; paths trimmed per D-07 |
| Egg / hatch | **P0** | Ceremony correct; art gate open |
| Tortoise companion | **P0** | Standing + idle only. **Wave reverted (D-01/D-02).** |
| Day-1 first win | **P0** | #185 merged; #194 selector is P1 |
| Companion reactions | **P1** | Merged; verify no fitness-truth leakage |
| Journey (walk/run) | **P0** | Walk is the launch activity; run recorded honestly |
| GPS recording | **P0** | Recorder is strong; needs real-device battery/lifecycle proof |
| Journey cycle / swim | **P1** | Built; not marketed at launch |
| Adventure Map | **P1** | Needs human proof of the drawn route line on a real device |
| Passport | **P2** | |
| Rewards / XP / trophies | **P1** | Present; must stay quiet |
| Backup / restore | **P0** | Built; needs pilot acceptance |
| Data export / deletion | **P0** | Legal requirement, not a feature |
| NinFit ID | **P2 — off by default** | **Password recovery is missing `[REPO]`.** Do not promote accounts without it |
| PWA install | **P0** | |
| **Offline behaviour** | **P0 — currently failing** | See 6.2 |
| Native Android | P3 | |
| Native iOS | P3 | |
| Health Connect | **P2** | First wearable work; Android first |
| HealthKit | P2 | |
| Garmin / Fitbit / third-party | NOT NOW | |
| Sleep | NOT NOW | Section 8 |
| Recovery / HRV | NOT NOW | Regulatory risk (`[EXT]` Apple, 26 Mar 2026) |
| Steps | **P1** | The single most-requested passive signal `[INF]` |
| Nutrition | NOT NOW | |
| AI coaching | NOT NOW | |
| Social / community / challenges | NOT NOW | |
| Secret Prestige / Living Legacy / Champion / Trophy Room / Living Seasons | P3 | Direction locked, mechanics unbuilt |
| Monetisation / subscriptions | **NOT AT LAUNCH** | Section 12 |
| Notifications | **P1** | Calm notification policy (#129) must land first |
| Analytics | **P0** | Nothing exists `[REPO]`; cannot run a beta blind |
| Crash reporting | **P0** | Nothing exists `[REPO]` |
| Support | **P0** | One email address and a response commitment |
| Privacy / legal | **P0** | Privacy notice must be published, not drafted |
| Accessibility | **P0** | Global reduced-motion is done; screen-reader pass is not |

## 6.2 The offline contradiction — a P0 nobody has called P0

`[REPO]` `public/sw.js` precaches exactly `['/', '/manifest.webmanifest',
'/icons/icon-192.png', '/icons/icon-512.png']`. Vite's content-hashed JS and CSS are
never cached. An offline launch therefore serves the cached HTML shell, which then
requests application bundles that are not there.

`[INF]` For a product whose headline is *local-first*, and whose core activity is
**walking outdoors**, "the app does not start without signal" is not a documented
limitation — it is a broken promise in the exact place the promise matters. A user
starting a walk in a rural lane or a basement gym gets a blank screen holding data
that is sitting on their own device.

`[DEC]` **D-10. Offline app-start is a launch blocker.** The service worker must
precache the built asset manifest so a cold offline launch boots the app.

---

# 7. Not-launch product

Deliberately deferred, with the reason:

| Deferred | Reason |
|---|---|
| Sleep, recovery, HRV, readiness | `[EXT]` Apple's 26 March 2026 medical-device declaration rule makes physiological inference the highest-regulatory-risk surface available. `[INF]` A solo founder should not open it as a launch feature. |
| Wearable integrations beyond steps | `[REPO]` Nothing is built (#108–#110, #114, #123 are all open design issues). Real integration is months, not weeks. |
| Social, friends, crews, leaderboards, kudos | `[INF]` Every one of them requires moderation, abuse handling and a privacy model NinFit has deliberately not built — and comparison is the mechanic the ICP is fleeing. |
| Nutrition / food scanning | Out of wedge. Adds a food-morality risk the principles forbid. |
| AI coaching | Adds inference on health data and a per-user cost. |
| Monetisation | Section 12. |
| Families 2–5 art, evolution stages, habitats, cosmetics, Trophy Room, Living Seasons | `[REPO]` Nineteen unbuilt character sets. Post-revenue work. |
| Native apps | The PWA is the cheapest route to real users. Revisit when install friction is measured, not assumed. |

---

# 8. First 30 days experience

| Phase | What happens | Why they continue | Truth / safety boundary |
|---|---|---|---|
| **Day 0** | Install → intro → 4 core questions + adaptive follow-ups → path recommendation the user can override → egg cracks stage by stage as they answer → "Start my journey" → hatch → meet the Tortoise. | Curiosity: the egg visibly responds to *their* answers. | `[REPO]` Species must not leak before the hatch; hatch grants no XP or trophy; species is permanent. |
| **Day 1** | One clear first step, sized to the answers given. A ten-minute walk is a complete success. | The first win is achievable on the worst day of the week. | The companion reacts to a genuine recorded activity, never to an app open. |
| **Days 2–7** | Week view fills with what actually happened. A logged rest day is a filled day, not a gap. First Journey recorded. | Nothing is red. Nothing is missing. | `[REPO]` `not_yet` and `unplanned` draw identically — the only inference available from separating them is blame. |
| **Week 2** | Personalisation becomes visible: the plan adapts to what they actually did. | "It noticed." | Adaptation must be explainable in one sentence, never a hidden score. |
| **Week 3 — the churn cliff** | **The critical week.** Most people miss several days here. | **This is the wedge.** Returning after a gap is greeted warmly, the plan steps down automatically, and nothing is lost. | No catch-up debt, no decay, no "you missed 4 days". |
| **Week 4** | A first-month recap: what they did, in their words, with no grade. | Evidence they are different from four weeks ago. | Recap states only recorded facts. No projection, no target. |
| **Month 2+** | Adventure Map fills in. Journey history accumulates. Companion history deepens. | The record becomes theirs and worth keeping. | Bond may grow from genuine shared history and **never decays**. |
| **Return after absence** | Welcomed. Programme steps back to Tiny. Companion is pleased. | The one thing no competitor does. | `[REPO]` Permanent progress is never removed through absence. |

`[INF]` **Week 3 is the product.** Everything else in this document is in service of
being the app that handles week three correctly. Beta measurement (section 11) is
designed around it.

---

# 9. Technical release gate

Objective pass/fail. Every line is a command or an artefact, not a judgement.

## 9.1 Automated gate — must all pass on the release SHA

| # | Check | Pass condition | Status at `95c9cca` |
|---|---|---|---|
| G1 | `npm test` | 0 failures | **PASS** (2,035) |
| G2 | `npm run typecheck` | exit 0 | **PASS** |
| G3 | `npm run build` | exit 0 | **PASS** |
| G4 | `git diff --check` on the PR range | clean | **PASS** |
| G5 | `npm audit` | 0 high, 0 critical | **PASS** (0 of everything) |
| G6 | First-load JS+CSS gzip | ≤ 200 kB | **PASS** (~136 kB) |
| G7 | Lighthouse PWA installable | installable = true | **NOT RUN** |
| G8 | Cold offline launch boots the app | app renders, not a blank shell | **FAIL** — D-10 |
| G9 | No third-party generator watermark in any shipped asset | zero | **FAIL** — H2 |
| G10 | Every `MASCOT_STAGE_ART` entry pairs a still with **its own** motion master's frame 0 | bboxes identical | **FAIL** — H1 |
| G11 | Alpha-matte green excess on shipped character assets | mean ≤ 5 | **FAIL** — H3 (53.8) |
| G12 | Crash reporting reports a deliberately thrown error | event received | **FAIL** — none exists |
| G13 | Analytics receives the six core events | all six | **FAIL** — none exists |
| G14 | Privacy notice reachable from Settings and from the store listing | live URL | **FAIL** — skeleton only |

`[DEC]` **D-11.** G9, G10 and G11 become **enforced tests in the repository**, not
checklist items. A pixel contract that only a human can check is a contract that will
break again. G10 in particular is trivially testable — decode frame 0, compare alpha
bounding boxes — and would have caught H1 before merge.

## 9.2 Human acceptance gate — real devices, real hands

`[REPO]` CI cannot see any of these. Every one of the four merged-and-defective
findings above passed a green suite.

| # | Behaviour | Devices |
|---|---|---|
| H-A | Full hatch ceremony: one companion on screen at all times, no ghost, no watermark, no cut-off gesture | 1 iPhone, 1 Android, both themes |
| H-B | Reduced-motion hatch: three still states, Skip works, companion arrives | both |
| H-C | Motion asset forced to fail: standing companion still reachable, user never trapped | both |
| H-D | 30-minute outdoor walk with screen locked: route drawn, distance sane, no gaps | both, real streets |
| H-E | Battery drain across that 30 minutes recorded and stated | both |
| H-F | Airplane-mode cold start: app boots and shows existing data | both |
| H-G | Backup → clear site data → restore: history returns, verified read-back | both |
| H-H | Adventure Map route line visibly drawn on a real GPU | both |
| H-I | VoiceOver / TalkBack pass on Today, Week, Journey start/stop, Settings → Data | both |
| H-J | Install to home screen, launch from icon, update to a new build without losing data | both |
| H-K | A three-week absence, simulated by clock change: no punishment anywhere | both |

`[DEC]` **D-12. Human acceptance is a gate, not a courtesy.** A green CI run is
explicitly not sufficient authority to ship a visible change. This summit exists
partly because that rule was not enforced on #197.

---

# 10. Risk register

Ranked by likelihood × impact.

| # | Risk | L | I | Mitigation | Owner | Blocks launch? |
|---|---|---|---|---|---|---|
| R1 | Watermarked/defective companion art ships to real users | **High** | **High** | D-01/D-02 revert now; G9–G11 as tests | Art + Eng | **YES** |
| R2 | Offline start fails for a local-first walking app | **High** | **High** | D-10 precache the asset manifest | Eng | **YES** |
| R3 | Launching blind — no analytics, no crash reporting `[REPO]` | **High** | **High** | Privacy-safe minimal event set + crash reporter before beta | Data + Eng | **YES** |
| R4 | Data loss on a real device (quota, corruption, clear-site-data) | Med | **Critical** | Pilot acceptance H-G; existing fail-closed + quarantine work is strong | Eng + QA | **YES** |
| R5 | Accounts promoted without password recovery `[REPO]` | Med | **High** | Keep NinFit ID off by default; build recovery before any promotion | Eng + Support | **YES** (if accounts shown) |
| R6 | Positioning too broad — five paths the programme cannot deliver | **High** | Med | D-07 trim to two paths | Product | **YES** |
| R7 | Scope creep from 46 open design issues | **High** | Med | This roadmap is the filter; issues are a backlog, not a plan | CEO | No |
| R8 | Founder capacity — one person, three products `[REPO context]` | **High** | **High** | Milestones sized to one person; nothing in NOW needs new art | CEO | No |
| R9 | GPS battery drain on long walks | Med | **High** | H-E measured and published before beta | Mobile | **YES** |
| R10 | App Store medical-device declaration `[EXT 26 Mar 2026]` | Med | **High** | Declare "not a medical device"; keep all health language neutral; no recovery/HRV at launch | Legal | **YES** (store submission) |
| R11 | UK GDPR: no privacy notice published | Med | **High** | Publish before any real user | Legal | **YES** |
| R12 | WebM alpha support on iOS Safari for companion motion | Med | Med | Motion already falls back to the standing still on error `[REPO]`; verify on a real iPhone at H-A | Mobile | No |
| R13 | Retention fails — people leave in week 3 anyway | Med | **Critical** | The beta is designed to measure exactly this | Product | No |
| R14 | Nobody can find the product | **High** | Med | Section 11; wedge is narrow enough to name a community | Growth | No |
| R15 | Art pipeline stalls on four remaining families | **High** | Med | Ship with one family and a letter fallback that already works `[REPO]` | Art | No |
| R16 | 13 MB `dist` on mobile data | Med | Low | Backgrounds are lazy per region; measure real transfer at H-D | Eng | No |
| R17 | Subscription introduced too early and kills goodwill | Low | **High** | D-15: no monetisation at launch | Commercial | No |
| R18 | Supabase/Vercel/MapLibre dependency change | Low | Med | `docs/THIRD_PARTY_SERVICE_REGISTER.md` exists; app already runs without Supabase `[REPO #191]` | Eng | No |
| R19 | Accessibility failure in a screen-reader review | Med | Med | H-I before beta | A11y | No |
| R20 | Five `useGame()` instances hold divergent state `[REPO]` | Low | Med | Known, documented, partially mitigated by durable delivery; extend the DOM lane | Eng | No |

---

# 11. Go-to-market

## 11.1 Beta

`[DEC]` **D-13. Private beta of 15–25 people, recruited by hand.** Not 100. The
objective is depth: eleven human acceptance behaviours and one honest answer about
week three.

| | |
|---|---|
| Who | People who have told the founder, unprompted, that they want to get back into it |
| Where | Direct relationships first; South Wales walking groups, parkrun volunteers, local Facebook community groups, workplace wellbeing contacts |
| How long | Four weeks minimum — the beta must cross week three or it has measured nothing |
| Feedback | A 10-minute call at day 7 and day 28. Not a form. |
| Bug reporting | One email address, and a build identifier already visible in Settings `[REPO #81]` |

## 11.2 Public beta and launch

Public beta only after the private beta has crossed week three with at least half the
cohort still opening the app. Launch surfaces, in order of expected value for this
wedge:

1. **The founder story, told honestly.** `[INF]` "I built the app I needed to start
   again" is the only marketing asset a solo founder has that an incumbent cannot buy.
2. **UK walking and beginner communities** — r/CouchTo5K-adjacent, walking groups,
   long-term-condition communities. `[DEC]` **D-14. Participate before posting.** No
   launch post in any community the founder has not been part of for a month.
3. **Short vertical video of the hatch** — once the art is clean, it is the single
   most shareable thing NinFit has.
4. **Product Hunt** — worth one day, low expectation. Wrong audience for this ICP.
5. **Local South Wales press / community** — genuinely useful for a UK-first product.

## 11.3 Analytics — the minimum honest set

`[DEC]` **D-15. Six events, no more, no health data, no route data, no free text.**

`onboarding_completed`, `hatch_completed`, `first_activity_recorded`,
`activity_recorded` (with `type` and `is_rest`), `journey_completed`,
`app_opened_after_gap` (with a bucketed gap length).

`[INF]` These six answer every question the beta needs and none of them carry
anything a user would be upset to see in a settings page.

## 11.4 What would convince us

| Claim | Evidence that would convince us |
|---|---|
| **The product works** | ≥ 80% of the cohort complete onboarding and record a Day 1 activity without help |
| **The product retains** | ≥ 50% still recording something in week 4, and **at least a third of those returned after a gap of 4+ days** |
| **The positioning works** | In day-28 calls, people describe NinFit back in words close to the positioning statement, unprompted |
| **People would pay** | ≥ 30% say yes to a specific price when asked at day 28 — and `[INF]` treat that as a weak signal until money actually moves |

---

# 12. Monetisation

`[EXT]` Competitor context, 2026-09-05: Strava £54.99/yr, Runna £99.99/yr, bundle
£119.99/yr, Apple Fitness+ £79.99/yr, Gentler Streak £40.99/yr or £59.99 lifetime,
Finch £4.99–£69.99 tiers, Zombies Run £49.99/yr, WHOOP $199–$359/yr, Garmin Connect+
~$69.99/yr.

`[DEC]` **D-16. NinFit v1 is free. No subscription, no IAP, no paywall.**

Reasons: `[EXT]` the ICP is disproportionately lower-income, the group with the
largest activity gap; `[SENT]` the market's loudest current complaint is
subscription stacking and features moving behind paywalls; `[INF]` NinFit has one
companion family and no wearable integration — there is nothing honest to charge for
yet.

`[DEC]` **D-17. The future model is a one-time "Founding Supporter" purchase, not a
subscription.** `[HYP]` £9.99–£14.99 one-off, buying: cosmetic-only companion
customisation, additional background regions, and a supporter mark. Explicitly never
purchasable: XP, trophies, achievements, Secret Prestige, evolution, extra eggs,
species rerolls, streak protection, or anything that touches fitness truth.

`[HYP]` Illustrative only, not a forecast: 1,000 installs × 5% conversion × £12 ≈
£600. That is not a business; it is a signal that the value is real. A subscription
becomes discussable only when NinFit delivers something with an ongoing cost —
wearable sync, or a genuine coaching layer — and not before.

`[DEC]` **D-18. Gentler Streak's lifetime tier (£59.99) is the model to study**, not
Strava's. A one-off purchase from a calm product is congruent; a subscription from a
product about not being pressured is not.

---

# 13. Department reports

Each department reports against the verified baseline. Disagreements are recorded,
not smoothed.

### 01. CEO / Product Leadership
**Strong:** an unusually disciplined decision record and a genuine ethical spine.
**Incomplete:** the product is described more thoroughly than it is scoped.
**Risky:** 46 open design issues and one open PR is a planning-to-building ratio of
46:1. **Stop:** writing new design issues. **Start:** closing or explicitly parking
them. **Continue:** the decision log. **Top three:** revert the defective art lane;
pick the wedge (done, D-04); get 20 real people using it.

### 02. Product Management
**Strong:** locked decisions with revisit triggers — genuinely rare.
**Weak:** `[REPO]` five paths, two deliverable. **Debt:** the ROADMAP is 3,530 lines
across 34 phases; it is a vision document being used as a plan. **Before launch:**
D-07 path trim, and a one-page scope that fits on a screen. **Needs from Eng:** an
honest statement of what the programme can express.

### 03. Engineering & Software Architecture
**Strong:** `[REPO]` pure domain layer, repository boundary, 1.17:1 test-to-source,
zero dependency vulnerabilities, 1.13 s production build, app runs without Supabase.
**Weak:** offline start (D-10); five `useGame()` instances that can diverge; `base:
'./'` in `vite.config.ts` contradicted by absolute `/mascots/`, `/icons/` and
`/manifest.webmanifest` paths, so a sub-path deploy would break. **Debt:** 154 remote
branches, ~35 of them `verify/pr151-*` and `ci(temp)` throwaways. **Stop:** creating
verification branches on the remote. **Start:** deleting merged branches on merge.

### 04. Mobile / PWA / Native
**Strong:** viewport-fit safe areas, network-first navigation, update reliability
work, responsive baseline verified at 360/390/430/768/1024/1440.
**Weak:** offline is shell-only; manifest declares both icons `"purpose": "any
maskable"` which will render zoomed on Android; no battery measurement for GPS.
**Before launch:** D-10, H-D, H-E, H-J. **Disagreement recorded:** Mobile wants
native Android for reliable background GPS; Engineering and CEO overrule for launch —
`[REPO]` foreground recording is what exists and what is tested.

### 05. QA / Test / Release Engineering
**Strong:** 2,035 tests, a real CI gate on Node 24, a whitespace check that compares
the actual PR diff.
**Weak — and this is the department's headline:** the suite tests *wiring*, not
*pixels*. `[REPO]` `tortoiseHatchWaveShake.dom.test.tsx` asserts that the standing
image and the video both exist and that the `--under-wave` class is applied — the
exact configuration that produces the defect. **The test proves the bug is present
and calls it a pass.** **Start:** asset-contract tests (G9–G11). **Stop:** treating
green CI as authority to ship a visible change.

### 06. UX / UI Design
**Strong:** one obvious next action per screen; neutral Week trail; no score or
percentage anywhere; a genuinely calm information architecture.
**Weak:** the letter-glyph fallback is load-bearing for 19 of 20 companion
stage/family combinations `[REPO]`. **Before launch:** make the glyph state look
deliberate rather than unfinished. **Needs from Art:** nothing — the fallback must
work without art, permanently.

### 07. Art / Animation / Companion Experience
**Strong:** the egg stage system, the Tortoise idle master and its frame-0 still are
genuinely good and correctly paired.
**Weak:** the wave master is watermarked, green-spilled, and mispaired.
**Debt:** four families and nineteen stage sets unbuilt. **Stop:** wiring generated
art before the visual-asset-pipeline gate passes. **Start:** the T1B clean wave
master `docs/specs/active/tortoise-starter-clean-wave-v1.md`, which is already
specified and unbuilt. **Top priority:** unblock D-01 permanently.

### 08. Fitness & Behaviour Design
**Question asked of it:** *if all mascot graphics disappeared tomorrow, would NinFit
still be useful?* **Answer: yes, but only for one kind of person.** `[REPO]` The
strongest fitness capability is the Journey recorder — accuracy-gated GPS, honest
distance, walk and run kept distinct. The programme layer is a gentle-movement
journal.
**Missing for a credible v1:** nothing, *if* the wedge is D-04. **Everything**, if
the wedge were general fitness.
**Claims we may responsibly make:** "helps you start moving again", "records your
walks honestly", "your history stays on your phone".
**Claims we may NOT make:** improves fitness, aids weight loss, improves sleep,
prevents anything, is suitable for a condition.
**Rest:** already correct — planned rest is adherence.
**Illness/injury:** offer to step the programme down; never ask why; never record a
reason; never infer.
**Overtraining:** the intensity vocabulary caps at `light` `[REPO]`, so the product
structurally cannot incentivise overtraining today. Preserve that property when
intensity is expanded.

### 09. Health / Sleep / Recovery
**Position:** `[EXT]` after Apple's 26 March 2026 declaration requirement, any
readiness or recovery score is a regulatory conversation. **Recommendation: sleep and
recovery are NOT NOW.** The minimum that would add real value later is a manual
"how did you sleep / how's your energy" check-in that adapts the plan and **never
scores the person** (#105). **Disagreement recorded:** the Health team believes a
manual energy check-in is cheap enough to be P1; Safety and CEO hold it at P2 to keep
the launch surface minimal.

### 10. Wearables / Health Connect / HealthKit
**Reality:** `[REPO]` nothing built; #108, #109, #110, #114, #123 are open designs.
**Which matters first:** **steps, read-only, via Health Connect on Android.** It is
the one signal the ICP already generates without doing anything, it is the cheapest
integration, and read-only sidesteps the hardest provenance problems. **Not before
launch.**

### 11. Safety / Privacy / Security
**Strong:** `[REPO]` local-first authority, publishable-config-only client, corrupt
values quarantined not deleted, route privacy that splits rather than joins, health
notes never classified. This is the best-executed area of the product.
**Weak:** the privacy notice is a skeleton, not a published document. **Before
launch:** publish it; complete the deletion path end to end; state device-loss risk
plainly at the point of first use, not only in Settings.
**Objection, upheld:** Safety objects to any launch that promotes NinFit ID while
password recovery does not exist `[REPO]`. Upheld as R5.

### 12. Data / Analytics / Experimentation
**Reality:** `[REPO]` zero instrumentation. **Before launch:** the six events in
D-15, self-hosted or privacy-first, opt-out visible in Settings. **Stop:** planning
experimentation; there is no traffic to experiment on. **Needs from Legal:** a
sentence in the privacy notice covering exactly those six events.

### 13. Accessibility & Inclusive Design
**Strong:** `[REPO]` one global `@layer motion` rule kills every animation under
`prefers-reduced-motion` — no component has to remember; decorative art is
`aria-hidden`; the Week trail restates every fact in words.
**Weak:** no screen-reader pass has been recorded; no contrast audit; the letter
glyph is decorative-only, so a screen-reader user currently gets nothing where the
companion is.
**Before launch:** H-I. **Continue:** the global-rule pattern — it is the reason
reduced motion has held through seven feature steps.

### 14. Growth / Marketing / Acquisition
**Strong:** a genuine founder story and a wedge narrow enough to name a community.
**Weak:** no landing page, no store listing, no screenshots, and the most shareable
asset in the product is currently watermarked.
**Disagreement recorded:** Growth wanted the "calm Strava" position (candidate D) as
easier to market; overruled on truthfulness grounds (4.2). Growth's mitigation
accepted: lead with **walking**, which is concrete, universal, and something NinFit
genuinely does.

### 15. Community / Engagement / Retention
**Position:** `[EXT]` Google removed community and Badges from the Fitbit app on 19
May 2026. `[INF]` There is a displaced audience, but NinFit must not chase it —
community means moderation. **Retention at launch is the companion and week three,
not other people.**

### 16. Commercial Strategy
Section 12. **Objection recorded:** Commercial believes free-forever with no
monetisation path is how solo products die quietly, and wants a supporter purchase in
the public beta rather than after. **Resolution:** CEO accepts the risk and holds at
D-16, because charging before week-three retention is proven would be charging for a
hypothesis.

### 17. Customer Support / Operations
**Reality:** no support surface exists. **Before launch:** one email address, a
stated response time, a build identifier in every report `[REPO #81]`, and a written
answer to "I lost my data" — because with local-first storage that answer is
genuinely hard and must be honest.

### 18. Legal / Compliance / App Store Readiness
**Before launch, all mandatory:** publish the privacy notice; declare **not a
medical device** under Apple's 26 March 2026 rule `[EXT]`; UK GDPR lawful basis and
data-subject rights (export exists; deletion must be complete and provable); a
plain-English statement that data is on-device and that losing the device loses the
data; licence and provenance record for every shipped asset — **including removing
the Pika-watermarked wave**, which is both a brand and a provenance problem.
`[EXT]` Existing apps must declare medical-device status by early 2027 or lose the
ability to update, so this is not optional even if launch is web-only first.

### 19. Competitive Intelligence
Section 3. **Headline:** the three products NinFit must actually beat are Finch,
Gentler Streak and Zombies Run! — not Strava. **Recommendation:** track Google
Health's recovery from the May 2026 migration; if Badges and community do not return,
that displaced audience is NinFit's cheapest acquisition channel `[HYP]`.

### 20. Launch / Release Management
**Before launch:** a rehearsed rollback (the runbook exists at
`docs/release/release-and-rollback-runbook-v1.md` but has not been exercised), a
release identity visible in-app, and the gate in section 9 signed off. **Stop:**
merging visible changes on CI alone. **Start:** a human acceptance sign-off line in
every PR that touches a screen.

### 21. Art Pipeline Operations — *new department, and here is why*
`[INF]` Three of the four launch-blocking defects on `main` are asset-provenance
failures, not code failures: a watermark, an unfinished key, and a mispaired still.
None of them is anybody's current job. `[DEC]` **D-19. Asset provenance is a named
responsibility** with a machine-checkable manifest: for every shipped asset — source,
generator, licence, whether it is watermarked, its matte quality, and which motion
master its still belongs to. `skills/ninfit-visual-asset-pipeline/SKILL.md` describes
the gate; nothing enforces it.

---

# 14. Department ownership

| Area | Owner |
|---|---|
| Product scope, wedge, positioning | CEO / Product |
| Domain model, storage, offline, PWA | Engineering |
| Companion art, masters, mattes, provenance manifest | Art Pipeline Operations |
| Release gate, asset-contract tests, human acceptance | QA / Release |
| Privacy notice, medical-device declaration, GDPR | Legal / Safety |
| Analytics events and their privacy statement | Data (with Legal) |
| Beta recruitment, day-7 and day-28 calls | Growth (CEO in practice) |
| Support inbox and the "I lost my data" answer | Support |

`[INF]` Every one of these is the same person. The table is a statement of hats, and
of which hat must be worn when. Its practical value is that it says **when the founder
must stop being the engineer** — specifically, at the human acceptance gate.

---

# 15. Roadmap from today

Milestones, not dates. Each states what unlocks next.

## NOW — this week

**M1. Revert the defective wave from the hatch and from Today.**
*Why now:* it is on `main` and it is the product's most important moment.
*Owner:* Engineering + Art. *Depends on:* nothing.
*Deliverables:* remove `motionSrc` from the hatch path and from Today's tap-to-wave;
keep the standing + idle presentation exactly as it is; keep the media-failure
fallback; update `tortoiseHatchWaveShake.dom.test.tsx` to assert the wave is **not**
mounted.
*Acceptance:* full suite green; H-A and H-B pass on a real iPhone and a real Android.
*Human review:* **required.** *Unlocks:* an honest private beta.

**M2. Asset-contract tests (G9, G10, G11).**
*Why now:* the same class of defect will recur otherwise.
*Owner:* QA. *Depends on:* M1.
*Deliverables:* a test that decodes each motion master's frame 0 and asserts its alpha
bounding box equals its paired still's; a watermark/provenance assertion driven by a
committed manifest; a matte-spill threshold check.
*Acceptance:* the tests fail on `95c9cca`'s asset pairing and pass after M1.
*Human review:* not required. *Unlocks:* re-landing motion safely, ever.

**M3. Offline app-start.**
*Why now:* D-10; the local-first promise is currently false where it matters.
*Owner:* Engineering. *Depends on:* nothing.
*Deliverables:* precache the built asset manifest; a test that a cold offline
navigation resolves the app bundle.
*Acceptance:* H-F passes on both devices in airplane mode.
*Human review:* required. *Unlocks:* outdoor and rural use, which is the core activity.

## NEXT

**M4. Instrumentation.** The six D-15 events plus a crash reporter, both privacy-safe
and opt-out. *Unlocks:* a beta that measures anything.
**M5. Path trim (D-07).** Offer Start moving and Return to fitness only.
*Unlocks:* a truthful onboarding.
**M6. Privacy notice published + medical-device declaration prepared.**
*Unlocks:* legally letting a stranger use it.
**M7. Support surface.** One address, one response commitment, one honest data-loss
answer. *Unlocks:* real users.

## PRE-BETA

**M8. Human acceptance sweep H-A → H-K** on one iPhone and one Android, recorded in
`docs/pilot/device-accessibility-acceptance-matrix-v1.md`.
**M9. GPS battery measurement** over a real 30-minute walk, published as a number.
**M10. Rollback rehearsal** against the existing runbook.
**M11. Screen-reader pass** on Today, Week, Journey start/stop, Settings → Data.

## PRIVATE BETA

**M12.** 15–25 people, four weeks, day-7 and day-28 calls. Success criteria in 11.4.
*Unlocks:* the only honest answer to "does this retain".

## PUBLIC BETA

**M13.** Landing page and store-ready listing built around the D-08 positioning
sentence. **M14.** Clean T1B wave master → re-land motion behind the M2 gate.
**M15.** Steps via Health Connect, read-only, Android.

## V1 LAUNCH

**M16.** Full section-9 gate green, including every currently-failing line.
**M17.** Four weeks of public-beta retention data that meets 11.4.

## POST-LAUNCH 30 DAYS

**M18.** Week-3 return behaviour analysed against `app_opened_after_gap`.
**M19.** Calm notification policy (#129) — only if the beta shows people forget rather
than refuse. **M20.** Second companion family, art permitting.

## NEXT 3 MONTHS

**M21.** Manual sleep/energy check-in (#105) if wanted, still unscored.
**M22.** HealthKit read-only. **M23.** Supporter purchase (D-17) if 11.4's payment
signal held. **M24.** Programme vocabulary extended — the first honest step toward
`build_stamina`.

## LONGER-TERM

Families 2–5, evolution stages, Passport depth, Secret Prestige, Living Legacy,
Adventure expansion, cloud backup — each gated on revenue or on a proven retention
need, never on enthusiasm.

---

# 16. Next ten execution tasks, in dependency order

| # | Task | Best owner |
|---|---|---|
| 1 | Revert the wave from `HatchCompanionMedia` and Today; keep standing + idle; keep failure fallback | **CODEX** |
| 2 | Rewrite `tortoiseHatchWaveShake.dom.test.tsx` to assert the wave is absent and one companion element renders | **CODEX** |
| 3 | Add the frame-0 pairing test (G10) — decode alpha, compare bounding boxes | **COWORK** (needs ffmpeg/Pillow) |
| 4 | Add the asset provenance manifest + watermark/matte assertions (G9, G11) | **COWORK** |
| 5 | Service-worker precache of the built asset manifest + offline-boot test | **CODEX** |
| 6 | Human acceptance H-A, H-B, H-C, H-F on a real iPhone and Android | **HUMAN / CEO** |
| 7 | Wire the six analytics events + a crash reporter, opt-out in Settings | **CODEX** |
| 8 | Trim onboarding paths to Start moving and Return to fitness (D-07) | **CODEX** |
| 9 | Publish the privacy notice; prepare the not-a-medical-device declaration | **HUMAN / CEO** (Legal) |
| 10 | Produce the clean T1B Tortoise wave master, un-watermarked, cleanly keyed, with its frame-0 still | **DESIGN / ART TOOLING**, human-approved |

Tasks 1, 2, 5, 7 and 8 are small, bounded and well-specified — ideal Codex slices.
Tasks 3 and 4 need media tooling and belong in a Cowork session. Tasks 6, 9 and 10
cannot be delegated to any agent.

---

# 17. Stop / Start / Continue

**STOP**
- Merging visible changes on green CI alone.
- Wiring generated art into runtime before the asset gate passes.
- Writing new design issues while 46 are open and one PR is.
- Creating `verify/*` and `ci(temp)` branches on the remote.
- Describing NinFit as a five-path fitness product.

**START**
- Machine-checkable asset contracts (frame-0 pairing, watermark, matte).
- A human acceptance line in every PR that changes a screen.
- Measuring: six events, one crash reporter.
- Treating offline app-start as a core promise.
- Talking to twenty real people who are trying to start again.

**CONTINUE**
- The decision log and its revisit triggers.
- Local-first authority, fail-closed backups, quarantine-never-delete.
- The global reduced-motion rule and the aria-hidden decorative-art discipline.
- Refusing guilt, streak pressure, comparison and fake progress. It is the product.
- Rebuilding intent on current `main` rather than resurrecting stale branches.

---

# 18. CEO decision log

| # | Decision | Why |
|---|---|---|
| D-01 | Revert the wave from the hatch on `main` | Watermarked, mispaired and green-spilled art in the product's defining moment `[REPO]` |
| D-02 | Revert Today's tap-to-wave with it | Same asset, same defects |
| D-03 | Do not compete for the experienced endurance athlete | `[EXT]` Strava + Runna + Garmin + WHOOP serve them comprehensively |
| D-04 | Primary wedge: the first four weeks of starting again | Only candidate the existing domain model already fits `[REPO]` |
| D-05 | Secondary: a companion bound to a real, private journey | `[EXT]` Finch proves the mechanic; NinFit ties it to genuine movement |
| D-06 | Moat: local-first fitness truth with portable, verifiable data | `[EXT]` Incumbents are moving the other way and structurally cannot follow |
| D-07 | Launch with two paths, not five | `[REPO]` The programme cannot express strength or stamina |
| D-08 | Plain English only in user-facing copy | The ICP is not a startup audience |
| D-09 | P0–P3 scope as tabled in 6.1 | Smallest product we would be proud to hand over |
| D-10 | Offline app-start is a launch blocker | `[REPO]` Shell-only precache breaks the local-first promise outdoors |
| D-11 | G9–G11 become enforced tests | A contract only a human can check will break again |
| D-12 | Human acceptance is a gate, not a courtesy | Four defects passed a green suite |
| D-13 | Private beta of 15–25, four weeks minimum | Must cross week three to have measured anything |
| D-14 | Participate in communities before posting | Avoids spam and earns the right to be heard |
| D-15 | Six analytics events, no health or route data | Enough to learn, nothing to regret |
| D-16 | v1 is free — no subscription, no IAP | `[EXT]` ICP is lowest-income; nothing honest to charge for yet |
| D-17 | Future model is a one-time supporter purchase | Congruent with a calm product; never touches fitness truth |
| D-18 | Study Gentler Streak's lifetime tier, not Strava's subscription | Price model must match product promise |
| D-19 | Asset provenance is a named responsibility with a manifest | Three of four blockers were provenance failures |

---

# 19. CEO brief

**Where are we?** `main` is `95c9ccab`, 437 commits, 2,035 tests green, typecheck
green, production build green, zero dependency vulnerabilities. One open PR (#194),
46 open design issues, zero closed. Engineering health is genuinely good. Product
scope is not.

**What have we built?** A local-first gentle-movement journal with a real GPS Journey
recorder, an excellent data-integrity and privacy spine, a correct and accessible
hatch ceremony, and one companion family with artwork.

**Who are we building for?** People starting again — `[EXT]` the 24.7% of English
adults who are inactive and the 10.7% who are fairly active, especially those with a
long-term condition, for whom the activity gap is widest (49.1% vs 69.8%).

**Why would they choose NinFit?** Because it plans in walks and rest days, because
week three does not punish them, and because their history is a file they own.

**What is our gap?** Every major platform moved toward athletes, subscriptions and
paywalls in the last eighteen months. Nobody is building the calm, cheap, private
first-four-weeks product.

**What must be finished before real users arrive?** Revert the defective wave.
Fix offline start. Add analytics and crash reporting. Trim the paths to two. Publish
the privacy notice. Complete a human acceptance sweep on real devices.

**What are we deliberately not building yet?** Sleep, recovery, HRV, wearables beyond
steps, nutrition, AI coaching, social, native apps, monetisation, and families 2–5.

**Five biggest risks.** 1) Watermarked/defective art shipping. 2) Offline start
failing for a local-first walking app. 3) Launching blind with no measurement.
4) Data loss on a real device. 5) Founder capacity across three products.

**Next three actions.** 1) Revert the wave from the hatch and Today. 2) Add the
frame-0 pairing and provenance tests. 3) Fix the service-worker precache.

**How close are we?**

| | Distance | Gate |
|---|---|---|
| **Private beta** | **Close** — M1, M3, M4, M6, M7 and one device sweep | Nothing here needs new art or new architecture |
| **Public beta** | **Medium** — needs the clean wave master, a landing page and a store listing | Blocked on art the company must produce |
| **V1 launch** | **Further** — needs four weeks of beta retention data that meets 11.4 | Blocked on evidence, not code |

The honest summary: NinFit is a well-built product pointed at a market that is
slightly too large for it, carrying four small defects in its most important moment.
Fix the moment, narrow the aim, and put it in twenty pairs of hands.
