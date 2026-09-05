# M3 offline cold start — defect record

Status: **evidence record. Not an acceptance pass.**

This file exists because one set of real-device observations was being explained by
one theory, and the source does not support that. The observations are correct. The
single-cause explanation was not. Recording them apart keeps the H-F re-test honest:
each defect has to be proved fixed in its own way, and one of them cannot be seen
offline at all.

---

## 1. Observed facts — real Android session

Recorded as observed. Nothing here is inferred, and nothing here is revised.

| # | Observation |
|---|---|
| 1 | The React application shell booted offline. |
| 2 | Existing local state survived and rendered. |
| 3 | Today rendered. |
| 4 | Week rendered. |
| 5 | Progress rendered. |
| 6 | Settings rendered. |
| 7 | Journey rendered, but stable public artwork failed: Walk/Run, Cycle, Swim, and mascot/public artwork. |
| 8 | A large mascot image was also observed broken. |
| 9 | Profile produced the NinFit error boundary: "This screen couldn't open" / "Your data has not been changed." / "You can use another tab and try this screen again." |
| 10 | **Profile failed both ONLINE and OFFLINE in the affected running build.** |

Observation 10 is the one that decides this document. A hashed chunk that a
deployment still serves cannot fail while online. Whatever broke Profile online was
present regardless of the network, so at least one cause is not a caching problem.

---

## 2. Defect A — Profile crashes when NinFit ID is not configured

**Class:** optional-dependency crash. Nothing to do with the service worker.

**Immediate cause.** `AccountSection` calls `onAuthStateChange()` from
`src/data/supabase/auth.ts` inside a `useEffect`. That function calls
`configuredSupabase()`, which **throws synchronously** — `NinFit ID is not configured
in this build.` — whenever `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` are
absent. A synchronous throw inside an effect is a render-phase failure, so Profile
goes to the nearest error boundary. `getSession()` fails the same way, but being a
promise it was already caught.

**Why it matched observation 10.** Configuration is baked in at build time. A build
without those variables fails Profile on every launch, online and offline alike.

**Severity on canonical `main`.** Worse than the Android session showed. On `main` at
`cca5493` there is no error boundary anywhere, so the throw unmounts the React root:
`document.body.innerText.length === 0`, and Settings, Data, Account and Passport then
render nothing for the rest of the session. Reproduced in a browser against a
production build of `main`.

**Scope.** Production is configured, so production is not affected today. Deployments
without the variables — preview deployments among them, which is where device
acceptance is run — are.

**Fix.** `isSupabaseConfigured` is checked before any auth wiring starts, the
subscription call is wrapped in a synchronous guard, and an honest local-only account
state renders instead. Covered by `src/test/profileOptionalAccount.test.ts`.

**How to prove it in H-F.** Open Profile **while online** on the candidate build. If
Profile renders online, defect A is fixed. Offline behaviour proves nothing about it.

---

## 3. Defect B — a deployment update can strand the document that is already running

**Class:** service-worker cache-generation defect. Independent of defect A.

**Immediate cause.** `skipWaiting()` plus `clients.claim()` hand a document that is
still executing the previous build to the new worker. The activate handler deleted
every cache whose key was not the current `CACHE_VERSION`. The old document then asks
for one of its own hashed lazy chunks; the cache that held it is gone, the deployment
alias has moved, and the request 404s. `React.lazy` rejects and the screen fails.

The earlier fix retained superseded chunks *inside* one cache version. That is real
and still holds, but it was scoped to a single version, so it survived only until the
next `CACHE_VERSION` bump — which is exactly the deployment that would have carried
it.

**Reproduced**, in a browser, against two real production builds behind a switchable
origin: document running build 1; alias moved to build 2 with the cache version
bumped; `registration.update()` fired, as the app itself does on load, on
`visibilitychange` and on `online`. Result: `AccountSection-KPPxUx32.js` **404**,
`Failed to fetch dynamically imported module`, error boundary. After the fix, the same
scenario serves that chunk **200** from the retained previous generation.

