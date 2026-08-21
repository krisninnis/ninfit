# NinFit Current State

A short live checkpoint, for a human or an agent picking the project up cold.

**This file goes stale by design.** It is a snapshot written at a moment; the
repository keeps moving. Live Git always outranks it. If they disagree, believe Git,
say so, and update this file — see `skills/ninfit-handoff/SKILL.md`.

Last updated: **2026-08-21**

## Repository truth

| | |
|---|---|
| Remote | `https://github.com/krisninnis/ninfit.git` |
| `main` at last update | `0c5dc7e09ad3eaca3aeb9534416f3682c503a86f` |
| Latest merged PR | **#9** — Weight the Data screen by consequence (`305f0f1`) |
| Test baseline on `main` | **42 files / 1227 tests**, `npm run typecheck` exit 0, `npm run build` exit 0 |
| Node | `24.x` (`package.json` `engines`) |
| Deployment | Not established from the repository. No CI configuration, no `vercel.json`, no Dockerfile; `.vercel` is gitignored. Treat as INVESTIGATE — see `docs/production-readiness.md`. |

Verify all of the above before acting. The commands are in the handoff skill.

## Completed

Merged into `main`, most recent first:

| PR | Merge | What landed |
|---|---|---|
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

**PHASE 7 IS COMPLETE.** All four screens are merged:

| Slice | Screen | State |
|---|---|---|
| 7A | Week | complete — seven-day journey trail |
| 7B | Progress | complete — trend rows lead with the current reading |
| 7C | Profile | complete — section hierarchy |
| 7D | Data | complete — weight follows consequence |

What Phase 7D changed, for anyone reading the Data screen next: the full JSON backup
is now the single primary action; the CSV export and the entry to restore are both
secondary; the restore confirmation keeps its attention styling; a device that has
never been backed up says so with an attention chip; and the storage and privacy
block moved below the actions and now states the boundary accurately — fitness
records are local and are **not synced to a NinFit ID or to the cloud**, and a NinFit
ID is for sign-in only.

**No underlying behaviour changed in any of the four slices.** Export, import,
replace-not-merge, the mandatory pre-import backup, schema handling, provenance,
quarantine, the repository and auth are all untouched.

Nothing is in progress. The working tree is clean and `main` is synced.

## Next exact action

**Read the next roadmap phase and scope its first bounded slice before writing any
code.** `docs/ROADMAP.md` PHASE 8 — REWARD PRESENTATION + MOTION is next in
sequence, and it is the first phase in a while that touches the game layer, so the
scoping step matters more than usual.

Investigate first, propose a slice, implement only once the brief is authorised —
the shape that produced 7A through 7D.

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

## Parked work — do not merge

Both of these are **local-only branches on the original working machine**. They are
not on `origin`, so a fresh clone will not see them at all. Do not recreate,
cherry-pick or merge either without explicit authorisation.

| Branch | SHA | Why it is parked |
|---|---|---|
| `preserve/journey-home-mobile-background-v1` | `c984009dd437694b4459b1f4f48b7a449e88d2bc` | Journey Home mobile scenery prototype, deliberately preserved for reference only |
| `future/ornate-mystery-egg-v1` | `25dcfad80fbe6a189c0627443d2502dbbc851f5e` | Ornate Mystery Egg production art; the chroma-key route failed and the hybrid route is unfinished |

## Known follow-up

Carried forward so it survives a change of thread. Each is supported by repository
evidence; none is authorised work.

**Pilot blockers** (from `docs/production-readiness.md`)

- `SCHEMA_VERSION` is 1 and `SUPPORTED_SCHEMA_VERSIONS` is `[1]`, so the migration
  path has never run in the wild. Exercise it before real history depends on it.
- Export/import is the only backup route. **Restore has not been rehearsed.**
- Local privacy, deletion and device-loss behaviour needs a stated, accepted answer.

**Gaps found while reading the code, not yet raised as work**

- `src/data/supabase/auth.ts` has no password-recovery function. `resendConfirmation`
  exists; reset does not. Needed before accounts are promoted publicly.
- `src/ui/screens/DataScreen.tsx` offers export, CSV and import-replaces, but no
  in-app "delete everything" control. Deletion relies on the browser.
- `Section` renders its title as a `<span>` inside a `<button>`, so no screen has an
  `h2`. Fixing it means changing `src/ui/components/Field.tsx` for every screen.
- `Sparkline` uses `preserveAspectRatio="none"`, so the same series looks steeper at
  360px than at 1024px. Values and gaps stay correct.

**Product**

- Mascot artwork pipeline is unproven end to end. Placeholder art in the codebase is
  marked temporary on purpose. → `skills/ninfit-visual-asset-pipeline/SKILL.md`

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
  Note the tension: `docs/ROADMAP.md` PHASE 7 lists "recent trophies" and a "PB area"
  under Progress. That is unresolved, not settled. Raise it rather than assuming.

## Known stale documentation

`docs/ROADMAP.md` remains the canonical product plan, and it points here for live
status rather than naming a branch that moves.

Its `PHASE 7` status line now lags again: it reads `ACTIVE - WEEK (7A) AND PROGRESS
(7B) MERGED; PROFILE AND DATA REMAIN`, which was true when it was written and is not
now. Phase 7 is complete. Correct it on its own documentation commit rather than
inside other work.

One genuine issue remains, recorded in the roadmap's own housekeeping list:
`docs/ROADMAP.md` is stored with **mixed line endings** — `git ls-files --eol`
reports `i/mixed` for it and `i/lf` for every other document. Renormalise it on its
own commit, never inside a content change, or the real edit disappears into three
thousand lines of line-ending churn.

Read ROADMAP for *what to build*. Read this file for *where things stand*.
