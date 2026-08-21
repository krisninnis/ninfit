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
| `main` at last update | `09fff703f7cdc84d19f64d8230e98343e9770f84` |
| Latest merged PR | **#5** — `phase7b/progress-polish-v1` (`363f914`) |
| Test baseline on `main` | **42 files / 1219 tests**, `npm run typecheck` exit 0, `npm run build` exit 0 |
| Node | `24.x` (`package.json` `engines`) |
| Deployment | Not established from the repository. No CI configuration, no `vercel.json`, no Dockerfile; `.vercel` is gitignored. Treat as INVESTIGATE — see `docs/production-readiness.md`. |

Verify all of the above before acting. The commands are in the handoff skill.

## Completed

Merged into `main`, most recent first:

| PR | Merge | What landed |
|---|---|---|
| #5 | `09fff70` | **Phase 7B** — Progress polish: trend rows lead with the current reading (`363f914`) |
| #4 | `358211f` | Production-readiness review framework (`skills/production-readiness/`) and the NinFit profile (`docs/production-readiness.md`) |
| #3 | `eb4d811` | **Phase 7A** — Week seven-day journey trail (`04edbd4`) |
| #2 | `5456d13` | **Phase 6** — Today/Home redesign and the onboarding hatch journey (`0da5a61`, `52ef954`, `7f70fec`, `001a109`) |
| #1 | `54dc070` | NinFit world, account journey, 17 background regions, production background assets |

## Current work

**Phase 7 — remaining screens.** Week (7A) and Progress (7B) are merged. What is
left in `docs/ROADMAP.md` PHASE 7 is **Profile** and **Data**:

- **Profile** — the roadmap specifies the order: You, Your Programme, Where You
  Started, Your Notes, Game, Settings.
- **Data** — "calm and trustworthy": backup, import, privacy, provenance, data
  durability. Explicitly *avoid unnecessary game decoration*.

Nothing is in progress. The working tree is clean and `main` is synced.

## Next exact action

**Scope the next Phase 7 slice — Profile polish — as an investigation first**, the
same shape as 7A and 7B: read the roadmap section and the current screen, propose a
small hierarchy change, then implement only if the brief is authorised.

Data polish is the alternative if Profile is deferred. Do not start both.

## Locked decisions relevant right now

Only the subset that bears on Phase 7. The full set lives in `docs/DECISIONS.md`,
and the authoritative detail lives in the skills it points at.

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

`docs/ROADMAP.md` remains the canonical product plan, but its status lines lag:

- `CURRENT REPOSITORY STATUS` still names `54dc070` / PR #1 as the merged foundation
  and `phase6/today-home-redesign-v1` as the current branch. Four PRs have merged.
- `PHASE 6` is marked `STATUS: ACTIVE CURRENT WORKSTREAM`. It is merged.
- `PHASE 7` is marked `STATUS: FUTURE`. 7A is merged and 7B is implemented.

Read ROADMAP for *what to build*. Read this file for *where things stand*.
