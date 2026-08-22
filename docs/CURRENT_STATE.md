# NinFit Current State

A short live checkpoint, for a human or an agent picking the project up cold.

**This file goes stale by design.** It is a snapshot written at a moment; the
repository keeps moving. Live Git always outranks it. If they disagree, believe Git,
say so, and update this file — see `skills/ninfit-handoff/SKILL.md`.

Last updated: **2026-08-22**

## Repository truth

| | |
|---|---|
| Remote | `https://github.com/krisninnis/ninfit.git` |
| `main` at last update | `c1511eacd20b07d21419d31b9a58d711b411c085` |
| Latest merged PR | **#14** — Establish the canonical NinFit delivery loop (`6d58122`) |
| Latest merged **product** PR | **#13** — Phase 8.1 reward acknowledgement (`67b58ea`) |
| Test baseline on `main` | **43 files / 1267 tests**, `npm run typecheck` exit 0, `npm run build` exit 0, `git diff --check` clean |
| Node | `24.x` (`package.json` `engines`) |
| Deployment | Not established from the repository. No CI configuration, no `vercel.json`, no Dockerfile; `.vercel` is gitignored. Treat as INVESTIGATE — see `docs/production-readiness.md`. |

Verify all of the above before acting. The commands and the three safety verdicts
are in `skills/ninfit-delivery-loop/SKILL.md` §2.

## Completed

Merged into `main`, most recent first:

| PR | Merge | What landed |
|---|---|---|
| #14 | `c1511ea` | **Canonical delivery loop** — `skills/ninfit-delivery-loop/` plus pointers from the handoff and repository-workflow skills (`6d58122`) |
| #13 | `3850706` | **Phase 8.1** — Reward acknowledgement (`67b58ea`) |
| #12 | `2103ed4` | Phase 8 reward presentation specification — `docs/product/ninfit-reward-presentation-v1.md` (`2177bc8`) |
| #11 | `482977d` | Roadmap marked Phase 7 complete (`6f96591`) |
| #10 | `8d7d4a0` | Checkpoint recorded after Phase 7 (`6576b87`) |
| #9 | `0c5dc7e` | **Phase 7D** — Data polish: weight follows consequence (`305f0f1`) |
| #8 | `4f4e6ec` | **Phase 7C** — Profile section hierarchy (`b2237b2`) |
| #7 | `cf66a56` | Roadmap status alignment (`0c1ce2a`) |
| #6 | `bd3ec89` | Durable handoff system — `docs/CURRENT_STATE.md`, `docs/DECISIONS.md`, `skills/ninfit-handoff/` (`aea4f8d`) |
| #5 | `09fff70` | **Phase 7B** — Progress polish: trend rows lead with the current reading (`363f914`) |
| #4 | `358211f` | Production-readiness review framework (`skills/production-readiness/`) and the NinFit profile (`docs/production-readiness.md`) |
| #3 | `eb4d811` | **Phase 7A** — Week seven-day journey trail (`04edbd4`) |
| #2 | `5456d13` | **Phase 6** — Today/Home redesign and the onboarding hatch journey (`0da5a61`, `52ef954`, `7f70fec`, `001a109`) |
| #1 | `54dc070` | NinFit world, account journey, 17 background regions, production background assets |

## Current work

**PHASE 8.1 IS COMPLETE**, and the development workflow it exposed is now written
down.