**Reach.** Not Profile-only. There are six lazy imports: `AccountSection`,
`NinFitIdAuth`, `ActiveJourneyMap` (twice) and `JourneyRouteMap` (twice). Five of them
sat on screens with no error boundary at all, so the same 404 there unmounted the whole
application rather than one screen.

**Fix.** Cache **generations**: activation keeps the current generation and the one a
live client may still be executing, and removes older ones. Pruning inside a generation
keeps the current and previous build's assets and drops the rest, so the cache stays
bounded. `ScreenErrorBoundary` now wraps the whole route switch, and a
`RegionErrorBoundary` sits at every lazy call site.

**How to prove it in H-F/H-J.** Install build A, use it, deploy build B, reopen, and
open a lazy screen — Profile, an active Journey, a saved Journey, the Postcard. Also
confirm a build-A document already open is not broken by build B activating.

---

## 4. Defect C — offline cold start could serve the previous build's root

Found while walking install → activate → fetch in sequence rather than testing each
handler alone.

`caches.match('/')` with no cache name searches every cache in creation order. The
moment a second generation exists — which is the point of the defect B fix — the
**older** root wins, so an offline cold start would keep booting the previous build for
as long as that generation is retained. A root and its exact hashed set are cached
together precisely so the pair stays coherent; choosing the root from one generation
while subresources resolve across all of them is how an old root ends up asking for
assets from a build it was never part of.

**Measured directly in Chromium** with both generations present:

```
caches.keys()                    -> ["ninfit-shell-v3", "ninfit-shell-v4"]
open("ninfit-shell-v3").match("/") -> root referencing assets/index-BmH_EGwk.js   (old build)
open("ninfit-shell-v4").match("/") -> root referencing assets/index-B5wATWG1.js   (new build)
caches.match("/")                -> root referencing assets/index-BmH_EGwk.js     (OLD)
```

**Reproduced end to end**, by installing build A, updating to build B, then making the
origin refuse connections so the worker's own `fetch` throws and the offline fallback
is the only path left:

| Worker | Offline cold start after the update served |
|---|---|
| before the fix | `assets/index-BmH_EGwk.js` — **the previous build** |
| after the fix | `assets/index-B5wATWG1.js` — the current build |

This matters for H-F itself: without the fix, a tester who updated and then went into
airplane mode would have been looking at the *previous* build and reporting on it.

The offline root is now resolved from the current generation first, with a
cross-generation fallback kept second, because an older but complete build still beats
no application at all.

---

## 5. Defect D — stable artwork was absent from the offline set

This is the one that observations 7 and 8 record directly, and the only defect the
Android session could see offline.

Artwork under `/mascots/` and `/egg/` was not part of the generated offline asset
manifest, so it was never precached and could not resolve offline. The manifest now
covers app-owned stable artwork alongside Vite's hashed `/assets/`.

Verified in a browser: offline cold start after one online launch renders Today, Week,
Journey, Progress, Profile, Settings and Data with **zero broken images and zero failed
requests**.

The manifest also excludes non-runtime files. `public/mascots/README.md` and
`.gitkeep` were being precached onto every device as though they were artwork.

---

## 6. What each defect means for the acceptance matrix

| Defect | Visible offline? | Visible online? | Proved fixed by |
|---|---|---|---|
| A — NinFit ID configuration crash | yes | **yes** | opening Profile online |
| B — update strands the running document | yes | yes | install A, update to B, open a lazy screen |
| C — stale offline root | **yes only** | no | offline cold start showing the new build after an update |
| D — stable artwork not precached | **yes only** | no | offline cold start with all Journey and mascot art present |

A single airplane-mode launch does not cover A or B. H-F and H-J have to be run
together, in one session, in this order: online first, then update, then offline.

## 7. Status

H-F: **NOT PASS.** Android must be re-run on the final build — the worker, the error
boundaries and the offline manifest have all changed since the session above.

H-J: **NOT RUN.**

iPhone: **NOT RUN**, for either gate.

Automated verification is not evidence for any of these rows. See
`docs/pilot/device-accessibility-acceptance-matrix-v1.md`.