**Phase 8.1 — Reward Acknowledgement Foundation** (PR #13). Today now says *what* was
just earned instead of only how much. Verified against the source at `c1511ea`:

- `RewardAcknowledgement.tsx` renders the newly granted delta; **every** event gets a
  line, with no truncation and no "and others".
- Visible wording is `RewardEvent.label`, unmodified — the UI orders and styles, and
  never composes reward phrasing.
- Two presentation tiers, `standard` and `reward`, from an exhaustive
  `Record<RewardKind, RewardTier>`, so an eighth kind fails to compile rather than
  silently taking the calm tier. Nothing is cinematic.
- Multi-event ordering: reward tier first, the domain's own order kept within each.
- Bounded dwell: 2200 ms, +600 ms per extra line, capped at 4400 ms.
- Reduced motion respected — the dwell timer starts on mount and is tied to no
  transition, so the message survives when the animation is collapsed by
  `src/styles/motion.css`.
- `.xpfloat` retired from source and CSS.
- **No file under `src/domain`, `src/app` or `src/storage` was modified.** The
  boundary declared in the specification held.

The authoritative contract is `docs/product/ninfit-reward-presentation-v1.md`.

**Canonical delivery loop** (PR #14). `skills/ninfit-delivery-loop/SKILL.md` is now
the governing development workflow: task classes, slice size, when a specification is
required and the lightweight slice contract that replaces it, change boundaries,
branch conventions, the three repository-truth verdicts, three verification levels,
named stop points, the standard implementation report, this register, and the art
lane. It routes rather than restates — where it and an owning skill disagree, the
owning skill wins.

Read it after this file and before proposing any work.

Nothing is in progress. The working tree is clean.

## Next exact action

**1. The stale-documentation correction slice.** The workflow audit that produced
PR #14 found four stale or contradicted instructions and deliberately did not fix
them, because the slice was authorised for pointers only. They are listed under
*Known stale documentation* below. One `docs/` slice, no behaviour change.

**2. DISCOVERY — the multi-`useGame` / reward-delivery architecture.** Candidate
correctness risk raised by an independent audit; requires repository/runtime
verification before further Phase 8 expansion. Read-only: evidence and a recommended
boundary. **Do not refactor during the investigation.**

It must prove or disprove, against repository and runtime evidence, each of:

- whether multiple independent `useGame()` instances can consume `RewardEvent`s
  before `RewardAcknowledgement` receives them
- whether `first_measurement`, or any other reward granted away from Today, can be
  granted without ever being acknowledged
- whether cold-load, JSON-import and other-tab reward events are lost to presentation
- whether App-level path and accent state can remain stale after Profile switches path
- whether redundant `syncGame` derivations occur
- what the **smallest** runtime or component test would be that exposes the failure

**3. If the risk is proven** — scope and implement the smallest shared-state or
single-reward-delivery correction, with runtime integration tests. Its own slice. It
touches domain or app architecture, so it needs a specification, not a slice
contract — see the spec rule in `skills/ninfit-delivery-loop/SKILL.md` §4.

**4. If the risk is disproven** — record the evidence here, reduce the register entry
back to the known cold-load caveat, and return to Phase 8 sequencing.

**5. Phase 8.2 — Inspirational Reinforcement** is investigated and scoped only once
this correctness question is settled. `docs/ROADMAP.md` PHASE 8A — INSPIRATIONAL
QUOTE SYSTEM remains the product direction.

## Locked decisions relevant right now

Only the subset that bears on the work in hand. The full set lives in
`docs/DECISIONS.md`, and the authoritative detail lives in the skills it points at.

- **Fitness is the product; the game is the reinforcement layer.** No game mechanic
  is added to Week or Progress because a phase happens to be about polish.
  → `skills/ninfit-product-principles/SKILL.md`
- **No score, streak, percentage, grade or daily-completion ring**, on any screen.
  → `skills/ninfit-product-guardrails/SKILL.md`
- **Health and body data is information, never a verdict.** Progress states what was
  recorded and never what it means. → `skills/ninfit-fitness-truth/SKILL.md`
- **The Week trail stays secondary to the day records**, carries no mascot marker
  yet, and is `aria-hidden`. → `src/domain/week.ts`, `src/test/week.test.ts`
- **Progress states what was recorded, never what it means.** Trend rows lead with
  the current reading and use no directional wording.
  → `src/test/progressScreen.test.ts`
- **Infrastructure is promoted by evidence, not by checklist.**
  → `skills/production-readiness/SKILL.md`
- **Reward wording belongs to the domain.** Presentation may order, group and style
  `RewardEvent.label`; it may never compose or rewrite it.
  → `docs/product/ninfit-reward-presentation-v1.md`, `src/test/rewardAcknowledgement.test.ts`
- **The delivery loop governs how work is done** — task class, slice size, branch,
  boundary, verification level and stop point are declared before implementation.
  → `skills/ninfit-delivery-loop/SKILL.md`

## Parked work — do not merge

Both of these are **local-only branches on the original working machine**. They are
not on `origin`, so a fresh clone will not see them at all. Do not recreate,
cherry-pick or merge either without explicit authorisation.

| Branch | SHA | Why it is parked |
|---|---|---|
| `preserve/journey-home-mobile-background-v1` | `c984009dd437694b4459b1f4f48b7a449e88d2bc` | Journey Home mobile scenery prototype, deliberately preserved for reference only |
| `future/ornate-mystery-egg-v1` | `25dcfad80fbe6a189c0627443d2502dbbc851f5e` | Ornate Mystery Egg production art; the chroma-key route failed and the hybrid route is unfinished |

## Known follow-up

The parked-work register. Everything here has been seen, judged and deliberately not
done. **Being listed here is not authorisation** — it is the record that it was
considered. Nothing is fixed inside an unrelated slice; when one of these becomes
authorised work it moves to `docs/ROADMAP.md` and leaves this list.

### Reward and game infrastructure

Absorbed from `docs/product/ninfit-reward-presentation-v1.md` §22 now that Phase 8.1
is merged. That section stays as the record of what the slice knowingly excluded;
this is the live list.

#### Multi-`useGame` shared-state architecture — CANDIDATE CURRENT CORRECTNESS RISK

**Candidate correctness risk raised by an independent audit; requires
repository/runtime verification before further Phase 8 expansion.** The audit's
technical claims are recorded here as claims. **They have not been independently
verified and are not repository truth yet.** Verifying them is *Next exact action*
step 2, and that step is investigation, not authorisation to change anything.

*Established from the repository:* `useGame()` is instantiated independently at four
sites. On a cold load carrying unsynced rewards — after a JSON import, or logs changed
in another tab — `App.tsx` mounts first, grants and persists them, and Today's later
sync returns `granted: []`. Phase 8.1 guarantees the normal in-session completion path
only. This much was already recorded before the audit.

*Claimed by the audit, unverified:* that because granting is idempotent and persisted
on first sync, the loss may be broader than the cold-load case already described; and
that the same independent-state architecture may leave App-level path and accent state
stale after Profile switches path.

This is the same issue as the previously parked cold-sync race, **elevated rather than
duplicated**. The remedy, if the risk is proven, is a single shared game context
across App, Today and Profile — an architecture slice with its own specification.

| Item | Detail |
|---|---|
| `recentEvents` persisted but unread | `GameState.recentEvents` is written and capped at 20, typed "used only to show what just happened", and read by nothing. It is the natural foundation for a durable reward queue that would also fix the race above. |
| Level-up has no `RewardKind` | Derived from XP totals, so it is not a discrete event. The bar simply moves. Presenting a level-up requires a domain change. |
| PB engine absent | No PB type, key, field or UI exists anywhere. Roadmap Phase 18. |
| Sound and haptics unwired | `soundEnabled` and `hapticsEnabled` persist and default `false`; nothing reads either, and there is no `navigator.vibrate` in the codebase. |
| Cinematic reward presentation | Hatch, evolution, Champion, gold/platinum trophy, Secret Prestige. `--ft-motion-cinematic` remains unused. Later Phase 8 slices, most blocked on mascot art. |
| Progress trophy/PB tension | `docs/ROADMAP.md` PHASE 7 lists "recent trophies" and a "PB area" under Progress; Phase 7B deliberately kept the game layer off that screen. **Unresolved, not settled.** Raise it rather than assuming either way. |

### Test coverage shape

Raised as a broader QA concern by the same independent audit, and recorded here
without overclaiming. It is an observation about the *shape* of the coverage, not a
defect count, and it authorises nothing.

The suite is strong where it is strong: **43 files / 1267 tests**, with deep
pure-domain coverage and extensive source-contract assertions. **Runtime component and
integration coverage is limited** — which is precisely the layer at which a
reward-delivery failure would appear.

Verified from the repository, so this part is not an audit claim:

- `vite.config.ts` sets `environment: 'node'`, on the stated reasoning that the domain
  layer is pure TypeScript.
- `include` is `src/test/**/*.test.ts`, so a `.tsx` test file would not be collected.
- There is no `jsdom`, `happy-dom` or `@testing-library/*` dependency, and no test
  imports `react-dom`, `createRoot`, `renderToString` or `renderHook`.
- **No component in this repository is ever rendered by the test suite.**
  `RewardAcknowledgement` is covered by source-scanning plus its exported pure
  functions; its `useEffect` delivery behaviour is never executed.

Consequence for step 2: the discovery must determine the **smallest** runtime test
layer that would prove reward-delivery behaviour, knowing that any such layer needs a
DOM environment and a renderer — that is, package changes. **No testing framework is
to be chosen, added or configured before that investigation reports.**

### Data safety — pilot blockers

From `docs/production-readiness.md`. Each is `NOW / BLOCKER BEFORE PILOT`.

| Item | Detail |
|---|---|
| Schema N → N+1 migration never exercised | `SCHEMA_VERSION` is 1 and `SUPPORTED_SCHEMA_VERSIONS` is `[1]`, so the migration path has never run in the wild. Rehearse it before real history depends on it. |
| Real-history restore rehearsal | Export/import is the only backup route and **restore has never been rehearsed** against real history. |
| Browser quota and recovery | A quota or write failure mid-replace is not transactional in browser storage. Corrupt-state quarantine exists; interrupted-import and quota behaviour has no accepted answer. |
| Delete-all | `src/ui/screens/DataScreen.tsx` offers export, CSV and import-replaces, but no in-app "delete everything". Deletion currently relies on the browser. Local privacy, deletion and device-loss behaviour needs a stated, accepted answer. |

### Gaps found while reading the code

| Item | Detail |
|---|---|
| Supabase password recovery | `src/data/supabase/auth.ts` has `resendConfirmation` but no password-reset function. Needed before accounts are promoted publicly. |
| `Section` / `h2` semantics | `Section` renders its title as a `<span>` inside a `<button>`, so no screen has an `h2`. Fixing it means changing `src/ui/components/Field.tsx` for every screen. |
| Sparkline distortion | `Sparkline` uses `preserveAspectRatio="none"`, so the same series looks steeper at 360px than at 1024px. Values and gaps stay correct. |

### Art lane — parked

Art is a separate lane and never rides along in a product slice — see
`skills/ninfit-delivery-loop/SKILL.md` §11 and `skills/ninfit-visual-asset-pipeline/SKILL.md`.
**Missing production art must not block infrastructure that can use a placeholder.**

Repository evidence: `public/` contains backgrounds, icons and intro media only. No
mascot or trophy production asset is in the repository. `docs/brand/reference/`
holds reference PNGs, which are source material, not canonical assets. `EggArt` is
code-drawn and `family.glyph` is a single letter; both are marked temporary and are
to be replaced, not refined.

| Item | State |
|---|---|
| Tortoise family production assets | Starter, Growing, Active and Athletic produced; **Champion not yet produced**. Reported by the product thread; not yet in the repository. |
| Other four mascot families | Not produced. Prove one family end to end before generating the rest. |
| Mystery Egg pipeline | Generation and extraction partly proven. `future/ornate-mystery-egg-v1` holds the unfinished hybrid route. |
| Transparent hatch-wave video | Image-to-video and the transparent WebM pipeline are both technically proven; the current source is unusable because a watermark crosses the moving hand. Reported by the product thread. |
| Trophy production assets | A reference collection exists (`docs/brand/reference/ninfit-trophy-collection-reference-v1.png`); individual canonical assets are not complete. |

### Product decisions pending

Raised but **not locked**. `docs/DECISIONS.md` records these only once they are
decided; recording them here does not settle them.

| Item | Detail |
|---|---|
| Swimming as a roadmap addition | `swimming` already exists as a preferred activity in `src/domain/game/onboarding.ts`, but there is no swimming path or roadmap phase. Adding a sixth **path** would be a locked-set change — see `docs/DECISIONS.md`, mascot family and hatch identity. |
| Worldwide / travel mascot discovery | Proposed. No roadmap phase, no repository evidence. |
| Challenge-exclusive flex mascots | Proposed. No roadmap phase, no repository evidence. |
| Never-purchasable rule for challenge and world mascots | Proposed as a rule. It is consistent with the locked "prestige is earned, never purchased" direction but is **not itself locked** and does not appear in `docs/DECISIONS.md`. |

## Do not accidentally reopen

Recently settled. Re-litigating any of these wastes a slice.

- **Opal does not replace the Mystery Egg.** They are separate systems and the
  compiler enforces it (`CompanionId` and `MascotFamilyId` share no members).
- **The egg hatches at the end of onboarding**, on an explicit "Start my journey"
  action — not after six qualifying activity days.
- **A hatched companion's species is permanent.** A later path change moves the
  programme only.
- **No daily completion score on Today.** The "N of M sections recorded" footer was
  removed deliberately.
- **Line endings are LF**, enforced by `.gitattributes`. Do not renormalise files.
- **Progress carries no game layer** — no XP panel, trophy carousel or streak banner.
  The roadmap tension above is unresolved, not settled. Raise it rather than assuming.
- **Reward acknowledgement is not a dialog.** It sits in Today's normal flow, takes no
  focus, blocks nothing and covers nothing. An overlay was considered and rejected.
- **`.xpfloat` is retired, not renamed.** It is gone from source and CSS, and a test
  keeps it gone.
- **The reward tier map lives in the presentation layer.** The reward domain must not
  know that motion exists.

## Known stale documentation

Found by the workflow audit behind PR #14 and **deliberately not fixed there** — that
slice was authorised for pointers only. This is the correction slice named as the next
exact action. Repository truth wins over every line below.

| Where | What is stale |
|---|---|
| `skills/ninfit-repository-workflow/SKILL.md` | "Current known issue" describes the repository-wide CRLF churn as present. It was fixed by `.gitattributes`; the Windows working tree now reports **zero** modified files. The section is history, not a live warning. |
| `skills/ninfit-repository-workflow/SKILL.md` | Preflight tells the reader to read `AGENTS.md`. **That file does not exist.** |
| `skills/ninfit-deployment-health/SKILL.md` | States that `index.html` declares only `apple-mobile-web-app-capable` and that adding the standard tag is outstanding. `index.html` line 26 already declares `mobile-web-app-capable`, and `docs/ROADMAP.md` records it resolved on 20 August. |
| `skills/ninfit-ui-verification/SKILL.md` | Its verification sequence uses `npx tsc --noEmit` where every other document uses `npm run typecheck`. Worth noting that `npm run build` already runs `tsc --noEmit` first, so a green build subsumes typecheck. |

One genuine repository issue remains, recorded in the roadmap's own housekeeping list:
`docs/ROADMAP.md` is still stored with **mixed line endings** — `git ls-files --eol`
reports `i/mixed` for it and `i/lf` for every other document, despite
`.gitattributes` declaring `* text=auto eol=lf`. Renormalise it on its own commit,
never inside a content change, or the real edit disappears into three thousand lines
of line-ending churn.

Two working-tree files (`src/styles/components/backdrop.css`,
`src/ui/components/PageBackdrop.tsx`) still hold CRLF on disk and emit a "CRLF will be
replaced by LF" warning on `git diff`. They report clean because Git normalises on
read. Harmless; noted so it is not re-diagnosed.

Read ROADMAP for *what to build*. Read this file for *where things stand*. Read
`skills/ninfit-delivery-loop/SKILL.md` for *how work is done*.
